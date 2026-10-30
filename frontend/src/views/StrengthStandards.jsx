// Strength standards: how the main lifts measure up for the lifter's sex, age and body weight, and
// what that says about each muscle (lib/strength-standards.js), on ten levels from Bones to The
// Whammest. The body map is coloured by level, red to blue and purple; a muscle can be tapped for the lifts behind
// it. Below it the strong and weak points, then every lift with its level, its best estimated 1RM
// and what the next level asks, so the weak point is also the next thing to train.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { fmtNum } from '../lib/format.js'
import { MUSCLE_NAME } from '../lib/muscles.js'
import { lastBW } from '../lib/history.js'
import { LEVELS, STEPS, levelOf, liftStandards, muscleStandards, overallScore, stepOf, strongWeak } from '../lib/strength-standards.js'
import BodyMap from '../components/BodyMap.jsx'
import Rings from '../components/Rings.jsx'
import Icon from '../components/Icon.jsx'
import { Button, Row, Section } from '../components/ui.jsx'
import { bwSheet } from '../sheets.jsx'

// One colour per level, Bones first: Apple's system colours from red through green to blue, and
// purple for The Whammest. The same ten are the .bm-std map steps in index.css.
const mix = (a, b) => `color-mix(in srgb, var(--${a}) 50%, var(--${b}))`
export const STEP_COLOR = ['var(--red)', mix('red', 'orange'), 'var(--orange)', mix('orange', 'yellow'), 'var(--yellow)',
  mix('yellow', 'green'), 'var(--green)', 'var(--teal)', 'var(--blue)', 'var(--purple)']
// Literal t() calls, so check-source-strings sees them.
const levelName = () => ({
  bones: t('Bones'), stickman: t('Stickman'), likkleMan: t('Likkle Man'), warmingUp: t('Warming Up'), patterned: t('Patterned'),
  sturdy: t('Sturdy'), stocky: t('Stocky'), wham: t('Wham'), hench: t('Hench'), whammest: t('The Whammest'),
})
const liftName = () => ({
  squat: t('Squat'), frontSquat: t('Front squat'), deadlift: t('Deadlift'), hipThrust: t('Hip thrust'),
  bench: t('Bench press'), ohp: t('Overhead press'), dip: t('Dip'), row: t('Barbell row'), pullup: t('Pull-up'), curl: t('Barbell curl'),
})

// How far up the ten levels a lift is, in the colour of its level, with a tick at every level.
function LevelMeter({ score }) {
  const pct = Math.round(Math.min(STEPS, score) / STEPS * 100)
  return <span className="lvl-meter" role="img" aria-label={levelName()[levelOf(score)]}>
    <span style={{ width: pct + '%', background: STEP_COLOR[stepOf(score) - 1] }} />
  </span>
}

export default function StrengthStandards() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [picked, setPicked] = useState(null)
  const sex = S.body === 'female' ? 'female' : 'male'
  const age = S.goals?.age || null
  const bw = lastBW(S)
  const lifts = useMemo(() => liftStandards(S, { sex, age }), [S, sex, age])
  const muscles = useMemo(() => muscleStandards(lifts), [lifts])
  const overall = overallScore(lifts)
  const { strong, weak } = strongWeak(muscles)
  const logged = lifts.filter(l => l.score != null)
  const levels = Object.fromEntries(Object.entries(muscles).map(([m, s]) => [m, stepOf(s)]))
  // A ratio as a weight at today's body weight, in the profile's unit, to the nearest half.
  // A target rounds up, so the next level never names the weight already lifted.
  const weight = (ratio, up = false) => (bw ? `${fmtNum((up ? Math.ceil : Math.round)(ratio * bw.w * 2 - 1e-9) / 2)} ${S.unit}` : `${fmtNum(ratio)} × ${t('BW')}`)
  const muscleRow = m => <Row key={m} title={t(MUSCLE_NAME[m])} value={levelName()[levelOf(muscles[m])]}
    icon="dot" iconTint={STEP_COLOR[stepOf(muscles[m]) - 1]} onClick={() => setPicked(m)} accessory="chevron" />
  const behind = picked ? lifts.filter(l => l.score != null && l.muscles[picked]) : []

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" data-back="/stats" onClick={() => nav(-1)} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 12 }}>
        <h1>{t('Strength standards')}</h1>
        <div className="sub">{[sex === 'female' ? t('Female') : t('Male'), age ? t('{0} years', age) : null, bw ? `${fmtNum(bw.w)} ${S.unit}` : null].filter(Boolean).join(' · ')}</div>
      </div>
    </div>

    {!bw && <Section footer={t('Standards are multiples of your body weight, so they need a weigh-in.')}>
      <Row icon="scale" iconTint="var(--teal)" title={t('Log your body weight')} accessory="chevron" onClick={() => bwSheet()} />
    </Section>}
    {!age && <Section>
      <Row icon="person" iconTint="var(--indigo)" title={t('Add your age')} subtitle={t('Standards are fairer with it: under 18 and over 40 the bar is lower.')}
        accessory="chevron" onClick={() => nav('/goals')} />
    </Section>}

    <section className="sect">
      <div className="sect-b">
        <div className="tt-hero">
          <Rings size={84} rings={[{ value: (overall || 0) / STEPS, color: overall == null ? 'var(--grey)' : STEP_COLOR[stepOf(overall) - 1] }]}
            label={overall == null ? t('No lifts yet') : levelName()[levelOf(overall)]}>
            <span className="rating-n">{overall == null ? '–' : fmtNum(Math.round(overall * 10) / 10)}</span>
          </Rings>
          <div className="tt-score">
            <div className="lrow-s">{t('Overall')}</div>
            <div className="tt-score-l">{overall == null ? t('No lifts yet') : levelName()[levelOf(overall)]}</div>
            <div className="lrow-s">{logged.length
              ? t('From {0} of {1} main lifts, your best of the last year.', logged.length, lifts.length)
              : t('Log a squat, bench, deadlift, press, row or pull-up to see where you stand.')}</div>
          </div>
        </div>
        {logged.length > 0 && <div style={{ padding: '0 16px 12px' }}>
          <BodyMap levels={levels} body={sex} className="bm-std" onMuscle={setPicked} selected={picked} />
          <div className="std-legend" aria-hidden="true">
            <span className="std-grad" style={{ background: `linear-gradient(90deg, ${STEP_COLOR.join(', ')})` }} />
            <span className="row" style={{ justifyContent: 'space-between' }}><span>{levelName().bones}</span><span>{levelName().whammest}</span></span>
          </div>
        </div>}
        {picked && <div className="lrow" style={{ display: 'block' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{t(MUSCLE_NAME[picked])}</b>
            <span className="lrow-s">{muscles[picked] != null ? levelName()[levelOf(muscles[picked])] : t('No lift logged for it')}</span>
          </div>
          {behind.length > 0 && <div className="lrow-s" style={{ marginTop: 4 }}>
            {t('From: {0}', behind.map(l => liftName()[l.id]).join(', '))}</div>}
        </div>}
      </div>
    </section>

    {strong.length > 0 && <Section title={t('Strong points')}>{strong.map(muscleRow)}</Section>}
    {weak.length > 0 && <Section title={t('Weak points')} footer={t('Train these first: they hold back the lifts that use them.')}>{weak.map(muscleRow)}</Section>}

    <Section title={t('Lifts')} footer={t('Rough standards built from common body-weight ratios, adjusted for sex and age. A guide, not a test.')}>
      {lifts.map(l => l.score != null
        ? <div key={l.id} className="lrow std-lift">
          <span className="lrow-m">
            <span className="lrow-t">{liftName()[l.id]}</span>
            <LevelMeter score={l.score} />
            <span className="lrow-s">
              {levelName()[l.level]} · {t('1RM about {0}', weight(l.ratio))} ({l.ratio.toFixed(2)} × {t('BW')})
              {l.next ? <><br />{t('{0} for {1}', weight(l.next.ratio, true), levelName()[l.next.level])}</> : null}
            </span>
          </span>
        </div>
        : <Row key={l.id} title={liftName()[l.id]} subtitle={t('Not logged in the last year. {0} is about {1}.', levelName()[LEVELS[6]], weight(l.thresholds[5]))} />)}
    </Section>

    {logged.length === 0 && <div style={{ textAlign: 'center' }}><Button variant="tinted" onClick={() => nav('/plan')}>{t('Go to Plan')}</Button></div>}
  </div>
}

