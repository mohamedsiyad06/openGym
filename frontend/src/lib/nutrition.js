// What to eat each day, from the goals (lib/goals.js) and the body weight, and how a logged day
// measures up. The food itself comes from Health Connect (Cronometer writes its diary there; see
// lib/health-sync.js), as { [day]: { kcal, protein, carbs, fat, fiber, sodium, ... } }.
//
// Rough, population-level numbers, not medical advice: a maintenance guess per kg of body weight,
// a protein figure per kg by goal, and a generic adult reference for the micronutrients. The
// person's own calorie number (S.goals.calories) replaces the guess.
import { LB_PER_KG } from './health-read.js'

// Maintenance guess in kcal per kg of body weight, by how active the day is, and what each goal
// does to it.
const KCAL_PER_KG = { desk: 30, mixed: 33, feet: 36 }
const GOAL_FACTOR = { lose: 0.8, build: 1.1, strength: 1.0, fit: 1.0 }
const PROTEIN_PER_KG = { lose: 2.0, build: 1.8, strength: 1.8, fit: 1.4 }
export const KCAL_MIN = 800
export const KCAL_MAX = 6000

/** [key, label, unit, daily reference] of the micronutrients scored, most useful first. */
export const MICROS = [
  ['fiber', 'Fiber', 'g', 30],
  ['potassium', 'Potassium', 'mg', 3400],
  ['calcium', 'Calcium', 'mg', 1000],
  ['iron', 'Iron', 'mg', 12],
  ['magnesium', 'Magnesium', 'mg', 400],
  ['zinc', 'Zinc', 'mg', 11],
  ['vitC', 'Vitamin C', 'mg', 90],
  ['vitD', 'Vitamin D', 'µg', 15],
]
export const SODIUM_MAX = 2300
// Fewer reported micronutrients than this and the micros are not scored: the diary does not track them.
export const MICROS_MIN_REPORTED = 3

/** The latest weigh-in in kilograms, or null. */
export function weightKg(S) {
  const last = S?.bodyweight?.length ? S.bodyweight[S.bodyweight.length - 1] : null
  const w = Number(last?.w)
  if (!(w > 0)) return null
  return S.unit === 'lb' ? w / LB_PER_KG : w
}

/** A calorie number to start from: maintenance guess, moved by the goal, to the nearest 50. */
export function suggestCalories(goal, active, kg) {
  if (!(kg > 0)) return null
  const kcal = kg * (KCAL_PER_KG[active] || KCAL_PER_KG.mixed) * (GOAL_FACTOR[goal] || 1)
  return Math.min(KCAL_MAX, Math.max(KCAL_MIN, Math.round(kcal / 50) * 50))
}

/** The day's targets { kcal, protein, carbs, fat, fiber, sodiumMax }, or null without a basis. */
export function nutritionTargets(S) {
  const g = S?.goals
  if (!g || g.skipped || !g.goal) return null
  const kg = weightKg(S)
  const kcal = Number(g.calories) > 0 ? Math.round(Number(g.calories)) : suggestCalories(g.goal, g.active, kg)
  if (!kcal) return null
  const protein = Math.round(kg ? kg * (PROTEIN_PER_KG[g.goal] || 1.6) : kcal * 0.25 / 4)
  const fat = Math.round(kcal * 0.28 / 9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { kcal, protein, carbs, fat, fiber: Math.max(25, Math.round(kcal / 1000 * 14)), sodiumMax: SODIUM_MAX }
}

/** Whether a day's record holds a diary at all. */
export const hasDiary = n => !!n && Number(n.kcal) > 0

// How a number scores against its target: 1 inside ±10%, falling to 0 at ±50%. `over` only: a day
// that is not over yet is not marked down for what is still to eat.
const closeness = (have, target, overOnly) => {
  const r = have / target
  const dev = overOnly ? Math.max(0, r - 1) : Math.abs(r - 1)
  return Math.max(0, Math.min(1, 1 - (dev - 0.1) / 0.4))
}

/**
 * The scores (0..1) of a logged day `n` against `targets`. `final` is a finished day: eating less
 * than the target then counts against it, where today it is still to come. Micros is null when the
 * diary reports too few of them.
 */
export function scoreNutrition(n, targets, final) {
  if (!hasDiary(n) || !targets) return null
  const calories = closeness(n.kcal, targets.kcal, !final)
  const protein = Math.min(1, (Number(n.protein) || 0) / targets.protein)
  const macros = (closeness(Number(n.carbs) || 0, targets.carbs || 1, !final) + closeness(Number(n.fat) || 0, targets.fat, !final)) / 2
  const shown = MICROS.filter(([k]) => Number(n[k]) > 0)
  let micros = null
  if (shown.length >= MICROS_MIN_REPORTED) {
    const parts = shown.map(([k, , , ref]) => Math.min(1, n[k] / (k === 'fiber' ? targets.fiber : ref)))
    if (Number(n.sodium) > 0) parts.push(Math.max(0, 1 - Math.max(0, n.sodium / targets.sodiumMax - 1)))
    micros = parts.reduce((a, b) => a + b, 0) / parts.length
  }
  return { calories, protein, macros, micros }
}
