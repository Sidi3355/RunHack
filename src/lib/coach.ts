import type { Analysis, CoachAdvice, MetricKey } from '../types'
import { loadProfile } from './history'

/**
 * The coach never sees the video. It only receives the derived,
 * non-video metrics below.
 */
export function coachPayload(analysis: Analysis) {
  const v: Record<string, number> = {}
  for (const m of analysis.metrics) {
    Object.assign(v, m.values)
    v[`${m.key}_score`] = m.score
  }
  const p = loadProfile()
  return {
    ...v,
    overall_score: analysis.overallScore,
    analysis_confidence: +analysis.confidence.toFixed(2),
    primary_observation: analysis.primary.key,
    ...(p.age != null ? { runner_age: p.age } : {}),
    ...(p.yearsRunning != null ? { runner_years_running: p.yearsRunning } : {}),
    ...(p.goalPaceMinPerKm != null ? { runner_goal_pace_min_per_km: p.goalPaceMinPerKm } : {}),
    ...(p.experience != null ? { runner_experience: p.experience } : {}),
  }
}

export async function getCoachAdvice(analysis: Analysis): Promise<CoachAdvice> {
  try {
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coachPayload(analysis)),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.noticed && data.tryThis && data.why) {
        return { noticed: data.noticed, tryThis: data.tryThis, why: data.why, generative: true }
      }
    }
  } catch {
    // no coach endpoint available — fall through to templated coaching
  }
  return templatedAdvice(analysis)
}

/** Deterministic templated coaching used when no LLM is configured. */
export function templatedAdvice(analysis: Analysis): CoachAdvice {
  const templates: Record<MetricKey, CoachAdvice> = {
    footPlacement: {
      noticed:
        'Your foot appears to contact the ground relatively far ahead of your hip in this recording.',
      tryThis:
        'On your next run, experiment with slightly quicker, shorter steps and think about putting your foot down closer underneath you.',
      why: 'Landing nearer your centre of mass may help you keep a smoother, more efficient movement pattern.',
      generative: false,
    },
    posture: {
      noticed: analysis.primary.headline,
      tryThis:
        'Think "tall and relaxed": imagine a string gently lifting the top of your head, with a slight whole-body lean from the ankles.',
      why: 'A steady, slightly forward posture can make it easier to keep your stride relaxed and consistent.',
      generative: false,
    },
    kneeMotion: {
      noticed: analysis.primary.headline,
      tryThis:
        'Try a few short strides focusing on lifting your heel a little higher behind you as you push off.',
      why: 'A comfortable knee range helps your legs cycle smoothly instead of reaching or shuffling.',
      generative: false,
    },
    symmetry: {
      noticed:
        'Your left and right knee movement differs more than expected in this clip.',
      tryThis:
        'Try a short relaxed run focusing on an even rhythm — some runners find counting steps left-right helps.',
      why: 'A more even left-right rhythm can make your stride feel smoother and more consistent.',
      generative: false,
    },
    cadence: {
      noticed: analysis.primary.headline,
      tryThis:
        'Try increasing your step rate by around 5% — quicker, lighter steps at the same speed. A metronome app around 170–180 beats/min can help.',
      why: 'Research links a modestly higher step rate with lower impact loading at the hip, knee and ankle.',
      generative: false,
    },
    verticalOscillation: {
      noticed: 'You appear to bounce vertically more than expected in this recording.',
      tryThis:
        'Imagine running under a low ceiling — keep your head level and let quicker steps carry you forward instead of up.',
      why: 'Less vertical bounce tends to mean lower peak impact forces and less wasted energy each stride.',
      generative: false,
    },
    kneeAtContact: {
      noticed:
        'Your knee appears relatively straight at the moment your foot lands in this recording.',
      tryThis:
        'Think "soft knees": let your knee stay slightly bent as your foot touches down, landing a little closer under your body.',
      why: 'A softly bent knee at contact lets your leg act like a spring and absorb load more gradually.',
      generative: false,
    },
  }
  return templates[analysis.primary.key]
}
