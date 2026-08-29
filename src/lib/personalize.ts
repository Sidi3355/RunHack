import type { Analysis, MetricKey } from '../types'
import type { Profile } from './history'

/**
 * Research-grounded personalization. Every insight combines a value actually
 * measured from the user's video with a profile fact they entered, and cites
 * the source behind the recommendation (see RESEARCH.md). Nothing here
 * invents numbers: if a metric was unreliable or a profile field is missing,
 * the related insight is simply not produced.
 */
export interface PersonalInsight {
  title: string
  text: string
  source: string
  /** related metric card, if any */
  metric?: MetricKey
}

const EXPERIENCE_LABEL: Record<NonNullable<Profile['experience']>, string> = {
  new: 'new runner',
  amateur: 'amateur runner',
  experienced: 'experienced runner',
  competitive: 'competitive runner',
}

function metricValue(analysis: Analysis, key: MetricKey, valueKey: string): number | null {
  const m = analysis.metrics.find((x) => x.key === key)
  if (!m || m.unreliable) return null
  const v = m.values[valueKey]
  return typeof v === 'number' && v >= 0 ? v : null
}

export function hasPersonalization(p: Profile): boolean {
  return p.age != null || p.experience != null || p.yearsRunning != null || p.goalPaceMinPerKm != null
}

export function personalInsights(analysis: Analysis, p: Profile): PersonalInsight[] {
  const out: PersonalInsight[] = []

  const cadence = metricValue(analysis, 'cadence', 'cadence_spm')
  const footAhead = metricValue(analysis, 'footPlacement', 'foot_ahead_of_hip_leg_ratio')
  const bounce = metricValue(analysis, 'verticalOscillation', 'vertical_oscillation_leg_ratio')
  const contactFlex = metricValue(analysis, 'kneeAtContact', 'knee_flexion_at_contact_deg')

  // Goal pace × cadence: step-rate work is the best-evidenced lever we measure.
  if (p.goalPaceMinPerKm != null && cadence != null) {
    const bumped = Math.round(cadence * 1.05)
    if (cadence < 170) {
      out.push({
        title: `Toward your ${p.goalPaceMinPerKm.toFixed(1)} min/km goal`,
        text: `We measured ~${cadence.toFixed(0)} steps/min in this clip. The best-evidenced adjustment is a modest one: raising step rate about 5% (to roughly ${bumped} steps/min) at the same effort reduces braking impulse and joint loading — which supports holding a faster pace without adding impact. Larger jumps aren't better; studies used 5–10% increases.`,
        source: 'Schubert 2014 (Sports Health); Anderson 2022 meta-analysis',
        metric: 'cadence',
      })
    } else {
      out.push({
        title: `Toward your ${p.goalPaceMinPerKm.toFixed(1)} min/km goal`,
        text: `Your measured step rate (~${cadence.toFixed(0)} steps/min) is already in the range the step-rate literature targets, so chasing more cadence is unlikely to be your best lever — look at the lower-scoring cards instead.`,
        source: 'Schubert 2014 (Sports Health); Anderson 2022 meta-analysis',
        metric: 'cadence',
      })
    }
  }

  // Goal pace × overstride: braking costs speed.
  if (p.goalPaceMinPerKm != null && footAhead != null && footAhead > 0.22) {
    out.push({
      title: 'Overstride is working against your pace goal',
      text: `Your ankle lands about ${(footAhead * 100).toFixed(0)}% of leg length ahead of your hip. A foot contacting well ahead of the pelvis increases braking impulse — decelerating you on every step — so landing closer under your body is a speed-friendly change, not just an injury-prevention one.`,
      source: 'Souza 2016; Schubert 2014 (Sports Health)',
      metric: 'footPlacement',
    })
  }

  // Age × landing mechanics: softer landings reduce per-step load.
  if (p.age != null && p.age >= 45 && (contactFlex != null || bounce != null)) {
    const parts: string[] = []
    if (contactFlex != null) parts.push(`~${contactFlex.toFixed(0)}° of knee bend at contact`)
    if (bounce != null) parts.push(`vertical bounce of ~${(bounce * 100).toFixed(0)}% of leg length`)
    out.push({
      title: 'Load-friendly form matters more with the years',
      text: `From your clip we measured ${parts.join(' and ')}. A softly bent knee at contact and lower vertical bounce both reduce the load each stride puts through the leg — a sensible emphasis for any runner who wants to keep accumulating mileage over the years. These are the same landing features that separated injured from uninjured runners in the literature.`,
      source: 'Bramah 2018 (Am J Sports Med); Adams 2018 (IJSPT)',
      metric: contactFlex != null ? 'kneeAtContact' : 'verticalOscillation',
    })
  }

  // Experience level: how aggressively to change things.
  if (p.experience != null) {
    const primary = analysis.primary
    const label = EXPERIENCE_LABEL[p.experience]
    if (p.experience === 'new' || p.experience === 'amateur') {
      out.push({
        title: `One change at a time`,
        text: `As a${p.experience === 'amateur' ? 'n' : ''} ${label}${p.yearsRunning != null ? ` (${p.yearsRunning} yr${p.yearsRunning === 1 ? '' : 's'} running)` : ''}, focus on your single lowest-scoring signal — for this clip that's “${primary.label}”. Gait-retraining studies work with one simple cue at a time (often with a metronome for step rate); stacking several form changes at once isn't how the evidence was built.`,
        source: 'Anderson 2022 meta-analysis; Souza 2016',
        metric: primary.key,
      })
    } else {
      out.push({
        title: `Fine-tuning as a ${label}`,
        text: `With your base${p.yearsRunning != null ? ` (${p.yearsRunning} yrs running)` : ''}, the marginal gains are in consistency: your lowest-scoring signal in this clip is “${primary.label}”. Re-record a side-on clip every few weeks under similar conditions — the trend across sessions in My journey is more informative than any single reading from monocular video.`,
        source: 'Souza 2016 (2D video framework); IJSPT 2023 reliability',
        metric: primary.key,
      })
    }
  }

  return out
}
