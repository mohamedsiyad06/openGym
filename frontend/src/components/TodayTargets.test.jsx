// @vitest-environment happy-dom
//
// Home's targets card: the workout line, the week's sessions, steps from Health Connect against the
// target, and the pace to the target weight. The numbers themselves are lib/goals.js (goals.test.js).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ S: null, health: null, today: '2026-10-28', sheets: [] }))

vi.mock('../store/useStore.js', () => {
  const snap = () => ({ S: mocks.S })
  const useStore = selector => selector ? selector(snap()) : snap()
  useStore.getState = snap
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ openSheet: render => { mocks.sheets.push(render); return { id: 's', close: () => {} } } })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
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
    expect(text()).toContain('0/3')
  })

  it('offers to connect when steps are not read yet', async () => {
    mocks.health = { readSteps: false, steps: {} }
    await render()
    expect(text()).toContain('Aim for 9,000 steps a day.')
    expect(text()).toContain('Connect Google Health')
  })

  describe('food and the day score', () => {
    const diary = { kcal: 1500, protein: 120, carbs: 150, fat: 50, fiber: 20, potassium: 2000, calcium: 800, sodium: 1800 }
    beforeEach(() => {
      mocks.today = '2026-10-28'
      mocks.health = { readSteps: true, readNutrition: true, steps: { '2026-10-28': 4500 }, nutrition: { '2026-10-28': diary } }
    })

    it('shows the calories left, the macros and a score so far', async () => {
      await render()
      expect(text()).toContain('1,500 / 2,400 kcal')
      expect(text()).toContain('900 kcal left')
      expect(text()).toContain('Protein 120 / 180 g')
      expect(text()).toContain('Day score so far')
    })

    it('opens the macros and micros in a sheet from the food row', async () => {
      mocks.sheets = []
      await render()
      expect(text()).not.toContain('Potassium')
      const row = [...host.querySelectorAll('button')].find(x => x.textContent.includes('kcal left'))
      await act(async () => { row.click() })
      expect(mocks.sheets).toHaveLength(1)
      await act(async () => { root.render(mocks.sheets[0](() => {})) })
      expect(text()).toContain('Potassium')
      expect(text()).toContain('2,000 / 3,400 mg')
      expect(text()).toContain('1,800 / 2,300 mg max')
    })

    it('says so when nothing is logged yet, and offers Cronometer when it is not read', async () => {
      mocks.health = { readSteps: false, readNutrition: true, steps: {}, nutrition: {} }
      await render()
      expect(text()).toContain('Nothing logged in your food diary yet today.')
      await act(async () => root.unmount()); root = createRoot(host)
      mocks.health = { readSteps: false, readNutrition: false, steps: {}, nutrition: {} }
      await render()
      expect(text()).toContain('Aim for 2,400 kcal and 180 g protein.')
      expect(text()).toContain('Connect Cronometer')
    })
  })
})
