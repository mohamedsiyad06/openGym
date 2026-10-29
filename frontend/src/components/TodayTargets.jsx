// Home: what to hit today, from the goals asked in views/GoalSetup.jsx (worked out in lib/goals.js,
// lib/nutrition.js and lib/rating.js). Laid out the way Apple's Fitness app shows a day: rings for
// the workout week, the steps and the food beside the day's score, then one row per target in the
// inset-grouped list, each row tinted like its ring and saying its numbers in words. The steps and
// the food diary are read from Health Connect on the phone and never leave it (lib/health-sync.js).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, tn, dateLocale } from '../lib/i18n.js'
import { todayISO, fmtNum, isoOf } from '../lib/format.js'
import { MOBILE } from '../lib/mobile.js'
import { effectiveRoutines } from '../lib/history.js'
import { weekTally } from '../lib/queue.js'
import { hasGoals, isTrainingDay, stepsAverage, stepsState, weeklySessions, weightPlan } from '../lib/goals.js'
import { nutritionTargets, hasDiary, MICROS, MICROS_MIN_REPORTED, SODIUM_MAX } from '../lib/nutrition.js'
import { rateDay } from '../lib/rating.js'
import { loadHealth, onHealthChange, enableRead, healthStatus } from '../lib/health-sync.js'
import { Section, Row } from './ui.jsx'
import Rings from './Rings.jsx'
import { tone, labelText } from './Rating.jsx'

// One tint per target, shared by its ring and its row: Apple's Activity palette.
const TINT = { workout: 'var(--red)', steps: 'var(--green)', food: 'var(--blue)' }

// Literal t() calls, so check-source-strings sees them.
const microName = () => ({
  fiber: t('Fiber'), potassium: t('Potassium'), calcium: t('Calcium'), iron: t('Iron'),
  magnesium: t('Magnesium'), zinc: t('Zinc'), vitC: t('Vitamin C'), vitD: t('Vitamin D'),
})

function FoodSheet({ diary, targets }) {
  const shown = MICROS.filter(([k]) => Number(diary[k]) > 0)
  const g = v => fmtNum(Math.round(Number(v) || 0))
  return <>
    <h3>{t('Food today')}</h3>
    <Section title={t('Macros')}>
      <Row title={t('Calories')} value={`${g(diary.kcal)} / ${fmtNum(targets.kcal)} ${t('kcal')}`} />
      <Row title={t('Protein')} value={`${g(diary.protein)} / ${fmtNum(targets.protein)} g`} />
      <Row title={t('Carbs')} value={`${g(diary.carbs)} / ${fmtNum(targets.carbs)} g`} />
      <Row title={t('Fat')} value={`${g(diary.fat)} / ${fmtNum(targets.fat)} g`} />
    </Section>
    <Section title={t('Micros')}
      footer={[shown.length < MICROS_MIN_REPORTED && t('Your diary reports few micronutrients, so they are not scored.'),
        t('Rough daily references for an adult, not medical advice.')].filter(Boolean).join(' ')}>
      {shown.map(([k, , unit, ref]) => <Row key={k} title={microName()[k]}
        value={`${g(diary[k])} / ${fmtNum(k === 'fiber' ? targets.fiber : ref)} ${unit}`} />)}
      {Number(diary.sodium) > 0 && <Row title={t('Sodium')}
        value={<span style={{ color: diary.sodium > SODIUM_MAX ? 'var(--orange)' : undefined }}>{`${g(diary.sodium)} / ${fmtNum(SODIUM_MAX)} mg ${t('max')}`}</span>} />}
      {!shown.length && !(Number(diary.sodium) > 0) && <Row title={t('None reported')} />}
    </Section>
  </>
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
    return <Section>
      <Row icon="target" iconTint="var(--blue)" title={t('Set your goals')} accessory="chevron" onClick={() => nav('/goals')}
        subtitle={t('Tell openGym what you are aiming for and it shows what to hit each day.')} />
    </Section>
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
  const targets = nutritionTargets(S)
  const diary = h?.readNutrition && hasDiary(h.nutrition?.[today]) ? h.nutrition[today] : null
  const rateOf = iso => rateDay(S, iso, {
    steps: h?.readSteps ? h.steps?.[iso] : undefined,
    nutrition: h?.readNutrition ? h.nutrition?.[iso] : undefined,
    today,
  })
  const dayRating = rateOf(today)
  const lastRating = rateOf(isoOf(new Date(Date.now() - 864e5)))
  const canConnect = MOBILE && avail === 'available'

  const connect = kind => async () => {
    setBusy(true)
    try { setH((await enableRead(kind, () => useStore.getState().S)).health || await loadHealth()) } catch { /* shown as not connected */ }
    setBusy(false)
  }
  const openFood = () => useUI.getState().openSheet(() => <FoodSheet diary={diary} targets={targets} />)

  const workoutLine = doneToday ? t('Done today. Nice work.')
    : routines.length ? t('Today: {0}', routines.map(r => r.name).join(' + '))
      : planned ? t('Training day. Pick a routine to start.') : t('Rest day. Keep moving.')
  const weekLine = perWeek ? (left > 0 ? tn('{0} session to go this week', '{0} sessions to go this week', left) : t('Weekly target hit')) : null
  const eta = wp && wp.weeks > 0 ? new Date(Date.now() + wp.weeks * 7 * 864e5).toLocaleDateString(dateLocale(), { month: 'short', year: 'numeric' }) : null
  const lines = (...xs) => { const v = xs.filter(Boolean); return v.length ? v.reduce((a, x, i) => (i ? [...a, <br key={i} />, x] : [x]), []) : null }

  const rings = [
    { value: perWeek ? doneWeek / perWeek : 0, color: TINT.workout },
    { value: steps ? steps.pct / 100 : 0, color: TINT.steps },
    { value: diary && targets ? diary.kcal / targets.kcal : 0, color: TINT.food },
  ]
  const ringLabel = [
    perWeek ? t('{0} of {1} this week', doneWeek, perWeek) : null,
    steps ? `${t('Steps')} ${fmtNum(steps.have)} / ${fmtNum(steps.goal)}` : null,
    diary && targets ? `${fmtNum(diary.kcal)} / ${fmtNum(targets.kcal)} ${t('kcal')}` : null,
  ].filter(Boolean).join(', ')

  return <Section title={t('Your targets today')}>
    <div className="tt-hero">
      <Rings rings={rings} label={ringLabel || t('Your targets today')} />
      <div className="tt-score">
        {dayRating ? <>
          <div className="lrow-s">{dayRating.final ? t('Day score') : t('Day score so far')}</div>
          <div className="tt-score-n" style={{ color: tone(dayRating.score) }}>{dayRating.score}</div>
          <div className="tt-score-l">{labelText()[dayRating.label]}</div>
        </> : <div className="lrow-s">{t('Log a workout, your steps or your food to get a day score.')}</div>}
        {lastRating && <div className="lrow-s" style={{ marginTop: 4 }}>{t('Yesterday: {0}', lastRating.score)}</div>}
      </div>
    </div>

    <Row icon="dumbbell" iconTint={TINT.workout} title={t('Workout')} subtitle={lines(workoutLine, weekLine)}
      value={perWeek ? `${doneWeek}/${perWeek}` : null} />

    <Row icon="steps" iconTint={TINT.steps} title={t('Steps')}
      subtitle={steps
        ? lines(steps.done ? t('Step target hit.') : t('{0} steps to go', fmtNum(steps.left)), avg != null && t('Last 7 days: {0} a day', fmtNum(avg)),
          h?.readError === 'permission' && t('Permission withdrawn. Tap to allow again'))
        : t('Aim for {0} steps a day.', fmtNum(stepsState(goals, 0).goal))}
      value={steps ? `${fmtNum(steps.have)} / ${fmtNum(steps.goal)}` : null}
      onClick={steps && h?.readError === 'permission' ? connect('steps') : undefined} accessory={steps && h?.readError === 'permission' ? 'chevron' : 'none'} />
    {!steps && canConnect && <Row icon="link" iconTint={TINT.steps} title={t('Connect Google Health')} accessory="chevron" onClick={busy ? undefined : connect('steps')} />}

    {targets && <Row icon="flame" iconTint={TINT.food} title={t('Food')}
      subtitle={diary
        ? lines(diary.kcal <= targets.kcal ? t('{0} kcal left', fmtNum(targets.kcal - diary.kcal)) : t('{0} kcal over', fmtNum(diary.kcal - targets.kcal)),
          t('Protein {0} / {1} g · Carbs {2} / {3} g · Fat {4} / {5} g', fmtNum(Math.round(diary.protein || 0)), fmtNum(targets.protein), fmtNum(Math.round(diary.carbs || 0)), fmtNum(targets.carbs), fmtNum(Math.round(diary.fat || 0)), fmtNum(targets.fat)))
        : h?.readNutrition ? t('Nothing logged in your food diary yet today.') : t('Aim for {0} kcal and {1} g protein.', fmtNum(targets.kcal), fmtNum(targets.protein))}
      value={diary ? `${fmtNum(diary.kcal)} / ${fmtNum(targets.kcal)} ${t('kcal')}` : null}
      onClick={diary ? openFood : undefined} accessory={diary ? 'chevron' : 'none'} />}
    {targets && !h?.readNutrition && canConnect && <Row icon="link" iconTint={TINT.food} title={t('Connect Cronometer')} accessory="chevron" onClick={busy ? undefined : connect('nutrition')} />}

    {wp && <Row icon="scale" iconTint="var(--teal)" title={t('Weight')}
      subtitle={wp.left === 0 ? t('At your goal weight.')
        : t('{0} {1} to go. About {2} {1} a week gets you there.', fmtNum(Math.abs(wp.left)), S.unit, fmtNum(Math.abs(wp.perWeek))) + (eta ? ' ' + t('Around {0}.', eta) : '')}
      value={`${fmtNum(wp.now)} → ${fmtNum(wp.target)} ${S.unit}`} />}

    <Row icon="target" iconTint="var(--grey)" title={t('Goals & targets')} subtitle={t('Change your steps, calories, protein, goal weight and training days.')} accessory="chevron" onClick={() => nav('/goals')} />
  </Section>
}
