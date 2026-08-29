import type { Analysis, MetricResult, PoseFrame, PoseSequence } from '../types'
import { LM } from '../types'
import { HEURISTICS, falloffScore } from './heuristics'

// These are approximate camera-based signals from monocular pose estimation,
// not clinical measurements.

const R2D = 180 / Math.PI

function mid(f: PoseFrame, a: number, b: number) {
  return {
    x: (f.landmarks[a].x + f.landmarks[b].x) / 2,
    y: (f.landmarks[a].y + f.landmarks[b].y) / 2,
  }
}

/** torso angle from vertical in degrees (image space, y down) */
function torsoLeanDeg(f: PoseFrame): number {
  const s = mid(f, LM.leftShoulder, LM.rightShoulder)
  const h = mid(f, LM.leftHip, LM.rightHip)
  return Math.abs(Math.atan2(s.x - h.x, h.y - s.y) * R2D)
}

/** interior angle at `b` for points a-b-c (image space) in degrees */
function angleAt(f: PoseFrame, a: number, b: number, c: number): number {
  const p = f.landmarks
  const v1 = { x: p[a].x - p[b].x, y: p[a].y - p[b].y }
  const v2 = { x: p[c].x - p[b].x, y: p[c].y - p[b].y }
  const dot = v1.x * v2.x + v1.y * v2.y
  const m = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)
  if (m === 0) return 180
  return Math.acos(Math.min(1, Math.max(-1, dot / m))) * R2D
}

function quantiles(values: number[], qs: number[]): number[] {
  const s = [...values].sort((a, b) => a - b)
  return qs.map((q) => s[Math.min(s.length - 1, Math.floor(q * s.length))])
}

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length)

/** frames where a foot is near its lowest point → likely ground contact */
function lowFootFrames(frames: PoseFrame[], ankle: number): PoseFrame[] {
  const ys = frames.map((f) => f.landmarks[ankle].y)
  const [thresh] = quantiles(ys, [0.8]) // y down: larger y = lower foot
  return frames.filter((f) => f.landmarks[ankle].y >= thresh)
}

/**
 * Likely initial-contact frames per side: local maxima of ankle height-below-hip
 * (y down → lowest foot), spaced at least `minGap` seconds apart.
 * Approximate gait-event detection from monocular video — not force-plate truth.
 */
function contactFrames(frames: PoseFrame[], side: 'left' | 'right', minGap = 0.22): PoseFrame[] {
  const [hip, knee, ankle] =
    side === 'left'
      ? [LM.leftHip, LM.leftKnee, LM.leftAnkle]
      : [LM.rightHip, LM.rightKnee, LM.rightAnkle]
  // ankle depth below the hip, normalized by per-frame leg length, so body
  // translation / scale change (runner approaching camera) cancels out
  const ys = frames.map((f) => {
    const leg = legLength(f, hip, knee, ankle)
    return leg > 1e-4 ? (f.landmarks[ankle].y - f.landmarks[hip].y) / leg : 0
  })
  const [thresh] = quantiles(ys, [0.7])
  const out: PoseFrame[] = []
  let lastT = -Infinity
  for (let i = 1; i < frames.length - 1; i++) {
    if (ys[i] >= thresh && ys[i] >= ys[i - 1] && ys[i] >= ys[i + 1]) {
      if (frames[i].t - lastT >= minGap) {
        out.push(frames[i])
        lastT = frames[i].t
      }
    }
  }
  return out
}

function legLength(f: PoseFrame, hip: number, knee: number, ankle: number): number {
  const p = f.landmarks
  return (
    Math.hypot(p[knee].x - p[hip].x, p[knee].y - p[hip].y) +
    Math.hypot(p[ankle].x - p[knee].x, p[ankle].y - p[knee].y)
  )
}

export function analyseSequence(seq: PoseSequence): Analysis {
  const frames = seq.frames
  const H = HEURISTICS

  // ---- 1. Torso lean (posture)
  // torso measurements need visible shoulders AND hips; tight-cropped clips
  // (legs only) otherwise produce nonsense lean angles
  const torsoVis = mean(
    frames.map((f) =>
      mean(
        [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip].map(
          (i) => f.landmarks[i].visibility,
        ),
      ),
    ),
  )
  const leans = frames.map(torsoLeanDeg)
  const avgLean = mean(leans)
  const [lo, hi] = quantiles(leans, [0.05, 0.95])
  const leanRange = hi - lo
  const leanDev =
    avgLean < H.torsoLean.idealMin
      ? H.torsoLean.idealMin - avgLean
      : avgLean > H.torsoLean.idealMax
        ? avgLean - H.torsoLean.idealMax
        : 0
  const rangeDev = Math.max(0, leanRange - H.torsoLean.rangeOk)
  const postureScore = Math.round(
    0.65 * falloffScore(leanDev, H.torsoLean.falloff) +
      0.35 * falloffScore(rangeDev, H.torsoLean.rangeFalloff),
  )
  const maxLeanFrame = frames[leans.indexOf(Math.max(...leans))]
  const postureUnreliable = torsoVis < 0.6 || avgLean > 45
  const posture: MetricResult = postureUnreliable
    ? {
        key: 'posture',
        label: 'Posture',
        score: 65,
        headline:
          "We couldn't reliably measure your torso in this clip — try filming with your whole body in frame.",
        detail: 'Posture needs shoulders and hips clearly visible from the side.',
        keyTime: frames[0].t,
        values: { torso_lean_deg: -1, torso_lean_range_deg: -1 },
        unreliable: true,
      }
    : {
    key: 'posture',
    label: 'Posture',
    score: postureScore,
    headline:
      leanDev === 0
        ? `Torso lean averages ${avgLean.toFixed(0)}° — in a comfortable range.`
        : avgLean > H.torsoLean.idealMax
          ? `Your torso leans about ${avgLean.toFixed(0)}° forward on average in this clip.`
          : `Your torso stays quite upright (~${avgLean.toFixed(0)}°) in this clip.`,
    detail: `Average lean ${avgLean.toFixed(1)}°, varying about ${leanRange.toFixed(1)}° through the stride.`,
    keyTime: maxLeanFrame.t,
    values: { torso_lean_deg: +avgLean.toFixed(1), torso_lean_range_deg: +leanRange.toFixed(1) },
  }

  // ---- 2. Knee flexion
  const lKnee = frames.map((f) => angleAt(f, LM.leftHip, LM.leftKnee, LM.leftAnkle))
  const rKnee = frames.map((f) => angleAt(f, LM.rightHip, LM.rightKnee, LM.rightAnkle))
  const [lMin, lMax] = quantiles(lKnee, [0.05, 0.95])
  const [rMin, rMax] = quantiles(rKnee, [0.05, 0.95])
  const lRange = lMax - lMin
  const rRange = rMax - rMin
  const avgRange = (lRange + rRange) / 2
  const kneeDev =
    avgRange < H.kneeFlexion.idealRangeMin
      ? H.kneeFlexion.idealRangeMin - avgRange
      : avgRange > H.kneeFlexion.idealRangeMax
        ? avgRange - H.kneeFlexion.idealRangeMax
        : 0
  const kneeScore = falloffScore(kneeDev, H.kneeFlexion.falloff)
  const minIdx = lKnee.indexOf(Math.min(...lKnee))
  const kneeMotion: MetricResult = {
    key: 'kneeMotion',
    label: 'Knee motion',
    score: kneeScore,
    headline:
      kneeDev === 0
        ? `Knees move through ~${avgRange.toFixed(0)}° each stride — a solid range.`
        : avgRange < H.kneeFlexion.idealRangeMin
          ? `Your knees move through a fairly small range (~${avgRange.toFixed(0)}°) in this recording.`
          : `Your knees move through a very large range (~${avgRange.toFixed(0)}°) in this recording.`,
    detail: `Left knee ${lMin.toFixed(0)}–${lMax.toFixed(0)}°, right knee ${rMin.toFixed(0)}–${rMax.toFixed(0)}°.`,
    keyTime: frames[minIdx].t,
    values: {
      left_knee_min_deg: +lMin.toFixed(0),
      left_knee_max_deg: +lMax.toFixed(0),
      right_knee_min_deg: +rMin.toFixed(0),
      right_knee_max_deg: +rMax.toFixed(0),
    },
  }

  // ---- 3. Foot placement / possible overstride signal
  const contactSignals: { v: number; t: number }[] = []
  for (const side of ['left', 'right'] as const) {
    const ankle = side === 'left' ? LM.leftAnkle : LM.rightAnkle
    const hip = side === 'left' ? LM.leftHip : LM.rightHip
    const knee = side === 'left' ? LM.leftKnee : LM.rightKnee
    for (const f of lowFootFrames(frames, ankle)) {
      const leg = legLength(f, hip, knee, ankle)
      if (leg < 1e-4) continue
      const ahead = Math.abs(f.landmarks[ankle].x - f.landmarks[hip].x) / leg
      contactSignals.push({ v: ahead, t: f.t })
    }
  }
  const footVals = contactSignals.map((c) => c.v)
  const footSignal = footVals.length ? quantiles(footVals, [0.75])[0] : 0
  const footDev = Math.max(0, footSignal - H.footPlacement.ok)
  const footScore = falloffScore(footDev, H.footPlacement.falloff)
  const worstContact = contactSignals.length
    ? contactSignals.reduce((a, b) => (b.v > a.v ? b : a))
    : { v: 0, t: frames[0].t }
  const footPlacement: MetricResult = {
    key: 'footPlacement',
    label: 'Foot placement',
    score: footScore,
    headline:
      footDev === 0
        ? 'Your feet appear to land close underneath your body.'
        : 'Your foot appears to land relatively far ahead of your hip in this recording.',
    detail: `At likely ground-contact moments the ankle is about ${(footSignal * 100).toFixed(0)}% of leg length ahead of the hip.`,
    keyTime: worstContact.t,
    values: { foot_ahead_of_hip_leg_ratio: +footSignal.toFixed(2) },
  }

  // ---- 4. Left/right symmetry
  const rangeDiff = Math.abs(lRange - rRange) / Math.max(1, Math.max(lRange, rRange))
  const symDev = Math.max(0, rangeDiff - H.symmetry.ok)
  const symScore = falloffScore(symDev, H.symmetry.falloff)
  const symmetry: MetricResult = {
    key: 'symmetry',
    label: 'Symmetry',
    score: symScore,
    headline:
      symDev === 0
        ? 'Left and right leg movement look closely matched.'
        : 'Your left and right knee movement differs more than expected in this clip.',
    detail: `Knee-range difference between sides is about ${(rangeDiff * 100).toFixed(0)}%.`,
    keyTime: kneeMotion.keyTime,
    values: { knee_range_lr_difference_pct: +(rangeDiff * 100).toFixed(0) },
  }

  // ---- side-view check: cadence/bounce/landing-knee are only meaningful on
  // a side-on clip. Head-on footage shows almost no horizontal ankle swing
  // relative to the hip, so we gate on that.
  const perFrameLeg = frames.map((f) => legLength(f, LM.leftHip, LM.leftKnee, LM.leftAnkle))
  const ankleSwing = (ankle: number, hip: number) => {
    const xs = frames.map((f, i) =>
      perFrameLeg[i] > 1e-4 ? (f.landmarks[ankle].x - f.landmarks[hip].x) / perFrameLeg[i] : 0,
    )
    const [a, b] = quantiles(xs, [0.05, 0.95])
    return b - a
  }
  const sideSwing = Math.max(
    ankleSwing(LM.leftAnkle, LM.leftHip),
    ankleSwing(LM.rightAnkle, LM.rightHip),
  )
  const sideView = sideSwing >= H.sideView.minAnkleSwing
  const notSideOn =
    'This signal needs a side-on clip — try filming from the side with the whole body in frame.'

  // ---- 5. Cadence (step rate)
  // Higher step rate reduces loading rate / braking impulse (Schubert 2014, Adams 2018).
  const lContacts = contactFrames(frames, 'left')
  const rContacts = contactFrames(frames, 'right')
  const totalContacts = lContacts.length + rContacts.length
  const span = frames[frames.length - 1].t - frames[0].t
  const stepsPerMin = span > 0.5 ? (totalContacts / span) * 60 : 0
  const cadenceUnreliable = !sideView || totalContacts < H.cadence.minContacts || span < 2
  const cadenceDev =
    stepsPerMin < H.cadence.idealMin
      ? H.cadence.idealMin - stepsPerMin
      : stepsPerMin > H.cadence.idealMax
        ? stepsPerMin - H.cadence.idealMax
        : 0
  const cadence: MetricResult = cadenceUnreliable
    ? {
        key: 'cadence',
        label: 'Cadence',
        score: 65,
        headline: sideView
          ? "We couldn't detect enough foot contacts to estimate your step rate — a slightly longer side-on clip helps."
          : "We couldn't reliably estimate your step rate from this camera angle.",
        detail: sideView ? 'Cadence needs a few clear strides with the feet visible.' : notSideOn,
        keyTime: frames[0].t,
        values: { cadence_spm: -1 },
        unreliable: true,
      }
    : {
        key: 'cadence',
        label: 'Cadence',
        score: falloffScore(cadenceDev, H.cadence.falloff),
        headline:
          cadenceDev === 0
            ? `Estimated step rate is ~${stepsPerMin.toFixed(0)} steps/min — in a commonly recommended range.`
            : stepsPerMin < H.cadence.idealMin
              ? `Your estimated step rate is ~${stepsPerMin.toFixed(0)} steps/min — on the lower side in this clip.`
              : `Your estimated step rate is ~${stepsPerMin.toFixed(0)} steps/min — quite high in this clip.`,
        detail: `Detected ${totalContacts} foot contacts over ${span.toFixed(1)}s. Research links quicker, shorter steps with lower joint loading.`,
        keyTime: (lContacts[0] ?? rContacts[0] ?? frames[0]).t,
        values: { cadence_spm: +stepsPerMin.toFixed(0) },
      }

  // ---- 6. Vertical oscillation (bounce)
  // Large CoM vertical displacement ("bounding") is a video-analysis flag
  // (Souza 2016) and predicts higher peak vGRF (Adams 2018).
  // raw hip height detrended with a rolling mean (cancels whole-body drift),
  // then normalized by the extended-leg length. Per-frame normalization would
  // inject knee-flexion foreshortening into the signal, so we avoid it.
  const hipYs = frames.map((f) => mid(f, LM.leftHip, LM.rightHip).y)
  // detrend window ≈ one stride period so within-stride motion survives while
  // slower whole-body drift cancels (fixed windows break on slow-motion clips)
  const contactGaps: number[] = []
  for (const contacts of [lContacts, rContacts])
    for (let i = 1; i < contacts.length; i++) contactGaps.push(contacts[i].t - contacts[i - 1].t)
  const winSec = contactGaps.length
    ? [...contactGaps].sort((a, b) => a - b)[Math.floor(contactGaps.length / 2)]
    : 0.7
  const detrended = hipYs.map((y, i) => {
    const lo = frames[i].t - winSec / 2
    const hi = frames[i].t + winSec / 2
    const windowVals = hipYs.filter((_, j) => frames[j].t >= lo && frames[j].t <= hi)
    return y - mean(windowVals)
  })
  const [oscLo, oscHi] = quantiles(detrended, [0.05, 0.95])
  const [legRef] = quantiles(perFrameLeg, [0.9]) // near-extended leg length
  const oscRatio = legRef > 1e-4 ? (oscHi - oscLo) / legRef : 0
  const oscDev = Math.max(0, oscRatio - H.verticalOscillation.ok)
  const hiIdx = detrended.indexOf(Math.max(...detrended))
  const oscUnreliable = !sideView || oscRatio > 0.25
  const verticalOscillation: MetricResult = !oscUnreliable
    ? {
        key: 'verticalOscillation',
        label: 'Bounce',
        score: falloffScore(oscDev, H.verticalOscillation.falloff),
        headline:
          oscDev === 0
            ? 'Your vertical bounce looks economical — energy is going forward, not up.'
            : 'You appear to bounce vertically more than expected in this recording.',
        detail: `Hip vertical movement is about ${(oscRatio * 100).toFixed(0)}% of leg length each stride.`,
        keyTime: frames[hiIdx].t,
        values: { vertical_oscillation_leg_ratio: +oscRatio.toFixed(2) },
      }
    : {
        key: 'verticalOscillation',
        label: 'Bounce',
        score: 65,
        headline: sideView
          ? "We couldn't reliably measure your vertical bounce in this clip."
          : "We couldn't reliably measure your vertical bounce from this camera angle.",
        detail: sideView
          ? 'The hip movement we tracked was too large to be a trustworthy bounce estimate — a steadier side-on clip helps.'
          : notSideOn,
        keyTime: frames[0].t,
        values: { vertical_oscillation_leg_ratio: -1 },
        unreliable: true,
      }

  // ---- 7. Knee flexion at initial contact
  // Injured runners tend to land with a more extended knee (Bramah 2018).
  const contactFlexions: { v: number; t: number }[] = []
  for (const [contacts, hip, knee, ankle] of [
    [lContacts, LM.leftHip, LM.leftKnee, LM.leftAnkle],
    [rContacts, LM.rightHip, LM.rightKnee, LM.rightAnkle],
  ] as [PoseFrame[], number, number, number][]) {
    for (const f of contacts) contactFlexions.push({ v: 180 - angleAt(f, hip, knee, ankle), t: f.t })
  }
  const avgContactFlex = contactFlexions.length ? mean(contactFlexions.map((c) => c.v)) : 0
  const flexDev = Math.max(0, H.kneeAtContact.okFlexion - avgContactFlex)
  const stiffest = contactFlexions.length
    ? contactFlexions.reduce((a, b) => (b.v < a.v ? b : a))
    : { v: 0, t: frames[0].t }
  const kneeAtContact: MetricResult = !sideView
    ? {
        key: 'kneeAtContact',
        label: 'Landing knee',
        score: 65,
        headline: "We couldn't reliably judge your landing knee from this camera angle.",
        detail: notSideOn,
        keyTime: frames[0].t,
        values: { knee_flexion_at_contact_deg: -1 },
        unreliable: true,
      }
    : contactFlexions.length
    ? {
        key: 'kneeAtContact',
        label: 'Landing knee',
        score: falloffScore(flexDev, H.kneeAtContact.falloff),
        headline:
          flexDev === 0
            ? `Your knee is comfortably bent (~${avgContactFlex.toFixed(0)}°) as your foot lands — good shock absorption.`
            : `Your knee appears relatively straight (~${avgContactFlex.toFixed(0)}° bend) as your foot lands in this clip.`,
        detail: `A softly bent knee at contact helps the leg absorb load; a very straight landing leg is a common flag in video gait analysis.`,
        keyTime: stiffest.t,
        values: { knee_flexion_at_contact_deg: +avgContactFlex.toFixed(0) },
      }
    : {
        key: 'kneeAtContact',
        label: 'Landing knee',
        score: 65,
        headline: "We couldn't isolate clear foot-contact moments to judge your landing knee.",
        detail: 'This signal needs a few visible strides from the side.',
        keyTime: frames[0].t,
        values: { knee_flexion_at_contact_deg: -1 },
        unreliable: true,
      }

  const metrics = [
    posture,
    footPlacement,
    kneeMotion,
    symmetry,
    cadence,
    verticalOscillation,
    kneeAtContact,
  ]
  const w = H.overallWeights
  const overallScore = Math.round(
    posture.score * w.posture +
      footPlacement.score * w.footPlacement +
      kneeMotion.score * w.kneeMotion +
      symmetry.score * w.symmetry +
      cadence.score * w.cadence +
      verticalOscillation.score * w.verticalOscillation +
      kneeAtContact.score * w.kneeAtContact,
  )
  const reliable = metrics.filter((m) => !m.unreliable)
  const pool = reliable.length ? reliable : metrics
  const primary = pool.reduce((a, b) => (b.score < a.score ? b : a))

  return { sequence: seq, metrics, overallScore, confidence: seq.confidence, primary }
}
