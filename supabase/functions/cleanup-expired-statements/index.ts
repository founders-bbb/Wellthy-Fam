// =====================================================================================
// FAMILY APP — SUPABASE EDGE FUNCTION: cleanup-expired-statements (Phase 6)
// File: supabase/functions/cleanup-expired-statements/index.ts
//
// Daily cron-friendly cleanup. Finds statement_imports rows whose delete_after has
// passed and whose status is still in {parsing, review, failed} — i.e. anything
// that didn't reach 'imported'. For each:
//   1. Removes the source PDF from the bank-statements bucket if still present.
//   2. Sets status='expired' and clears source_file_path.
//   3. (statement_transactions cascade-delete via the FK.)
//
// CONTRACT
//   Request: {}
//   Response (200): { expired_count: <number>, files_deleted: <number> }
//   Errors: 500 server_error
//
// SCHEDULING
//   Not configured here — set up a daily cron via the Supabase dashboard
//   pointing at this function's URL. parse-statement already deletes the PDF on
//   successful parse, so this is a backstop for failed/abandoned imports.
// =====================================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: expiredImports, error: selErr } = await supabase
      .from('statement_imports')
      .select('id, source_file_path, status')
      .lt('delete_after', new Date().toISOString())
      .in('status', ['parsing', 'review', 'failed'])
    if (selErr) {
      return jsonResp(500, { error: 'server_error', detail: selErr.message })
    }

    let filesDeleted = 0
    let expiredCount = 0
    for (const imp of expiredImports || []) {
      if (imp.source_file_path) {
        const { error: rmErr } = await supabase.storage.from('bank-statements').remove([imp.source_file_path])
        if (!rmErr) filesDeleted++
        else console.error('[cleanup] file remove failed', imp.id, rmErr)
      }
      const { error: updErr } = await supabase
        .from('statement_imports')
        .update({ status: 'expired', source_file_path: null })
        .eq('id', imp.id)
      if (!updErr) expiredCount++
      else console.error('[cleanup] status update failed', imp.id, updErr)
    }

    return jsonResp(200, { expired_count: expiredCount, files_deleted: filesDeleted })
  } catch (err: any) {
    console.error('cleanup-expired-statements error:', err)
    return jsonResp(500, { error: 'server_error', detail: String(err?.message || err) })
  }
})

function jsonResp(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
