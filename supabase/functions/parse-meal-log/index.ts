// =====================================================================================
// FAMILY APP — SUPABASE EDGE FUNCTION: parse-meal-log v7 (Phase 6 vessel pipeline)
// File: supabase/functions/parse-meal-log/index.ts
//
// CONTRACT (replaces v6's free-text + AI guess flow):
//
//   Request:  { items_text: string, user_id: uuid }
//
//   Response (200): {
//     dishes: [
//       {
//         dish_name, dish_normalized,
//         default_vessel, vessel_grams,
//         protein_per_gram, carbs_per_gram, fat_per_gram, calories_per_gram,
//         restaurant_fat_multiplier,
//         nutrition_source: 'curated' | 'ai_estimate',
//         user_default_quantity, user_default_unit, user_default_cooking_style,  // null if first time
//       }, ...
//     ],
//     parse_method: 'claude_haiku',
//     raw_text: string,
//   }
//
//   Errors:
//     400 { error: 'invalid_input', detail }    — missing/invalid items_text or user_id
//     422 { error: 'parse_failed', raw, detail } — Claude returned malformed JSON
//     500 { error: 'server_error', detail }     — anything else
//
// FLOW
//   1. Validate items_text non-empty, user_id is UUID.
//   2. Claude Haiku parses items_text → dish list ({dish_name, dish_normalized, guessed_category}).
//   3. Single batch lookup: food_vessels.in('dish_normalized', keys).
//   4. Single batch lookup: user_dish_portions for (user_id, [dish_normalized…]).
//   5. For dishes that hit food_vessels: nutrition_source='curated'.
//   6. For dishes that miss: per-dish Claude Haiku estimate call (HOME-COOKED, ICMR-NIN style).
//      Set restaurant_fat_multiplier=1.30 constant. nutrition_source='ai_estimate'.
//   7. If estimate call fails: safe fallback (katori, 150g, generic Indian-curry-average macros).
//   8. Attach user portion memory (else nulls).
//   9. Return assembled response. NO DB WRITES — caller owns the meals insert + the
//      post-save call to update-portion-memory.
//
// AI-estimated rows are NOT inserted into food_vessels. Curating happens manually.
//
// Anthropic key env var: ANTHROPIC_API_KEY (existing — unchanged).
// =====================================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const CLAUDE_TIMEOUT_MS = 10_000

// Safe fallback when both Claude calls fail — generic Indian curry-average values.
// Better to log something than fail entirely.
const SAFE_FALLBACK = {
  default_vessel: 'katori',
  vessel_grams: 150,
  protein_per_gram: 0.05,
  carbs_per_gram: 0.12,
  fat_per_gram: 0.04,
  calories_per_gram: 1.20,
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PARSE_SYSTEM_PROMPT = `You parse free-text Indian meal descriptions into structured dishes. Always split compound meals into separate dishes (e.g. 'rajma chawal' = two dishes: rajma + chawal). Use simple lowercase Hindi/English names for dish_normalized (snake_case, no spaces, no special characters). The category must be one of: curry, rice, bread, snack, sweet, drink, dal, sabzi, dairy, fruit, other.

Return ONLY the JSON array. No prose, no markdown fences, no explanation.

Examples:
'2 rotis, dal, sabzi' → [{"dish_name":"Roti","dish_normalized":"roti","guessed_category":"bread"},{"dish_name":"Dal","dish_normalized":"dal","guessed_category":"dal"},{"dish_name":"Sabzi","dish_normalized":"sabzi","guessed_category":"sabzi"}]
'rajma chawal' → [{"dish_name":"Rajma","dish_normalized":"rajma","guessed_category":"curry"},{"dish_name":"Chawal","dish_normalized":"chawal","guessed_category":"rice"}]
'masala dosa with sambhar' → [{"dish_name":"Masala Dosa","dish_normalized":"masala_dosa","guessed_category":"snack"},{"dish_name":"Sambhar","dish_normalized":"sambhar","guessed_category":"curry"}]`

const ESTIMATE_SYSTEM_PROMPT = `You estimate nutrition for Indian dishes when our curated table doesn't have them. Return ONLY a JSON object — no prose, no markdown fences. Use ICMR-NIN style values for typical HOME-COOKED Indian preparation. default_vessel must be one of: katori, plate, piece, glass, spoon.`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const body = await req.json().catch(() => ({}))
    const { items_text, user_id } = body as { items_text?: string; user_id?: string }

    if (!items_text || typeof items_text !== 'string' || !items_text.trim()) {
      return jsonResp(400, { error: 'invalid_input', detail: 'items_text is required' })
    }
    if (!user_id || !UUID_RE.test(String(user_id))) {
      return jsonResp(400, { error: 'invalid_input', detail: 'user_id must be a UUID' })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_API_KEY) {
      return jsonResp(500, { error: 'server_misconfigured', detail: 'missing ANTHROPIC_API_KEY' })
    }

    // ── Step 1: Claude Haiku parses free-text into structured dish list ────────
    let parsedDishes: Array<{ dish_name: string; dish_normalized: string; guessed_category?: string }>
    let rawClaudeText = ''
    try {
      rawClaudeText = await callClaude(ANTHROPIC_API_KEY, PARSE_SYSTEM_PROMPT, items_text.trim())
      parsedDishes = parseDishListJSON(rawClaudeText)
    } catch (err) {
      return jsonResp(422, { error: 'parse_failed', raw: rawClaudeText, detail: String(err) })
    }
    if (!Array.isArray(parsedDishes) || parsedDishes.length === 0) {
      return jsonResp(422, { error: 'parse_failed', raw: rawClaudeText, detail: 'empty dish list' })
    }

    // ── Step 2: Batch lookup against food_vessels ─────────────────────────────
    const normalizedKeys = parsedDishes
      .map((d) => String(d.dish_normalized || '').trim())
      .filter(Boolean)
    const { data: vesselRows } = await supabase
      .from('food_vessels')
      .select(
        'dish_name, dish_normalized, default_vessel, vessel_grams, protein_per_gram, carbs_per_gram, fat_per_gram, calories_per_gram, restaurant_fat_multiplier, category'
      )
      .in('dish_normalized', normalizedKeys)
    const vesselByKey: Record<string, any> = {}
    ;(vesselRows || []).forEach((row: any) => {
      vesselByKey[row.dish_normalized] = row
    })

    // ── Step 3: Batch lookup against user_dish_portions ────────────────────────
    const { data: portionRows } = await supabase
      .from('user_dish_portions')
      .select('dish_normalized, last_quantity, last_unit, last_cooking_style')
      .eq('user_id', user_id)
      .in('dish_normalized', normalizedKeys)
    const portionByKey: Record<string, any> = {}
    ;(portionRows || []).forEach((row: any) => {
      portionByKey[row.dish_normalized] = row
    })

    // ── Step 4: Assemble response (with AI-estimate fallback for misses) ───────
    const dishes = []
    for (const parsed of parsedDishes) {
      const key = String(parsed.dish_normalized || '').trim()
      if (!key) continue

      let nutrition = vesselByKey[key]
      let nutritionSource: 'curated' | 'ai_estimate' = 'curated'

      if (!nutrition) {
        nutritionSource = 'ai_estimate'
        try {
          const estimated = await estimateNutritionViaClaude(
            ANTHROPIC_API_KEY,
            parsed.dish_name || key,
            parsed.guessed_category || 'other'
          )
          nutrition = { ...estimated, restaurant_fat_multiplier: 1.30 }
        } catch {
          // Both calls failed (or estimate timed out). Use safe defaults so the user
          // can still log the meal — losing precision is better than losing the entry.
          nutrition = { ...SAFE_FALLBACK, restaurant_fat_multiplier: 1.30 }
        }
      }

      const portion = portionByKey[key]
      dishes.push({
        dish_name: nutrition.dish_name || parsed.dish_name || key,
        dish_normalized: key,
        default_vessel: nutrition.default_vessel,
        vessel_grams: Number(nutrition.vessel_grams),
        protein_per_gram: Number(nutrition.protein_per_gram),
        carbs_per_gram: Number(nutrition.carbs_per_gram),
        fat_per_gram: Number(nutrition.fat_per_gram),
        calories_per_gram: Number(nutrition.calories_per_gram),
        restaurant_fat_multiplier: Number(nutrition.restaurant_fat_multiplier ?? 1.30),
        nutrition_source: nutritionSource,
        user_default_quantity: portion ? Number(portion.last_quantity) : null,
        user_default_unit: portion ? portion.last_unit : null,
        user_default_cooking_style: portion ? portion.last_cooking_style : null,
      })
    }

    return jsonResp(200, {
      dishes,
      parse_method: 'claude_haiku',
      raw_text: items_text,
    })
  } catch (err: any) {
    console.error('parse-meal-log error:', err)
    return jsonResp(500, { error: 'server_error', detail: String(err?.message || err) })
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonResp(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function callClaude(apiKey: string, system: string, userContent: string): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), CLAUDE_TIMEOUT_MS)
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 800,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    if (!r.ok) throw new Error(`Claude ${r.status}`)
    const data = await r.json()
    return String(data?.content?.[0]?.text || '').trim()
  } finally {
    clearTimeout(timer)
  }
}

function parseDishListJSON(text: string): Array<any> {
  // Tolerate Claude wrapping output in ```json fences or stray prose by extracting
  // the first balanced [...] array.
  const direct = safeParse(text)
  if (Array.isArray(direct)) return direct
  const m = text.match(/\[[\s\S]*\]/)
  if (m) {
    const arr = safeParse(m[0])
    if (Array.isArray(arr)) return arr
  }
  throw new Error('claude returned non-array JSON')
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

async function estimateNutritionViaClaude(
  apiKey: string,
  dishName: string,
  guessedCategory: string,
): Promise<{
  default_vessel: string
  vessel_grams: number
  protein_per_gram: number
  carbs_per_gram: number
  fat_per_gram: number
  calories_per_gram: number
  dish_name?: string
}> {
  const user = `Estimate nutrition for: ${dishName} (one ${guessedCategory}). Return JSON: {"default_vessel": "katori|plate|piece|glass|spoon", "vessel_grams": <number>, "protein_per_gram": <number>, "carbs_per_gram": <number>, "fat_per_gram": <number>, "calories_per_gram": <number>}`
  const text = await callClaude(apiKey, ESTIMATE_SYSTEM_PROMPT, user)
  const direct = safeParse(text)
  const obj =
    direct && typeof direct === 'object' && !Array.isArray(direct)
      ? direct
      : safeParse((text.match(/\{[\s\S]*\}/) || [])[0] || '')
  if (!obj || typeof obj !== 'object') throw new Error('estimate not JSON object')
  // Validate the shape — coerce numbers, default vessel.
  const allowed = new Set(['katori', 'plate', 'piece', 'glass', 'spoon'])
  const default_vessel = allowed.has(obj.default_vessel) ? obj.default_vessel : 'katori'
  const vessel_grams = numberOr(obj.vessel_grams, SAFE_FALLBACK.vessel_grams)
  const protein_per_gram = numberOr(obj.protein_per_gram, SAFE_FALLBACK.protein_per_gram)
  const carbs_per_gram = numberOr(obj.carbs_per_gram, SAFE_FALLBACK.carbs_per_gram)
  const fat_per_gram = numberOr(obj.fat_per_gram, SAFE_FALLBACK.fat_per_gram)
  const calories_per_gram = numberOr(obj.calories_per_gram, SAFE_FALLBACK.calories_per_gram)
  return {
    default_vessel,
    vessel_grams,
    protein_per_gram,
    carbs_per_gram,
    fat_per_gram,
    calories_per_gram,
  }
}

function numberOr(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}
