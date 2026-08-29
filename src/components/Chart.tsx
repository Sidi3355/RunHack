/** Minimal dependency-free SVG line chart for progress trends. */
export default function Chart({
  points,
  height = 120,
  color = '#3f6b4f',
  min,
  max,
  unit,
}: {
  /** values in chronological order */
  points: number[]
  height?: number
  color?: string
  min?: number
  max?: number
  unit?: string
}) {
  const w = 320
  const pad = 8
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
  const py = (v: number) => height - pad - ((v - lo) / range) * (height - pad * 2)
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')
  const area = `${d} L${px(points.length - 1).toFixed(1)},${height - pad} L${px(0).toFixed(1)},${height - pad} Z`
  const last = points[points.length - 1]
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img">
      <path d={area} fill={color} opacity={0.12} />
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      {points.map((v, i) => (
        <circle key={i} cx={px(i)} cy={py(v)} r={3} fill={color} />
      ))}
      <text x={w - pad} y={py(last) - 8} textAnchor="end" fontSize={12} fill={color} fontWeight={600}>
        {Math.round(last * 10) / 10}
        {unit ?? ''}
      </text>
    </svg>
  )
}
