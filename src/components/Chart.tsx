import { useEffect, useState } from 'react'

/** Minimal dependency-free SVG line chart for progress trends. */
export default function Chart({
  points,
  height = 120,
  color = '#3f6b4f',
  min,
  max,
  unit,
  detailed = false,
  labels,
}: {
  /** values in chronological order */
  points: number[]
  height?: number
  color?: string
  min?: number
  max?: number
  unit?: string
  /** expanded mode: gridlines, axis values, per-point values and labels */
  detailed?: boolean
  /** optional per-point labels (e.g. dates), chronological order */
  labels?: string[]
}) {
  const w = detailed ? 640 : 320
  const pad = detailed ? 36 : 8
  const bottomPad = detailed ? 34 : 8
  if (points.length < 2) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-moss/40">
        Need at least two data points to draw a trend.
      </div>
    )
  }
  const lo = min ?? Math.min(...points)
  const hi = max ?? Math.max(...points)
  const range = hi - lo || 1
  const px = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2)
  const py = (v: number) => height - bottomPad - ((v - lo) / range) * (height - pad - bottomPad)
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')
  const area = `${d} L${px(points.length - 1).toFixed(1)},${height - bottomPad} L${px(0).toFixed(1)},${height - bottomPad} Z`
  const last = points[points.length - 1]
  const fmt = (v: number) => `${Math.round(v * 10) / 10}${unit ?? ''}`

  // in detailed mode, thin out x labels so they never overlap
  const labelStep = Math.max(1, Math.ceil(points.length / 8))
  const gridLines = detailed ? [0, 0.25, 0.5, 0.75, 1] : []

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img">
      {gridLines.map((g) => {
        const y = height - bottomPad - g * (height - pad - bottomPad)
        return (
          <g key={g}>
            <line x1={pad} x2={w - pad} y1={y} y2={y} stroke="#e0dcc9" strokeWidth={1} />
            <text x={pad - 6} y={y + 4} textAnchor="end" fontSize={11} fill="#22372b" opacity={0.45}>
              {Math.round((lo + g * range) * 10) / 10}
            </text>
          </g>
        )
      })}
      <path d={area} fill={color} opacity={0.12} />
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      {points.map((v, i) => (
        <circle key={i} cx={px(i)} cy={py(v)} r={detailed ? 4 : 3} fill={color} />
      ))}
      {detailed &&
        points.map((v, i) => (
          <text
            key={`v${i}`}
            x={px(i)}
            y={py(v) - 9}
            textAnchor="middle"
            fontSize={11}
            fill={color}
            fontWeight={600}
          >
            {fmt(v)}
          </text>
        ))}
      {detailed &&
        labels &&
        points.map((_, i) =>
          i % labelStep === 0 || i === points.length - 1 ? (
            <text
              key={`l${i}`}
              x={px(i)}
              y={height - 10}
              textAnchor="middle"
              fontSize={10}
              fill="#22372b"
              opacity={0.5}
            >
              {labels[i] ?? ''}
            </text>
          ) : null,
        )}
      {!detailed && (
        <text x={w - pad} y={py(last) - 8} textAnchor="end" fontSize={12} fill={color} fontWeight={600}>
          {fmt(last)}
        </text>
      )}
    </svg>
  )
}

/**
 * A chart card that expands into a detailed fullscreen view on click,
 * dismissed by clicking the backdrop, the close button, or Escape.
 */
export function ExpandableChart({
  title,
  subtitle,
  points,
  labels,
  color = '#3f6b4f',
  min,
  max,
  unit,
  height = 120,
}: {
  title: string
  subtitle?: string
  points: number[]
  labels?: string[]
  color?: string
  min?: number
  max?: number
  unit?: string
  height?: number
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const lo = Math.min(...points)
  const hi = Math.max(...points)
  const avg = points.reduce((a, b) => a + b, 0) / points.length
  const fmt = (v: number) => `${Math.round(v * 10) / 10}${unit ?? ''}`
  const canExpand = points.length >= 2

  return (
    <>
      <button
        type="button"
        onClick={() => canExpand && setOpen(true)}
        className={`block w-full text-left ${canExpand ? 'cursor-zoom-in' : 'cursor-default'}`}
        aria-label={canExpand ? `Expand ${title} chart` : title}
      >
        <Chart points={points} min={min} max={max} unit={unit} color={color} height={height} />
        {canExpand && <p className="mt-1 text-right text-[10px] text-moss/35">Tap to expand</p>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-moss/40 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — detailed view`}
        >
          <div
            className="w-full max-w-3xl rounded-3xl border border-line bg-panel p-5 shadow-xl sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-moss">{title}</h3>
                {subtitle && <p className="mt-0.5 text-xs text-moss/50">{subtitle}</p>}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full border border-line bg-cream px-3 py-1.5 text-sm text-moss/60 hover:text-moss"
                aria-label="Close detailed view"
              >
                ✕
              </button>
            </div>
            <Chart
              points={points}
              labels={labels}
              min={min}
              max={max}
              unit={unit}
              color={color}
              height={280}
              detailed
            />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Latest', fmt(points[points.length - 1])],
                ['Average', fmt(avg)],
                ['Highest', fmt(hi)],
                ['Lowest', fmt(lo)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-line bg-cream px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-moss/45">
                    {label}
                  </p>
                  <p className="font-display text-lg font-bold text-fern">{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] text-moss/40">
              {points.length} data points · tap outside or press Esc to close
            </p>
          </div>
        </div>
      )}
    </>
  )
}
