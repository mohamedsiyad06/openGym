import { describe, expect, it } from 'vitest'
import { applyGoals, hasGoals, needsGoals, stepGoal, stepsAverage, stepsState, trainingDays, weeklySessions, weightPlan, isTrainingDay } from './goals.js'

const base = () => ({ unit: 'kg', bodyweight: [{ d: '2026-10-20', w: 90 }], targetW: null, rateGoal: null, goals: null })

describe('applyGoals', () => {
  it('stores the answers and the target weight, and sets the weekly corridor', () => {
    const S = base()
    applyGoals(S, { goal: 'lose', days: [1, 3, 5], level: 'new', minutes: 45, active: 'desk', targetW: 82.04 }, 99)
    expect(S.goals).toEqual({ goal: 'lose', days: [1, 3, 5], level: 'new', minutes: 45, active: 'desk', steps: null, calories: null, at: 99 })
    expect(S.targetW).toBe(82)
    expect(S.rateGoal).toEqual({ dir: 'lose', by: '%', lo: 0.25, hi: 0.75 })
  })

  it('falls back on sane values for junk answers', () => {
    const S = base()
    applyGoals(S, { goal: 'nope', days: ['x', 9, 2, 2], level: 7, minutes: 'a', steps: 5 })
    expect(S.goals).toMatchObject({ goal: 'fit', days: [2], level: 'some', minutes: 60, active: 'mixed', steps: null })
    expect(S.rateGoal.dir).toBe('hold')
  })

  it('keeps a calorie target in range and drops one that is not', () => {
    expect(applyGoals(base(), { goal: 'fit', calories: 2400.4 }).calories).toBe(2400)
    expect(applyGoals(base(), { goal: 'fit', calories: 200 }).calories).toBeNull()
  })

  it('leaves an earlier target weight alone for goals that do not move the weight', () => {
    const S = { ...base(), targetW: 80 }
    applyGoals(S, { goal: 'strength', days: [1], targetW: 70 })
    expect(S.targetW).toBe(80)
  })
})

describe('asking', () => {
  it('asks until answered or put off', () => {
    expect(needsGoals({})).toBe(true)
    expect(needsGoals({ goals: { skipped: true } })).toBe(false)
    expect(hasGoals({ goals: { skipped: true } })).toBe(false)
    expect(hasGoals({ goals: { goal: 'build' } })).toBe(true)
  })
})

describe('training days', () => {
  it('sorts, dedupes and drops what is not a weekday', () => {
    expect(trainingDays({ days: [5, 1, 1, -1, 7, '3'] })).toEqual([1, 3, 5])
    expect(weeklySessions({ days: [1, 4] })).toBe(2)
    expect(isTrainingDay({ days: [1, 4] }, 4)).toBe(true)
    expect(isTrainingDay({ days: [1, 4] }, 2)).toBe(false)
    expect(trainingDays(null)).toEqual([])
  })
})

describe('steps', () => {
  it('targets by goal, lower for a desk day, and the person\'s own number wins', () => {
    expect(stepGoal({ goal: 'lose', active: 'mixed' })).toBe(9000)
    expect(stepGoal({ goal: 'lose', active: 'desk' })).toBe(7500)
    expect(stepGoal({ goal: 'build' })).toBe(7000)
    expect(stepGoal({ goal: 'lose', steps: 12000 })).toBe(12000)
    expect(stepGoal({ goal: 'lose', steps: 12 })).toBe(9000)
    expect(stepGoal(null)).toBe(8000)
  })

  it('reports what is left today', () => {
    expect(stepsState({ goal: 'fit' }, 3000)).toEqual({ have: 3000, goal: 8000, left: 5000, pct: 38, done: false })
    expect(stepsState({ goal: 'fit' }, 9500)).toMatchObject({ left: 0, pct: 100, done: true })
    expect(stepsState({ goal: 'fit' }, undefined)).toMatchObject({ have: 0, pct: 0 })
  })

  it('averages the days before today', () => {
    const map = { '2026-10-25': 6000, '2026-10-26': 8000, '2026-10-27': 10000, '2026-10-28': 500 }
    expect(stepsAverage(map, '2026-10-28')).toBe(8000)
    expect(stepsAverage(map, '2026-10-28', 2)).toBe(9000)
    expect(stepsAverage({}, '2026-10-28')).toBeNull()
  })
})

describe('weightPlan', () => {
  it('works out the distance and the weeks at an on-pace rate', () => {
    const S = { ...base(), targetW: 81 }
    expect(weightPlan(S)).toEqual({ now: 90, target: 81, left: -9, perWeek: -0.45, weeks: 20 })
  })

  it('also counts up', () => {
    const S = { ...base(), bodyweight: [{ d: 'x', w: 70 }], targetW: 75 }
    const p = weightPlan(S)
    expect(p.left).toBe(5)
    expect(p.perWeek).toBeGreaterThan(0)
    expect(p.weeks).toBe(28)
  })

  it('is null without a weigh-in or a target', () => {
    expect(weightPlan(base())).toBeNull()
    expect(weightPlan({ ...base(), bodyweight: [], targetW: 80 })).toBeNull()
  })
})
