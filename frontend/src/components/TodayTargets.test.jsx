// @vitest-environment happy-dom
//
// Home's targets card: the workout line, the week's sessions, steps from Health Connect against the
// target, and the pace to the target weight. The numbers themselves are lib/goals.js (goals.test.js).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ S: null, health: null, today: '2026-10-28' }))

vi.mock('../store/useStore.js', () => {
  const snap = () => ({ S: mocks.S })
  const useStore = selector => selector ? selector(snap()) : snap()
  useStore.getState = snap
  return { useStore }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: true }))
vi.mock('../lib/health-sync.js', () => ({
  loadHealth: async () => mocks.health,
  onHealthChange: () => () => {},
  enableRead: vi.fn(),
  healthStatus: async () => ({ status: 'available' }),
}))
vi.mock('../lib/format.js', async orig => ({ ...(await orig()), todayISO: () => mocks.today }))

import TodayTargets from './TodayTargets.jsx'

let host, root
const render = async () => { await act(async () => { root.render(<TodayTargets />) }) }
const text = () => host.textContent

beforeEach(() => {
  mocks.S = { unit: 'kg', routines: [], week: {}, dayPlan: {}, workouts: [], queue: null, bodyweight: [{ d: '2026-10-27', w: 90 }], targetW: 81,
    goals: { goal: 'lose', days: [1, 3, 5], active: 'mixed', steps: null } }
  mocks.health = { readSteps: true, steps: { '2026-10-26': 7000, '2026-10-27': 9000, '2026-10-28': 4500 } }
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

describe('TodayTargets', () => {
  it('shows nothing before the questions were asked', async () => {
    mocks.S.goals = null
    await render()
    expect(text()).toBe('')
  })

  it('offers the questions again after they were put off', async () => {
    mocks.S.goals = { skipped: true }
    await render()
    expect(text()).toContain('Set your goals')
  })

  it('shows steps against the target, the average and the weight pace', async () => {
    await render()
    expect(text()).toContain('4,500 / 9,000')
    expect(text()).toContain('4,500 steps to go')
    expect(text()).toContain('Last 7 days: 8,000 a day')
    expect(text()).toContain('90 → 81 kg')
    expect(text()).toContain('9 kg to go')
    expect(text()).toContain('0 of 3 this week')
  })

  it('offers to connect when steps are not read yet', async () => {
    mocks.health = { readSteps: false, steps: {} }
    await render()
    expect(text()).toContain('Aim for 9,000 steps a day.')
    expect(text()).toContain('Connect Google Health')
  })
})
