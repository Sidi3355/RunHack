import { useEffect, useState } from 'react'
import {
  beginAuth,
  deriveInsights,
  disconnect,
  fetchRuns,
  getClientId,
  getToken,
  sampleRuns,
  setClientId,
  type FitbitInsights,
} from '../lib/fitbit'
import { ExpandableChart } from './Chart'

function fmtPace(minPerKm: number) {
  const m = Math.floor(minPerKm)
  const s = Math.round((minPerKm - m) * 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

function consistencyLabel(cv: number) {
  if (cv < 0.06) return { label: 'Very consistent', color: 'text-fern' }
  if (cv < 0.12) return { label: 'Fairly consistent', color: 'text-fern' }
  return { label: 'Varies a lot', color: 'text-peach' }
}

export default function FitbitPage() {
  const [connected, setConnected] = useState(!!getToken())
  const [insights, setInsights] = useState<FitbitInsights | null>(null)
  const [isSample, setIsSample] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [clientIdDraft, setClientIdDraft] = useState(getClientId())

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const runs = await fetchRuns()
      setInsights(deriveInsights(runs))
      setIsSample(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load Fitbit data.')
      setConnected(!!getToken())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (connected) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected])

  const showSample = () => {
    setInsights(deriveInsights(sampleRuns()))
    setIsSample(true)
    setError('')
  }

  const chrono = insights ? [...insights.runs].reverse() : []
  const runDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const hrRuns = chrono.filter((r) => (r.averageHeartRate ?? 0) > 0)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold">
        Your <span className="glow-text">Fitbit runs</span>
      </h1>
      <p className="mt-2 max-w-xl text-moss/60">
        Connect your Fitbit to bring heart rate, pace, and consistency from your real runs into
        FormTwin — alongside the video-based form analysis.
      </p>

      {!connected && !isSample && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-line bg-panel p-6">
            <h2 className="font-display text-lg font-bold">Connect Fitbit</h2>
            <p className="mt-2 text-sm leading-relaxed text-moss/60">
              Sign in with Fitbit (Google) and grant read access to your activities and heart rate.
              Data is read directly from Fitbit into your browser — FormTwin has no server storing
              it.
            </p>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-moss/50">
              Fitbit app client ID
            </label>
            <input
              value={clientIdDraft}
              onChange={(e) => setClientIdDraft(e.target.value)}
              placeholder="e.g. 23ABCD"
              className="mt-1 w-full rounded-xl border border-line bg-cream px-3 py-2 text-sm outline-none focus:border-fern"
            />
            <p className="mt-1 text-[11px] text-moss/45">
              Register a free “Client” app at dev.fitbit.com with redirect URL{' '}
              <span className="font-mono">{window.location.origin}/</span> to get one.
            </p>
            <button
              onClick={() => {
                setClientId(clientIdDraft)
                void beginAuth().catch((e: unknown) =>
                  setError(e instanceof Error ? e.message : 'Could not start Fitbit sign-in.'),
                )
              }}
              disabled={!clientIdDraft.trim()}
              className="mt-4 w-full rounded-2xl bg-fern px-6 py-3 font-display font-bold text-cream disabled:opacity-40"
            >
              Connect Fitbit
            </button>
          </div>
          <div className="rounded-3xl border border-dashed border-line bg-panel/60 p-6">
            <h2 className="font-display text-lg font-bold">Just exploring?</h2>
            <p className="mt-2 text-sm text-moss/60">
              See what the insights look like with clearly-labelled sample data.
            </p>
            <button
              onClick={showSample}
              className="mt-4 rounded-2xl border border-fern/40 px-6 py-3 font-display font-bold text-fern"
            >
              View sample Fitbit insights
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-peach/60 bg-peach/15 px-4 py-3 text-sm text-moss">
          {error}
        </div>
      )}
      {loading && <p className="mt-6 text-moss/50">Loading your runs…</p>}

      {insights && (
        <>
          {isSample && (
            <div className="mt-6 rounded-2xl border border-sky bg-sky/30 px-4 py-2.5 text-sm text-moss">
              Sample Fitbit insights — synthetic demo data, not your real runs.
            </div>
          )}
          {connected && !isSample && (
            <button
              onClick={() => {
                disconnect()
                setConnected(false)
                setInsights(null)
              }}
              className="mt-4 text-xs text-moss/50 underline underline-offset-4"
            >
              Disconnect Fitbit
            </button>
          )}

          {insights.runs.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-line bg-panel p-10 text-center text-moss/50">
              No runs found in your recent Fitbit activities.
            </div>
          ) : (
            <>
              {/* summary cards */}
              <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="rounded-3xl border border-line bg-panel p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-moss/50">
                    Avg pace
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold text-fern">
                    {insights.avgPaceMinPerKm ? fmtPace(insights.avgPaceMinPerKm) : '—'}
                  </p>
                </div>
                <div className="rounded-3xl border border-line bg-panel p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-moss/50">
                    Pace consistency
                  </p>
                  {insights.paceConsistency != null ? (
                    <p
                      className={`mt-1 font-display text-2xl font-bold ${consistencyLabel(insights.paceConsistency).color}`}
                    >
                      {consistencyLabel(insights.paceConsistency).label}
                    </p>
                  ) : (
                    <p className="mt-1 font-display text-2xl font-bold text-moss/40">—</p>
                  )}
                  {insights.paceConsistency != null && (
                    <p className="mt-1 text-[11px] text-moss/45">
                      Pace varies ~{Math.round(insights.paceConsistency * 100)}% between runs
                    </p>
                  )}
                </div>
                <div className="rounded-3xl border border-line bg-panel p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-moss/50">
                    Avg heart rate
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold text-fern">
                    {insights.avgHeartRate ? `${Math.round(insights.avgHeartRate)} bpm` : '—'}
                  </p>
                </div>
                <div className="rounded-3xl border border-line bg-panel p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-moss/50">
                    Avg cadence
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold text-fern">
                    {insights.avgCadenceSpm ? `${Math.round(insights.avgCadenceSpm)} spm` : '—'}
                  </p>
                  {insights.avgCadenceSpm != null && (
                    <p className="mt-1 text-[11px] text-moss/45">
                      {insights.avgCadenceSpm >= 160
                        ? 'In the range research links with lighter landings'
                        : 'Research links slightly quicker steps with lighter landings'}
                    </p>
                  )}
                </div>
              </div>

              {/* trends */}
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                <div className="rounded-3xl border border-line bg-panel p-5">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-moss/50">
                    Pace trend (min/km — lower is faster)
                  </p>
                  <ExpandableChart
                    title="Pace trend"
                    subtitle="min/km per run — lower is faster"
                    points={chrono.map((r) => r.paceMinPerKm)}
                    labels={chrono.map((r) => runDate(r.startTime))}
                    color="#3f6b4f"
                  />
                </div>
                <div className="rounded-3xl border border-line bg-panel p-5">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-moss/50">
                    Heart rate trend (bpm)
                  </p>
                  <ExpandableChart
                    title="Heart rate trend"
                    subtitle="Average bpm per run"
                    points={hrRuns.map((r) => r.averageHeartRate as number)}
                    labels={hrRuns.map((r) => runDate(r.startTime))}
                    color="#d98f5f"
                    unit=" bpm"
                  />
                </div>
                <div className="rounded-3xl border border-line bg-panel p-5">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-moss/50">
                    Distance per run (km)
                  </p>
                  <ExpandableChart
                    title="Distance per run"
                    subtitle="Kilometres per run"
                    points={chrono.map((r) => r.distanceKm)}
                    labels={chrono.map((r) => runDate(r.startTime))}
                    color="#7ba05b"
                    unit=" km"
                  />
                </div>
              </div>

              {/* effort + weekly volume */}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-line bg-panel p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-moss/50">
                    Last 7 days
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold text-fern">
                    {insights.weeklyDistanceKm.toFixed(1)} km
                  </p>
                </div>
                {insights.hardEffortShare != null && (
                  <div className="rounded-3xl border border-line bg-panel p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-moss/50">
                      Time in higher-intensity heart zones
                    </p>
                    <p className="mt-1 font-display text-2xl font-bold text-fern">
                      {Math.round(insights.hardEffortShare * 100)}%
                    </p>
                    <p className="mt-1 text-[11px] text-moss/45">
                      Most easy-run guidance keeps the bulk of running at lower intensity.
                    </p>
                  </div>
                )}
              </div>

              {/* run list */}
              <h2 className="mt-8 mb-3 font-display text-xl font-bold">Recent runs</h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {insights.runs.map((r) => (
                  <li key={r.logId} className="rounded-3xl border border-line bg-panel p-4">
                    <div className="flex items-center justify-between text-sm text-moss/60">
                      <span>
                        {new Date(r.startTime).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span>{(r.durationSec / 60).toFixed(0)} min</span>
                    </div>
                    <p className="mt-1 font-display text-xl font-bold text-fern">
                      {r.distanceKm.toFixed(1)} km
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                      {r.paceMinPerKm > 0 && (
                        <span className="rounded-full bg-sage/60 px-2 py-0.5 text-fern">
                          {fmtPace(r.paceMinPerKm)}
                        </span>
                      )}
                      {r.averageHeartRate != null && (
                        <span className="rounded-full bg-peach/40 px-2 py-0.5 text-moss">
                          {r.averageHeartRate} bpm
                        </span>
                      )}
                      {r.cadenceSpm != null && (
                        <span className="rounded-full bg-sky/50 px-2 py-0.5 text-moss">
                          {Math.round(r.cadenceSpm)} spm
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <p className="mt-10 text-center text-[11px] text-moss/40">
        Fitbit data is read into your browser only. These are training insights, not medical
        measurements.
      </p>
    </div>
  )
}
