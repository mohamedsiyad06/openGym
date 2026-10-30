// @vitest-environment happy-dom
//
// The strength standards screen: lifts placed on levels, the muscles they speak for, strong and
// weak points, and the prompts for a missing weigh-in or age. The levels are lib/strength-standards.js.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ S: null, nav: vi.fn() }))
vi.mock('../store/useStore.js', () => {
  const snap = () => ({ S: mocks.S })
  const useStore = selector => selector ? selector(snap()) : snap()
  useStore.getState = snap
  return { useStore }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.nav }))
vi.mock('../sheets.jsx', () => ({ bwSheet: vi.fn() }))
vi.mock('../components/BodyMap.jsx', () => ({ default: ({ levels }) => <div data-testid="map">{JSON.stringify(levels)}</div> }))

import StrengthStandards from './StrengthStandards.jsx'

const NOW = Date.now()
const day = n => new Date(NOW - n * 864e5).toISOString().slice(0, 10)
const workout = (n, id, w, r) => ({ id: 'w' + n + id, d: day(n), start: NOW - n * 864e5, end: NOW - n * 864e5 + 3600e3,
  entries: [{ id, target: { mode: 'reps' }, sets: [{ w, r, done: true }] }] })

let host, root
const render = async () => { await act(async () => { root.render(<StrengthStandards />) }) }
const text = () => host.textContent

beforeEach(() => {
  mocks.S = { unit: 'kg', body: 'male', bodyweight: [{ d: day(1), w: 80, t: NOW - 864e5 }], goals: { goal: 'strength', age: 30 },
    workouts: [workout(3, '0025', 100, 1), workout(4, '0043', 80, 1)] }
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

describe('StrengthStandards', () => {
  it('places each logged lift and says what the next level asks', async () => {
    await render()
    // Bench 100 kg at 80 kg: 1.25 × BW, Wham; Hench is 1.5 × 80 = 120 kg.
    expect(text()).toContain('Bench press')
    expect(text()).toContain('Wham · 1RM about 100 kg (1.25 × BW)')
    expect(text()).toContain('120 kg for Hench')
    // Squat 80 kg: 1 × BW, Warming Up; Patterned is 1.25 × 80 = 100 kg.
    expect(text()).toContain('Warming Up · 1RM about 80 kg (1.00 × BW)')
    expect(text()).toContain('100 kg for Patterned')
    expect(text()).toContain('Not logged in the last year. Stocky is about 160 kg.')   // deadlift: 2 × 80
  })

  it('colours the muscles by level, and names strong and weak points', async () => {
    await render()
    const levels = JSON.parse(host.querySelector('[data-testid="map"]').textContent)
    expect(levels.chest).toBe(8)        // Wham
    expect(levels.quadriceps).toBe(4)   // Warming Up
    expect(text()).toContain('Strong points')
    expect(text()).toContain('Weak points')
  })

  it('asks for a weigh-in and an age when they are missing', async () => {
    mocks.S.bodyweight = []
    mocks.S.goals = { goal: 'strength' }
    await render()
    expect(text()).toContain('Log your body weight')
    expect(text()).toContain('Add your age')
  })

  it('says what to log when nothing counts yet', async () => {
    mocks.S.workouts = []
    await render()
    expect(text()).toContain('No lifts yet')
  })
})
