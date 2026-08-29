import type { Analysis, MetricKey } from '../types'

/**
 * Local run history, persisted in the browser only. FormTwin stores derived
 * metric scores — never the video itself — so past analyses stay on-device.
 */
export interface HistoryEntry {
  id: string
  /** epoch ms of the analysis */
  date: number
  overallScore: number
  confidence: number
  primaryHeadline: string
  scores: Partial<Record<MetricKey, number>>
  /** metric keys that were unreliable for this clip */
  unreliable: MetricKey[]
}

const KEY = 'formtwin.history.v1'

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : []
  } catch {
    return []
  }
}

export function saveAnalysis(analysis: Analysis): HistoryEntry {
  const scores: Partial<Record<MetricKey, number>> = {}
  const unreliable: MetricKey[] = []
  for (const m of analysis.metrics) {
    scores[m.key] = m.score
    if (m.unreliable) unreliable.push(m.key)
  }
  const entry: HistoryEntry = {
    id: `run-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    date: Date.now(),
    overallScore: analysis.overallScore,
    confidence: analysis.confidence,
    primaryHeadline: analysis.primary.headline,
    scores,
    unreliable,
  }
  const all = [entry, ...loadHistory()].slice(0, 100)
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* storage full or unavailable — history is best-effort */
  }
  return entry
}

export function deleteEntry(id: string): HistoryEntry[] {
  const all = loadHistory().filter((e) => e.id !== id)
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* best-effort */
  }
  return all
}

const PROFILE_KEY = 'formtwin.profile.v1'

export interface Profile {
  name: string
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (raw) return JSON.parse(raw) as Profile
  } catch {
    /* fall through */
  }
  return { name: '' }
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
  } catch {
    /* best-effort */
  }
}
