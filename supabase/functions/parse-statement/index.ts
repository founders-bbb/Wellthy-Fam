// =====================================================================================
// FAMILY APP — SUPABASE EDGE FUNCTION: parse-statement (Phase 6 statement upload)
// File: supabase/functions/parse-statement/index.ts
//
// CONTRACT
//   Request:
//     {
//       statement_import_id: uuid,
//       user_id: uuid,
//       family_id: uuid,
//       storage_path: "user_id/statement_import_id.pdf",
//       pdf_password: string | null
//     }
//
//   Response (200):
//     {
//       success: true,
//       statement_import_id, document_type, bank_name, account_last4,
//       period_start, period_end, total_credits, total_debits,
//       transaction_count, parse_method
//     }
//
//   Errors:
//     400 invalid_input
//     401 unauthorized       — user_id ≠ owner of statement_import_id
//     422 parse_failed       — { reason: 'unable_to_extract_text' | 'not_a_statement' |
//                                       'corrupted_pdf'         | 'wrong_password'      |
//                                       'already_processed'     | 'parse_failed' }
//     500 server_error
//
// FLOW
//   1. Validate input shapes (UUIDs, non-empty storage_path).
//   2. Fetch statement_imports row; bail if not status='parsing' or wrong owner.
//   3. Download PDF from bank-statements bucket via service-role client.
//   4. If pdf_password: try to decrypt via pdf-lib. Failure → status='failed',
//      reason='wrong_password', return 422.
//   5. Convert bytes → base64 → Claude Sonnet (vision/document mode, 60s timeout).
//   6. Parse Claude's JSON. Malformed → status='failed', reason='parse_failed', 422.
//   7. Apply per-family merchant_categories overrides to each parsed transaction.
//   8. Insert all parsed rows into statement_transactions (user_action='pending').
//   9. Update statement_imports → status='review' + summary fields + parsed count.
//  10. Delete the source PDF from the bucket (24h retention applies to the row,
//      not the blob — we shed the blob as soon as parsing succeeds).
//  11. Return summary.
//
// CATEGORY CONVENTION
//   The income-detection convention used elsewhere in the app reads category='Income'.
//   The Claude system prompt is explicit that:
//     - Bank account credits → category='Income'
//     - Credit-card "payment to card" → category='Income'
//     - Everything else → categorized into one of the 6 expense categories.
//
// ENV: ANTHROPIC_API_KEY (existing).
// =====================================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SONNET_MODEL = 'claude-sonnet-4-20250514'
const CLAUDE_TIMEOUT_MS = 60_000
const CLAUDE_MAX_TOKENS = 8000

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const VALID_CATEGORIES = new Set(['Daily Essentials','House Bills','Travel','Health','Lifestyle','Savings','Income','Cash','Transfer'])

const SYSTEM_PROMPT = `You extract transactions from Indian bank account statements and credit card statements. Return ONLY a single JSON object, no prose, no markdown fences.

Output schema:
{
  "document_type": "bank_account" | "credit_card",
  "bank_name": "<bank name as printed>" | null,
  "account_last4": "<last 4 digits>" | null,
  "period_start": "YYYY-MM-DD",
  "period_end": "YYYY-MM-DD",
  "total_credits": <number>,
  "total_debits": <number>,
  "transactions": [
    {
      "raw_narration": "<exact line as printed>",
      "date": "YYYY-MM-DD",
      "amount": <positive number>,
      "transaction_type": "debit" | "credit",
      "merchant_normalized": "<short merchant name in upper case, e.g. AMAZON, SWIGGY, ZOMATO, UBER, ELECTRICITY BOARD>",
      "category_suggested": "Daily Essentials" | "House Bills" | "Travel" | "Health" | "Lifestyle" | "Savings" | "Income" | "Cash" | "Transfer",
      "confidence_score": <0.0 to 1.0>
    },
    ...
  ]
}

CATEGORIZATION RULES (expense categories — pick exactly one):
- Daily Essentials: groceries, household supplies, vegetables, milk, supermarket, kirana
- House Bills: electricity, gas, water, internet, rent, EMI, mobile recharge, DTH, society maintenance
- Travel: Uber, Ola, fuel, flight, hotel, train, bus, tolls, parking
- Health: pharmacy, hospital, doctor, lab tests, gym, insurance premium (health), supplements
- Lifestyle: restaurants, food delivery (Swiggy/Zomato), shopping (Amazon/Flipkart non-essentials), entertainment, cinema, alcohol, salon
- Savings: investments, mutual fund SIPs, FD, recurring deposits, transfers labeled as savings

CASH AND TRANSFER HANDLING (CRITICAL):

These two categories must be used for transactions that are NOT real spending:

- Cash: ATM withdrawals — narrations like "ATM WITHDRAWAL", "ATM WDL", "CASH WD", "ATM CASH", or any narration with "ATM" that includes a withdrawal amount. confidence_score=0.95. These extract money for off-statement use; they are NOT a categorized expense.

- Transfer: Personal payments to identified individuals. Narrations with person names — typically Indian first names or surnames in ALL CAPS, sometimes prefixed with UPI/IMPS/NEFT followed by a person's name. Examples: "UPI/SHANTHAMMA/...", "NEFT-RPAVITHRA-...", "IMPS to CHAITHALI P". confidence_score=0.7. These are personal transfers (rent to landlord, money to family, splitting bills) — NOT retail spending.

  Self-transfers between own accounts: narrations with "SELF", "OWN", "TRANSFER TO OWN", or where the recipient resembles the user's bank details. category=Transfer, confidence_score=0.9.

REFUND HANDLING:
Refunds appear as CREDIT lines but are NOT income. Narrations starting with "REFUND", "REVERSAL", "REV-", or small credits that look like they mirror a prior debit (same merchant name pattern). For these:
- Set transaction_type="credit"
- Set category to whatever the original purchase category likely was (e.g. POWERLOOK APPAREL refund → Lifestyle, not Income)
- confidence_score=0.5 (genuinely ambiguous)
- DO NOT default refunds to Income just because they're credits.

INCOME ASSIGNMENT (CRITICAL — read carefully):
- Bank account statement: a CREDIT line (deposit, salary, refund, transfer-in) → category="Income", transaction_type="credit". A DEBIT line → categorize normally and transaction_type="debit".
- Credit card statement: a "PAYMENT TO CARD" / "BILL PAYMENT" / similar line where the user pays their bill → category="Income", transaction_type="credit". This is the income-equivalent that frees up the spending pool. ALL OTHER credit-card lines (purchases, fees, EMI charges, finance charges) → categorize normally and transaction_type="debit", regardless of whether the statement renders the amount as a positive or negative number.

CONFIDENCE SCORING:
- 0.9+ : Clear match (e.g. SWIGGY → Lifestyle, ELECTRICITY BOARD → House Bills)
- 0.7-0.9 : Likely but ambiguous (e.g. AMAZON could be Daily Essentials or Lifestyle — pick most likely)
- 0.5-0.7 : Best guess but uncertain
- below 0.5 : Genuinely unclear (e.g. an unknown merchant name) — pick most likely category and flag low confidence

NORMALIZATION:
- merchant_normalized must be UPPER CASE, no extra words. 'PAYMENT TO SWIGGY INSTAMART' → 'SWIGGY INSTAMART'. 'UPI/AMAZON PAY/...' → 'AMAZON PAY'.
- Skip pure balance lines, opening/closing balance entries, and statement headers.

If you cannot determine the document type with confidence, return document_type="bank_account" as default. If you cannot find period dates, use the first and last transaction date.`

const USER_PROMPT = 'Extract all transactions from this statement and return the JSON object as specified.'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const body = await req.json().catch(() => ({}))
    const { statement_import_id, user_id, family_id, storage_path, pdf_password } = body as {
      statement_import_id?: string
      user_id?: string
      family_id?: string
      storage_path?: string
      pdf_password?: string | null
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
    if (!storage_path || typeof storage_path !== 'string' || !storage_path.trim()) {
      return jsonResp(400, { error: 'invalid_input', detail: 'storage_path is required' })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_API_KEY) {
      return jsonResp(500, { error: 'server_misconfigured', detail: 'missing ANTHROPIC_API_KEY' })
    }

    // Step 2: Fetch + ownership check + status check.
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
    if (importRow.status !== 'parsing') {
      return jsonResp(422, { error: 'parse_failed', reason: 'already_processed', detail: `status=${importRow.status}` })
    }

    // Step 3: Download PDF from storage.
    const { data: pdfBlob, error: dlErr } = await supabase.storage.from('bank-statements').download(storage_path)
    if (dlErr || !pdfBlob) {
      await markFailed(supabase, statement_import_id, 'corrupted_pdf', 'download_failed: ' + (dlErr?.message || 'no body'))
      return jsonResp(422, { error: 'parse_failed', reason: 'corrupted_pdf', detail: dlErr?.message || 'download failed' })
    }
    let pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer())

    // Step 4: Decrypt if password-protected.
    if (pdf_password) {
      try {
        const doc = await PDFDocument.load(pdfBytes, { password: pdf_password, ignoreEncryption: false })
        // pdf-lib doesn't expose a direct "decrypted bytes" API; saving the loaded
        // doc effectively writes an unencrypted copy that Claude can read.
        pdfBytes = await doc.save({ useObjectStreams: false })
      } catch (decErr: any) {
        const msg = String(decErr?.message || decErr)
        const isPwdErr = /password|encrypt/i.test(msg)
        await markFailed(supabase, statement_import_id, isPwdErr ? 'wrong_password' : 'corrupted_pdf', msg)
        return jsonResp(422, {
          error: 'parse_failed',
          reason: isPwdErr ? 'wrong_password' : 'corrupted_pdf',
          detail: msg,
        })
      }
    }

    // Sanity-check: ensure the PDF is structurally readable (cheap probe).
    try {
      await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
    } catch (probeErr: any) {
      const msg = String(probeErr?.message || probeErr)
      // If it complains about encryption AT THIS STAGE, we hit a password-protected PDF
      // that wasn't provided a password.
      const isPwdErr = /password|encrypt/i.test(msg)
      await markFailed(supabase, statement_import_id, isPwdErr ? 'wrong_password' : 'corrupted_pdf', msg)
      return jsonResp(422, {
        error: 'parse_failed',
        reason: isPwdErr ? 'wrong_password' : 'corrupted_pdf',
        detail: msg,
      })
    }

    // Step 5: Base64 + Claude Sonnet vision.
    const pdfBase64 = bytesToBase64(pdfBytes)
    let claudeText = ''
    try {
      claudeText = await callClaudeVision(ANTHROPIC_API_KEY, pdfBase64)
    } catch (claudeErr: any) {
      const msg = String(claudeErr?.message || claudeErr)
      await markFailed(supabase, statement_import_id, 'unable_to_extract_text', msg)
      return jsonResp(422, { error: 'parse_failed', reason: 'unable_to_extract_text', detail: msg })
    }

    // Step 6: Parse Claude's JSON.
    const parsed = extractJSONObject(claudeText)
    if (!parsed) {
      await markFailed(supabase, statement_import_id, 'parse_failed', 'claude returned non-JSON: ' + claudeText.slice(0, 200))
      return jsonResp(422, { error: 'parse_failed', reason: 'parse_failed', detail: 'claude did not return JSON' })
    }
    if (!Array.isArray(parsed.transactions) || parsed.transactions.length === 0) {
      await markFailed(supabase, statement_import_id, 'not_a_statement', 'no transactions found')
      return jsonResp(422, { error: 'parse_failed', reason: 'not_a_statement', detail: 'no transactions found' })
    }

    // Step 7: Apply per-family merchant_categories overrides + normalize each row.
    const merchantKeys = parsed.transactions
      .map((t: any) => String(t?.merchant_normalized || '').toUpperCase().trim())
      .filter(Boolean)
    const { data: overrides } = await supabase
      .from('merchant_categories')
      .select('merchant_normalized, category')
      .eq('family_id', family_id)
      .in('merchant_normalized', merchantKeys.length > 0 ? merchantKeys : ['__none__'])
    const overrideByKey: Record<string, string> = {}
    ;(overrides || []).forEach((o: any) => { overrideByKey[String(o.merchant_normalized || '').toUpperCase()] = o.category })

    const stagedRows = parsed.transactions
      .map((t: any) => normalizeStagedRow(t, statement_import_id, overrideByKey))
      .filter(Boolean) as Array<any>

    if (stagedRows.length === 0) {
      await markFailed(supabase, statement_import_id, 'not_a_statement', 'no usable transactions after normalization')
      return jsonResp(422, { error: 'parse_failed', reason: 'not_a_statement', detail: 'no usable transactions' })
    }

    // Step 8: Insert into statement_transactions.
    const { error: insertErr } = await supabase.from('statement_transactions').insert(stagedRows)
    if (insertErr) {
      await markFailed(supabase, statement_import_id, 'parse_failed', 'staging insert failed: ' + insertErr.message)
      return jsonResp(500, { error: 'server_error', detail: insertErr.message })
    }

    // Step 9: Summarize + flip status to review.
    const documentType = parsed.document_type === 'credit_card' ? 'credit_card' : 'bank_account'
    const summary = {
      status: 'review',
      document_type: documentType,
      bank_name: nullIfEmpty(parsed.bank_name),
      account_last4: nullIfEmpty(parsed.account_last4),
      period_start: validDate(parsed.period_start),
      period_end: validDate(parsed.period_end),
      total_credits: numberOrNull(parsed.total_credits),
      total_debits: numberOrNull(parsed.total_debits),
      parse_method: 'claude_sonnet',
      parsed_transaction_count: stagedRows.length,
      failure_reason: null,
    }
    const { error: updErr } = await supabase
      .from('statement_imports')
      .update(summary)
      .eq('id', statement_import_id)
    if (updErr) {
      console.error('[parse-statement] update statement_imports failed', updErr)
      // Soft-fail: rows are already staged, return what we have.
    }

    // Step 10: Delete the source PDF (retention applies to the row, not the blob).
    try {
      await supabase.storage.from('bank-statements').remove([storage_path])
      await supabase.from('statement_imports').update({ source_file_path: null }).eq('id', statement_import_id)
    } catch (rmErr) {
      console.error('[parse-statement] PDF delete failed (continuing)', rmErr)
    }

    return jsonResp(200, {
      success: true,
      statement_import_id,
      document_type: documentType,
      bank_name: summary.bank_name,
      account_last4: summary.account_last4,
      period_start: summary.period_start,
      period_end: summary.period_end,
      total_credits: summary.total_credits,
      total_debits: summary.total_debits,
      transaction_count: stagedRows.length,
      parse_method: 'claude_sonnet',
    })
  } catch (err: any) {
    console.error('parse-statement error:', err)
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

async function markFailed(supabase: any, id: string, reason: string, detail: string) {
  try {
    await supabase
      .from('statement_imports')
      .update({ status: 'failed', failure_reason: `${reason}: ${detail}`.slice(0, 500), parse_method: 'claude_sonnet' })
      .eq('id', id)
  } catch (e) {
    console.error('[parse-statement] markFailed bookkeeping failed', e)
  }
}

async function callClaudeVision(apiKey: string, pdfBase64: string): Promise<string> {
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
        model: SONNET_MODEL,
        max_tokens: CLAUDE_MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
            },
            { type: 'text', text: USER_PROMPT },
          ],
        }],
      }),
    })
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      throw new Error(`Claude ${r.status}: ${t.slice(0, 200)}`)
    }
    const data = await r.json()
    return String(data?.content?.[0]?.text || '').trim()
  } finally {
    clearTimeout(timer)
  }
}

function extractJSONObject(text: string): any | null {
  // Tolerate ```json fences and stray prose by extracting the first balanced {...} block.
  const direct = safeParse(text)
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) return direct
  const m = text.match(/\{[\s\S]*\}/)
  if (m) {
    const obj = safeParse(m[0])
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj
  }
  return null
}

function safeParse(s: string): any {
  try { return JSON.parse(s) } catch { return null }
}

function nullIfEmpty(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s : null
}

function numberOrNull(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

function validDate(v: unknown): string | null {
  if (!v) return null
  const s = String(v)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

// Convert each parsed transaction into a statement_transactions row, applying any
// per-family merchant_category override. Drops rows that fail basic shape checks.
function normalizeStagedRow(
  t: any,
  statement_import_id: string,
  overrideByKey: Record<string, string>,
) {
  const amount = Number(t?.amount)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const transaction_type = t?.transaction_type === 'credit' ? 'credit' : 'debit'
  const raw_narration = String(t?.raw_narration || '').trim()
  if (!raw_narration) return null
  const merchant_normalized = String(t?.merchant_normalized || '').toUpperCase().trim() || null

  let category_suggested = String(t?.category_suggested || '').trim()
  if (!VALID_CATEGORIES.has(category_suggested)) {
    // Guard against Claude returning a category outside our allowed set.
    category_suggested = transaction_type === 'credit' ? 'Income' : 'Daily Essentials'
  }
  let confidence_score = Number(t?.confidence_score)
  if (!Number.isFinite(confidence_score)) confidence_score = 0.5
  confidence_score = Math.max(0, Math.min(1, confidence_score))

  // Apply merchant_categories override if we have one. Bumps confidence by 0.2 (capped at 0.95).
  if (merchant_normalized && overrideByKey[merchant_normalized]) {
    category_suggested = overrideByKey[merchant_normalized]
    confidence_score = Math.min(0.95, confidence_score + 0.2)
  }

  return {
    statement_import_id,
    raw_narration,
    parsed_date: validDate(t?.date),
    amount: Math.round(amount * 100) / 100,
    transaction_type,
    merchant_normalized,
    category_suggested,
    confidence_score: Math.round(confidence_score * 100) / 100,
    user_action: 'pending',
  }
}

// Native btoa() handles binary strings up to ~64k cleanly; for safety on big PDFs
// we chunk through the binary string before encoding. Deno's btoa is the same as
// browser btoa.
function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as unknown as number[])
  }
  return btoa(bin)
}
