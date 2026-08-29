/**
 * Prototype coaching heuristics — NOT clinical thresholds.
 *
 * All scoring in FormTwin is a transparent heuristic derived from
 * camera-based pose estimates. Tune freely for the demo.
 *
 * Target ranges are informed by the 2D running-gait literature
 * (see RESEARCH.md): Souza 2016 evidence-based video analysis;
 * Bramah 2018 injured-runner kinematics; Schubert 2014 & Anderson 2022
 * step-rate reviews; Adams 2018 cadence/vertical-oscillation loading.
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
  cadence: {
    /**
     * Steps per minute. Higher step rate (shorter strides) consistently
     * reduces vertical loading rate, braking impulse and joint energy
     * absorption (Schubert 2014; Adams 2018). Typical recreational
     * range ~160–180; below ~155 often pairs with overstriding.
     */
    idealMin: 160,
    idealMax: 190,
    falloff: 30,
    /** minimum detected contacts for a reliable estimate */
    minContacts: 4,
  },
  verticalOscillation: {
    /**
     * Hip-midpoint vertical excursion normalized by leg length.
     * Lower oscillation predicts lower peak vGRF (Adams 2018);
     * "bounding" (large CoM displacement) is a flag in video analysis
     * (Souza 2016). ~6–10 cm on a ~90 cm leg ≈ 0.07–0.11.
     */
    ok: 0.11,
    falloff: 0.12,
  },
  kneeAtContact: {
    /**
     * Knee flexion (deg from straight) at likely initial contact.
     * Injured runners land with a more extended knee (Bramah 2018);
     * some flexion at contact helps absorb load.
     */
    okFlexion: 8,
    falloff: 10,
  },
  sideView: {
    /**
     * Minimum horizontal ankle swing (5–95 pct range, normalized by leg
     * length) for a clip to count as side-on. Head-on footage shows little
     * horizontal ankle travel, making gait-event metrics unreliable.
     */
    minAnkleSwing: 0.45,
    /**
     * Maximum shoulder horizontal separation / torso length for a side-on
     * view. Facing the camera the shoulders are widely separated, from the
     * side they nearly overlap. Second signal to make the guard robust.
     */
    maxShoulderRatio: 0.45,
  },
  overallWeights: {
    posture: 0.14,
    footPlacement: 0.2,
    kneeMotion: 0.12,
    symmetry: 0.1,
    cadence: 0.16,
    verticalOscillation: 0.12,
    kneeAtContact: 0.16,
  },
} as const

/**
 * Scoring philosophy: monocular pose estimates carry real measurement
 * uncertainty, so no camera-based observation earns a perfect 100 — scores
 * top out at MAX_SCORE, and being merely inside a target band earns less
 * than sitting near its centre. Deviation beyond the band decays toward 5.
 */
export const MAX_SCORE = 92
const BAND_EDGE_SCORE = 78

/**
 * Score a value against an ideal band: MAX_SCORE at the band centre,
 * BAND_EDGE_SCORE at the edges, decaying to 5 at edge+falloff beyond.
 */
export function bandScore(
  value: number,
  idealMin: number,
  idealMax: number,
  falloff: number,
): number {
  const centre = (idealMin + idealMax) / 2
  const halfWidth = Math.max(1e-6, (idealMax - idealMin) / 2)
  if (value >= idealMin && value <= idealMax) {
    const frac = Math.abs(value - centre) / halfWidth
    return Math.round(MAX_SCORE - (MAX_SCORE - BAND_EDGE_SCORE) * frac)
  }
  const dev = value < idealMin ? idealMin - value : value - idealMax
  const s = BAND_EDGE_SCORE * (1 - Math.min(1, dev / falloff))
  return Math.round(Math.max(5, s))
}

/**
 * Score a magnitude where 0 is best and `ok` is the acceptable threshold:
 * MAX_SCORE at 0, BAND_EDGE_SCORE at `ok`, decaying to 5 at ok+falloff.
 */
export function thresholdScore(value: number, ok: number, falloff: number): number {
  const v = Math.max(0, value)
  if (v <= ok) {
    return Math.round(MAX_SCORE - (MAX_SCORE - BAND_EDGE_SCORE) * (v / Math.max(1e-6, ok)))
  }
  const s = BAND_EDGE_SCORE * (1 - Math.min(1, (v - ok) / falloff))
  return Math.round(Math.max(5, s))
}
