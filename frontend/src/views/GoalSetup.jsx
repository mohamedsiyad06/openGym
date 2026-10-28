// First start, and Settings → Goals: what the person wants and how they live, asked once so Home
// can say what to hit each day (components/TodayTargets.jsx). What the answers turn into is worked
// out in lib/goals.js. On the phone apps the last step offers Health Connect (steps and weigh-ins).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { DAYS, weekOrder, weekStartOf } from '../lib/format.js'
import { MOBILE } from '../lib/mobile.js'
import { GOAL_IDS, applyGoals, stepGoal, trainingDays } from '../lib/goals.js'
import { logWeighIn } from '../lib/bodyweight.js'
import { enableRead, healthStatus } from '../lib/health-sync.js'
import { lastBW } from '../lib/history.js'
import Icon from '../components/Icon.jsx'
import { Button, Segmented, Stepper } from '../components/ui.jsx'

const goalLabel = () => ({
  lose: t('Lose fat'),
  build: t('Build muscle'),
  strength: t('Get stronger'),
  fit: t('Stay fit and healthy'),
})
const goalHint = () => ({
  lose: t('A steady loss with strength training and plenty of walking.'),
  build: t('Slow weight gain, mostly muscle.'),
  strength: t('Heavier lifts over time, weight stays about the same.'),
  fit: t('Move well, feel good, keep the habit.'),
})
const STEPS = ['goal', 'train', 'life', 'body', 'health']

export default function GoalSetup({ onDone } = {}) {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const getState = () => useStore.getState().S
  const prev = S.goals && !S.goals.skipped ? S.goals : null
  const bw = lastBW(S)
  const [i, setI] = useState(0)
  const [a, setA] = useState(() => ({
    goal: prev?.goal || null,
    days: prev ? trainingDays(prev) : [1, 3, 5],
    minutes: prev?.minutes || 60,
    level: prev?.level || 'some',
    active: prev?.active || 'mixed',
    steps: prev?.steps || null,
    weight: bw?.w || null,
    targetW: S.targetW || null,
  }))
  // Fresh profile: the unit can still be chosen here; with data logged, it is changed in Settings
  // (which converts what is there).
  const fresh = !S.workouts.length && !S.bodyweight.length
  const [hc, setHc] = useState(null)   // null: not asked, else { steps, weight } as granted
  const [busy, setBusy] = useState(false)
  const [avail, setAvail] = useState(MOBILE ? null : 'unsupported')
  useEffect(() => { if (MOBILE) healthStatus().then(s => setAvail(s.status)).catch(() => setAvail('unsupported')) }, [])
  const set = patch => setA(x => ({ ...x, ...patch }))
  const step = STEPS[i]
  const unit = S.unit
  const moves = a.goal === 'lose' || a.goal === 'build'
  // What the steppers show when nothing was typed is what gets saved.
  const kgOr = (kg, lb) => (unit === 'kg' ? kg : lb)
  const shownWeight = a.weight || kgOr(70, 155)
  const shownTarget = a.targetW || shownWeight + (a.goal === 'lose' ? -1 : 1) * kgOr(5, 10)

  const finish = async () => {
    update(s => {
      applyGoals(s, { ...a, targetW: moves ? shownTarget : null })
      if (!bw || a.weight) logWeighIn(s, shownWeight)
    })
    if (onDone) onDone(); else nav('/home', { replace: true })
  }
  const skip = () => {
    update(s => { s.goals = { skipped: true } })
    if (onDone) onDone(); else nav('/home', { replace: true })
  }
  const connect = async () => {
    setBusy(true)
    const steps = await enableRead('steps', getState).catch(() => ({ ok: false }))
    const weight = await enableRead('weight', getState).catch(() => ({ ok: false }))
    setHc({ steps: !!steps.ok, weight: !!weight.ok })
    setBusy(false)
  }
  const skipHealth = avail !== 'available'
  const last = i === STEPS.length - 1
  const canNext = step === 'goal' ? !!a.goal : step === 'train' ? a.days.length > 0 : true
  const next = () => (last ? finish() : setI(i + 1))
  const stepsGoal = stepGoal({ goal: a.goal, active: a.active, steps: a.steps })

  return <div className="narrow">
    <div className="hdr">
      <div>
        <h1>{prev ? t('Your goals') : t('Let’s set your goals')}</h1>
        <div className="sub">{t('Step {0} of {1}', i + 1, STEPS.length)}</div>
      </div>
    </div>

    {step === 'goal' && <div className="card">
      <h3>{t('What do you want out of training?')}</h3>
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        {GOAL_IDS.map(id => <button key={id} className={'chip' + (a.goal === id ? ' on' : '')} aria-pressed={a.goal === id}
          style={{ textAlign: 'start', padding: '12px 14px', display: 'block' }} onClick={() => set({ goal: id })}>
          <div style={{ fontWeight: 600 }}>{goalLabel()[id]}</div>
          <div className="dim small nocap">{goalHint()[id]}</div>
        </button>)}
      </div>
    </div>}

    {step === 'train' && <div className="card">
      <h3>{t('Which days can you train?')}</h3>
      <div className="muted small">{t('Pick the days you plan to lift. Your weekly target comes from this.')}</div>
      <div className="chips" style={{ margin: '12px 0' }}>
        {weekOrder(weekStartOf(S)).map(d => <button key={d} className={'chip' + (a.days.includes(d) ? ' on' : '')} aria-pressed={a.days.includes(d)}
          onClick={() => set({ days: a.days.includes(d) ? a.days.filter(x => x !== d) : [...a.days, d] })}>{t(DAYS[d])}</button>)}
      </div>
      <h3>{t('How long is a session?')}</h3>
      <Segmented options={[30, 45, 60, 90].map(m => ({ value: m, label: t('{0} min', m) }))} value={a.minutes} onChange={minutes => set({ minutes })} />
      <div style={{ height: 14 }} />
      <h3>{t('How long have you been lifting?')}</h3>
      <Segmented options={[{ value: 'new', label: t('New') }, { value: 'some', label: t('A while') }, { value: 'exp', label: t('Years') }]}
        value={a.level} onChange={level => set({ level })} />
    </div>}

    {step === 'life' && <div className="card">
      <h3>{t('What does a normal day look like?')}</h3>
      <div className="muted small">{t('This sets your daily step target.')}</div>
      <div style={{ display: 'grid', gap: 8, margin: '12px 0' }}>
        {[['desk', t('Mostly sitting'), t('Desk job, studying, driving.')], ['mixed', t('A bit of both'), t('Some walking around.')], ['feet', t('On my feet'), t('Retail, trades, lots of walking.')]].map(([id, label, hint]) =>
          <button key={id} className={'chip' + (a.active === id ? ' on' : '')} aria-pressed={a.active === id}
            style={{ textAlign: 'start', padding: '12px 14px', display: 'block' }} onClick={() => set({ active: id })}>
            <div style={{ fontWeight: 600 }}>{label}</div>
            <div className="dim small nocap">{hint}</div>
          </button>)}
      </div>
      <h3>{t('Daily steps')}</h3>
      <Stepper value={stepsGoal} step={500} min={1000} max={30000} decimal={false} onChange={v => set({ steps: v })} unit={t('steps')} ariaLabel={t('Daily steps')} />
    </div>}

    {step === 'body' && <div className="card">
      <h3>{t('Your body weight')}</h3>
      <div className="muted small">{moves ? t('Where you are, and where you want to be. Home shows the pace.') : t('Optional. Home can track it for you.')}</div>
      {fresh && <div style={{ margin: '12px 0' }}>
        <Segmented options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} value={unit}
          onChange={u => { if (u !== unit) update(s => { s.unit = u }); setA(x => ({ ...x, weight: null, targetW: null })) }} />
      </div>}
      <div className="dim small">{t('Now')}</div>
      <Stepper value={shownWeight} step={0.5} min={20} max={kgOr(300, 660)} unit={unit} ariaLabel={t('Now')}
        onChange={weight => set({ weight })} />
      {moves && <>
        <div className="dim small" style={{ marginTop: 14 }}>{t('Goal weight')}</div>
        <Stepper value={shownTarget} step={0.5} min={20} max={kgOr(300, 660)} unit={unit} ariaLabel={t('Goal weight')}
          onChange={targetW => set({ targetW })} />
      </>}
    </div>}

    {step === 'health' && <div className="card">
      <div style={{ fontSize: 40, color: 'var(--acc)' }}><Icon name="heart" /></div>
      <h3>{t('Connect Google Health')}</h3>
      {skipHealth
        ? <div className="muted" style={{ lineHeight: 1.5 }}>{avail === 'unsupported' || avail === null
          ? t('Steps and weigh-ins come from Health Connect, on the Android app. You can log them by hand here.')
          : t('Install or update Health Connect, then switch this on in Settings.')}</div>
        : <>
          <div className="muted" style={{ lineHeight: 1.5 }}>{t('openGym reads your steps and your weigh-ins from Health Connect, so Google Fit, Fitbit, Samsung Health and your scale all count. It only reads while the app is open.')}</div>
          {hc
            ? <div className="small" style={{ marginTop: 12, color: hc.steps || hc.weight ? 'var(--green)' : 'var(--orange)' }}>
              {hc.steps && hc.weight ? t('Connected: steps and weight.') : hc.steps || hc.weight ? t('Connected, but one permission was not given.') : t('Not connected. You can try again in Settings.')}</div>
            : <div style={{ marginTop: 14 }}><Button variant="primary" disabled={busy} onClick={connect}>{t('Allow steps and weight')}</Button></div>}
        </>}
    </div>}

    <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
      <Button variant="primary" disabled={!canNext || busy} onClick={next}>{last ? t('Save my targets') : t('Continue')}</Button>
      {i > 0 && <Button variant="ghost" className="dim" onClick={() => setI(i - 1)}>{t('Back')}</Button>}
      {!prev && i === 0 && <Button variant="ghost" className="dim" onClick={skip}>{t('Not now')}</Button>}
      {prev && i === 0 && <Button variant="ghost" className="dim" onClick={() => (onDone ? onDone() : nav(-1))}>{t('Cancel')}</Button>}
    </div>
  </div>
}
