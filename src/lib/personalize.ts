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

export interface PersonalTarget {
  key: MetricKey
  label: string
  /** the evidence-based target */
  target: string
  /** how this target reads for THIS runner's profile — honest about when the evidence doesn't differentiate */
  note: string
  source: string
}

/**
 * Demographic-aware target guidance. The underlying 2D-video bands come from
 * the cited literature and — except for cadence, which is genuinely
 * pace/speed-dependent — the research does NOT publish different biomechanical
 * targets per age or ability level. So instead of inventing demographic
 * numbers, each note states what the evidence supports for this runner's
 * level: where the band genuinely shifts (cadence with pace) and where only
 * the expectation of hitting it differs.
 */
export function personalTargets(p: Profile): PersonalTarget[] {
  const exp = p.experience
  const beginner = exp === 'new' || exp === 'amateur'
  const levelWord = exp ? EXPERIENCE_LABEL[exp] : 'runner'

  const cadenceNote = (() => {
    const base =
      'Cadence is the one target that genuinely shifts with your profile: step rate rises with running speed, so the right spot in the 160–190 band depends on pace.'
    if (p.goalPaceMinPerKm != null && p.goalPaceMinPerKm <= 5) {
      return `${base} At your ~${p.goalPaceMinPerKm.toFixed(1)} min/km goal pace, most runners sit in the middle-to-upper part of the band (~170–185); at easy pace the low end is normal.`
    }
    if (p.goalPaceMinPerKm != null) {
      return `${base} At your ~${p.goalPaceMinPerKm.toFixed(1)} min/km goal pace, the low-to-middle part of the band (~160–175) is typical; forcing an elite-style 180+ at easy pace isn't supported by the evidence.`
    }
    return `${base} At easy paces the low end is normal — the often-quoted "180" comes from elites racing, not ${levelWord}s on easy runs.`
  })()

  const expectation = beginner
    ? `As ${exp === 'amateur' || exp === 'experienced' ? 'an' : 'a'} ${levelWord}, being outside a band isn't alarming — the studies changed one thing at a time and used modest (~5%) adjustments.`
    : `As ${exp === 'amateur' || exp === 'experienced' ? 'an' : 'a'} ${levelWord}, you should sit inside this band on most reliable clips; use the trend across sessions rather than one reading.`

  return [
    {
      key: 'posture',
      label: 'Posture',
      target: 'Slight forward lean, ~2–12° from vertical, held steadily',
      note: `The evidence-based band is the same across ages and levels. ${expectation}`,
      source: 'Souza 2016; Bramah 2018',
    },
    {
      key: 'footPlacement',
      label: 'Foot placement',
      target: 'Ankle ≤22% of leg length ahead of the hip at contact',
      note: `The overstride flag doesn't change with demographics — but it matters more the faster you want to run, because a far-forward foot brakes every step. ${expectation}`,
      source: 'Souza 2016; Schubert 2014',
    },
    {
      key: 'kneeMotion',
      label: 'Knee motion',
      target: '~40–110° of knee travel per stride',
      note: `Knee range naturally grows with speed: at easy pace expect the lower half of this band; nearer the top when running fast. No separate band per age or level is published. ${expectation}`,
      source: 'Souza 2016',
    },
    {
      key: 'symmetry',
      label: 'Symmetry',
      target: 'Left/right knee-range difference ≤12%',
      note: `Symmetry expectations are the same for every runner — the literature treats between-limb differences as a consistency flag at any level. ${expectation}`,
      source: 'IJSPT 2023',
    },
    {
      key: 'cadence',
      label: 'Cadence',
      target: '~160–190 steps/min (pace-dependent)',
      note: cadenceNote,
      source: 'Schubert 2014; Anderson 2022',
    },
    {
      key: 'verticalOscillation',
      label: 'Bounce',
      target: 'Hip vertical travel ≤11% of leg length per stride',
      note: `This ceiling applies to all runners; the research doesn't lower or raise it per demographic. ${expectation}`,
      source: 'Souza 2016; Adams 2018',
    },
    {
      key: 'kneeAtContact',
      label: 'Landing knee',
      target: '~10–30° of knee bend as the foot lands',
      note: `The injured-vs-healthy comparison behind this band wasn't split by age or ability — a softly bent knee at contact is the target for everyone${p.age != null && p.age >= 45 ? ', and load-friendly landings are a sensible emphasis for masters runners' : ''}. ${expectation}`,
      source: 'Bramah 2018',
    },
  ]
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
