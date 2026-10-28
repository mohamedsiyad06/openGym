// A score out of 100 for a gym session and for a whole day, both against the person's goal
// (lib/goals.js). Computed on the fly from what is logged, never stored, so a changed goal or an
// edited workout re-rates the past.
//
// A session is judged on five things, weighted by goal: how much of it was done, how many hard
// sets, how many of them in the rep range the goal wants, whether the lifts went up on last time,
// and how long it ran against the time the person gave. A part with nothing to judge (no rep sets,
// no clock) drops out and the rest re-weigh. A day is the session, steps and food together, each
// only when there is something to judge.
import { isWarmupRow, isSideSet } from './workout-model.js'
import { modeOf } from './history.js'
import { finishCompare } from './finish-compare.js'
import { hasGoals, isTrainingDay, stepsState } from './goals.js'
import { excusedOn } from './day-notes.js'
import { nutritionTargets, scoreNutrition } from './nutrition.js'

// Weights per goal, per part. They need not sum to 1: they are normalised over the parts present.
const WEIGHTS = {
  build: { done: 0.2, volume: 0.3, reps: 0.25, progress: 0.15, time: 0.1 },
  strength: { done: 0.2, volume: 0.2, reps: 0.3, progress: 0.25, time: 0.05 },
  lose: { done: 0.25, volume: 0.25, reps: 0.15, progress: 0.1, time: 0.25 },
  fit: { done: 0.3, volume: 0.2, reps: 0.15, progress: 0.15, time: 0.2 },
}
// Hard sets that make a full session of 60 minutes, per goal.
const SETS_PER_HOUR = { build: 16, strength: 12, lose: 14, fit: 12 }
/** The rep range each goal wants, [from, to]; a set up to 2 reps outside it counts half. */
export const REP_RANGE = { build: [6, 15], strength: [1, 6], lose: [8, 20], fit: [6, 15] }
const PROGRESS_BY_TREND = { 1: 1, 0: 0.75, [-1]: 0.4 }
const NEUTRAL = 0.75

export const PART_LABELS = {
  done: 'Sets done', volume: 'Hard sets', reps: 'Rep range', progress: 'Progress', time: 'Time',
}

const clamp01 = x => Math.max(0, Math.min(1, x))
const doneSet = s => (isSideSet(s) ? s.sides.L.done === true && s.sides.R.done === true : s?.done === true)
const repsOf = s => Math.round(Number(isSideSet(s) ? s.sides.L.r : s?.r) || 0)

/** The label for a score. */
export const labelFor = score => (score >= 85 ? 'Excellent' : score >= 70 ? 'Strong' : score >= 55 ? 'Solid' : score >= 40 ? 'Light' : 'Easy day')

function combine(parts) {
  const have = parts.filter(p => p.score != null && p.weight > 0)
  const total = have.reduce((n, p) => n + p.weight, 0)
  if (!total) return null
  return Math.round(have.reduce((n, p) => n + p.score * p.weight, 0) / total * 100)
}

/**
 * The rating of workout `w` against the goal: { score, label, parts: [{ id, score (0..1) }], weakest }
 * or null when no goal was answered or nothing in the workout was done. `S` holds `w` (the
 * progress part reads the sessions before it).
 */
export function rateSession(S, w) {
  if (!hasGoals(S) || !w) return null
  const goal = S.goals.goal
  const wt = WEIGHTS[goal]
  let total = 0, done = 0, hard = 0
  const repCredits = []
  const range = REP_RANGE[goal]
  for (const e of w.entries || []) {
    const mode = modeOf(e.target || e)
    for (const s of e.sets || []) {
      if (!s || isWarmupRow(s)) continue
      total++
      if (!doneSet(s)) continue
      done++
      if (mode === 'cardio') { hard += (Number(s.min) || 0) / 8; continue }
      hard++
      if (mode !== 'reps') continue
      const r = repsOf(s)
      if (r <= 0) continue
      const off = r < range[0] ? range[0] - r : r > range[1] ? r - range[1] : 0
      repCredits.push(off === 0 ? 1 : off <= 2 ? 0.5 : 0)
    }
  }
  if (!done) return null

  const minutes = Number(S.goals.minutes) || 60
  const target = SETS_PER_HOUR[goal] * Math.max(0.5, Math.min(1.5, minutes / 60))
  let progress = null
  try {
    const rows = finishCompare(S, w)
    if (rows.length) progress = rows.reduce((n, r) => n + (r.trend == null ? NEUTRAL : PROGRESS_BY_TREND[r.trend]), 0) / rows.length
  } catch { /* a lift the planner cannot read: left out */ }
  if (progress != null && Array.isArray(w.prs) && w.prs.length) progress = clamp01(progress + 0.1)
  const mins = Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start ? (w.end - w.start) / 60000 : null
  const ratio = mins == null ? null : mins / minutes

  const parts = [
    { id: 'done', score: done / total },
    { id: 'volume', score: clamp01(hard / target) },
    { id: 'reps', score: repCredits.length ? repCredits.reduce((a, b) => a + b, 0) / repCredits.length : null },
    { id: 'progress', score: progress },
    { id: 'time', score: ratio == null ? null : ratio < 0.6 ? clamp01(ratio / 0.6) : ratio > 1.4 ? Math.max(0.6, 1.4 / ratio) : 1 },
  ].map(p => ({ ...p, weight: wt[p.id] }))
  const score = combine(parts)
  const weakest = parts.filter(p => p.score != null).sort((a, b) => a.score - b.score)[0]
  return { score, label: labelFor(score), parts: parts.map(({ id, score: s }) => ({ id, score: s })), weakest: weakest && weakest.score < 0.8 ? weakest.id : null }
}

/**
 * The rating of one day `iso`: { score, label, parts: [{ id, score }], final } or null with nothing
 * to judge. `steps`: that day's step count or undefined; `nutrition`: that day's diary or
 * undefined. `final` is a day that is over: a training day with no session then counts as missed
 * (unless it carries a note), and eating less than the target counts against it.
 */
export function rateDay(S, iso, { steps, nutrition, today = iso } = {}) {
  if (!hasGoals(S)) return null
  const final = iso < today
  const parts = []
  const workouts = (S.workouts || []).filter(w => w.d === iso)
  const rated = workouts.map(w => rateSession(S, w)).filter(Boolean)
  const planned = isTrainingDay(S.goals, new Date(iso + 'T12:00:00').getDay())
  if (rated.length) parts.push({ id: 'training', score: Math.max(...rated.map(r => r.score)) / 100, weight: 30 })
  else if (workouts.length) parts.push({ id: 'training', score: 0.6, weight: 30 })
  else if (planned && final && !excusedOn(S, iso)) parts.push({ id: 'training', score: 0, weight: 30 })
  if (steps != null) parts.push({ id: 'steps', score: stepsState(S.goals, steps).pct / 100, weight: 20 })
  const nut = scoreNutrition(nutrition, nutritionTargets(S), final)
  if (nut) {
    parts.push({ id: 'calories', score: nut.calories, weight: 20 }, { id: 'protein', score: nut.protein, weight: 15 }, { id: 'macros', score: nut.macros, weight: 10 })
    if (nut.micros != null) parts.push({ id: 'micros', score: nut.micros, weight: 15 })
  }
  const score = combine(parts)
  if (score == null) return null
  return { score, label: labelFor(score), parts: parts.map(({ id, score: s }) => ({ id, score: s })), final }
}
