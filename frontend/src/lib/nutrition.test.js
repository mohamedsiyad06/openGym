import { describe, expect, it } from 'vitest'
import { hasDiary, nutritionTargets, scoreNutrition, suggestCalories, weightKg } from './nutrition.js'

const S = (goal, over = {}) => ({ unit: 'kg', bodyweight: [{ d: '2026-10-27', w: 80 }], goals: { goal, active: 'mixed', calories: null }, ...over })

describe('targets', () => {
  it('guess a calorie target by goal and activity, to the nearest 50', () => {
    expect(suggestCalories('fit', 'mixed', 80)).toBe(2650)
    expect(suggestCalories('lose', 'mixed', 80)).toBe(2100)
    expect(suggestCalories('build', 'feet', 80)).toBe(3150)
    expect(suggestCalories('lose', 'desk', 0)).toBeNull()
  })

  it('builds macros from the calories and the body weight', () => {
    const t = nutritionTargets(S('lose'))
    expect(t).toMatchObject({ kcal: 2100, protein: 160, fat: 65, fiber: 29, sodiumMax: 2300 })
    expect(t.carbs).toBe(Math.round((2100 - 160 * 4 - 65 * 9) / 4))
  })

  it('takes the person\'s own calories, and works in pounds', () => {
    const s = S('build', { unit: 'lb', bodyweight: [{ d: 'x', w: 176.4 }] })
    s.goals.calories = 3000
    expect(weightKg(s)).toBeCloseTo(80, 1)
    expect(nutritionTargets(s).kcal).toBe(3000)
  })

  it('has none before the goals are answered or without a weight or calories', () => {
    expect(nutritionTargets({ goals: null })).toBeNull()
    expect(nutritionTargets({ goals: { skipped: true } })).toBeNull()
    expect(nutritionTargets(S('fit', { bodyweight: [] }))).toBeNull()
    const g = S('fit', { bodyweight: [] }); g.goals.calories = 2200
    expect(nutritionTargets(g)).toMatchObject({ kcal: 2200, protein: 138 })
  })
})

describe('scoreNutrition', () => {
  const T = { kcal: 2000, protein: 150, carbs: 220, fat: 60, fiber: 28, sodiumMax: 2300 }
  const good = { kcal: 2050, protein: 155, carbs: 225, fat: 62, fiber: 30, potassium: 3500, calcium: 1000, iron: 14, sodium: 2000 }

  it('has no score without a diary', () => {
    expect(hasDiary({ kcal: 0 })).toBe(false)
    expect(scoreNutrition(null, T, true)).toBeNull()
    expect(scoreNutrition({ kcal: 0 }, T, true)).toBeNull()
  })

  it('gives a good day full marks', () => {
    expect(scoreNutrition(good, T, true)).toEqual({ calories: 1, protein: 1, macros: 1, micros: 1 })
  })

  it('marks a finished day down for eating too little, but today only for too much', () => {
    const light = { ...good, kcal: 1200 }
    expect(scoreNutrition(light, T, true).calories).toBeCloseTo(0.25, 2)
    expect(scoreNutrition(light, T, false).calories).toBe(1)
    expect(scoreNutrition({ ...good, kcal: 2800 }, T, false).calories).toBeCloseTo(0.25, 2)
  })

  it('counts protein as progress and caps it', () => {
    expect(scoreNutrition({ ...good, protein: 75 }, T, false).protein).toBe(0.5)
    expect(scoreNutrition({ ...good, protein: 300 }, T, false).protein).toBe(1)
  })

  it('leaves micros out when the diary reports too few, and marks too much sodium down', () => {
    expect(scoreNutrition({ kcal: 2000, protein: 150, carbs: 220, fat: 60, fiber: 30 }, T, true).micros).toBeNull()
    expect(scoreNutrition({ ...good, sodium: 3450 }, T, true).micros).toBeCloseTo((4 + 0.5) / 5, 5)
  })
})
