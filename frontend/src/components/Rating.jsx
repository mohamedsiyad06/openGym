// A score out of 100 with what it is made of (lib/rating.js): on the finish summary, in a saved
// workout, and on Home for the day. The score sits inside a ring that fills with it, and the label
// says in words what the colour says, so neither carries the meaning alone.
import { t } from '../lib/i18n.js'
import { REP_RANGE } from '../lib/rating.js'
import Rings from './Rings.jsx'

/** The system colour for a score: green from 70, the accent from 55, orange from 40, else red. */
export const tone = score => (score >= 70 ? 'var(--green)' : score >= 55 ? 'var(--acc)' : score >= 40 ? 'var(--orange)' : 'var(--red)')

// Literal t() calls, so check-source-strings sees them.
export const labelText = () => ({
  Excellent: t('Excellent'), Strong: t('Strong'), Solid: t('Solid'), Light: t('Light'), 'Easy day': t('Easy day'),
})
const partText = () => ({
  done: t('Sets done'), volume: t('Hard sets'), reps: t('Rep range'), progress: t('Progress'), time: t('Time'),
  training: t('Training'), steps: t('Steps'), calories: t('Calories'), protein: t('Protein'), macros: t('Carbs and fat'), micros: t('Micros'),
})

/** The one line of advice for the weakest part of a session, by goal. */
export function tipFor(part, goal, minutes) {
  if (part === 'done') return t('Finish the sets you planned. Cut a lift rather than skip sets.')
  if (part === 'volume') return t('A few more hard sets would suit this goal.')
  if (part === 'reps') { const [a, b] = REP_RANGE[goal] || REP_RANGE.fit; return t('Aim for {0} to {1} reps on your main sets for this goal.', a, b) }
  if (part === 'progress') return t('Add a little weight or a rep over last time.')
  if (part === 'time') return t('Keep the session close to {0} minutes.', minutes || 60)
  return null
}

export default function Rating({ rating, title, tip = null }) {
  if (!rating) return null
  const color = tone(rating.score)
  const parts = rating.parts.filter(p => p.score != null)
  return <section className="sect rating" style={{ textAlign: 'start' }}>
    <div className="sect-b">
      <div className="rating-hero">
        <Rings size={76} rings={[{ value: rating.score / 100, color }]} label={t('Score {0} out of 100', rating.score)}>
          <span className="rating-n">{rating.score}</span>
        </Rings>
        <div className="rating-m">
          <div className="lrow-s">{title}</div>
          <div className="rating-l" style={{ color }}>{labelText()[rating.label] || rating.label}</div>
          {tip && <div className="lrow-s rating-tip">{tip}</div>}
        </div>
      </div>
      {parts.map(p => {
        const pct = Math.round(p.score * 100)
        return <div key={p.id} className="lrow rating-part">
          <span className="lrow-m">
            <span className="lrow-t">{partText()[p.id] || p.id}</span>
            <span className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={partText()[p.id] || p.id}>
              <span style={{ width: pct + '%', background: tone(pct) }} />
            </span>
          </span>
          <span className="lrow-v">{pct}</span>
        </div>
      })}
    </div>
  </section>
}
