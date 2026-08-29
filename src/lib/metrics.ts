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

  const metrics = [posture, footPlacement, kneeMotion, symmetry]
  const w = H.overallWeights
  const overallScore = Math.round(
    posture.score * w.posture +
      footPlacement.score * w.footPlacement +
      kneeMotion.score * w.kneeMotion +
      symmetry.score * w.symmetry,
  )
  const reliable = metrics.filter((m) => !m.unreliable)
  const pool = reliable.length ? reliable : metrics
  const primary = pool.reduce((a, b) => (b.score < a.score ? b : a))

  return { sequence: seq, metrics, overallScore, confidence: seq.confidence, primary }
}
