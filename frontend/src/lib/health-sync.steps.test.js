import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Reading the day's steps from Health Connect for the targets card (lib/goals.js). The plugin and
// the app's data directory are played in memory, as in health-sync.read.test.js.
const h = vi.hoisted(() => {
  vi.stubEnv('VITE_MOBILE', '1')
  return { files: new Map(), calls: [], granted: { steps: true, nutrition: true }, days: [], food: [], fail: null }
})

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    readFile: async ({ path }) => {
      if (!h.files.has(path)) throw new Error('File does not exist')
      return { data: h.files.get(path) }
    },
    writeFile: async ({ path, data }) => { h.files.set(path, data) },
  },
}))
vi.mock('@capacitor/app', () => ({ App: { addListener: () => ({ remove() {} }) } }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android' },
  registerPlugin: () => ({
    status: async () => ({ status: 'available', granted: false, read: { ...h.granted } }),
    requestPermissions: async arg => { h.calls.push(['request', arg]); return { granted: false, read: { ...h.granted } } },
    readSteps: async arg => {
      h.calls.push(['readSteps', arg])
      if (h.fail) throw Object.assign(new Error('no'), { code: h.fail })
      return { days: h.days }
    },
    readNutrition: async arg => {
      h.calls.push(['readNutrition', arg])
      if (h.fail) throw Object.assign(new Error('no'), { code: h.fail })
      return { days: h.food }
    },
    setEnabled: async () => {},
  }),
}))

const NOW = Date.UTC(2026, 9, 28, 12, 0, 0)
const getState = () => ({ workouts: [], bodyweight: [] })
const file = () => JSON.parse(h.files.get('opengym-health.json') || 'null')
let hs
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.resetModules()
  h.files.clear(); h.calls = []; h.granted = { steps: true, nutrition: true }; h.food = []; h.days = [{ d: '2026-10-27', steps: 8123 }, { d: '2026-10-28', steps: 4021 }]; h.fail = null
  hs = await import('./health-sync.js')
})
afterEach(() => { vi.useRealTimers() })

describe('steps', () => {
  it('reads nothing while it is off', async () => {
    await hs.loadHealth()
    await hs.readHealth(getState, { force: true, now: NOW })
    expect(h.calls).toEqual([])
  })

  it('asks for the steps permission only, then keeps the last week by day', async () => {
    const r = await hs.enableRead('steps', getState)
    expect(r.ok).toBe(true)
    expect(h.calls[0]).toEqual(['request', { read: ['steps'], write: [] }])
    expect(h.calls[1]).toEqual(['readSteps', { days: 7 }])
    expect(file()).toMatchObject({ readSteps: true, readHr: false, on: false, steps: { '2026-10-27': 8123, '2026-10-28': 4021 } })
  })

  it('stays off when the permission is not given', async () => {
    h.granted.steps = false
    expect(await hs.enableRead('steps', getState)).toEqual({ ok: false, reason: 'denied' })
    expect(file()).toBeNull()
  })

  it('reads again after a few minutes, not before', async () => {
    await hs.enableRead('steps', getState)
    await hs.readHealth(getState, { now: NOW + 60e3 })
    expect(h.calls.filter(c => c[0] === 'readSteps')).toHaveLength(1)
    h.days = [{ d: '2026-10-28', steps: 5000 }]
    await hs.readHealth(getState, { now: NOW + 11 * 60e3 })
    expect(file().steps).toEqual({ '2026-10-28': 5000 })
  })

  it('reports a withdrawn permission and keeps the last count', async () => {
    await hs.enableRead('steps', getState)
    h.fail = 'permission'
    await hs.readHealth(getState, { now: NOW + 11 * 60e3 })
    expect(file()).toMatchObject({ readError: 'permission', steps: { '2026-10-28': 4021 } })
  })

  it('turning it off clears the counts', async () => {
    await hs.enableRead('steps', getState)
    await hs.disableRead('steps')
    expect(file()).toMatchObject({ readSteps: false, steps: {} })
  })
})

describe('cleanSteps', () => {
  it('keeps plausible whole counts for real days', () => {
    expect(hs.cleanSteps([{ d: '2026-10-28', steps: 1234.6 }, { d: 'x', steps: 5 }, { d: '2026-10-27', steps: -4 }, { d: '2026-10-26', steps: 9e9 }, null]))
      .toEqual({ '2026-10-28': 1235 })
    expect(hs.cleanSteps(undefined)).toEqual({})
  })
})

describe('nutrition', () => {
  const day = (d, extra = {}) => ({ d, kcal: 2100, protein: 150.04, carbs: 230, fat: 70, fiber: 28, sodium: 0, potassium: 3100, ...extra })

  it('asks for the nutrition permission only, then keeps the diary by day', async () => {
    h.food = [day('2026-10-27'), day('2026-10-28', { kcal: 0 })]
    const r = await hs.enableRead('nutrition', getState)
    expect(r.ok).toBe(true)
    expect(h.calls[0]).toEqual(['request', { read: ['nutrition'], write: [] }])
    expect(h.calls[1]).toEqual(['readNutrition', { days: 7 }])
    // A day without calories has no diary; zero nutrients are not kept.
    expect(file().nutrition).toEqual({ '2026-10-27': { kcal: 2100, protein: 150, carbs: 230, fat: 70, fiber: 28, potassium: 3100 } })
    expect(file()).toMatchObject({ readNutrition: true, readSteps: false })
  })

  it('stays off when not granted, and clears on turning off', async () => {
    h.granted.nutrition = false
    expect(await hs.enableRead('nutrition', getState)).toEqual({ ok: false, reason: 'denied' })
    h.granted.nutrition = true
    h.food = [day('2026-10-27')]
    await hs.enableRead('nutrition', getState)
    await hs.disableRead('nutrition')
    expect(file()).toMatchObject({ readNutrition: false, nutrition: {} })
  })
})
