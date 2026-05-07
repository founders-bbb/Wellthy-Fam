// ============================================================
// FAMILY APP — generate-nudge v2 (Rules Engine)
// ============================================================
// PRODUCTION SOURCE OF TRUTH — pulled from Supabase 2026-05-07.
// This is the live function in production. If your local file looks
// different and simpler, your local file is STALE.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function fmt(n: any) { return Math.round(Number(n) || 0).toLocaleString('en-IN') }

// Categories that are NOT real spending. Income flows in, Cash is extraction
// (off-statement use), Transfer is personal payments (rent, splitting bills,
// money to family). Spending math must exclude all three or the topCat /
// weeklyExpenses figures lie about the user's actual outflows.
const SPENDING_EXCLUDED_CATS = new Set(['Income', 'Cash', 'Transfer'])

// ── REFLECTION RULES (Phase 2 — replaces NUDGE_RULES) ────────
//
// Three reflection types per nudge_character_bible.md:
//   pattern        — single-domain mirror of recent behavior. Observation only.
//   cross_domain   — connects two domains (spending+sleep, screens+meals, etc).
//                    Surfaces correlations without claiming causation.
//   aspirational   — connects current behavior to a stated goal. Math-honest,
//                    forward-looking, no hype.
//
// Each rule's prompt() returns text passed AS-IS to Claude. The system prompt
// in callClaude() handles voice — rule prompts just supply the situation +
// numbers and any pacing/length hints. Don't repeat voice rules here.
const REFLECTION_RULES = [

  // ─────────────────────────────────────────────────────────
  // PATTERN — single-domain mirror, observation only
  // ─────────────────────────────────────────────────────────

  {
    id: 'p_finance_top_category',
    domain: 'finance',
    type: 'pattern',
    priority: 78,
    trigger: (ctx: any) => ctx.totalThisWeek > 1000 && !!ctx.topCat && ctx.topCatAmt > 500,
    prompt: (ctx: any) =>
      `Situation: ${ctx.firstName}'s top spending category this week was ${ctx.topCat} at ₹${fmt(ctx.topCatAmt)} out of ₹${fmt(ctx.totalThisWeek)} total. Reflect that back as a quiet observation. Don't suggest action. Two sentences max.`,
  },
  {
    id: 'p_finance_quiet_week',
    domain: 'finance',
    type: 'pattern',
    priority: 60,
    trigger: (ctx: any) =>
      ctx.totalThisWeek > 500 && ctx.totalLastWeek > 500
      && Math.abs(ctx.totalThisWeek - ctx.totalLastWeek) / ctx.totalLastWeek < 0.1,
    prompt: (ctx: any) =>
      `Situation: ${ctx.firstName} spent ₹${fmt(ctx.totalThisWeek)} this week, almost identical to ₹${fmt(ctx.totalLastWeek)} last week. Reflect on the steadiness. Don't celebrate it. Two sentences max.`,
  },
  {
    id: 'p_wellness_protein_pattern',
    domain: 'wellness',
    type: 'pattern',
    priority: 70,
    trigger: (ctx: any) => ctx.weeklyMealsLogged >= 4 && ctx.avgProtein > 0,
    prompt: (ctx: any) =>
      `Situation: ${ctx.firstName} averaged ${Math.round(ctx.avgProtein)}g protein this week across ${ctx.weeklyMealsLogged} meals. Their target is ${ctx.proteinTarget}g/day. Just observe — note the gap or the hit. No prescriptions, no foods to try. Two sentences max.`,
  },
  {
    // Bible Section 5: "celebrate actual behaviour, not aspirational behaviour."
    // We deliberately do NOT compare avgSleepHrs to the user's stated q20 number
    // from onboarding, because that comparison reads as scolding ("you said you
    // would..."). The rule fires only when the actual sleep is genuinely short
    // (< 6h), and the prompt explicitly forbids the comparison.
    id: 'p_wellness_sleep_solo',
    domain: 'wellness',
    type: 'pattern',
    priority: 72,
    trigger: (ctx: any) =>
      ctx.avgSleepHrs !== null && ctx.avgSleepHrs < 6 && ctx.sleepLoggedDays >= 3,
    prompt: (ctx: any) =>
      `Situation: ${ctx.firstName} averaged ${ctx.avgSleepHrs.toFixed(1)}h sleep across the last ${ctx.sleepLoggedDays} nights. Reflect this back as one quiet observation. Do not say "you said you would" or compare to any stated target. Just the number, plainly visible. One sentence.`,
  },

  // ─────────────────────────────────────────────────────────
  // CROSS_DOMAIN — connections across domains, observation only
  // ─────────────────────────────────────────────────────────

  {
    id: 'c_screen_spend',
    domain: 'finance',
    type: 'cross_domain',
    priority: 88,
    trigger: (ctx: any) =>
      ctx.avgScreenHrs !== null && ctx.avgScreenHrs >= 8
      && ctx.totalLastWeek > 500
      && ctx.totalThisWeek > ctx.totalLastWeek * 1.2,
    prompt: (ctx: any) =>
      `Situation: ${ctx.firstName} averaged ${ctx.avgScreenHrs.toFixed(1)}h on screens daily this week. Spending also climbed: ₹${fmt(ctx.totalThisWeek)} this week vs ₹${fmt(ctx.totalLastWeek)} last week. Surface this as a pattern visible across the data, not a causal claim. Two sentences.`,
  },
  {
    id: 'c_sleep_money',
    domain: 'finance',
    type: 'cross_domain',
    priority: 90,
    trigger: (ctx: any) =>
      ctx.avgSleepHrs !== null && ctx.avgSleepHrs < 6.5
      && ctx.totalLastWeek > 500
      && ctx.totalThisWeek > ctx.totalLastWeek * 1.15,
    prompt: (ctx: any) =>
      `Situation: ${ctx.firstName} averaged ${ctx.avgSleepHrs.toFixed(1)}h sleep across ${ctx.sleepLoggedDays} logged nights this week. Spending also rose: ₹${fmt(ctx.totalThisWeek)} vs ₹${fmt(ctx.totalLastWeek)} last week. Late nights and looser spending often travel together. Observe the pattern. Don't scold. Two sentences.`,
  },
  {
    id: 'c_screen_meals',
    domain: 'wellness',
    type: 'cross_domain',
    priority: 80,
    trigger: (ctx: any) =>
      ctx.avgScreenHrs !== null && ctx.avgScreenHrs >= 7
      && ctx.weeklyMealsLogged < 3,
    prompt: (ctx: any) =>
      `Situation: ${ctx.firstName} averaged ${ctx.avgScreenHrs.toFixed(1)}h on screens daily but logged only ${ctx.weeklyMealsLogged} meal${ctx.weeklyMealsLogged === 1 ? '' : 's'} this week. Reflect the connection — meal logging tends to drop on heavy-screen weeks. No judgment. One sentence.`,
  },
  {
    id: 'c_lifestyle_sleep',
    domain: 'finance',
    type: 'cross_domain',
    priority: 78,
    trigger: (ctx: any) => {
      const ls = ctx.spendByCat['Lifestyle'] || 0
      return ls > ctx.totalThisWeek * 0.4 && ctx.totalThisWeek > 1000
        && ctx.avgSleepHrs !== null && ctx.avgSleepHrs < 7
    },
    prompt: (ctx: any) => {
      const ls = ctx.spendByCat['Lifestyle'] || 0
      return `Situation: ${ctx.firstName} spent ₹${fmt(ls)} on Lifestyle this week — about ${Math.round(ls/ctx.totalThisWeek*100)}% of their total. Sleep averaged ${ctx.avgSleepHrs.toFixed(1)}h. Late dinners and late nights tend to come together. One observation. Two sentences max.`
    },
  },
  {
    // Reserved slot for the subscription / EMI detector landing in Prompt 10.
    // Trigger fail-closes against missing ctx.recurringMonthlyTotal so this
    // rule never fires until the detector actually populates that field.
    // DO NOT delete during a "remove dead code" pass — this is intentional
    // forward-compatibility, paired with Prompt 10's planned context shape.
    id: 'c_recurring_visible',
    domain: 'finance_subscription',
    type: 'cross_domain',
    priority: 82,
    trigger: (ctx: any) =>
      typeof ctx.recurringMonthlyTotal === 'number' && ctx.recurringMonthlyTotal > 1000,
    prompt: (ctx: any) =>
      `Situation: ${ctx.firstName}'s recurring monthly subscriptions and EMIs add up to ₹${fmt(ctx.recurringMonthlyTotal)}. Surface the total once. Don't list items — they can see them. One sentence.`,
  },

  // ─────────────────────────────────────────────────────────
  // ASPIRATIONAL — connects today's behavior to a stated goal
  // ─────────────────────────────────────────────────────────

  {
    id: 'a_goal_pace',
    domain: 'goals',
    type: 'aspirational',
    priority: 85,
    trigger: (ctx: any) =>
      ctx.topGoal && ctx.topGoal.target > 0
      && ctx.monthlyNetSavings > 0
      && ctx.topGoal.current / ctx.topGoal.target < 0.85,
    prompt: (ctx: any) =>
      `Situation: ${ctx.firstName}'s top goal "${ctx.topGoal.name}" needs ₹${fmt(ctx.topGoal.target - ctx.topGoal.current)} more. At ₹${fmt(ctx.monthlyNetSavings)}/month, that's about ${ctx.monthsToGoal} months at the current pace. Reflect on the pace honestly. No cheering. Two sentences max.`,
  },
  {
    id: 'a_goal_almost_there',
    domain: 'goals',
    type: 'aspirational',
    priority: 92,
    trigger: (ctx: any) => {
      const g = ctx.topGoal
      return g && g.target > 0
        && g.current / g.target >= 0.85 && g.current / g.target < 1
    },
    prompt: (ctx: any) =>
      `Situation: ${ctx.firstName}'s goal "${ctx.topGoal.name}" is at ${Math.round(ctx.topGoal.current/ctx.topGoal.target*100)}%. ₹${fmt(ctx.topGoal.target - ctx.topGoal.current)} to go. Acknowledge the proximity. No hype. One or two sentences.`,
  },
  {
    // Compound visibility: surface what one weekly category, redirected
    // toward a goal, would compound to over 10 years at 12%. Math is the
    // standard FV-of-monthly-investment closed form: M * (((1+r)^n - 1)/r)
    // with r = 0.01 (12% annual ÷ 12) and n = 120 (10 years × 12 months).
    // (1.01^120 - 1) / 0.01 ≈ 230.039, so we use the constant 230 directly.
    id: 'a_compound_visibility',
    domain: 'finance',
    type: 'aspirational',
    priority: 76,
    trigger: (ctx: any) => {
      if (!ctx.topGoal) return false
      // Find any category whose weekly spend exceeds ₹3,000 (~₹13k/mo,
      // ~₹1.55L/yr — large enough that the 10-yr projection is meaningful).
      const big = Object.entries(ctx.spendByCat || {})
        .find(([_, v]: any) => Number(v) > 3000)
      return !!big
    },
    prompt: (ctx: any) => {
      const top = Object.entries(ctx.spendByCat || {})
        .sort((a: any, b: any) => Number(b[1]) - Number(a[1]))[0] as any
      const cat = top[0]
      const weekly = Number(top[1])
      const monthly = Math.round((weekly / 7) * 30)
      const tenYrFV = Math.round(monthly * 230) // FV ≈ M × 230 for 12% over 10 yrs
      return `Situation: ${ctx.firstName} spent ₹${fmt(weekly)} on ${cat} this week, roughly ₹${fmt(monthly)}/month. Redirected toward "${ctx.topGoal.name}", that compounds to about ₹${fmt(tenYrFV)} over ten years at 12% returns. State the projection plainly. No advice, no "you should." Frame as a projection, not a forecast. Use "if redirected... becomes ₹X" or "would compound to ₹X." Never "will be," "gives you," or "you'll have ₹X." This is math, not destiny. Two sentences max.`
    },
  },
  {
    id: 'a_purpose_connection',
    domain: 'mindset',
    type: 'aspirational',
    priority: 55,
    trigger: (ctx: any) => !!ctx.qData.q35_purpose,
    prompt: (ctx: any) =>
      `Situation: ${ctx.firstName} once shared their reason: "${ctx.qData.q35_purpose}". Connect today's behavior — any specific from this week — back to that purpose. One sentence. Personal, grounded, never preachy.`,
  },
]

// ── MAIN SERVER ───────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let body: any = {}
  try { body = await req.json() } catch {}

  try {
    let users: any[] = []
    if (body.user_id) {
      const { data } = await supabase.from('users')
        .select('id, name, weight, weight_unit, family_id, questionnaire_data')
        .eq('id', body.user_id).single()
      if (data) users = [data]
    } else {
      const { data } = await supabase.from('users')
        .select('id, name, weight, weight_unit, family_id, questionnaire_data')
        .eq('questionnaire_completed', true)
      users = data || []
    }

    const results = []
    for (const user of users) {
      try { results.push(await processUser(supabase, user, body)) }
      catch (err: any) { results.push({ user_id: user.id, error: err.message }) }
    }

    return new Response(JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

async function processUser(supabase: any, user: any, inline: any) {
  const userId = user.id

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const { data: existing } = await supabase.from('nudges').select('id')
    .eq('user_id', userId).gte('sent_at', todayStart.toISOString()).maybeSingle()
  if (existing) return { user_id: userId, skipped: 'already sent today' }

  // Defensive nighttime guard — should never fire in normal cron operation
  // (cron is 0 3 UTC = 08:30 IST). Prevents manual or webhook invocations
  // during the silent window from breaking the brand promise. IST is
  // hardcoded because the silent-hours UI is global, not per-user.
  const nowMs = Date.now()
  const istNow = new Date(nowMs + (5.5 * 60 * 60 * 1000))
  const istHour = istNow.getUTCHours()
  if (istHour >= 22 || istHour < 8) {
    return { user_id: userId, skipped: 'silent_hours' }
  }

  const ctx = await buildContext(supabase, userId, user, inline)

  const { data: recent } = await supabase.from('nudges').select('domain, nudge_text, message, type, nudge_type')
    .eq('user_id', userId).order('sent_at', { ascending: false }).limit(5)
  ctx.recentNudges = (recent || []).map((n: any) => ({
    domain: n.domain || n.type,
    nudgeType: n.nudge_type || null,
    text: n.nudge_text || n.message || '',
    ruleId: n.type,
  }))

  const recentRuleIds = ctx.recentNudges.slice(0, 3).map((n: any) => n.ruleId).filter(Boolean)
  const recentTypes = ctx.recentNudges.slice(0, 3).map((n: any) => n.nudgeType).filter(Boolean)

  // Phase 3 rule selection: per-type cycling. The Reflections engine has a small
  // universe of rules (4 pattern + 5 cross_domain + 4 aspirational), so plain
  // priority sorting tends to cycle the same rule family for days. Instead:
  //   1. Filter triggered + not-recently-used (by id).
  //   2. Group by type.
  //   3. Among types with at least one triggered rule, prefer one NOT in the
  //      last 3 nudges' types. Tiebreak by the type whose top-priority rule
  //      is highest.
  //   4. Fall back to whichever type has rules if all three types were used
  //      recently. Within the chosen type, pick highest priority.
  const triggered = REFLECTION_RULES
    .filter(r => { try { return r.trigger(ctx) } catch { return false } })
    .filter(r => !recentRuleIds.includes(r.id))

  const byType: { [k: string]: any[] } = { pattern: [], cross_domain: [], aspirational: [] }
  triggered.forEach(r => { if (byType[r.type]) byType[r.type].push(r) })

  const typesWithRules = Object.keys(byType).filter(t => byType[t].length > 0)
  const freshTypes = typesWithRules.filter(t => !recentTypes.includes(t))
  const candidateTypes = freshTypes.length > 0 ? freshTypes : typesWithRules

  // Sort candidate types by their highest in-type priority (desc).
  const chosenType = candidateTypes.length > 0
    ? candidateTypes.sort((a, b) => {
        const aMax = Math.max.apply(null, byType[a].map((r: any) => r.priority))
        const bMax = Math.max.apply(null, byType[b].map((r: any) => r.priority))
        return bMax - aMax
      })[0]
    : null

  const chosen = chosenType
    ? byType[chosenType].sort((a: any, b: any) => b.priority - a.priority)[0]
    : null
  const prompt = chosen ? chosen.prompt(ctx)
    : `Situation: ${ctx.firstName} has been logging consistently. Write ONE simple reflection in 1-2 sentences. Not a nudge, not advice, just a quiet observation about their relationship with money or wellness today. Use any specific number from their data if helpful. Better to say nothing than to be generic.`
  const domain = chosen?.domain || 'family'
  const ruleId = chosen?.id || 'fallback'
  // Default fallback type is 'pattern' — the most neutral, observational stance.
  const nudgeTypeStr = chosen?.type || 'pattern'

  console.log(`[NUDGE] ${userId} → rule: ${ruleId} (type=${nudgeTypeStr})`)

  const recentTexts = ctx.recentNudges.map((n: any) => n.text).filter(Boolean)
  const nudgeText = await callClaude(prompt, recentTexts)
  if (!nudgeText) return { user_id: userId, skipped: 'Claude returned empty' }

  const { data: nudge, error } = await supabase.from('nudges').insert({
    user_id: userId, domain, type: ruleId,
    nudge_type: nudgeTypeStr,
    nudge_text: nudgeText, message: nudgeText,
    sent_at: new Date().toISOString(),
  }).select().single()
  if (error) throw error

  const { data: tok } = await supabase.from('push_tokens').select('token').eq('user_id', userId).maybeSingle()
  let pushSent = false
  if (tok?.token) pushSent = await sendPush(tok.token, nudgeText, nudgeTypeStr, domain)

  return { user_id: userId, nudge_id: nudge.id, rule: ruleId, domain, text: nudgeText, push_sent: pushSent }
}

async function buildContext(supabase: any, userId: string, user: any, inline: any) {
  const qData = user.questionnaire_data || {}
  const firstName = user.name?.split(' ')[0] || qData.q1_name?.split(' ')[0] || 'there'
  const proteinTarget = Math.round(Number(user.weight || 60) * 1.2)
  const now = new Date()

  if (inline?.user_id && inline?.name) {
    // Inline-mode ctx: keep the same shape as the full path so Phase 2 rules
    // can be written once and run in either mode. Wellness aggregates default
    // to NULL (= "no data") so wellness-only rules fail-closed in inline mode.
    return {
      userId, userMemberId: null, firstName, qData, proteinTarget,
      dayOfWeek: now.getDay(), isStartOfMonth: now.getDate() <= 3,
      totalThisWeek: inline.weekly_spend || 0, totalLastWeek: 0,
      weeklyExpenses: inline.weekly_spend || 0, weeklyIncome: 0,
      topCat: inline.top_category || '', topCatAmt: inline.weekly_spend || 0,
      spendByCat: {}, weeklyTxCount: inline.weekly_tx_count || 0,
      monthlyNetSavings: 0, avgProtein: 0,
      weeklyMealsLogged: inline.weekly_meals_logged || 0,
      weeklyWaterAvg: inline.weekly_water_avg || 0,
      avgScreenHrs: null, screenLoggedDays: 0,
      avgSleepHrs: null, sleepLoggedDays: 0,
      myWellness: [],
      topGoal: null, monthsToGoal: 0, hasEMI: false,
      memberCount: 1, membersNotLogging: [], familyName: '',
      recentNudges: [],
    }
  }

  const d7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const d14 = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0]

  // Wellness fetch added in Phase 1 (Reflections engine). Reads screen_hrs +
  // sleep_hours per member-day. NULL is meaningful: it means "this metric was
  // not logged for that day" (post-build #10 — see wellness_logged_distinction.sql).
  // We pull all members in the family because cross_domain rules in Phase 2 may
  // want to look at sibling/spouse data; Phase 1 only aggregates the current user.
  const [t1, t2, m1, g1, mb1, fam1, w1] = await Promise.all([
    supabase.from('transactions').select('amount,category,date').eq('user_id', userId).gte('date', d7),
    supabase.from('transactions').select('amount,category,date').eq('user_id', userId).gte('date', d14).lt('date', d7),
    supabase.from('meals').select('protein,date').eq('user_id', userId).gte('date', d7),
    supabase.from('goals').select('name,target,current').eq('user_id', userId).gt('target', 0).order('target', { ascending: false }),
    user.family_id ? supabase.from('family_members').select('id,name,user_id').eq('family_id', user.family_id) : { data: [] },
    user.family_id ? supabase.from('families').select('family_name').eq('id', user.family_id).single() : { data: null },
    user.family_id ? supabase.from('wellness').select('member_id,date,screen_hrs,sleep_hours').eq('family_id', user.family_id).gte('date', d7) : { data: [] },
  ])

  const txThis = t1.data || [], txLast = t2.data || [], meals = m1.data || []
  const goals = g1.data || [], members = mb1.data || []
  const wellnessThisWeek = w1.data || []

  // Resolve the family_members.id for this user. Reflections care about the
  // current user's data; wellness rows key on member_id (text), so we filter
  // the wellness array by this id below.
  const userMemberRow = (members || []).find((m: any) => m.user_id === userId)
  const userMemberId = userMemberRow ? userMemberRow.id : null

  // Spending aggregations now exclude Cash and Transfer alongside Income.
  // Cash = ATM extraction (not consumed), Transfer = personal payments.
  // Both should be visible in the transaction list but invisible to the
  // "what did you spend on" picture the Nudge reflects back.
  const spendByCat: any = {}
  const spendLastByCat: any = {}
  txThis.forEach((t: any) => {
    if (SPENDING_EXCLUDED_CATS.has(t.category)) return
    spendByCat[t.category] = (spendByCat[t.category] || 0) + Number(t.amount)
  })
  txLast.forEach((t: any) => {
    if (SPENDING_EXCLUDED_CATS.has(t.category)) return
    spendLastByCat[t.category] = (spendLastByCat[t.category] || 0) + Number(t.amount)
  })

  const totalThisWeek = Object.values(spendByCat).reduce((a: any, b: any) => a + b, 0) as number
  const totalLastWeek = Object.values(spendLastByCat).reduce((a: any, b: any) => a + b, 0) as number
  const topEntry = Object.entries(spendByCat).sort((a: any, b: any) => b[1] - a[1])[0]
  const weeklyIncome = txThis.filter((t: any) => t.category === 'Income').reduce((s: number, t: any) => s + Number(t.amount), 0)
  const weeklyExpenses = txThis
    .filter((t: any) => !SPENDING_EXCLUDED_CATS.has(t.category))
    .reduce((s: number, t: any) => s + Number(t.amount), 0)
  const monthlyNetSavings = Math.max(weeklyIncome - weeklyExpenses, 0)
  const hasEMI = txThis.some((t: any) => ['EMI', 'Loan', 'House Bills'].includes(t.category))

  const totalProtein = meals.reduce((s: number, m: any) => s + (Number(m.protein) || 0), 0)
  const daysLogged = new Set(meals.map((m: any) => m.date)).size || 1
  const avgProtein = totalProtein / daysLogged

  // Wellness aggregation for the CURRENT user only. Filter by userMemberId
  // (text match) then by metric NOT NULL — explicit zero counts as logged
  // (e.g. user explicitly logged 0 hours of sleep), missing/NULL does not.
  const myWellness = userMemberId
    ? wellnessThisWeek.filter((w: any) => w.member_id === userMemberId)
    : []
  const screenLoggedRows = myWellness.filter((w: any) => w.screen_hrs !== null && typeof w.screen_hrs !== 'undefined')
  const screenLoggedDays = screenLoggedRows.length
  const avgScreenHrs = screenLoggedDays > 0
    ? screenLoggedRows.reduce((s: number, w: any) => s + Number(w.screen_hrs), 0) / screenLoggedDays
    : null
  const sleepLoggedRows = myWellness.filter((w: any) => w.sleep_hours !== null && typeof w.sleep_hours !== 'undefined')
  const sleepLoggedDays = sleepLoggedRows.length
  const avgSleepHrs = sleepLoggedDays > 0
    ? sleepLoggedRows.reduce((s: number, w: any) => s + Number(w.sleep_hours), 0) / sleepLoggedDays
    : null

  const topGoal = goals[0] || null
  const monthsToGoal = topGoal && monthlyNetSavings > 0
    ? Math.ceil((topGoal.target - topGoal.current) / monthlyNetSavings) : 0

  const membersNotLogging = (members || [])
    .filter((m: any) => m.user_id && m.user_id !== userId).map((m: any) => m.name).slice(0, 2)

  return {
    userId, userMemberId, firstName, qData, proteinTarget,
    dayOfWeek: now.getDay(), isStartOfMonth: now.getDate() <= 3,
    totalThisWeek, totalLastWeek, weeklyExpenses, weeklyIncome,
    topCat: topEntry?.[0] || '', topCatAmt: topEntry?.[1] || 0,
    spendByCat, weeklyTxCount: txThis.length,
    monthlyNetSavings, avgProtein, weeklyMealsLogged: meals.length, weeklyWaterAvg: 0,
    // Wellness aggregates (Phase 1). NULL = no data this week. Rules in Phase 2
    // must guard against NULL before using these in arithmetic.
    avgScreenHrs, screenLoggedDays, avgSleepHrs, sleepLoggedDays, myWellness,
    topGoal, monthsToGoal, hasEMI,
    memberCount: members.length, membersNotLogging,
    familyName: fam1.data?.family_name || '',
    recentNudges: [],
  }
}

// System prompt distilled from nudge_character_bible.md (lines 12, 36, 65,
// 189, 206, 244–250, plus reference transformations from Section 10).
// Target: ~600 tokens. Keeps the operative rules and three transformation
// pairs that train voice better than rule lists alone. The bible itself is
// the source of truth — if voice ever drifts in production, update the
// bible first, then mirror the change here.
const SYSTEM_PROMPT = `You are the Nudge, that one friend who has somehow been living in this family's house for the past month without them noticing. You've seen the grocery runs, the late nights, the goal they set at the kitchen table. You care, genuinely. You're not an AI assistant, not a coach, not a dashboard. You hold up a mirror and say "hey, I see you, and here's what I see." Two to four sentences max, often two.

THE CORE RULE. Sentence first, number second. Every reflection begins with a human observation. The number, if it appears at all, is the evidence. Never the headline. A doctor says "Your blood pressure is 140/90." A friend says "You've been burning the candle pretty hard." Same information, completely different experience. You are always the friend.

GRAMMAR
- Never use em dashes. Use a comma, a full stop, or restructure the sentence.
- No bullet points, no colon separators.
- No metric-first sentences.
- No passive voice.
- No hedging language ("it may be worth considering").
- No hollow affirmations ("great job!").

WHAT YOU NEVER DO
- Open with a number.
- Use AI-tells: "I notice that," "it's important to," "please remember," "as a reminder."
- Say "I" at all. You have no ego, no identity. You just observe.
- Moralise about food, body, or personal spending.
- Compare this family to other families.
- Make certain predictions ("if you continue at this rate, you will...").
- Repeat yesterday's observation.

THREE LITMUS QUESTIONS. Every reflection must pass:
1. Would a real person say this to a family member they care about?
2. Does it start from the person, not the number?
3. Does it make one useful point?
If the first thing in the sentence is a metric, rewrite it. If it sounds like a report, rewrite it. If it makes more than one point, cut to the most important one.

REFERENCE TRANSFORMATIONS
Bad: "You spent ₹4,200 last week, which is 18% above your monthly average. Consider reducing discretionary spending."
Good: "Last week ran a little heavy, mostly lifestyle and eating out. Nothing that can't be absorbed but worth keeping tighter this week."

Bad: "Priya has not logged her meals for 3 days. Consistent meal logging is important for tracking wellness."
Good: "Priya's meals have gone quiet for a few days and she tends to drop off when things get hectic. A quick log tonight would fill in the gap."

Bad: "Great job! Your family logged 5 days in a row. Keep up the excellent work!"
Good: "Five days in a row. The streak is real and that kind of quiet consistency is what actually builds habits."

INDIAN CONTEXT. Use ₹. Indian number formatting (1,000 / 10,000 / 1,00,000). Use first names when given. Return only the reflection text. No quotes, no preamble, no labels like "Reflection:".`

async function callClaude(situation: string, recentTexts: string[]): Promise<string> {
  const key = Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `${situation}\n\n${recentTexts.length ? `Recent nudges (do NOT repeat these phrasings or topics):\n${recentTexts.slice(0, 3).join('\n')}` : ''}\n\nReturn ONLY the reflection text. No quotes.`,
      }],
    }),
  })
  if (!res.ok) throw new Error(`Claude ${res.status}`)
  const d = await res.json()
  return d.content?.[0]?.text?.trim() || ''
}

// Push notification title map keyed by reflection TYPE, not domain. The mirror
// emoji ties to the brand framing "Mirror, not tracker." Domain is still
// preserved in the notification's data payload for client-side analytics, but
// the user-visible title now signals what KIND of reflection this is.
async function sendPush(token: string, message: string, nudgeType: string, domain: string): Promise<boolean> {
  const titles: any = {
    pattern: '🪞 A pattern',
    cross_domain: '🪞 Worth noticing',
    aspirational: '🪞 Toward your goal',
  }
  try {
    const r = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title: titles[nudgeType] || '🌿 Family App', body: message, sound: 'default', data: { type: 'nudge', domain, nudge_type: nudgeType }, priority: 'normal' }),
    })
    return r.ok
  } catch { return false }
}
