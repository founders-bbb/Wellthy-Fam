// =====================================================================================
// FAMILY APP — SUPABASE EDGE FUNCTION: finalize-statement-import (Phase 6)
// File: supabase/functions/finalize-statement-import/index.ts
//
// Called by the client AFTER the user reviews parsed statement_transactions and
// confirms which to import (and what category to use for each). This function
// commits the confirmed rows into public.transactions, marks discarded ones,
// upserts merchant_categories overrides for any user-pick that differed from
// Claude's suggestion, and flips the parent statement_imports row to 'imported'.
//
// CONTRACT
//   Request:
//     {
//       statement_import_id: uuid,
//       user_id: uuid,
//       family_id: uuid,
//       member_id: uuid,                 // family_members.id this batch attributes to
//       confirmed_transactions: [
//         { statement_transaction_id: uuid, category_confirmed: string }
//       ],
//       discarded_transaction_ids: [uuid, ...]
//     }
//
//   Response (200):
//     { success: true, imported_count, merchant_category_overrides_saved }
//
//   Errors: 400 invalid_input | 401 unauthorized | 500 server_error
//
// COLUMN SHAPE FOR public.transactions (matches AddTxModal/QuickLogSheet exactly,
// extended with the four new statement-origin columns added by phase6_statement_upload.sql):
//
//   merchant         — NOT NULL. Filled by priority chain: merchant_normalized || raw_narration || 'Statement entry'
//   amount           — NOT NULL.
//   category         — string from our 6 expense categories or 'Income'
//   member_id        — text (allows 'joint' sentinel; we pass the family_members.id text)
//   member_name      — looked up from family_members
//   confirmed        — true (statement entries arrive already-confirmed by the user)
//   source           — 'Statement'
//   date             — parsed_date if present else today
//   is_family_spending — false (default); statement entries are individual unless flagged
//   user_id          — POPULATED for statement imports (intentional inconsistency vs
//                      manual entries which leave it null; backfill of manual entries
//                      can happen in a future cleanup migration, not now)
//   statement_import_id, raw_narration, merchant_normalized, confidence_score
//
// Income detection: this function preserves category='Income' as the income marker.
// transactions.type column exists in prod but is unused — we leave it null.
// =====================================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const VALID_CATEGORIES = new Set(['Daily Essentials','House Bills','Travel','Health','Lifestyle','Savings','Income','Cash','Transfer'])

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const body = await req.json().catch(() => ({}))
    const {
      statement_import_id,
      user_id,
      family_id,
      member_id,
      confirmed_transactions,
      discarded_transaction_ids,
    } = body as {
      statement_import_id?: string
      user_id?: string
      family_id?: string
      member_id?: string
      confirmed_transactions?: Array<{ statement_transaction_id?: string; category_confirmed?: string }>
      discarded_transaction_ids?: string[]
    }

    if (!statement_import_id || !UUID_RE.test(String(statement_import_id))) {
      return jsonResp(400, { error: 'invalid_input', detail: 'statement_import_id must be a UUID' })
    }
    if (!user_id || !UUID_RE.test(String(user_id))) {
      return jsonResp(400, { error: 'invalid_input', detail: 'user_id must be a UUID' })
    }
    if (!family_id || !UUID_RE.test(String(family_id))) {
      return jsonResp(400, { error: 'invalid_input', detail: 'family_id must be a UUID' })
    }
    if (!member_id || !UUID_RE.test(String(member_id))) {
      return jsonResp(400, { error: 'invalid_input', detail: 'member_id must be a UUID' })
    }
    if (!Array.isArray(confirmed_transactions)) {
      return jsonResp(400, { error: 'invalid_input', detail: 'confirmed_transactions must be an array' })
    }
    const discardedIds = Array.isArray(discarded_transaction_ids) ? discarded_transaction_ids.filter((x) => UUID_RE.test(String(x))) : []

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── Ownership check ────────────────────────────────────────────────────────
    const { data: importRow, error: importErr } = await supabase
      .from('statement_imports')
      .select('id, user_id, family_id, status')
      .eq('id', statement_import_id)
      .maybeSingle()
    if (importErr || !importRow) {
      return jsonResp(401, { error: 'unauthorized', detail: 'statement_import not found' })
    }
    if (importRow.user_id !== user_id || importRow.family_id !== family_id) {
      return jsonResp(401, { error: 'unauthorized', detail: 'statement_import does not belong to this user/family' })
    }

    // ── Member lookup (need member_name for transactions row) ─────────────────
    const { data: memberRow } = await supabase
      .from('family_members')
      .select('id, name, family_id')
      .eq('id', member_id)
      .maybeSingle()
    if (!memberRow || memberRow.family_id !== family_id) {
      return jsonResp(401, { error: 'unauthorized', detail: 'member does not belong to this family' })
    }
    const memberName = memberRow.name || 'Member'

    // ── Fetch all referenced statement_transactions in one shot ────────────────
    const confirmedIds = (confirmed_transactions || [])
      .map((c) => String(c?.statement_transaction_id || ''))
      .filter((s) => UUID_RE.test(s))
    const allRefIds = Array.from(new Set([...confirmedIds, ...discardedIds]))
    if (allRefIds.length === 0) {
      return jsonResp(400, { error: 'invalid_input', detail: 'no transactions to process' })
    }

    const { data: stagedRows, error: stagedErr } = await supabase
      .from('statement_transactions')
      .select('id, statement_import_id, raw_narration, parsed_date, amount, transaction_type, merchant_normalized, category_suggested, confidence_score, user_action')
      .in('id', allRefIds)
    if (stagedErr) {
      return jsonResp(500, { error: 'server_error', detail: 'staged read failed: ' + stagedErr.message })
    }
    const stagedById: Record<string, any> = {}
    ;(stagedRows || []).forEach((r: any) => { stagedById[r.id] = r })

    // Reject if any staged row doesn't belong to the parent statement_import.
    for (const id of allRefIds) {
      const r = stagedById[id]
      if (!r || r.statement_import_id !== statement_import_id) {
        return jsonResp(401, { error: 'unauthorized', detail: 'staged row does not belong to this statement_import' })
      }
    }

    const today = new Date().toISOString().slice(0, 10)

    // ── Build transactions inserts + statement_transactions updates ───────────
    const txInserts: any[] = []
    const stUpdates: Array<{ id: string; category_confirmed: string }> = []
    const merchantUpserts: Record<string, { family_id: string; merchant_normalized: string; category: string }> = {}

    for (const c of confirmed_transactions || []) {
      const stId = String(c?.statement_transaction_id || '')
      if (!UUID_RE.test(stId)) continue
      const staged = stagedById[stId]
      if (!staged) continue
      const categoryConfirmed = String(c?.category_confirmed || '').trim()
      if (!VALID_CATEGORIES.has(categoryConfirmed)) {
        return jsonResp(400, {
          error: 'invalid_input',
          detail: `category_confirmed not allowed: ${categoryConfirmed} (statement_transaction_id=${stId})`,
        })
      }

      // merchant priority chain — guarantees the NOT NULL constraint never trips.
      const merchant = (staged.merchant_normalized && String(staged.merchant_normalized).trim())
        || (staged.raw_narration && String(staged.raw_narration).trim())
        || 'Statement entry'

      txInserts.push({
        family_id,
        user_id,
        member_id: memberRow.id,            // family_members.id (uuid as text in transactions.member_id)
        member_name: memberName,
        merchant,
        amount: Number(staged.amount),
        category: categoryConfirmed,
        date: staged.parsed_date || today,
        confirmed: true,
        source: 'Statement',
        is_family_spending: false,
        recurring_transaction_id: null,
        photo_path: null,
        // statement-origin columns:
        statement_import_id,
        raw_narration: staged.raw_narration,
        merchant_normalized: staged.merchant_normalized,
        confidence_score: staged.confidence_score,
      })
      stUpdates.push({ id: stId, category_confirmed: categoryConfirmed })

      // If the user picked something different from Claude's suggestion AND we have
      // a merchant_normalized to key on, remember the override for next import.
      // Single confirmation is enough.
      if (
        staged.merchant_normalized
        && categoryConfirmed
        && categoryConfirmed !== staged.category_suggested
      ) {
        const key = String(staged.merchant_normalized).toUpperCase()
        merchantUpserts[key] = {
          family_id,
          merchant_normalized: key,
          category: categoryConfirmed,
        }
      }
    }

    if (txInserts.length === 0 && discardedIds.length === 0) {
      return jsonResp(400, { error: 'invalid_input', detail: 'nothing to import or discard' })
    }

    // ── Insert transactions in one batch ──────────────────────────────────────
    let importedCount = 0
    if (txInserts.length > 0) {
      const { data: inserted, error: insertErr } = await supabase
        .from('transactions')
        .insert(txInserts)
        .select('id')
      if (insertErr) {
        return jsonResp(500, { error: 'server_error', detail: 'transactions insert failed: ' + insertErr.message })
      }
      importedCount = (inserted || []).length

      // Mark staged rows as imported.
      for (const u of stUpdates) {
        const { error: stUpdErr } = await supabase
          .from('statement_transactions')
          .update({ user_action: 'imported', category_confirmed: u.category_confirmed })
          .eq('id', u.id)
        if (stUpdErr) console.error('[finalize] staged update failed', u.id, stUpdErr)
      }
    }

    // ── Discard the rest ──────────────────────────────────────────────────────
    if (discardedIds.length > 0) {
      const { error: discErr } = await supabase
        .from('statement_transactions')
        .update({ user_action: 'discarded' })
        .in('id', discardedIds)
      if (discErr) console.error('[finalize] discard update failed', discErr)
    }

    // ── Upsert merchant_categories overrides ──────────────────────────────────
    let overridesSaved = 0
    const overrides = Object.values(merchantUpserts)
    if (overrides.length > 0) {
      const { error: mcErr } = await supabase
        .from('merchant_categories')
        .upsert(
          overrides.map((o) => ({
            family_id: o.family_id,
            merchant_normalized: o.merchant_normalized,
            category: o.category,
            last_confirmed_at: new Date().toISOString(),
          })),
          { onConflict: 'family_id,merchant_normalized' }
        )
      if (mcErr) console.error('[finalize] merchant_categories upsert failed', mcErr)
      else overridesSaved = overrides.length
    }

    // ── Flip parent statement_imports row to 'imported' ───────────────────────
    const { error: parentUpdErr } = await supabase
      .from('statement_imports')
      .update({ status: 'imported', imported_at: new Date().toISOString() })
      .eq('id', statement_import_id)
    if (parentUpdErr) console.error('[finalize] parent status update failed', parentUpdErr)

    return jsonResp(200, {
      success: true,
      imported_count: importedCount,
      merchant_category_overrides_saved: overridesSaved,
    })
  } catch (err: any) {
    console.error('finalize-statement-import error:', err)
    return jsonResp(500, { error: 'server_error', detail: String(err?.message || err) })
  }
})

function jsonResp(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
