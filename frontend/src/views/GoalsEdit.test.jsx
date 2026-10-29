// @vitest-environment happy-dom
//
// Goals & targets: every number changes in place and is saved at once, an own number can go back
// to automatic, and a profile that never answered gets the questions instead.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ S: null, nav: vi.fn() }))
const update = vi.fn(mut => { const next = structuredClone(mocks.S); mut(next); mocks.S = next })

vi.mock('../store/useStore.js', () => {
  const snap = () => ({ S: mocks.S, update })
  const useStore = selector => selector ? selector(snap()) : snap()
  useStore.getState = snap
  return { useStore }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.nav }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false }))
vi.mock('../lib/health-sync.js', () => ({ enableRead: vi.fn(), healthStatus: vi.fn(async () => ({ status: 'unsupported' })) }))

import GoalsEdit from './GoalsEdit.jsx'

let host, root
const render = async () => { await act(async () => { root.render(<GoalsEdit />) }) }
const text = () => host.textContent
const row = title => [...host.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === title)
const plus = title => row(title).querySelector('button[aria-label^="Increase"]')
const click = async el => { await act(async () => { el.click() }) }

beforeEach(() => {
  mocks.S = { unit: 'kg', bodyweight: [{ d: '2026-10-27', w: 80 }], workouts: [], targetW: 75, rateGoal: null,
    goals: { goal: 'lose', days: [1, 3, 5], level: 'some', minutes: 60, active: 'mixed', steps: null, calories: null, at: 1 } }
  mocks.nav.mockClear(); update.mockClear()
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

describe('GoalsEdit', () => {
  it('shows the targets as they stand', async () => {
    await render()
    expect(text()).toContain('Goals & targets')
    expect(row('Steps').querySelector('input').value).toBe('9000')
    expect(row('Calories').querySelector('input').value).toBe('2100')
    expect(row('Protein').querySelector('input').value).toBe('160')
    expect(row('Goal weight').querySelector('input').value).toBe('75')
  })

  it('saves a step target of your own, and goes back to automatic', async () => {
    await render()
    await click(plus('Steps'))
    expect(mocks.S.goals.steps).toBe(9500)
    await render()   // the mocked store does not re-render by itself
    expect(row('Use automatic targets')).toBeTruthy()
    await click(row('Use automatic targets'))
    expect(mocks.S.goals).toMatchObject({ steps: null, calories: null, protein: null })
  })

  it('changes the training days, but never to none', async () => {
    mocks.S.goals.days = [1]
    await render()
    const mo = [...host.querySelectorAll('.day-chips .chip')].find(b => b.textContent === 'Mo')
    expect(mo.disabled).toBe(true)
    const tu = [...host.querySelectorAll('.day-chips .chip')].find(b => b.textContent === 'Tu')
    await click(tu)
    expect(mocks.S.goals.days).toEqual([1, 2])
  })

  it('removes the goal weight', async () => {
    await render()
    await click(row('Remove goal weight'))
    expect(mocks.S.targetW).toBeNull()
  })

  it('asks the questions when there are no goals yet', async () => {
    mocks.S.goals = null
    await render()
    expect(text()).toContain('What do you want out of training?')
  })
})
