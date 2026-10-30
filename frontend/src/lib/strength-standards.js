// Strength standards: each main lift's best estimated 1RM against body weight, placed on ten
// levels (Bones up to The Whammest) for the lifter's sex and age, and from the lifts a level for every muscle, so the body
// map can show strong points and weak points (views/StrengthStandards.jsx).
//
// The table is our own: round multiples of body weight in line with the ratios commonly quoted in
// strength-training writing for adult lifters, not any app's or site's dataset. It is a rough
// guide, not a test result. Ages under 18 and over 40 lower what each level asks, by a simple
// curve shaped like the masters age coefficients used in powerlifting (about 1% a year after 40).
//
// The lift's number is lib/relative-strength.js relativeSeries: the best estimated 1RM of a
// workout over the body weight of that day, with body weight added for pull-ups and dips, so
// one number works for barbell and bodyweight lifts alike.
import { relativeSeries } from './relative-strength.js'

/** The ten levels, weakest first. Bones is everything below the first threshold. */
export const LEVELS = ['bones', 'stickman', 'likkleMan', 'warmingUp', 'patterned', 'sturdy', 'stocky', 'wham', 'hench', 'whammest']
/** How many thresholds a lift has: one per level above Bones. */
export const STEPS = LEVELS.length - 1

// Five anchors per lift, × body weight for a 1RM: [beginner, novice, intermediate, advanced, elite]
// in the usual wording. The nine thresholds of the ten levels are spread over them (spread()).
// `ids`: the catalogue exercises that count for it, the usual variant first.
// `muscles`: how much each muscle is behind the lift, 0..1, for the per-muscle level.
export const LIFTS = [
  { id: 'squat', name: 'Squat', ids: ['0043', '3593'], male: [0.75, 1.25, 1.5, 2.25, 2.75], female: [0.5, 0.75, 1.25, 1.5, 2],
    muscles: { quadriceps: 1, gluteal: 0.6, adductors: 0.5, 'lower-back': 0.3 } },
  { id: 'frontSquat', name: 'Front squat', ids: ['0042'], male: [0.6, 1, 1.25, 1.75, 2.25], female: [0.4, 0.6, 1, 1.25, 1.6],
    muscles: { quadriceps: 1, gluteal: 0.4, abs: 0.3 } },
  { id: 'deadlift', name: 'Deadlift', ids: ['0032', '0117'], male: [1, 1.5, 2, 2.5, 3], female: [0.5, 1, 1.25, 1.75, 2.5],
    muscles: { 'lower-back': 1, hamstring: 0.8, gluteal: 0.8, trapezius: 0.6, forearm: 0.5, 'upper-back': 0.3 } },
  { id: 'hipThrust', name: 'Hip thrust', ids: ['1060'], male: [0.75, 1.25, 1.75, 2.5, 3.25], female: [0.5, 1, 1.5, 2.25, 3],
    muscles: { gluteal: 1, hamstring: 0.5 } },
  { id: 'bench', name: 'Bench press', ids: ['0025'], male: [0.5, 0.75, 1, 1.5, 2], female: [0.25, 0.5, 0.75, 1, 1.5],
    muscles: { chest: 1, triceps: 0.6, deltoids: 0.5 } },
  { id: 'ohp', name: 'Overhead press', ids: ['1162', '0091'], male: [0.35, 0.55, 0.75, 1, 1.25], female: [0.2, 0.35, 0.5, 0.75, 1],
    muscles: { deltoids: 1, triceps: 0.6, trapezius: 0.4 } },
  { id: 'dip', name: 'Dip', ids: ['0251', '0814'], male: [1, 1.2, 1.5, 1.8, 2.1], female: [0.7, 0.9, 1.1, 1.4, 1.7],
    muscles: { triceps: 1, chest: 0.7, deltoids: 0.3 } },
  { id: 'row', name: 'Barbell row', ids: ['0027', '3017'], male: [0.5, 0.75, 1, 1.5, 1.75], female: [0.25, 0.4, 0.65, 0.9, 1.2],
    muscles: { 'upper-back': 1, trapezius: 0.5, biceps: 0.5, 'lower-back': 0.3 } },
  { id: 'pullup', name: 'Pull-up', ids: ['0652', '0841', '1326'], male: [1, 1.1, 1.3, 1.6, 1.9], female: [0.7, 0.9, 1.05, 1.3, 1.55],
    muscles: { 'upper-back': 1, biceps: 0.6, forearm: 0.4 } },
  { id: 'curl', name: 'Barbell curl', ids: ['0031'], male: [0.2, 0.4, 0.6, 0.85, 1.15], female: [0.1, 0.2, 0.4, 0.6, 0.85],
    muscles: { biceps: 1, forearm: 0.6 } },
]

/** How much of the adult standard a lifter of `age` is held to: 1 from 18 to 40. */
export function ageFactor(age) {
  const a = Number(age)
  if (!Number.isFinite(a) || a <= 0) return 1
  if (a < 18) return Math.max(0.8, 1 - (18 - a) * 0.03)
  if (a <= 40) return 1
  return Math.max(0.5, 1 - (a - 40) * 0.01)
}

/**
 * The nine thresholds from the five anchors [b, n, i, a, e]: Stickman at half of b, Likkle Man at
 * b, Warming Up halfway to n, Patterned at n, Sturdy halfway to i, Stocky at i, Wham halfway to a,
 * Hench at a and The Whammest at e.
 */
export function spread([b, n, i, a, e]) {
  return [b / 2, b, (b + n) / 2, n, (n + i) / 2, i, (i + a) / 2, a, e]
}

/** The nine thresholds (× body weight) of a lift for this lifter. */
export function thresholdsFor(lift, sex, age) {
  const f = ageFactor(age)
  return spread(sex === 'female' ? lift.female : lift.male).map(x => Math.round(x * f * 1000) / 1000)
}

/**
 * Where a ratio sits on the thresholds, as a number from 0 to 9: below the first it is the share
 * of the way to it (0..1, Bones), between two thresholds it is the lower one's number (1 =
 * Stickman) plus the share of the way to the next, from the last (The Whammest) on it is 9.
 */
export function scoreOf(ratio, th) {
  const r = Number(ratio)
  if (!(r > 0)) return 0
  if (r < th[0]) return r / th[0]
  for (let i = 0; i < th.length - 1; i++) if (r < th[i + 1]) return i + 1 + (r - th[i]) / (th[i + 1] - th[i])
  return th.length
}

/** The level a score stands at, one of LEVELS. */
export const levelOf = score => LEVELS[Math.max(0, Math.min(STEPS, Math.floor(score)))]

/** A score's step on the body map, 1 (Bones) to 10 (The Whammest). */
export const stepOf = score => Math.max(1, Math.min(LEVELS.length, Math.floor(score) + 1))

/**
 * Every lift: { id, name, ex (the exercise the best came from), ratio, score, level, next (the
 * next level's name and its ratio), thresholds, d (the day of the best) } or with ratio null when
 * none of its exercises was logged in the window. `now` and `days` set the window (a year).
 */
export function liftStandards(S, { sex = S?.body === 'female' ? 'female' : 'male', age = S?.goals?.age, now = Date.now(), days = 365 } = {}) {
  const since = now - days * 864e5
  return LIFTS.map(lift => {
    const th = thresholdsFor(lift, sex, age)
    let best = null
    for (const ex of lift.ids) {
      for (const p of relativeSeries(S, ex)) {
        if (!(p.t >= since) || p.assisted && lift.id !== 'pullup' && lift.id !== 'dip') continue
        if (!best || p.y > best.ratio) best = { ratio: p.y, ex, d: p.d }
      }
    }
    const base = { id: lift.id, name: lift.name, thresholds: th, muscles: lift.muscles }
    if (!best) return { ...base, ratio: null, score: null, level: null, next: null }
    const score = scoreOf(best.ratio, th)
    const at = Math.min(STEPS, Math.floor(score))
    const next = at < STEPS ? { level: LEVELS[at + 1], ratio: th[at] } : null
    return { ...base, ex: best.ex, d: best.d, ratio: Math.round(best.ratio * 1000) / 1000, score: Math.round(score * 100) / 100, level: levelOf(score), next }
  })
}

/**
 * Every muscle that a logged lift says something about: { [muscle]: score }, each the mean of
 * its lifts' scores weighted by how much the muscle is behind each.
 */
export function muscleStandards(lifts) {
  const sum = {}, weight = {}
  for (const l of lifts) {
    if (l.score == null) continue
    for (const [m, w] of Object.entries(l.muscles)) {
      sum[m] = (sum[m] || 0) + l.score * w
      weight[m] = (weight[m] || 0) + w
    }
  }
  const out = {}
  for (const m of Object.keys(sum)) out[m] = Math.round(sum[m] / weight[m] * 100) / 100
  return out
}

/** The overall score: the mean of the logged lifts, or null with none. */
export function overallScore(lifts) {
  const s = lifts.filter(l => l.score != null).map(l => l.score)
  return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length * 100) / 100 : null
}

/** The strongest and the weakest muscles, `n` each, by score; a muscle is only in one of them. */
export function strongWeak(muscles, n = 3) {
  const sorted = Object.entries(muscles).sort((a, b) => b[1] - a[1])
  // At most half each, so with few muscles nothing is called both strong and weak.
  const k = Math.min(n, Math.floor(sorted.length / 2))
  if (!k) return { strong: [], weak: [] }
  return { strong: sorted.slice(0, k).map(([m]) => m), weak: sorted.slice(-k).reverse().map(([m]) => m) }
}
