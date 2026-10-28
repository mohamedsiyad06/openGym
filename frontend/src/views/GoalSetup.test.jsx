// @vitest-environment happy-dom
//
// The goals questions: what reaches the profile (S.goals, the target weight, the first weigh-in),
// that they can be put off, and that a goal has to be picked before going on.
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

import GoalSetup from './GoalSetup.jsx'

let host, root
const render = async () => { await act(async () => { root.render(<GoalSetup />) }) }
const click = async text => {
  const b = [...host.querySelectorAll('button')].find(x => x.textContent.includes(text))
  expect(b, text).toBeTruthy()
  await act(async () => { b.click() })
}
const has = text => host.textContent.includes(text)

beforeEach(() => {
  mocks.S = { unit: 'kg', bodyweight: [], workouts: [], targetW: null, rateGoal: null, goals: null }
  mocks.nav.mockClear(); update.mockClear()
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

describe('GoalSetup', () => {
  it('will not go on before a goal is picked', async () => {
    await render()
    const cont = [...host.querySelectorAll('button')].find(b => b.textContent === 'Continue')
    expect(cont.disabled).toBe(true)
    await click('Lose fat')
    expect(cont.disabled).toBe(false)
  })

  it('saves the goals, a target weight and the first weigh-in, then goes home', async () => {
    await render()
    await click('Lose fat')
    await click('Continue')           // days
    expect(has('Which days can you train?')).toBe(true)
    await click('Continue')           // life
    await click('Mostly sitting')
    await click('Continue')           // body
    expect(has('Your body weight')).toBe(true)
    await click('Continue')           // health (not on the web)
    expect(has('Connect Google Health')).toBe(true)
    await click('Save my targets')
    const S = mocks.S
    expect(S.goals).toMatchObject({ goal: 'lose', days: [1, 3, 5], active: 'desk', level: 'some', minutes: 60 })
    expect(S.targetW).toBe(65)        // the 70 kg default, 5 kg lighter
    expect(S.bodyweight).toHaveLength(1)
    expect(S.bodyweight[0].w).toBe(70)
    expect(S.rateGoal.dir).toBe('lose')
    expect(mocks.nav).toHaveBeenCalledWith('/home', { replace: true })
  })

  it('can be put off, which is remembered so it is not asked again', async () => {
    await render()
    await click('Not now')
    expect(mocks.S.goals).toEqual({ skipped: true })
    expect(mocks.nav).toHaveBeenCalledWith('/home', { replace: true })
  })

  it('needs at least one training day', async () => {
    await render()
    await click('Get stronger')
    await click('Continue')
    for (const d of ['Mo', 'We', 'Fr']) await click(d)
    const cont = [...host.querySelectorAll('button')].find(b => b.textContent === 'Continue')
    expect(cont.disabled).toBe(true)
  })
})
