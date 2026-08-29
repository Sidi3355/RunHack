/**
 * Fitbit Web API integration (OAuth 2.0 + PKCE, runs fully in the browser).
 *
 * FormTwin only reads activity + heart-rate summaries to derive run-quality
 * insights; no Fitbit data leaves the browser. Requires a Fitbit developer
 * app of type "Client" whose redirect URL matches this site's origin —
 * the client ID is configured via VITE_FITBIT_CLIENT_ID or entered in the UI.
 */

export interface FitbitRun {
  logId: number
  /** ISO start time */
  startTime: string
  activityName: string
  /** seconds */
  durationSec: number
  /** km */
  distanceKm: number
  /** minutes per km */
  paceMinPerKm: number
  averageHeartRate: number | null
  steps: number | null
  /** steps per minute */
  cadenceSpm: number | null
  calories: number
  heartRateZones: { name: string; minutes: number }[]
}

export interface FitbitInsights {
  runs: FitbitRun[]
  /** coefficient of variation of pace across recent runs, 0..1 */
  paceConsistency: number | null
  avgPaceMinPerKm: number | null
  avgHeartRate: number | null
  avgCadenceSpm: number | null
  weeklyDistanceKm: number
  /** share of run minutes spent in higher-intensity HR zones, 0..1 */
  hardEffortShare: number | null
}

const TOKEN_KEY = 'formtwin.fitbit.token.v1'
const VERIFIER_KEY = 'formtwin.fitbit.verifier.v1'
const CLIENT_ID_KEY = 'formtwin.fitbit.clientid.v1'

interface StoredToken {
  accessToken: string
  /** epoch ms */
  expiresAt: number
  userId: string
}

export function getClientId(): string {
  const env = import.meta.env.VITE_FITBIT_CLIENT_ID as string | undefined
  if (env) return env
  return localStorage.getItem(CLIENT_ID_KEY) ?? ''
}

export function setClientId(id: string) {
  localStorage.setItem(CLIENT_ID_KEY, id.trim())
}

export function getToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const t = JSON.parse(raw) as StoredToken
    return t.expiresAt > Date.now() ? t : null
  } catch {
    return null
  }
}

export function disconnect() {
  localStorage.removeItem(TOKEN_KEY)
}

function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sha256(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(digest)
}

const SCOPES = 'activity heartrate profile cardio_fitness'

export async function beginAuth(): Promise<void> {
  const clientId = getClientId()
  if (!clientId) throw new Error('No Fitbit client ID configured.')
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)))
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  const challenge = base64url(await sha256(verifier))
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: SCOPES,
    redirect_uri: window.location.origin + '/',
  })
  window.location.href = `https://www.fitbit.com/oauth2/authorize?${params}`
}

/** Completes the PKCE flow if the URL has ?code=…; returns true on success. */
export async function completeAuthIfRedirected(): Promise<boolean> {
  const code = new URLSearchParams(window.location.search).get('code')
  if (!code) return false
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  const clientId = getClientId()
  if (!verifier || !clientId) return false
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    redirect_uri: window.location.origin + '/',
  })
  const res = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  window.history.replaceState({}, '', window.location.pathname)
  if (!res.ok) return false
  const json = (await res.json()) as {
    access_token: string
    expires_in: number
    user_id: string
  }
  const token: StoredToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 60) * 1000,
    userId: json.user_id,
  }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
  sessionStorage.removeItem(VERIFIER_KEY)
  return true
}

interface FitbitActivityLog {
  logId: number
  activityName: string
  startTime: string
  duration: number
  distance?: number
  distanceUnit?: string
  averageHeartRate?: number
  steps?: number
  calories: number
  speed?: number
  pace?: number
  heartRateZones?: { name: string; minutes: number }[]
}

export async function fetchRuns(limit = 20): Promise<FitbitRun[]> {
  const token = getToken()
  if (!token) throw new Error('Not connected to Fitbit.')
  const url = `https://api.fitbit.com/1/user/-/activities/list.json?beforeDate=${new Date()
    .toISOString()
    .slice(0, 10)}&sort=desc&limit=${Math.min(limit, 100)}&offset=0`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  })
  if (res.status === 401) {
    disconnect()
    throw new Error('Fitbit session expired — please reconnect.')
  }
  if (!res.ok) throw new Error('Could not load your Fitbit activities.')
  const json = (await res.json()) as { activities: FitbitActivityLog[] }
  return json.activities
    .filter((a) => /run|jog/i.test(a.activityName))
    .map(toRun)
}

function toRun(a: FitbitActivityLog): FitbitRun {
  const durationSec = a.duration / 1000
  const distanceKm = a.distance ?? 0
  const paceMinPerKm =
    a.pace != null ? a.pace / 60 : distanceKm > 0.05 ? durationSec / 60 / distanceKm : 0
  const cadenceSpm =
    a.steps != null && durationSec > 30 ? (a.steps / durationSec) * 60 : null
  return {
    logId: a.logId,
    startTime: a.startTime,
    activityName: a.activityName,
    durationSec,
    distanceKm,
    paceMinPerKm,
    averageHeartRate: a.averageHeartRate ?? null,
    steps: a.steps ?? null,
    cadenceSpm,
    calories: a.calories,
    heartRateZones: a.heartRateZones ?? [],
  }
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

export function deriveInsights(runs: FitbitRun[]): FitbitInsights {
  const paced = runs.filter((r) => r.paceMinPerKm > 0)
  const paces = paced.map((r) => r.paceMinPerKm)
  const avgPace = paces.length ? mean(paces) : null
  let paceConsistency: number | null = null
  if (paces.length >= 3 && avgPace) {
    const sd = Math.sqrt(mean(paces.map((p) => (p - avgPace) ** 2)))
    paceConsistency = sd / avgPace
  }
  const hrs = runs.map((r) => r.averageHeartRate).filter((h): h is number => h != null)
  const cadences = runs.map((r) => r.cadenceSpm).filter((c): c is number => c != null)
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000
  const weeklyDistanceKm = runs
    .filter((r) => new Date(r.startTime).getTime() >= weekAgo)
    .reduce((s, r) => s + r.distanceKm, 0)

  let hardEffortShare: number | null = null
  const zoned = runs.filter((r) => r.heartRateZones.length)
  if (zoned.length) {
    let total = 0
    let hard = 0
    for (const r of zoned) {
      for (const z of r.heartRateZones) {
        total += z.minutes
        if (/cardio|peak/i.test(z.name)) hard += z.minutes
      }
    }
    if (total > 0) hardEffortShare = hard / total
  }

  return {
    runs,
    paceConsistency,
    avgPaceMinPerKm: avgPace,
    avgHeartRate: hrs.length ? mean(hrs) : null,
    avgCadenceSpm: cadences.length ? mean(cadences) : null,
    weeklyDistanceKm,
    hardEffortShare,
  }
}

/** Clearly-labelled sample data so the Fitbit insights UI can be demoed. */
export function sampleRuns(): FitbitRun[] {
  const now = Date.now()
  const mk = (daysAgo: number, km: number, paceMin: number, hr: number, spm: number): FitbitRun => {
    const durationSec = paceMin * km * 60
    return {
      logId: daysAgo,
      startTime: new Date(now - daysAgo * 24 * 3600 * 1000).toISOString(),
      activityName: 'Run',
      durationSec,
      distanceKm: km,
      paceMinPerKm: paceMin,
      averageHeartRate: hr,
      steps: Math.round((spm * durationSec) / 60),
      cadenceSpm: spm,
      calories: Math.round(km * 65),
      heartRateZones: [
        { name: 'Fat Burn', minutes: Math.round(durationSec / 60) * 0.5 },
        { name: 'Cardio', minutes: Math.round(durationSec / 60) * 0.4 },
        { name: 'Peak', minutes: Math.round(durationSec / 60) * 0.1 },
      ],
    }
  }
  return [
    mk(1, 5.2, 5.6, 152, 168),
    mk(3, 8.1, 6.0, 148, 164),
    mk(5, 4.8, 5.3, 158, 171),
    mk(8, 10.0, 6.2, 146, 162),
    mk(11, 5.0, 5.5, 151, 167),
    mk(14, 6.4, 5.8, 150, 166),
  ]
}
