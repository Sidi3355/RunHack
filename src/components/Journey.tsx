import { useState } from 'react'
import type { MetricKey } from '../types'
import { deleteEntry, loadHistory, type HistoryEntry } from '../lib/history'
import { ExpandableChart } from './Chart'

const METRIC_LABELS: Record<MetricKey, string> = {
  posture: 'Posture',
  footPlacement: 'Foot placement',
  kneeMotion: 'Knee motion',
  symmetry: 'Symmetry',
  cadence: 'Cadence',
  verticalOscillation: 'Bounce',
  kneeAtContact: 'Landing knee',
}

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Journey() {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadHistory())
  const chrono = [...entries].reverse()

  const trendEntries = (key: MetricKey) =>
    chrono.filter((e) => e.scores[key] != null && !e.unreliable.includes(key))

  const shortDate = (ms: number) =>
    new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold">
        My <span className="glow-text">journey</span>
      </h1>
      <p className="mt-2 max-w-xl text-moss/60">
        Every analysis you run is saved on this device so you can watch your form grow over time —
        like rings on a tree.
      </p>

      {entries.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-line bg-panel p-10 text-center text-moss/50">
          No analyses yet. Upload a run on the Analyse page and it will appear here.
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          {/* progress graphs */}
          <section>
            <h2 className="mb-3 font-display text-xl font-bold">Progress</h2>
            <div className="rounded-3xl border border-line bg-panel p-5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-moss/50">
                Overall movement snapshot
              </p>
              <ExpandableChart
                title="Overall movement snapshot"
                subtitle="Score out of 100 across your saved analyses"
                points={chrono.map((e) => e.overallScore)}
                labels={chrono.map((e) => shortDate(e.date))}
                min={0}
                max={100}
                color="#3f6b4f"
              />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(Object.keys(METRIC_LABELS) as MetricKey[]).map((key) => {
                const es = trendEntries(key)
                if (!es.length) return null
                return (
                  <div key={key} className="rounded-3xl border border-line bg-panel p-4">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-moss/50">
                      {METRIC_LABELS[key]}
                    </p>
                    <ExpandableChart
                      title={METRIC_LABELS[key]}
                      subtitle="Score out of 100 across your saved analyses (reliable readings only)"
                      points={es.map((e) => e.scores[key] as number)}
                      labels={es.map((e) => shortDate(e.date))}
                      min={0}
                      max={100}
                      height={90}
                      color="#7ba05b"
                    />
                  </div>
                )
              })}
            </div>
          </section>

          {/* past uploads */}
          <section>
            <h2 className="mb-3 font-display text-xl font-bold">Past uploads</h2>
            <ul className="space-y-3">
              {entries.map((e) => (
                <li key={e.id} className="rounded-3xl border border-line bg-panel p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-moss/60">{fmtDate(e.date)}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-2xl font-bold text-fern">
                        {e.overallScore}
                        <span className="text-sm font-normal text-moss/40"> /100</span>
                      </span>
                      <button
                        onClick={() => setEntries(deleteEntry(e.id))}
                        className="text-xs text-moss/40 hover:text-moss/70"
                        aria-label="Delete entry"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-snug text-moss/75">{e.primaryHeadline}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(Object.keys(e.scores) as MetricKey[]).map((k) =>
                      e.unreliable.includes(k) ? null : (
                        <span
                          key={k}
                          className="rounded-full bg-sage/60 px-2 py-0.5 text-[11px] text-fern"
                        >
                          {METRIC_LABELS[k]} {e.scores[k]}
                        </span>
                      ),
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
      <p className="mt-10 text-center text-[11px] text-moss/40">
        History lives only in this browser — clearing site data removes it.
      </p>
    </div>
  )
}
