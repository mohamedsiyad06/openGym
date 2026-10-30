// Goals & targets: every answer of the goals questions (views/GoalSetup.jsx) and every daily target
// it turned into, changed in place, the way a page of iOS Settings works: a pick-one list opens a
// sheet with a checkmark, a number is a stepper in its row, and each change is saved at once
// (lib/goals.js updateGoals). Numbers left on automatic follow the body weight and the goal; one the
// person set stays until "Use automatic targets". Reached from Home's targets card and Settings.
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t, dateLocale } from '../lib/i18n.js'
import { DAYS, weekOrder, weekStartOf, fmtNum } from '../lib/format.js'
import { ACTIVE_IDS, AGE_MAX, AGE_MIN, GOAL_IDS, LEVEL_IDS, PACE_OPTIONS, PROTEIN_MAX, PROTEIN_MIN, STEPS_MAX, STEPS_MIN, hasGoals, stepGoal, trainingDays, updateGoals, weightPlan } from '../lib/goals.js'
import { KCAL_MAX, KCAL_MIN, nutritionTargets } from '../lib/nutrition.js'
import { lastBW } from '../lib/history.js'
import Icon from '../components/Icon.jsx'
import { Row, Section, SelectRow, Stepper } from '../components/ui.jsx'
import GoalSetup, { goalLabel } from './GoalSetup.jsx'

const levelLabel = () => ({ new: t('New'), some: t('A while'), exp: t('Years') })
const activeLabel = () => ({ desk: t('Mostly sitting'), mixed: t('A bit of both'), feet: t('On my feet') })
const MINUTES = [30, 45, 60, 75, 90, 120]

export default function GoalsEdit() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  // Never answered: the questions first, then this page.
  if (!hasGoals(S)) return <GoalSetup />

  const g = S.goals
  const set = patch => update(s => { updateGoals(s, patch) })
  const unit = S.unit
  const bw = lastBW(S)
  const targets = nutritionTargets(S)
  const plan = weightPlan(S)
  const days = trainingDays(g)
  const own = g.steps != null || g.calories != null || g.protein != null
  const wMax = unit === 'kg' ? 300 : 660
  const eta = plan && plan.weeks > 0 ? new Date(Date.now() + plan.weeks * 7 * 864e5).toLocaleDateString(dateLocale(), { month: 'short', year: 'numeric' }) : null

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" data-back="/home" onClick={() => nav(-1)} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 12 }}><h1>{t('Goals & targets')}</h1><div className="sub">{t('Changes save as you make them.')}</div></div>
    </div>

    <Section>
      <SelectRow icon="target" iconTint="var(--red)" title={t('Goal')} sheetTitle={t('What you are training for')} value={g.goal}
        options={GOAL_IDS.map(id => ({ value: id, label: goalLabel()[id] }))} onChange={goal => set({ goal })} />
    </Section>

    <Section title={t('Training')} footer={t('Your weekly target is one session for each day picked.')}>
      <div className="day-chips">
        {weekOrder(weekStartOf(S)).map(d => {
          const on = days.includes(d)
          // At least one day stays picked: a week with no training has no target to show.
          return <button key={d} className={'chip' + (on ? ' on' : '')} aria-pressed={on} disabled={on && days.length === 1}
            onClick={() => set({ days: on ? days.filter(x => x !== d) : [...days, d] })}>{t(DAYS[d])}</button>
        })}
      </div>
      <SelectRow icon="timer" iconTint="var(--orange)" title={t('Session length')} value={g.minutes}
        options={MINUTES.map(m => ({ value: m, label: t('{0} min', m) }))} onChange={minutes => set({ minutes })} />
      <SelectRow icon="medal" iconTint="var(--indigo)" title={t('Experience')} value={g.level}
        options={LEVEL_IDS.map(id => ({ value: id, label: levelLabel()[id] }))} onChange={level => set({ level })} />
    </Section>

    <Section title={t('Daily targets')}
      footer={own ? t('Some of these are your own numbers. The rest follow your weight and goal.') : t('Suggested from your weight, goal and day. Change any of them and it stays as you set it.')}>
      <Row icon="steps" iconTint="var(--green)" title={t('Steps')}>
        <Stepper value={stepGoal(g)} step={500} min={STEPS_MIN} max={STEPS_MAX} decimal={false} ariaLabel={t('Steps')} onChange={steps => set({ steps })} />
      </Row>
      <Row icon="flame" iconTint="var(--blue)" title={t('Calories')}>
        <Stepper value={targets?.kcal ?? 2200} step={50} min={KCAL_MIN} max={KCAL_MAX} decimal={false} unit={t('kcal')} ariaLabel={t('Calories')} onChange={calories => set({ calories })} />
      </Row>
      <Row icon="bolt" iconTint="var(--purple)" title={t('Protein')}>
        <Stepper value={targets?.protein ?? 140} step={5} min={PROTEIN_MIN} max={PROTEIN_MAX} decimal={false} unit="g" ariaLabel={t('Protein')} onChange={protein => set({ protein })} />
      </Row>
      {targets && <Row icon="list" iconTint="var(--grey)" title={t('Carbs and fat')} value={`${fmtNum(targets.carbs)} g · ${fmtNum(targets.fat)} g`} />}
      {own && <Row icon="reset" iconTint="var(--acc)" title={t('Use automatic targets')} accessory="chevron"
        onClick={() => set({ steps: null, calories: null, protein: null })} />}
    </Section>

    <Section title={t('Daily life')} footer={t('A more active day raises the step target and the calories.')}>
      <SelectRow icon="person" iconTint="var(--teal)" title={t('A normal day')} value={g.active}
        options={ACTIVE_IDS.map(id => ({ value: id, label: activeLabel()[id] }))} onChange={active => set({ active })} />
    </Section>

    <Section title={t('Body weight')}
      footer={plan ? (plan.left === 0 ? t('At your goal weight.')
        : t('{0} {1} to go. About {2} {1} a week gets you there.', fmtNum(Math.abs(plan.left)), unit, fmtNum(Math.abs(plan.perWeek))) + (eta ? ' ' + t('Around {0}.', eta) : ''))
        : bw ? null : t('Log a weigh-in on Home to see the pace to your goal weight.')}>
      <Row icon="target" iconTint="var(--blue)" title={t('Goal weight')}>
        <Stepper value={S.targetW || bw?.w || (unit === 'kg' ? 70 : 155)} step={0.5} min={20} max={wMax} unit={unit} ariaLabel={t('Goal weight')}
          onChange={v => update(s => { const n = Math.round(Number(v) * 10) / 10; if (n > 0 && n <= wMax) s.targetW = n })} />
      </Row>
      {S.targetW != null && <SelectRow icon="chart" iconTint="var(--indigo)" title={t('Weekly pace')} value={g.pace ?? 'auto'}
        options={[{ value: 'auto', label: t('Automatic') }, ...PACE_OPTIONS.map(p => ({ value: p, label: t('{0}% of body weight', fmtNum(p)) }))]}
        onChange={v => set({ pace: v === 'auto' ? null : v })} />}
      {S.targetW != null && <Row icon="trash" iconTint="var(--red)" danger title={t('Remove goal weight')} onClick={() => update(s => { s.targetW = null })} />}
    </Section>

    <Section title={t('About you')} footer={t('For the strength standards, which compare your lifts with lifters of your sex and age.')}>
      <SelectRow icon="person" iconTint="var(--indigo)" title={t('Sex')} value={S.body === 'female' ? 'female' : 'male'}
        options={[{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]} onChange={b => update(s => { s.body = b })} />
      <Row icon="calendar" iconTint="var(--orange)" title={t('Age')}>
        <Stepper value={g.age || 30} step={1} min={AGE_MIN} max={AGE_MAX} decimal={false} ariaLabel={t('Age')} onChange={age => set({ age })} />
      </Row>
      <Row icon="trophy" iconTint="var(--yellow)" title={t('Strength standards')} accessory="chevron" onClick={() => nav('/standards')} />
    </Section>

    <Section>
      <Row icon="list" iconTint="var(--grey)" title={t('Answer the questions again')} accessory="chevron" onClick={() => nav('/goals/setup')} />
    </Section>
  </div>
}
