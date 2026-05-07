// =====================================================================================
// FAMILY APP — SUPABASE EDGE FUNCTION: update-portion-memory (Phase 6)
// File: supabase/functions/update-portion-memory/index.ts
//
// Called by the client AFTER a meal is successfully saved to remember what THIS user
// typically eats of THIS dish. Pure upsert into user_dish_portions — no return data
// needed by the caller. Designed to be fire-and-forget: failures here MUST NOT block
// the meal save (the client should not await/throw on this).
//
// CONTRACT
//   Request: {
//     user_id: uuid,
//     dishes: [
//       { dish_normalized: string, quantity: number, unit: string, cooking_style: 'home'|'restaurant' },
//       ...
//     ]
//   }
//   Response: { updated: <number_of_dishes_processed> }
//   Errors:   400 invalid_input | 500 server_error
//
// BEHAVIOR
//   For each dish: calls public.upsert_user_dish_portion(...) — a SQL function defined
//   in supabase/migrations/phase6_vessel_meals.sql that does atomic "insert or bump":
//     INSERT new row with log_count=1, OR ON CONFLICT bump log_count by 1 and overwrite
//     last_quantity/unit/cooking_style/last_logged_at.
//   One round trip per dish, no read-then-write race.
//
// AUTH NOTE
//   Uses service-role to call the RPC (the RPC is `security definer`). The user_id is
//   taken from the request body — the client must send the authenticated user's id.
//   If you ever expose this beyond the app's own client, swap to user-JWT and let the
//   RPC's internal checks (or RLS) enforce ownership.
// =====================================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_COOKING = new Set(['home', 'restaurant'])

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const body = await req.json().catch(() => ({}))
    const { user_id, dishes } = body as {
      user_id?: string
      dishes?: Array<{ dish_normalized?: string; quantity?: number; unit?: string; cooking_style?: string }>
    }

    if (!user_id || !UUID_RE.test(String(user_id))) {
      return jsonResp(400, { error: 'invalid_input', detail: 'user_id must be a UUID' })
    }
    if (!Array.isArray(dishes) || dishes.length === 0) {
      return jsonResp(400, { error: 'invalid_input', detail: 'dishes must be a non-empty array' })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let updated = 0
    for (const d of dishes) {
      const dish_normalized = String(d?.dish_normalized || '').trim()
      const quantity = Number(d?.quantity)
      const unit = String(d?.unit || '').trim()
      const cooking_style = ALLOWED_COOKING.has(String(d?.cooking_style)) ? d!.cooking_style : 'home'

      // Skip malformed entries instead of failing the whole batch — fire-and-forget.
      if (!dish_normalized || !Number.isFinite(quantity) || quantity <= 0 || !unit) continue

      const { error } = await supabase.rpc('upsert_user_dish_portion', {
        p_user_id: user_id,
        p_dish_normalized: dish_normalized,
        p_quantity: quantity,
        p_unit: unit,
        p_cooking_style: cooking_style,
      })

      if (error) {
        console.error('upsert_user_dish_portion failed for', dish_normalized, error)
        continue
      }
      updated++
    }

    return jsonResp(200, { updated })
  } catch (err) {
    console.error('update-portion-memory error:', err)
    return jsonResp(500, { error: 'server_error', detail: String(err?.message || err) })
  }
})

function jsonResp(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
