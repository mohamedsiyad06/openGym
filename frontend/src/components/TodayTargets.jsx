// Home: what to hit today, from the goals asked in views/GoalSetup.jsx (worked out in lib/goals.js).
// Three rows: the workout (today and the week), steps (Health Connect, phone app) and the weight
// against the target. Steps are read on the phone and never leave it (lib/health-sync.js).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t, tn, dateLocale } from '../lib/i18n.js'
import { todayISO, fmtNum } from '../lib/format.js'
import { MOBILE } from '../lib/mobile.js'
import { effectiveRoutines } from '../lib/history.js'
import { weekTally } from '../lib/queue.js'
import { hasGoals, isTrainingDay, stepsAverage, stepsState, weeklySessions, weightPlan } from '../lib/goals.js'
import { loadHealth, onHealthChange, enableRead, healthStatus } from '../lib/health-sync.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

function Bar({ pct, done }) {
  return <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
    style={{ height: 8, borderRadius: 4, background: 'var(--fill, rgba(127,127,127,.2))', overflow: 'hidden', margin: '6px 0' }}>
    <div style={{ width: pct + '%', height: '100%', background: done ? 'var(--green)' : 'var(--acc)', transition: 'width .3s' }} />
  </div>
}

export default function TodayTargets() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [h, setH] = useState(null)
  const [busy, setBusy] = useState(false)
  const [avail, setAvail] = useState(null)
  useEffect(() => {
    if (!MOBILE) return undefined
    loadHealth().then(setH).catch(() => {})
    healthStatus().then(s => setAvail(s.status)).catch(() => {})
    return onHealthChange(setH)
  }, [])

  if (!S.goals) return null
  if (!hasGoals(S)) {
    return <div className="card">
      <div className="row" style={{ gap: 10 }}>
        <div style={{ flex: 1 }}><b>{t('Set your goals')}</b><div className="dim small">{t('Tell openGym what you are aiming for and it shows what to hit each day.')}</div></div>
        <Button size="sm" variant="tinted" onClick={() => nav('/goals')}>{t('Start')}</Button>
      </div>
    </div>
  }

  const today = todayISO()
  const goals = S.goals
  const routines = effectiveRoutines(S, today)
  const doneToday = S.workouts.some(w => w.d === today)
  const planned = isTrainingDay(goals, new Date().getDay())
  const { done: doneWeek } = weekTally(S, today)
  const perWeek = weeklySessions(goals)
  const left = Math.max(0, perWeek - doneWeek)
  const steps = h?.readSteps ? stepsState(goals, h.steps?.[today]) : null
  const avg = h?.readSteps ? stepsAverage(h.steps, today) : null
  const wp = weightPlan(S)

  const workoutLine = doneToday ? t('Done today. Nice work.')
    : routines.length ? t('Today: {0}', routines.map(r => r.name).join(' + '))
      : planned ? t('Training day. Pick a routine to start.') : t('Rest day. Keep moving.')
  const connect = async () => {
    setBusy(true)
    try { setH((await enableRead('steps', () => useStore.getState().S)).health || await loadHealth()) } catch { /* shown as not connected */ }
    setBusy(false)
  }
  const eta = wp && wp.weeks > 0 ? new Date(Date.now() + wp.weeks * 7 * 864e5).toLocaleDateString(dateLocale(), { month: 'short', year: 'numeric' }) : null

  return <div className="card">
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
      <b>{t('Your targets today')}</b>
      <button className="iconbtn" onClick={() => nav('/goals')} aria-label={t('Edit goals')}><Icon name="gear" /></button>
    </div>

    <div style={{ padding: '6px 0' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}><span>{t('Workout')}</span>
        <span className="dim small">{perWeek ? t('{0} of {1} this week', doneWeek, perWeek) : ''}</span></div>
      <div className="small">{workoutLine}</div>
      {perWeek > 0 && <div className="dim small">{left > 0 ? tn('{0} session to go this week', '{0} sessions to go this week', left) : t('Weekly target hit')}</div>}
    </div>

    <div style={{ padding: '6px 0' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}><span>{t('Steps')}</span>
        {steps && <span className="dim small">{fmtNum(steps.have)} / {fmtNum(steps.goal)}</span>}</div>
      {steps ? <>
        <Bar pct={steps.pct} done={steps.done} />
        <div className="small">{steps.done ? t('Step target hit.') : t('{0} steps to go', fmtNum(steps.left))}</div>
        {avg != null && <div className="dim small">{t('Last 7 days: {0} a day', fmtNum(avg))}</div>}
        {h?.readError === 'permission' && <div className="small" style={{ color: 'var(--orange)' }}>{t('Permission withdrawn. Tap to allow again')}</div>}
      </> : <>
        <div className="small">{t('Aim for {0} steps a day.', fmtNum(stepsState(goals, 0).goal))}</div>
        {MOBILE && avail === 'available' && <div style={{ marginTop: 8 }}><Button size="sm" variant="tinted" disabled={busy} onClick={connect}>{t('Connect Google Health')}</Button></div>}
      </>}
    </div>

    {wp && <div style={{ padding: '6px 0' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}><span>{t('Weight')}</span>
        <span className="dim small">{fmtNum(wp.now)} → {fmtNum(wp.target)} {S.unit}</span></div>
      {wp.left === 0 ? <div className="small">{t('At your goal weight.')}</div>
        : <div className="small">{t('{0} {1} to go. About {2} {1} a week gets you there.', fmtNum(Math.abs(wp.left)), S.unit, fmtNum(Math.abs(wp.perWeek)))}{eta ? ' ' + t('Around {0}.', eta) : ''}</div>}
    </div>}
  </div>
}
