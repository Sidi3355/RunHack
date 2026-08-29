import { useState } from 'react'
import type { Analysis, CoachAdvice, MetricKey } from '../types'
import Twin3D from './Twin3D'
import VideoOverlay from './VideoOverlay'
import ErrorBoundary from './ErrorBoundary'

function scoreColor(s: number) {
  if (s >= 80) return 'text-emerald-300'
  if (s >= 60) return 'text-amber-300'
  return 'text-rose-300'
}

export default function Results({
  analysis,
  videoUrl,
  coach,
  isSample,
  onReset,
}: {
  analysis: Analysis
  videoUrl: string | null
  coach: CoachAdvice
  isSample: boolean
  onReset: () => void
}) {
  const [selected, setSelected] = useState<MetricKey | null>(analysis.primary.key)
  const [seekRequest, setSeekRequest] = useState<{ time: number; n: number } | null>(null)
  const [showGhost, setShowGhost] = useState(false)
  const selectedMetric = analysis.metrics.find((m) => m.key === selected)
  const confidencePct = Math.round(analysis.confidence * 100)

  const selectMetric = (key: MetricKey, keyTime: number) => {
    setSelected((prev) => (prev === key ? null : key))
    setSeekRequest((prev) => ({ time: keyTime, n: (prev?.n ?? 0) + 1 }))
  }

  return (
    <div className="min-h-dvh max-w-2xl mx-auto px-4 pt-6 pb-10">
      <header className="flex items-center justify-between mb-4">
        <button onClick={onReset} className="text-sm text-white/50">
          ← New analysis
        </button>
        <span className="text-[11px] text-white/40 rounded-full border border-line px-2.5 py-1">
          Analysis confidence {confidencePct}%
        </span>
      </header>

      {isSample && (
        <div className="mb-4 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm text-cyan-100">
          Sample analysis — synthetic demo motion, not a real recording.
        </div>
      )}

      {/* 3D movement twin */}
      <h1 className="font-display text-2xl font-bold mb-3">
        Your <span className="glow-text">movement twin</span>
      </h1>
      <ErrorBoundary
        fallback={
          <div className="rounded-2xl border border-line bg-panel p-6 text-sm text-white/60">
            The 3D view isn't available on this device — the rest of your analysis is below.
          </div>
        }
      >
        <Twin3D sequence={analysis.sequence} highlight={selected} showGhost={showGhost} />
      </ErrorBoundary>

      {selected === 'footPlacement' && (
        <button
          onClick={() => setShowGhost((g) => !g)}
          className={`mt-3 w-full rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
            showGhost
              ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-200'
              : 'border-line bg-panel text-white/70'
          }`}
        >
          {showGhost ? '✓ Showing illustrative coaching cue (ghost)' : 'Show me the fix — ghost overlay'}
        </button>
      )}
      {showGhost && selected === 'footPlacement' && (
        <p className="mt-2 text-[11px] text-white/40">
          The green ghost is an illustrative coaching cue showing the direction of correction — not
          a biomechanically optimal pose.
        </p>
      )}

      {/* headline observation */}
      <section className="mt-6 rounded-2xl border border-line bg-panel p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300/80 mb-2">
          Headline observation
        </p>
        <p className="font-display text-lg leading-snug">{analysis.primary.headline}</p>
      </section>

      {/* movement snapshot */}
      <section className="mt-6">
        <div className="flex items-end justify-between mb-3">
          <h2 className="font-display text-xl font-bold">Movement snapshot</h2>
          <div className="text-right">
            <span className={`font-display text-4xl font-bold ${scoreColor(analysis.overallScore)}`}>
              {analysis.overallScore}
            </span>
            <span className="text-white/40 text-sm"> / 100</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {analysis.metrics.map((m) => (
            <button
              key={m.key}
              onClick={() => selectMetric(m.key, m.keyTime)}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                selected === m.key ? 'border-cyan-400/70 bg-cyan-400/10' : 'border-line bg-panel'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">{m.label}</span>
                <span className={`font-display text-2xl font-bold ${scoreColor(m.score)}`}>
                  {m.score}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-panel2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
                  style={{ width: `${m.score}%` }}
                />
              </div>
            </button>
          ))}
        </div>
        {selectedMetric && (
          <div className="mt-3 rounded-xl border border-line bg-panel px-4 py-3 text-sm text-white/70">
            <p>{selectedMetric.headline}</p>
            <p className="mt-1 text-white/45 text-xs">{selectedMetric.detail}</p>
          </div>
        )}
      </section>

      {/* video + overlay */}
      {videoUrl && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold mb-3">Your recording</h2>
          <VideoOverlay
            videoUrl={videoUrl}
            sequence={analysis.sequence}
            highlight={selected}
            seekRequest={seekRequest}
          />
          <p className="mt-2 text-[11px] text-white/40">
            Tap a snapshot card to jump to a representative moment and highlight the joints
            involved.
          </p>
        </section>
      )}

      {/* coaching */}
      <section className="mt-8 rounded-2xl border border-violet-400/30 bg-gradient-to-b from-violet-400/10 to-transparent p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-300/90 mb-3">
          {coach.generative ? 'AI Coach' : 'Coaching cue'}
        </p>
        <div className="space-y-4 text-sm leading-relaxed">
          <div>
            <p className="font-display font-semibold text-white/90 mb-1">What we noticed</p>
            <p className="text-white/70">{coach.noticed}</p>
          </div>
          <div>
            <p className="font-display font-semibold text-white/90 mb-1">Try this</p>
            <p className="text-white/70">{coach.tryThis}</p>
          </div>
          <div>
            <p className="font-display font-semibold text-white/90 mb-1">Why</p>
            <p className="text-white/70">{coach.why}</p>
          </div>
        </div>
      </section>

      <footer className="mt-10 space-y-2 text-[11px] text-white/35 text-center">
        <p>
          Your movement stays yours. Video analysis happens on your device — only derived movement
          metrics are used for coaching.
        </p>
        <p>
          These are approximate camera-based observations, not clinical measurements. FormTwin is a
          prototype coaching tool and is not a medical device or substitute for professional
          medical advice.
        </p>
      </footer>
    </div>
  )
}
