// What the person wants and how they live, asked once (views/GoalSetup.jsx), and what that turns
// into every day: a step target, sessions per week, and the pace to a target weight.
//
// Pure: Home's targets card reads this, and the steps come from lib/health-sync.js (Health
// Connect), which keeps them on the phone. S.goals is { skipped: true } when the questions were
// put off, or { goal, days, level, minutes, active, steps, calories, age, at }. The weight answers go where the
// rest of the app already looks for them: S.targetW (in the profile's unit) and S.rateGoal.

import { KCAL_MAX, KCAL_MIN } from './nutrition.js'

export const GOAL_IDS = ['lose', 'build', 'strength', 'fit']
export const LEVEL_IDS = ['new', 'some', 'exp']
export const ACTIVE_IDS = ['desk', 'mixed', 'feet']

// A daily step target by goal; a desk-bound day starts a little lower, so it is one to hit.
const STEPS_BY_GOAL = { lose: 9000, build: 7000, strength: 7000, fit: 8000 }
const STEPS_DESK_LESS = 1500
export const STEPS_MIN = 1000
export const STEPS_MAX = 40000

// The weekly rate each goal aims at, as a share of body weight (S.rateGoal, lib/bodyweight.js).
const RATE_BY_GOAL = {
  lose: { dir: 'lose', by: '%', lo: 0.25, hi: 0.75 },
  build: { dir: 'gain', by: '%', lo: 0.1, hi: 0.4 },
  strength: { dir: 'hold', by: '%', lo: 0, hi: 0.3 },
  fit: { dir: 'hold', by: '%', lo: 0, hi: 0.3 },
}
// What "on pace" means when working out the date a target weight is reached, per week.
const PACE_PCT = { lose: 0.5, gain: 0.25 }
/** The weekly paces a person can pick, as % of body weight a week (S.goals.pace). */
export const PACE_OPTIONS = [0.25, 0.5, 0.75, 1]
export const PROTEIN_MIN = 30
export const AGE_MIN = 12
export const AGE_MAX = 100
export const PROTEIN_MAX = 400

const whole = (v, lo, hi) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null
}

/** Whether the questions were answered (not put off): the targets card has something to show. */
export const hasGoals = S => !!S?.goals && !S.goals.skipped && GOAL_IDS.includes(S.goals.goal)

/** Whether the questions still have to be asked: never answered and never put off. */
export const needsGoals = S => !S?.goals

/** The training weekdays, 0 (Sunday) to 6, sorted and unique. */
export function trainingDays(goals) {
  const days = Array.isArray(goals?.days) ? goals.days : []
  return [...new Set(days.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
}

/** Sessions a week the person said they will do. */
export const weeklySessions = goals => trainingDays(goals).length

/** The daily step target: the person's own number when they set one, else by goal and day. */
export function stepGoal(goals) {
  const own = whole(goals?.steps, STEPS_MIN, STEPS_MAX)
  if (own) return own
  const base = STEPS_BY_GOAL[goals?.goal] || STEPS_BY_GOAL.fit
  return goals?.active === 'desk' ? base - STEPS_DESK_LESS : base
}

/** Today's steps against the target: { have, goal, left, pct (0..100), done }. */
export function stepsState(goals, steps) {
  const goal = stepGoal(goals)
  const have = Math.max(0, Math.round(Number(steps) || 0))
  return { have, goal, left: Math.max(0, goal - have), pct: Math.min(100, Math.round(have / goal * 100)), done: have >= goal }
}

/** The mean of the last `n` days that have a reading, today left out (it is not over). */
export function stepsAverage(map, today, n = 7) {
  const days = Object.keys(map || {}).filter(d => d < today).sort().slice(-n)
  if (!days.length) return null
  return Math.round(days.reduce((s, d) => s + (Number(map[d]) || 0), 0) / days.length)
}

/**
 * The answers put into the state `S` (mutated): the goals themselves, the target weight when a
 * number was given (the profile's unit), the weekly corridor for the goal, and the training
 * weekdays as the days the person means to train. Nothing else of the profile is touched.
 */
export function applyGoals(S, a, now = Date.now()) {
  const goal = GOAL_IDS.includes(a?.goal) ? a.goal : 'fit'
  S.goals = {
    goal,
    days: trainingDays(a),
    level: LEVEL_IDS.includes(a?.level) ? a.level : 'some',
    minutes: whole(a?.minutes, 10, 240) || 60,
    active: ACTIVE_IDS.includes(a?.active) ? a.active : 'mixed',
    steps: whole(a?.steps, STEPS_MIN, STEPS_MAX),
    // A daily calorie target of the person's own; null leaves it to lib/nutrition.js's guess.
    calories: whole(a?.calories, KCAL_MIN, KCAL_MAX),
    // Years, for the strength standards' age adjustment (lib/strength-standards.js).
    age: whole(a?.age, AGE_MIN, AGE_MAX),
    at: now,
  }
  const w = Number(a?.targetW)
  if (w > 0 && w < 500 && (goal === 'lose' || goal === 'build')) S.targetW = Math.round(w * 10) / 10
  else if (goal !== 'lose' && goal !== 'build') S.targetW = S.targetW ?? null
  S.rateGoal = { ...RATE_BY_GOAL[goal] }
  return S.goals
}

/**
 * Where the body weight stands against the target: { now, target, left (signed, towards the
 * target), weeks (at an on-pace rate, null when the goal does not move the weight), perWeek (the
 * pace in the profile's unit, signed) }. Null without a weigh-in or a target.
 */
export function weightPlan(S) {
  // The pace is the person's own when they picked one (S.goals.pace), else a steady default.
  const last = S?.bodyweight?.length ? S.bodyweight[S.bodyweight.length - 1] : null
  const target = Number(S?.targetW)
  if (!last || !(target > 0) || !(Number(last.w) > 0)) return null
  const now = Number(last.w)
  const left = Math.round((target - now) * 10) / 10
  const dir = left < 0 ? 'lose' : 'gain'
  const own = Number(S?.goals?.pace)
  const pct = PACE_OPTIONS.includes(own) ? own : PACE_PCT[dir]
  const perWeek = Math.round(now * pct / 100 * (left < 0 ? -1 : 1) * 100) / 100
  const weeks = left === 0 ? 0 : Math.max(1, Math.ceil(Math.abs(left) / Math.abs(perWeek)))
  return { now, target, left, weeks, perWeek }
}

/** The training weekdays, 0..6, against today's weekday: has the week got a session left. */
export function isTrainingDay(goals, weekday) {
  return trainingDays(goals).includes(weekday)
}

// The weekly corridor (S.rateGoal) for a goal, centred on the person's own pace when there is one.
function corridorFor(goal, pace) {
  const base = { ...RATE_BY_GOAL[goal] }
  if (!PACE_OPTIONS.includes(pace) || base.dir === 'hold') return base
  return { ...base, lo: Math.round(pace * 0.5 * 100) / 100, hi: Math.round(pace * 1.5 * 100) / 100 }
}

/**
 * One or more answers changed later (the Goals & targets page), in place on the state `S`. Only the
 * keys in `patch` change, each checked the way applyGoals checks it; `null` for steps, calories,
 * protein or pace goes back to the automatic value. A new goal or pace moves the weekly corridor
 * with it. Returns the new goals, or null when there were none to change.
 */
export function updateGoals(S, patch, now = Date.now()) {
  if (!hasGoals(S) || !patch || typeof patch !== 'object') return null
  const g = { ...S.goals }
  if ('goal' in patch && GOAL_IDS.includes(patch.goal)) g.goal = patch.goal
  if ('days' in patch) { const d = trainingDays(patch); if (d.length) g.days = d }
  if ('level' in patch && LEVEL_IDS.includes(patch.level)) g.level = patch.level
  if ('active' in patch && ACTIVE_IDS.includes(patch.active)) g.active = patch.active
  if ('minutes' in patch) { const m = whole(patch.minutes, 10, 240); if (m) g.minutes = m }
  if ('steps' in patch) g.steps = patch.steps == null ? null : whole(patch.steps, STEPS_MIN, STEPS_MAX) ?? g.steps
  if ('calories' in patch) g.calories = patch.calories == null ? null : whole(patch.calories, KCAL_MIN, KCAL_MAX) ?? g.calories
  if ('protein' in patch) g.protein = patch.protein == null ? null : whole(patch.protein, PROTEIN_MIN, PROTEIN_MAX) ?? g.protein
  if ('age' in patch) g.age = patch.age == null ? null : whole(patch.age, AGE_MIN, AGE_MAX) ?? g.age ?? null
  if ('pace' in patch) g.pace = patch.pace == null ? null : (PACE_OPTIONS.includes(Number(patch.pace)) ? Number(patch.pace) : g.pace ?? null)
  g.at = now
  if (g.goal !== S.goals.goal || g.pace !== S.goals.pace) S.rateGoal = corridorFor(g.goal, g.pace)
  S.goals = g
  return g
}
