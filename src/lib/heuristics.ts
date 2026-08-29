/**
 * Prototype coaching heuristics — NOT clinical thresholds.
 *
 * All scoring in FormTwin is a transparent heuristic derived from
 * camera-based pose estimates. Tune freely for the demo.
 */
export const HEURISTICS = {
  torsoLean: {
    /** degrees from vertical considered ideal (slight forward lean) */
    idealMin: 2,
    idealMax: 12,
    /** degrees beyond ideal at which score reaches 0 contribution */
    falloff: 18,
    /** torso lean variability (deg range) considered fine */
    rangeOk: 12,
    rangeFalloff: 18,
  },
  kneeFlexion: {
    /** knee angle range (deg) through the stride that reads as healthy drive */
    idealRangeMin: 40,
    idealRangeMax: 110,
    falloff: 40,
  },
  footPlacement: {
    /**
     * Horizontal ankle-ahead-of-hip distance at low-foot frames,
     * normalized by leg length. Below `ok` reads as landing under the body.
     */
    ok: 0.22,
    falloff: 0.3,
  },
  symmetry: {
    /** relative L/R difference in knee-angle range considered fine */
    ok: 0.12,
    falloff: 0.35,
  },
  overallWeights: {
    posture: 0.25,
    footPlacement: 0.3,
    kneeMotion: 0.25,
    symmetry: 0.2,
  },
} as const

/** map a deviation (0=perfect) with falloff to a 0..100 score */
export function falloffScore(deviation: number, falloff: number): number {
  const s = 100 * (1 - Math.min(1, Math.max(0, deviation) / falloff))
  return Math.round(Math.max(5, s))
}
