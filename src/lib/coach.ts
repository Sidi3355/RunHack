import type { Analysis, CoachAdvice, MetricKey } from '../types'

/**
 * The coach never sees the video. It only receives the derived,
 * non-video metrics below.
 */
export function coachPayload(analysis: Analysis) {
  const v: Record<string, number> = {}
  for (const m of analysis.metrics) Object.assign(v, m.values)
  return {
    ...v,
    posture_score: analysis.metrics.find((m) => m.key === 'posture')!.score,
    foot_placement_score: analysis.metrics.find((m) => m.key === 'footPlacement')!.score,
    knee_motion_score: analysis.metrics.find((m) => m.key === 'kneeMotion')!.score,
    symmetry_score: analysis.metrics.find((m) => m.key === 'symmetry')!.score,
    overall_score: analysis.overallScore,
    analysis_confidence: +analysis.confidence.toFixed(2),
    primary_observation: analysis.primary.key,
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
  }
  return templates[analysis.primary.key]
}
