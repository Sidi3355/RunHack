import { useState } from 'react'
import type { Analysis, CoachAdvice, MetricKey } from '../types'
import Twin3D from './Twin3D'
import VideoOverlay from './VideoOverlay'
import ErrorBoundary from './ErrorBoundary'

function scoreColor(s: number) {
  if (s >= 80) return 'text-fern'
  if (s >= 60) return 'text-amber-600'
  return 'text-rose-500'
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
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6">
      <header className="mb-4 flex items-center justify-between">
        <button onClick={onReset} className="text-sm text-moss/50">
          ← New analysis
        </button>
        <span className="rounded-full border border-line bg-panel px-2.5 py-1 text-[11px] text-moss/50">
          Analysis confidence {confidencePct}%
        </span>
      </header>

      {isSample && (
        <div className="mb-4 rounded-2xl border border-sky bg-sky/30 px-4 py-2.5 text-sm text-moss">
          Sample analysis — synthetic demo motion, not a real recording.
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        {/* left column: twin + video */}
        <div>
          <h1 className="mb-3 font-display text-2xl font-bold">
            Your <span className="glow-text">movement twin</span>
          </h1>
          <ErrorBoundary
            fallback={
              <div className="rounded-3xl border border-line bg-panel p-6 text-sm text-moss/60">
                The 3D view isn't available on this device — the rest of your analysis is below.
              </div>
            }
          >
            <Twin3D sequence={analysis.sequence} highlight={selected} showGhost={showGhost} />
          </ErrorBoundary>

          {selected === 'footPlacement' && (
            <button
              onClick={() => setShowGhost((g) => !g)}
              className={`mt-3 w-full rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                showGhost
                  ? 'border-fern/60 bg-sage/60 text-fern'
                  : 'border-line bg-panel text-moss/70'
              }`}
            >
              {showGhost
                ? '✓ Showing illustrative coaching cue (ghost)'
                : 'Show me the fix — ghost overlay'}
            </button>
          )}
          {showGhost && selected === 'footPlacement' && (
            <p className="mt-2 text-[11px] text-moss/45">
              The green ghost is an illustrative coaching cue showing the direction of correction —
              not a biomechanically optimal pose.
            </p>
          )}

          {videoUrl && (
            <section className="mt-8">
              <h2 className="mb-3 font-display text-xl font-bold">Your recording</h2>
              <VideoOverlay
                videoUrl={videoUrl}
                sequence={analysis.sequence}
                highlight={selected}
                seekRequest={seekRequest}
              />
              <p className="mt-2 text-[11px] text-moss/45">
                Tap a snapshot card to jump to a representative moment and highlight the joints
                involved.
              </p>
            </section>
          )}
        </div>

        {/* right column: observation + metrics + coaching */}
        <div>
          <section className="rounded-3xl border border-line bg-panel p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-fern/80">
              Headline observation
            </p>
            <p className="font-display text-lg leading-snug">{analysis.primary.headline}</p>
          </section>

          <section className="mt-6">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-display text-xl font-bold">Movement snapshot</h2>
              <div className="text-right">
                <span
                  className={`font-display text-4xl font-bold ${scoreColor(analysis.overallScore)}`}
                >
                  {analysis.overallScore}
                </span>
                <span className="text-sm text-moss/40"> / 100</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {analysis.metrics.map((m) => (
                <button
                  key={m.key}
                  onClick={() => selectMetric(m.key, m.keyTime)}
                  className={`rounded-3xl border p-4 text-left transition-colors ${
                    selected === m.key ? 'border-fern/70 bg-sage/50' : 'border-line bg-panel'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-moss/70">{m.label}</span>
                    <span className={`font-display text-2xl font-bold ${scoreColor(m.score)}`}>
                      {m.score}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel2">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-fern to-lime"
                      style={{ width: `${m.score}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
            {selectedMetric && (
              <div className="mt-3 rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-moss/70">
                <p>{selectedMetric.headline}</p>
                <p className="mt-1 text-xs text-moss/45">{selectedMetric.detail}</p>
                {selectedMetric.evidence && (
                  <p className="mt-2 border-t border-line pt-2 text-xs leading-relaxed text-moss/50">
                    <span className="font-semibold text-fern/80">Why this score: </span>
                    {selectedMetric.evidence}
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="mt-8 rounded-3xl border border-peach/50 bg-gradient-to-b from-peach/20 to-transparent p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-moss/60">
              {coach.generative ? 'AI Coach' : 'Coaching cue'}
            </p>
            <div className="space-y-4 text-sm leading-relaxed">
              <div>
                <p className="mb-1 font-display font-semibold text-moss/90">What we noticed</p>
                <p className="text-moss/70">{coach.noticed}</p>
              </div>
              <div>
                <p className="mb-1 font-display font-semibold text-moss/90">Try this</p>
                <p className="text-moss/70">{coach.tryThis}</p>
              </div>
              <div>
                <p className="mb-1 font-display font-semibold text-moss/90">Why</p>
                <p className="text-moss/70">{coach.why}</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <footer className="mt-10 space-y-2 text-center text-[11px] text-moss/40">
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
