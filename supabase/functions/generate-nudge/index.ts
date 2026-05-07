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

// ── NUDGE RULES ───────────────────────────────────────────────
const NUDGE_RULES = [

  // ──────── FINANCE ────────
  {
    id: 'finance_spending_spike',
    domain: 'finance',
    priority: 90,
    trigger: (ctx: any) => ctx.totalThisWeek > ctx.totalLastWeek * 1.3 && ctx.totalLastWeek > 500,
    prompt: (ctx: any) =>
      `${ctx.firstName} spent ₹${fmt(ctx.totalThisWeek)} this week vs ₹${fmt(ctx.totalLastWeek)} last week (+${Math.round((ctx.totalThisWeek/ctx.totalLastWeek - 1)*100)}%). Top category: ${ctx.topCat} at ₹${fmt(ctx.topCatAmt)}. Their 1-year goal is "${ctx.qData.q15_goal_1year || 'not set'}". Write a gentle, specific nudge — observation, not warning.`,
  },
  {
    id: 'finance_great_week',
    domain: 'finance',
    priority: 85,
    trigger: (ctx: any) => ctx.totalThisWeek < ctx.totalLastWeek * 0.75 && ctx.totalLastWeek > 500,
    prompt: (ctx: any) =>
      `${ctx.firstName} spent ₹${fmt(ctx.totalThisWeek)} this week vs ₹${fmt(ctx.totalLastWeek)} last week — ${Math.round((1-ctx.totalThisWeek/ctx.totalLastWeek)*100)}% less. Celebrate this with a warm 1-sentence nudge.`,
  },
  {
    id: 'finance_lifestyle_heavy',
    domain: 'finance',
    priority: 78,
    trigger: (ctx: any) => {
      const ls = ctx.spendByCat['Lifestyle & Entertainment'] || 0
      return ls > ctx.totalThisWeek * 0.35 && ctx.totalThisWeek > 500
    },
    prompt: (ctx: any) => {
      const ls = ctx.spendByCat['Lifestyle & Entertainment'] || 0
      return `${ctx.firstName} spent ₹${fmt(ls)} on Lifestyle & Entertainment — ${Math.round(ls/ctx.totalThisWeek*100)}% of this week's total. Their 1-year goal: "${ctx.qData.q15_goal_1year || 'not set'}". Write a friendly nudge connecting today's choices to their goal. No guilt.`
    },
  },
  {
    id: 'finance_no_income_logged',
    domain: 'finance',
    priority: 72,
    trigger: (ctx: any) => ctx.weeklyExpenses > 1000 && ctx.weeklyIncome === 0,
    prompt: (ctx: any) =>
      `${ctx.firstName} has logged ₹${fmt(ctx.weeklyExpenses)} in expenses this week but no income yet. They're a ${ctx.qData.q5_occupation || 'professional'}. Nudge them to log income so savings picture is complete. Light tone.`,
  },
  {
    id: 'finance_goal_pace',
    domain: 'finance',
    priority: 80,
    trigger: (ctx: any) => ctx.topGoal && ctx.topGoal.target > 0 && ctx.monthlyNetSavings > 0,
    prompt: (ctx: any) =>
      `${ctx.firstName}'s goal "${ctx.topGoal.name}" needs ₹${fmt(ctx.topGoal.target - ctx.topGoal.current)} more. At ₹${fmt(ctx.monthlyNetSavings)}/month savings, ~${ctx.monthsToGoal} months to reach. Write encouraging, specific nudge about pace.`,
  },
  {
    id: 'finance_loan_untracked',
    domain: 'finance',
    priority: 65,
    trigger: (ctx: any) => ctx.qData.q11_has_loans === 'Yes' && ctx.weeklyTxCount > 2 && !ctx.hasEMI,
    prompt: (ctx: any) =>
      `${ctx.firstName} has ${(ctx.qData.q11_loan_types || []).join(', ')} loans but hasn't logged an EMI this week. Gently remind to log it. Not alarming.`,
  },

  // ──────── WELLNESS ────────
  {
    id: 'wellness_protein_gap',
    domain: 'wellness',
    priority: 85,
    trigger: (ctx: any) => ctx.weeklyMealsLogged >= 3 && ctx.avgProtein < ctx.proteinTarget * 0.75,
    prompt: (ctx: any) =>
      `${ctx.firstName} averaged ${ctx.avgProtein.toFixed(0)}g protein/day, target ${ctx.proteinTarget}g. Exercise: ${ctx.qData.q21_exercise === 'Yes' ? (ctx.qData.q21_exercise_types||[]).join(', ') : 'not regular'}. Suggest one specific high-protein Indian food to add tomorrow. Practical not preachy.`,
  },
  {
    id: 'wellness_protein_hit',
    domain: 'wellness',
    priority: 70,
    trigger: (ctx: any) => ctx.weeklyMealsLogged >= 4 && ctx.avgProtein >= ctx.proteinTarget * 0.95,
    prompt: (ctx: any) =>
      `${ctx.firstName} hit protein target of ${ctx.proteinTarget}g — averaging ${ctx.avgProtein.toFixed(0)}g/day. 1-sentence celebration that keeps them motivated.`,
  },
  {
    id: 'wellness_low_energy_sleep',
    domain: 'wellness',
    priority: 72,
    trigger: (ctx: any) => ctx.qData.q20_sleep_hours < 6 && ctx.qData.q27_energy_level < 5,
    prompt: (ctx: any) =>
      `${ctx.firstName} sleeps ~${ctx.qData.q20_sleep_hours}h, energy ${ctx.qData.q27_energy_level}/10. Mental drain: ${Array.isArray(ctx.qData.q34_mental_drain) ? ctx.qData.q34_mental_drain.join(', ') : ctx.qData.q34_mental_drain || 'unspecified'}. Warm practical nudge about protecting sleep.`,
  },
  {
    id: 'wellness_consistent_logger',
    domain: 'wellness',
    priority: 65,
    trigger: (ctx: any) => ctx.weeklyMealsLogged >= 6 && ctx.qData.q21_exercise === 'Yes',
    prompt: (ctx: any) =>
      `${ctx.firstName} logged ${ctx.weeklyMealsLogged} meals this week and exercises (${(ctx.qData.q21_exercise_types||[]).join(', ')}). Goal: "${ctx.qData.q15_goal_1year || 'better health'}". Short motivating nudge connecting consistency to their why.`,
  },
  {
    id: 'wellness_smoking_quit',
    domain: 'wellness',
    priority: 60,
    trigger: (ctx: any) => ctx.qData.q24_smoking === 'Trying to quit',
    prompt: (ctx: any) =>
      `${ctx.firstName} is trying to quit smoking. Energy: ${ctx.qData.q27_energy_level}/10. Warm supportive 1-sentence nudge — acknowledge effort, no lecture.`,
  },

  // ──────── GOALS ────────
  {
    id: 'goals_halfway',
    domain: 'goals',
    priority: 92,
    trigger: (ctx: any) => {
      const g = ctx.topGoal
      return g && g.target > 0 && g.current/g.target >= 0.49 && g.current/g.target <= 0.55
    },
    prompt: (ctx: any) =>
      `${ctx.firstName} crossed 50% on goal "${ctx.topGoal.name}" — ₹${fmt(ctx.topGoal.current)} of ₹${fmt(ctx.topGoal.target)}. Genuine specific celebration nudge.`,
  },
  {
    id: 'goals_behind_pace',
    domain: 'goals',
    priority: 80,
    trigger: (ctx: any) => {
      const g = ctx.topGoal
      return g && g.target > 0 && g.current/g.target < 0.2 && ctx.monthlyNetSavings > 0
    },
    prompt: (ctx: any) =>
      `${ctx.firstName}'s goal "${ctx.topGoal.name}" only ${Math.round(ctx.topGoal.current/ctx.topGoal.target*100)}% funded. Biggest obstacle: "${ctx.qData.q17_stopping_you || 'not specified'}". Acknowledge obstacle, suggest one small action.`,
  },
  {
    id: 'goals_almost_there',
    domain: 'goals',
    priority: 88,
    trigger: (ctx: any) => {
      const g = ctx.topGoal
      return g && g.target > 0 && g.current/g.target >= 0.85 && g.current/g.target < 1
    },
    prompt: (ctx: any) =>
      `${ctx.firstName} is ${Math.round(ctx.topGoal.current/ctx.topGoal.target*100)}% to "${ctx.topGoal.name}" — just ₹${fmt(ctx.topGoal.target - ctx.topGoal.current)} to go! Energetic specific final push.`,
  },
  {
    id: 'goals_new_month',
    domain: 'goals',
    priority: 70,
    trigger: (ctx: any) => ctx.isStartOfMonth && ctx.topGoal && ctx.topGoal.target > 0,
    prompt: (ctx: any) =>
      `New month start. ${ctx.firstName}'s goal "${ctx.topGoal.name}" needs ₹${fmt(ctx.topGoal.target - ctx.topGoal.current)} more. Monthly savings: ₹${fmt(ctx.monthlyNetSavings)}. Fresh-start nudge.`,
  },

  // ──────── FAMILY ────────
  {
    id: 'family_sunday_checkin',
    domain: 'family',
    priority: 55,
    trigger: (ctx: any) => ctx.dayOfWeek === 0 && ctx.memberCount > 1,
    prompt: (ctx: any) =>
      `Sunday. ${ctx.firstName}'s family has ${ctx.memberCount} members. Warm weekly check-in nudge — feels like a friend, not an app.`,
  },
  {
    id: 'family_member_not_logging',
    domain: 'family',
    priority: 68,
    trigger: (ctx: any) => ctx.memberCount > 1 && ctx.membersNotLogging.length > 0,
    prompt: (ctx: any) =>
      `In ${ctx.firstName}'s family, ${ctx.membersNotLogging.join(' and ')} haven't logged this week. Light playful nudge to ${ctx.firstName} to check in — not nagging.`,
  },

  // ──────── MINDSET ────────
  {
    id: 'mindset_consistency',
    domain: 'mindset',
    priority: 62,
    trigger: (ctx: any) => ctx.weeklyTxCount >= 5 && ctx.weeklyMealsLogged >= 5,
    prompt: (ctx: any) =>
      `${ctx.firstName} on a roll — ${ctx.weeklyTxCount} transactions, ${ctx.weeklyMealsLogged} meals this week. They want "${Array.isArray(ctx.qData.q36_looking_for) ? ctx.qData.q36_looking_for.join(' and ') : ctx.qData.q36_looking_for || 'better lifestyle'}". 1-sentence connecting consistency to their why.`,
  },
  {
    id: 'mindset_monday_reset',
    domain: 'mindset',
    priority: 58,
    trigger: (ctx: any) => ctx.dayOfWeek === 1 && ctx.totalLastWeek > 0,
    prompt: (ctx: any) =>
      `Monday. ${ctx.firstName} spent ₹${fmt(ctx.totalLastWeek)} last week. 1-year goal: "${ctx.qData.q15_goal_1year || 'not set'}". Fresh-start week nudge.`,
  },
  {
    id: 'mindset_purpose',
    domain: 'mindset',
    priority: 50,
    trigger: (ctx: any) => !!ctx.qData.q35_purpose,
    prompt: (ctx: any) =>
      `${ctx.firstName} shared their reason: "${ctx.qData.q35_purpose}". 1-sentence nudge connecting today to that purpose. Personal and warm.`,
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

  const ctx = await buildContext(supabase, userId, user, inline)

  const { data: recent } = await supabase.from('nudges').select('domain, nudge_text, message, type')
    .eq('user_id', userId).order('sent_at', { ascending: false }).limit(5)
  ctx.recentNudges = (recent || []).map((n: any) => ({
    domain: n.domain || n.type,
    text: n.nudge_text || n.message || '',
    ruleId: n.type,
  }))

  const recentDomains = ctx.recentNudges.slice(0, 2).map((n: any) => n.domain)
  const recentRuleIds = ctx.recentNudges.slice(0, 3).map((n: any) => n.ruleId).filter(Boolean)

  const triggered = NUDGE_RULES
    .filter(r => { try { return r.trigger(ctx) } catch { return false } })
    .filter(r => !recentRuleIds.includes(r.id))
    .sort((a, b) => {
      const penalty = (r: any) => recentDomains.includes(r.domain) ? -20 : 0
      return (b.priority + penalty(b)) - (a.priority + penalty(a))
    })

  const chosen = triggered[0]
  const prompt = chosen ? chosen.prompt(ctx)
    : `Write a warm, encouraging 1-sentence daily nudge for ${ctx.firstName} about their family finances and wellness journey.`
  const domain = chosen?.domain || 'family'
  const ruleId = chosen?.id || 'fallback'

  console.log(`[NUDGE] ${userId} → rule: ${ruleId}`)

  const recentTexts = ctx.recentNudges.map((n: any) => n.text).filter(Boolean)
  const nudgeText = await callClaude(prompt, recentTexts)
  if (!nudgeText) return { user_id: userId, skipped: 'Claude returned empty' }

  const { data: nudge, error } = await supabase.from('nudges').insert({
    user_id: userId, domain, type: ruleId,
    nudge_text: nudgeText, message: nudgeText,
    sent_at: new Date().toISOString(),
  }).select().single()
  if (error) throw error

  const { data: tok } = await supabase.from('push_tokens').select('token').eq('user_id', userId).maybeSingle()
  let pushSent = false
  if (tok?.token) pushSent = await sendPush(tok.token, nudgeText, domain)

  return { user_id: userId, nudge_id: nudge.id, rule: ruleId, domain, text: nudgeText, push_sent: pushSent }
}

async function buildContext(supabase: any, userId: string, user: any, inline: any) {
  const qData = user.questionnaire_data || {}
  const firstName = user.name?.split(' ')[0] || qData.q1_name?.split(' ')[0] || 'there'
  const proteinTarget = Math.round(Number(user.weight || 60) * 1.2)
  const now = new Date()

  if (inline?.user_id && inline?.name) {
    return {
      userId, firstName, qData, proteinTarget,
      dayOfWeek: now.getDay(), isStartOfMonth: now.getDate() <= 3,
      totalThisWeek: inline.weekly_spend || 0, totalLastWeek: 0,
      weeklyExpenses: inline.weekly_spend || 0, weeklyIncome: 0,
      topCat: inline.top_category || '', topCatAmt: inline.weekly_spend || 0,
      spendByCat: {}, weeklyTxCount: inline.weekly_tx_count || 0,
      monthlyNetSavings: 0, avgProtein: 0,
      weeklyMealsLogged: inline.weekly_meals_logged || 0,
      weeklyWaterAvg: inline.weekly_water_avg || 0,
      topGoal: null, monthsToGoal: 0, hasEMI: false,
      memberCount: 1, membersNotLogging: [], familyName: '',
      recentNudges: [],
    }
  }

  const d7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const d14 = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0]

  const [t1, t2, m1, g1, mb1, fam1] = await Promise.all([
    supabase.from('transactions').select('amount,category,date').eq('user_id', userId).gte('date', d7),
    supabase.from('transactions').select('amount,category,date').eq('user_id', userId).gte('date', d14).lt('date', d7),
    supabase.from('meals').select('protein,date').eq('user_id', userId).gte('date', d7),
    supabase.from('goals').select('name,target,current').eq('user_id', userId).gt('target', 0).order('target', { ascending: false }),
    user.family_id ? supabase.from('family_members').select('name,user_id').eq('family_id', user.family_id) : { data: [] },
    user.family_id ? supabase.from('families').select('family_name').eq('id', user.family_id).single() : { data: null },
  ])

  const txThis = t1.data || [], txLast = t2.data || [], meals = m1.data || []
  const goals = g1.data || [], members = mb1.data || []

  const spendByCat: any = {}
  const spendLastByCat: any = {}
  txThis.forEach((t: any) => { spendByCat[t.category] = (spendByCat[t.category] || 0) + Number(t.amount) })
  txLast.forEach((t: any) => { spendLastByCat[t.category] = (spendLastByCat[t.category] || 0) + Number(t.amount) })

  const totalThisWeek = Object.values(spendByCat).reduce((a: any, b: any) => a + b, 0) as number
  const totalLastWeek = Object.values(spendLastByCat).reduce((a: any, b: any) => a + b, 0) as number
  const topEntry = Object.entries(spendByCat).sort((a: any, b: any) => b[1] - a[1])[0]
  const weeklyIncome = txThis.filter((t: any) => t.category === 'Income').reduce((s: number, t: any) => s + Number(t.amount), 0)
  const weeklyExpenses = txThis.filter((t: any) => t.category !== 'Income').reduce((s: number, t: any) => s + Number(t.amount), 0)
  const monthlyNetSavings = Math.max(weeklyIncome - weeklyExpenses, 0)
  const hasEMI = txThis.some((t: any) => ['EMI', 'Loan', 'House Bills'].includes(t.category))

  const totalProtein = meals.reduce((s: number, m: any) => s + (Number(m.protein) || 0), 0)
  const daysLogged = new Set(meals.map((m: any) => m.date)).size || 1
  const avgProtein = totalProtein / daysLogged

  const topGoal = goals[0] || null
  const monthsToGoal = topGoal && monthlyNetSavings > 0
    ? Math.ceil((topGoal.target - topGoal.current) / monthlyNetSavings) : 0

  const membersNotLogging = (members || [])
    .filter((m: any) => m.user_id && m.user_id !== userId).map((m: any) => m.name).slice(0, 2)

  return {
    userId, firstName, qData, proteinTarget,
    dayOfWeek: now.getDay(), isStartOfMonth: now.getDate() <= 3,
    totalThisWeek, totalLastWeek, weeklyExpenses, weeklyIncome,
    topCat: topEntry?.[0] || '', topCatAmt: topEntry?.[1] || 0,
    spendByCat, weeklyTxCount: txThis.length,
    monthlyNetSavings, avgProtein, weeklyMealsLogged: meals.length, weeklyWaterAvg: 0,
    topGoal, monthsToGoal, hasEMI,
    memberCount: members.length, membersNotLogging,
    familyName: fam1.data?.family_name || '',
    recentNudges: [],
  }
}

async function callClaude(situation: string, recentTexts: string[]): Promise<string> {
  const key = Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: `You are a warm, honest family advisor for Indian middle-class families. Rules for every nudge: 1-2 sentences only. Use actual numbers from context. Never use the word "should" or guilt language. Be direct and warm — like a trusted friend. Reference Indian context (₹, Indian foods). Never generic — every nudge must feel written for this specific person.`,
      messages: [{
        role: 'user',
        content: `${situation}\n\n${recentTexts.length ? `Recent nudges (DO NOT repeat these styles):\n${recentTexts.slice(0, 3).join('\n')}` : ''}\n\nReturn ONLY the nudge text. No quotes.`,
      }],
    }),
  })
  if (!res.ok) throw new Error(`Claude ${res.status}`)
  const d = await res.json()
  return d.content?.[0]?.text?.trim() || ''
}

async function sendPush(token: string, message: string, domain: string): Promise<boolean> {
  const titles: any = {
    finance: '💰 Finance Insight', wellness: '🥗 Wellness Nudge',
    goals: '🎯 Goal Update', family: '🏡 Family Check-in', mindset: '✨ Daily Motivation',
  }
  try {
    const r = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title: titles[domain] || '🌿 Family App', body: message, sound: 'default', data: { type: 'nudge', domain }, priority: 'normal' }),
    })
    return r.ok
  } catch { return false }
}
