// A score out of 100 with what it is made of (lib/rating.js): on the finish summary, in a saved
// workout, and on Home for the day.
import { t } from '../lib/i18n.js'
import { REP_RANGE } from '../lib/rating.js'

const tone = score => (score >= 70 ? 'var(--green)' : score >= 55 ? 'var(--acc)' : score >= 40 ? 'var(--orange)' : 'var(--red)')

// Literal t() calls, so check-source-strings sees them.
const labelText = () => ({
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

export default function Rating({ rating, title, tip = null, compact = false }) {
  if (!rating) return null
  const color = tone(rating.score)
  return <div className="card" style={{ textAlign: 'start' }}>
    <div className="row" style={{ gap: 14, alignItems: 'center' }}>
      <div role="img" aria-label={t('Score {0} out of 100', rating.score)}
        style={{ width: 64, height: 64, borderRadius: '50%', border: '5px solid ' + color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, flex: 'none' }}>
        {rating.score}
      </div>
      <div style={{ flex: 1 }}>
        <div className="dim small">{title}</div>
        <div style={{ fontWeight: 600, fontSize: 18, color }}>{labelText()[rating.label] || rating.label}</div>
        {tip && <div className="small" style={{ marginTop: 2 }}>{tip}</div>}
      </div>
    </div>
    {!compact && <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
      {rating.parts.filter(p => p.score != null).map(p => <div key={p.id}>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{partText()[p.id] || p.id}</span><span className="dim small">{Math.round(p.score * 100)}</span></div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.score * 100)}
          style={{ height: 5, borderRadius: 3, background: 'var(--fill, rgba(127,127,127,.2))', overflow: 'hidden' }}>
          <div style={{ width: Math.round(p.score * 100) + '%', height: '100%', background: tone(p.score * 100) }} />
        </div>
      </div>)}
    </div>}
  </div>
}
