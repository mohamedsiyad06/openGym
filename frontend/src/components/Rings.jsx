// Concentric progress rings in the manner of Apple's Activity rings: one per target, outermost
// first, each a track in its colour and an arc for how far along it is (capped at a full ring).
// The rings carry no meaning on colour alone: the rows beside them use the same tints and say the
// numbers, and the picture has a label of its own for screen readers.
export default function Rings({ rings, size = 112, label, children }) {
  const stroke = Math.round(size * 0.11)
  const gap = Math.max(2, Math.round(size * 0.02))
  const c = size / 2
  return <div className="rings" style={{ width: size, height: size }}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      {rings.map((r, i) => {
        const radius = c - stroke / 2 - i * (stroke + gap)
        if (radius <= stroke / 2) return null
        const len = 2 * Math.PI * radius
        const v = Math.max(0, Math.min(1, Number(r.value) || 0))
        return <g key={i} transform={`rotate(-90 ${c} ${c})`}>
          <circle cx={c} cy={c} r={radius} fill="none" stroke={r.color} strokeOpacity=".22" strokeWidth={stroke} />
          {v > 0 && <circle className="ring-arc" cx={c} cy={c} r={radius} fill="none" stroke={r.color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={`${len} ${len}`} strokeDashoffset={len * (1 - v)} />}
        </g>
      })}
    </svg>
    {children && <div className="rings-c">{children}</div>}
  </div>
}
