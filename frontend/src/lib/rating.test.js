import { describe, expect, it } from 'vitest'
import { labelFor, rateDay, rateSession } from './rating.js'

const set = (w, r, done = true) => ({ w, r, done })
const entry = (id, sets) => ({ id, target: { mode: 'reps' }, sets })
const at = (d, h) => Date.parse(d + 'T' + String(h).padStart(2, '0') + ':00:00Z')
const workout = (d, entries, extra = {}) => ({ id: 'w-' + d, d, start: at(d, 17), end: at(d, 18), entries, ...extra })
const state = (goal, workouts = [], extra = {}) => ({
  unit: 'kg', bodyweight: [{ d: '2026-10-20', w: 80 }], routines: [], week: {}, dayPlan: {}, queue: null,
  goals: { goal, days: [1, 3, 5], minutes: 60, active: 'mixed', calories: null }, workouts, ...extra,
})
// 16 hard sets of 8 reps with a warm-up, an hour long.
const full = reps => [entry('0025', Array.from({ length: 8 }, () => set(60, reps))), entry('0026', Array.from({ length: 8 }, () => set(40, reps)))]

describe('rateSession', () => {
  it('has no rating before the goals are answered, or for a session with nothing done', () => {
    const w = workout('2026-10-28', full(8))
    expect(rateSession({ ...state('build'), goals: null }, w)).toBeNull()
    expect(rateSession(state('build', [w]), workout('2026-10-28', [entry('0025', [set(60, 8, false)])]))).toBeNull()
  })

  it('rates a full hour of 8-rep sets highly for building muscle', () => {
    const w = workout('2026-10-28', full(8))
    const r = rateSession(state('build', [w]), w)
    expect(r.score).toBeGreaterThanOrEqual(85)
    expect(r.label).toBe('Excellent')
    expect(r.parts.find(p => p.id === 'reps').score).toBe(1)
  })

  it('judges the same sets by the goal: 8 reps is half credit-ish for strength, not in range', () => {
    const w = workout('2026-10-28', full(8))
    const build = rateSession(state('build', [w]), w)
    const strength = rateSession(state('strength', [w]), w)
    expect(strength.parts.find(p => p.id === 'reps').score).toBe(0.5)
    expect(strength.score).toBeLessThan(build.score)
    expect(strength.weakest).toBe('reps')
  })

  it('marks down skipped sets and a short session', () => {
    const half = [entry('0025', [...Array.from({ length: 4 }, () => set(60, 8)), ...Array.from({ length: 4 }, () => set(60, 8, false))])]
    const w = workout('2026-10-28', half, { end: at('2026-10-28', 17) + 20 * 60000 })
    const r = rateSession(state('fit', [w]), w)
    expect(r.parts.find(p => p.id === 'done').score).toBe(0.5)
    expect(r.parts.find(p => p.id === 'time').score).toBeCloseTo(0.556, 2)
    expect(r.score).toBeLessThan(60)
  })

  it('rewards beating last time', () => {
    const before = workout('2026-10-26', [entry('0025', Array.from({ length: 8 }, () => set(50, 8)))], { id: 'prev' })
    const w = workout('2026-10-28', full(8))
    const up = rateSession(state('build', [before, w]), w)
    const same = rateSession(state('build', [workout('2026-10-26', [entry('0025', Array.from({ length: 8 }, () => set(60, 8)))], { id: 'prev' }), w]), w)
    expect(up.parts.find(p => p.id === 'progress').score).toBeGreaterThan(same.parts.find(p => p.id === 'progress').score)
  })

  it('leaves out the clock when the session has none', () => {
    const w = workout('2026-10-28', full(8), { start: undefined, end: undefined })
    expect(rateSession(state('build', [w]), w).parts.find(p => p.id === 'time').score).toBeNull()
  })
})

describe('labelFor', () => {
  it('names the bands', () => {
    expect([90, 75, 60, 45, 10].map(labelFor)).toEqual(['Excellent', 'Strong', 'Solid', 'Light', 'Easy day'])
  })
})

describe('rateDay', () => {
  const diary = { kcal: 2100, protein: 160, carbs: 230, fat: 65, fiber: 30, potassium: 3400, calcium: 1000, iron: 12 }

  it('has none without goals or with nothing to judge', () => {
    expect(rateDay({ ...state('lose'), goals: null }, '2026-10-27', {})).toBeNull()
    expect(rateDay(state('lose'), '2026-10-27', { today: '2026-10-28' })).toBeNull() // Tuesday: a rest day
  })

  it('puts the session, steps and food together', () => {
    const w = workout('2026-10-28', full(10))
    const S = state('lose', [w])
    const r = rateDay(S, '2026-10-28', { steps: 9000, nutrition: diary, today: '2026-10-29' })
    expect(r.final).toBe(true)
    expect(r.parts.map(p => p.id)).toEqual(['training', 'steps', 'calories', 'protein', 'macros', 'micros'])
    expect(r.score).toBeGreaterThanOrEqual(80)
  })

  it('counts a missed training day against a finished day, not against today', () => {
    const S = state('build')   // 2026-10-28 is a Wednesday, a training day
    expect(rateDay(S, '2026-10-28', { steps: 7000, today: '2026-10-29' }).parts.find(p => p.id === 'training').score).toBe(0)
    expect(rateDay(S, '2026-10-28', { steps: 7000, today: '2026-10-28' }).parts.map(p => p.id)).toEqual(['steps'])
  })

  it('excuses a day with a note', () => {
    const S = state('build', [], { dayNotes: { '2026-10-28': { tag: 'sick', text: 'flu' } } })
    expect(rateDay(S, '2026-10-28', { steps: 7000, today: '2026-10-29' }).parts.map(p => p.id)).toEqual(['steps'])
  })

  it('scores steps by how close to the target', () => {
    const r = rateDay(state('build'), '2026-10-27', { steps: 3500, today: '2026-10-27' })
    expect(r.score).toBe(50)
  })
})
