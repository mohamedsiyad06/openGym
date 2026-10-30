import { describe, expect, it } from 'vitest'
import { LEVELS, LIFTS, ageFactor, spread, levelOf, liftStandards, muscleStandards, overallScore, scoreOf, stepOf, strongWeak, thresholdsFor } from './strength-standards.js'

const NOW = Date.parse('2026-10-30T12:00:00Z')
const day = n => new Date(NOW - n * 864e5).toISOString().slice(0, 10)
const set = (w, r) => ({ w, r, done: true })
const workout = (n, entries) => ({ id: 'w' + n, d: day(n), start: NOW - n * 864e5, end: NOW - n * 864e5 + 3600e3, entries })
const entry = (id, sets) => ({ id, target: { mode: 'reps' }, sets })
const S = (workouts, extra = {}) => ({ unit: 'kg', body: 'male', bodyweight: [{ d: day(1), w: 80, t: NOW - 864e5 }], workouts, goals: { goal: 'strength', age: 30 }, ...extra })
const bench = LIFTS.find(l => l.id === 'bench')

describe('age', () => {
  it('holds 18 to 40 to the adult standard, and asks less outside it', () => {
    expect(ageFactor(25)).toBe(1)
    expect(ageFactor(40)).toBe(1)
    expect(ageFactor(50)).toBeCloseTo(0.9)
    expect(ageFactor(16)).toBeCloseTo(0.94)
    expect(ageFactor(95)).toBe(0.5)
    expect(ageFactor(undefined)).toBe(1)
  })

  it('spreads nine thresholds over the five anchors, scales them, and picks the female table', () => {
    expect(spread([0.5, 0.75, 1, 1.5, 2])).toEqual([0.25, 0.5, 0.625, 0.75, 0.875, 1, 1.25, 1.5, 2])
    expect(thresholdsFor(bench, 'male', 30)).toEqual([0.25, 0.5, 0.625, 0.75, 0.875, 1, 1.25, 1.5, 2])
    expect(thresholdsFor(bench, 'male', 60)).toEqual([0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 1, 1.2, 1.6])
    expect(thresholdsFor(bench, 'female', 30)[1]).toBe(0.25)
  })
})

describe('scores and levels', () => {
  const th = [0.25, 0.5, 0.625, 0.75, 0.875, 1, 1.25, 1.5, 2]
  it('places a ratio between the thresholds', () => {
    expect(scoreOf(0.125, th)).toBe(0.5)
    expect(scoreOf(0.5, th)).toBe(2)
    expect(scoreOf(1.375, th)).toBe(7.5)
    expect(scoreOf(2.4, th)).toBe(9)
    expect(scoreOf(0, th)).toBe(0)
  })
  it('has the ten levels, Bones to The Whammest, and a map step for each', () => {
    expect(LEVELS).toEqual(['bones', 'stickman', 'likkleMan', 'warmingUp', 'patterned', 'sturdy', 'stocky', 'wham', 'hench', 'whammest'])
    expect([0.5, 1, 2.9, 5, 8.2, 9].map(levelOf)).toEqual(['bones', 'stickman', 'likkleMan', 'sturdy', 'hench', 'whammest'])
    expect([0.5, 1, 2.9, 5, 8.2, 9].map(stepOf)).toEqual([1, 2, 3, 6, 9, 10])
  })
})

describe('liftStandards', () => {
  it('reads the best estimated 1RM over body weight, and the next level', () => {
    // 100 kg × 1 at 80 kg body weight: 1.25 × BW, Wham; Hench is 1.5 × BW.
    const lifts = liftStandards(S([workout(3, [entry('0025', [set(100, 1)])])]), { now: NOW })
    const b = lifts.find(l => l.id === 'bench')
    expect(b).toMatchObject({ ratio: 1.25, score: 7, level: 'wham', next: { level: 'hench', ratio: 1.5 } })
    expect(lifts.find(l => l.id === 'squat').ratio).toBeNull()
  })

  it('counts body weight in a pull-up', () => {
    const lifts = liftStandards(S([workout(3, [entry('0652', [set(0, 1)])])]), { now: NOW })
    expect(lifts.find(l => l.id === 'pullup')).toMatchObject({ ratio: 1, level: 'likkleMan' })
  })

  it('leaves out lifts older than a year', () => {
    const lifts = liftStandards(S([workout(400, [entry('0025', [set(100, 1)])])]), { now: NOW })
    expect(lifts.find(l => l.id === 'bench').ratio).toBeNull()
  })

  it('holds an older lifter to a lower bar', () => {
    const w = [workout(3, [entry('0025', [set(100, 1)])])]
    const young = liftStandards(S(w), { now: NOW }).find(l => l.id === 'bench')
    const old = liftStandards(S(w, { goals: { age: 60 } }), { now: NOW }).find(l => l.id === 'bench')
    expect(old.score).toBeGreaterThan(young.score)
  })
})

describe('muscles', () => {
  const lifts = [
    { id: 'bench', score: 4, muscles: { chest: 1, triceps: 0.6, deltoids: 0.5 } },
    { id: 'squat', score: 1, muscles: { quadriceps: 1, gluteal: 0.6 } },
    { id: 'row', score: null, muscles: { 'upper-back': 1 } },
  ]
  it('averages the lifts behind each muscle, and skips unlogged lifts', () => {
    const m = muscleStandards(lifts)
    expect(m).toEqual({ chest: 4, triceps: 4, deltoids: 4, quadriceps: 1, gluteal: 1 })
    expect(overallScore(lifts)).toBe(2.5)
  })
  it('names the strong and the weak points, never the same muscle twice', () => {
    const { strong, weak } = strongWeak({ chest: 4, triceps: 3.8, deltoids: 3, quadriceps: 1, gluteal: 1.5 }, 3)
    expect(strong).toEqual(['chest', 'triceps'])
    expect(weak).toEqual(['quadriceps', 'gluteal'])
    expect(strongWeak({ chest: 2 })).toEqual({ strong: [], weak: [] })
  })
})
