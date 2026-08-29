import type { Analysis, MetricResult, PoseFrame, PoseSequence } from '../types'
import { LM } from '../types'
import { HEURISTICS, bandScore, thresholdScore } from './heuristics'

const EVIDENCE: Record<string, string> = {
  posture:
    'Target: slight forward lean (~2–12° from vertical), held steadily. Both very upright and heavily hunched trunks are flags in evidence-based 2D video analysis (Souza 2016), and injured runners showed greater trunk lean at midstance (Bramah 2018, Am J Sports Med).',
  footPlacement:
    'Target: landing under a flexing knee — ankle roughly beneath the knee at contact (≤8% of leg length ahead), i.e. a near-vertical shin. An ankle well ahead of the knee (reclined shin) is the classic 2D overstride flag (Souza 2016); shorter strides reduce joint energy absorption (Schubert 2014, Sports Health).',
  kneeMotion:
    'Target: ~40–110° of knee travel per stride. Limited stance-phase knee flexion reduces shock absorption and is one of the 14 measurements in the evidence-based video analysis framework (Souza 2016).',
  symmetry:
    'Target: left/right knee-range difference ≤12%. Between-limb kinematic differences are used clinically as consistency flags; 2D sagittal measures are reliable surrogates for 3D capture (IJSPT 2023).',
  cadence:
    'Target: ~160–190 steps/min. Raising step rate ~5–10% consistently lowers vertical loading rate, braking impulse and joint energy absorption (Schubert 2014; Adams 2018; Anderson 2022 meta-analysis).',
  verticalOscillation:
    'Target: hip vertical travel ≤11% of leg length per stride. Large vertical CoM displacement (“bounding”) is a standard video-analysis flag (Souza 2016) and predicts higher peak vertical ground-reaction force (Adams 2018, IJSPT).',
  kneeAtContact:
    'Target: ~10–30° of knee bend as the foot lands. Injured runners across four common soft-tissue injuries landed with a more extended knee at initial contact (Bramah 2018, Am J Sports Med).',
}

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

/** 3-point median smoothing — knocks out single-frame pose-estimation spikes */
function median3(v: number[]): number[] {
  return v.map((x, i) => {
    if (i === 0 || i === v.length - 1) return x
    const w = [v[i - 1], x, v[i + 1]].sort((a, b) => a - b)
    return w[1]
  })
}

/**
 * Likely initial-contact frames per side: local maxima of ankle height-below-hip
 * (y down → lowest foot), spaced at least `minGap` seconds apart.
 * Approximate gait-event detection from monocular video — not force-plate truth.
 */
function contactFrames(frames: PoseFrame[], side: 'left' | 'right', minGap = 0.25): PoseFrame[] {
  const [hip, knee, ankle] =
    side === 'left'
      ? [LM.leftHip, LM.leftKnee, LM.leftAnkle]
      : [LM.rightHip, LM.rightKnee, LM.rightAnkle]
  // ankle depth below the hip, normalized by per-frame leg length, so body
  // translation / scale change (runner approaching camera) cancels out
  const ys = median3(
    frames.map((f) => {
      const leg = legLength(f, hip, knee, ankle)
      return leg > 1e-4 ? (f.landmarks[ankle].y - f.landmarks[hip].y) / leg : 0
    }),
  )
  // stance shows as a cluster of consecutive low-foot frames; the first frame
  // of each cluster is the closest observable moment to initial contact
  const [thresh] = quantiles(ys, [0.72])
  const out: PoseFrame[] = []
  let lastT = -Infinity
  let inCluster = false
  for (let i = 0; i < frames.length; i++) {
    if (ys[i] >= thresh) {
      if (!inCluster && frames[i].t - lastT >= minGap) {
        // the knee is near its local extension maximum at touchdown, then
        // flexes under load — refine to that moment just around cluster start
        let best = frames[i]
        let bestAngle = angleAt(frames[i], hip, knee, ankle)
        for (const f of frames) {
          if (f.t < frames[i].t - 0.15 || f.t > frames[i].t + 0.05) continue
          const a = angleAt(f, hip, knee, ankle)
          if (a > bestAngle) {
            bestAngle = a
            best = f
          }
        }
        out.push(best)
        lastT = frames[i].t
      }
      inCluster = true
    } else {
      inCluster = false
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
  const postureScore = Math.round(
    0.65 * bandScore(avgLean, H.torsoLean.idealMin, H.torsoLean.idealMax, H.torsoLean.falloff) +
      0.35 * thresholdScore(leanRange, H.torsoLean.rangeOk, H.torsoLean.rangeFalloff),
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
    evidence: EVIDENCE.posture,
  }

  // ---- 2. Knee flexion
  const lKnee = median3(frames.map((f) => angleAt(f, LM.leftHip, LM.leftKnee, LM.leftAnkle)))
  const rKnee = median3(frames.map((f) => angleAt(f, LM.rightHip, LM.rightKnee, LM.rightAnkle)))
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
  const kneeScore = bandScore(
    avgRange,
    H.kneeFlexion.idealRangeMin,
    H.kneeFlexion.idealRangeMax,
    H.kneeFlexion.falloff,
  )
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
    evidence: EVIDENCE.kneeMotion,
  }

  // ---- 3. Foot placement / possible overstride signal
  // The expert 2D cue is landing "under a flexing knee": at initial contact the
  // ankle should sit roughly beneath the knee (shin near vertical). Measuring
  // against the hip instead flags fast-but-sound runners — at pace even elites
  // land well ahead of the hip — so the signal is the ankle's signed distance
  // ahead of the knee along the direction of travel, normalized by leg length.
  const lContacts = contactFrames(frames, 'left')
  const rContacts = contactFrames(frames, 'right')
  const sides: [PoseFrame[], number, number, number][] = [
    [lContacts, LM.leftHip, LM.leftKnee, LM.leftAnkle],
    [rContacts, LM.rightHip, LM.rightKnee, LM.rightAnkle],
  ]
  // direction of travel from foot orientation: the toes point the way the
  // runner is facing, which is far more stable than inferring it from
  // ankle-vs-hip positions at estimated contacts
  const travelSign =
    mean(
      frames.map(
        (f) =>
          f.landmarks[LM.leftFoot].x -
          f.landmarks[LM.leftHeel].x +
          (f.landmarks[LM.rightFoot].x - f.landmarks[LM.rightHeel].x),
      ),
    ) >= 0
      ? 1
      : -1
  const contactSignals: { v: number; t: number }[] = []
  for (const [contacts, hip, knee, ankle] of sides) {
    for (const f of contacts) {
      const leg = legLength(f, hip, knee, ankle)
      if (leg < 1e-4) continue
      const ahead = (travelSign * (f.landmarks[ankle].x - f.landmarks[knee].x)) / leg
      contactSignals.push({ v: Math.max(0, ahead), t: f.t })
    }
  }
  const footVals = contactSignals.map((c) => c.v)
  const footSignal = footVals.length ? quantiles(footVals, [0.75])[0] : 0
  const footDev = Math.max(0, footSignal - H.footPlacement.ok)
  const footScore = thresholdScore(footSignal, H.footPlacement.ok, H.footPlacement.falloff)
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
        : 'Your foot appears to land noticeably ahead of your knee in this recording.',
    detail: `At likely ground-contact moments the ankle is about ${(footSignal * 100).toFixed(0)}% of leg length ahead of the knee (0% = shin vertical, landing under a flexing knee).`,
    keyTime: worstContact.t,
    values: { foot_ahead_of_knee_leg_ratio: +footSignal.toFixed(2) },
    evidence: EVIDENCE.footPlacement,
  }

  // ---- 4. Left/right symmetry
  const rangeDiff = Math.abs(lRange - rRange) / Math.max(1, Math.max(lRange, rRange))
  const symDev = Math.max(0, rangeDiff - H.symmetry.ok)
  const symScore = thresholdScore(rangeDiff, H.symmetry.ok, H.symmetry.falloff)
  // a single side-on camera foreshortens the far leg, so implausibly large
  // differences are more likely a viewpoint artefact than true asymmetry
  const symmetry: MetricResult = rangeDiff > 0.22
    ? {
        key: 'symmetry',
        label: 'Symmetry',
        score: 65,
        headline:
          "We couldn't compare your left and right legs reliably in this clip — one side may be partly hidden from the camera.",
        detail:
          'A single side-on camera can under-measure the far leg; a difference this large is more likely a viewpoint artefact than true asymmetry.',
        keyTime: kneeMotion.keyTime,
        values: { knee_range_lr_difference_pct: -1 },
        unreliable: true,
      }
    : {
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
    evidence: EVIDENCE.symmetry,
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
  // second orientation signal: from the side the shoulders nearly overlap
  // horizontally, head-on they are widely separated relative to torso length
  const shoulderRatio = mean(
    frames.map((f) => {
      const s = mid(f, LM.leftShoulder, LM.rightShoulder)
      const h = mid(f, LM.leftHip, LM.rightHip)
      const torso = Math.hypot(s.x - h.x, s.y - h.y)
      return torso > 1e-4
        ? Math.abs(f.landmarks[LM.leftShoulder].x - f.landmarks[LM.rightShoulder].x) / torso
        : 0
    }),
  )
  // third signal: left–right ankle horizontal separation oscillates with each
  // stride when seen from the side, and is also the cadence signal below
  const sepRaw = median3(
    frames.map((f, i) =>
      perFrameLeg[i] > 1e-4
        ? (f.landmarks[LM.leftAnkle].x - f.landmarks[LM.rightAnkle].x) / perFrameLeg[i]
        : 0,
    ),
  )
  // centre the signal so a constant lateral offset can't stop it crossing zero
  const [sepMed] = quantiles(sepRaw, [0.5])
  const sepSig = sepRaw.map((v) => v - sepMed)
  const [sepLo, sepHi] = quantiles(sepSig, [0.05, 0.95])
  const sepAmp = sepHi - sepLo
  const facingCamera = torsoVis >= 0.6 && shoulderRatio > H.sideView.maxShoulderRatio
  const sideView =
    Math.max(sideSwing, sepAmp / 2) >= H.sideView.minAnkleSwing && !facingCamera
  const notSideOn =
    'This signal needs a side-on clip — try filming from the side with the whole body in frame.'

  // ---- 5. Cadence (step rate)
  // Higher step rate reduces loading rate / braking impulse (Schubert 2014, Adams 2018).
  // The left–right ankle separation oscillates once per STRIDE, so the stride
  // period is found by autocorrelation of that signal — robust to offsets and
  // tracking noise that break event counting. steps/min = 2 × strides/min.
  const span = frames[frames.length - 1].t - frames[0].t
  const dt = span / Math.max(1, frames.length - 1)
  const sepC = sepSig.map((v) => v - mean(sepSig))
  const sepVar = mean(sepC.map((v) => v * v))
  let bestLag = 0
  let bestCorr = 0
  if (sepVar > 1e-6 && dt > 0) {
    const maxLag = Math.min(sepC.length - 2, Math.round(1.5 / dt))
    const corrs: number[] = []
    for (let lag = 1; lag <= maxLag; lag++) {
      let s = 0
      for (let i = 0; i + lag < sepC.length; i++) s += sepC[i] * sepC[i + lag]
      corrs.push(s / ((sepC.length - lag) * sepVar))
    }
    // short lags correlate trivially (the signal varies slowly), so only
    // accept the peak after the autocorrelation's first local minimum
    let firstMin = 0
    while (firstMin + 1 < corrs.length && corrs[firstMin + 1] <= corrs[firstMin]) firstMin++
    const minLag = Math.max(firstMin + 1, Math.round(0.4 / dt))
    for (let lag = minLag; lag <= maxLag; lag++) {
      const corr = corrs[lag - 1]
      if (corr > bestCorr) {
        bestCorr = corr
        bestLag = lag
      }
    }
  }
  const stridePeriod = bestLag * dt
  const stepsPerMin = stridePeriod > 0 ? 120 / stridePeriod : 0
  // needs a clear periodic gait signal, a side-on view and 2+ strides of footage
  const cadenceUnreliable =
    !sideView || bestCorr < 0.35 || span < 2 * stridePeriod || stepsPerMin === 0
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
          ? "We couldn't find a clear stride rhythm to estimate your step rate in this clip."
          : "We couldn't reliably estimate your step rate from this camera angle.",
        detail: sideView
          ? 'Cadence needs a few normal-speed strides with the feet visible — slow-motion or very short clips can\u2019t give a true steps-per-minute reading.'
          : notSideOn,
        keyTime: frames[0].t,
        values: { cadence_spm: -1 },
        unreliable: true,
      }
    : {
        key: 'cadence',
        label: 'Cadence',
        score: bandScore(stepsPerMin, H.cadence.idealMin, H.cadence.idealMax, H.cadence.falloff),
        headline:
          cadenceDev === 0
            ? `Estimated step rate is ~${stepsPerMin.toFixed(0)} steps/min — in a commonly recommended range.`
            : stepsPerMin < H.cadence.idealMin
              ? `Your estimated step rate is ~${stepsPerMin.toFixed(0)} steps/min — on the lower side in this clip.`
              : `Your estimated step rate is ~${stepsPerMin.toFixed(0)} steps/min — quite high in this clip.`,
        detail: `Estimated from the stride rhythm across ${span.toFixed(1)}s of footage. Research links quicker, shorter steps with lower joint loading.`,
        keyTime: (lContacts[0] ?? rContacts[0] ?? frames[0]).t,
        values: { cadence_spm: +stepsPerMin.toFixed(0) },
        evidence: EVIDENCE.cadence,
      }

  // ---- 6. Vertical oscillation (bounce)
  // Large CoM vertical displacement ("bounding") is a video-analysis flag
  // (Souza 2016) and predicts higher peak vGRF (Adams 2018).
  // raw hip height detrended with a rolling mean (cancels whole-body drift),
  // then normalized by the extended-leg length. Per-frame normalization would
  // inject knee-flexion foreshortening into the signal, so we avoid it.
  const hipYs = frames.map((f) => mid(f, LM.leftHip, LM.rightHip).y)
  // detrend window ≈ one stride period (two steps) so within-stride motion
  // survives while slower whole-body drift cancels — a window shorter than the
  // hip's oscillation period would subtract the very signal being measured
  const winSec =
    stepsPerMin > 60 ? Math.min(1.5, Math.max(0.4, 120 / stepsPerMin)) : 0.7
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
        score: thresholdScore(oscRatio, H.verticalOscillation.ok, H.verticalOscillation.falloff),
        headline:
          oscDev === 0
            ? 'Your vertical bounce looks economical — energy is going forward, not up.'
            : 'You appear to bounce vertically more than expected in this recording.',
        detail: `Hip vertical movement is about ${(oscRatio * 100).toFixed(0)}% of leg length each stride.`,
        keyTime: frames[hiIdx].t,
        values: { vertical_oscillation_leg_ratio: +oscRatio.toFixed(2) },
        evidence: EVIDENCE.verticalOscillation,
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
  // the evidence flags only the EXTENDED side (injured runners land straighter);
  // very high measured flexion is a contact-timing artefact, not a fault
  const flexArtefact = avgContactFlex > 45
  const kneeAtContact: MetricResult = !sideView || flexArtefact
    ? {
        key: 'kneeAtContact',
        label: 'Landing knee',
        score: 65,
        headline: sideView
          ? "We couldn't pinpoint your foot-contact moments precisely enough to judge your landing knee."
          : "We couldn't reliably judge your landing knee from this camera angle.",
        detail: sideView
          ? 'Contact-moment detection from video was too uncertain in this clip for a fair reading.'
          : notSideOn,
        keyTime: frames[0].t,
        values: { knee_flexion_at_contact_deg: -1 },
        unreliable: true,
      }
    : contactFlexions.length
    ? {
        key: 'kneeAtContact',
        label: 'Landing knee',
        score: thresholdScore(
          Math.max(0, H.kneeAtContact.okFlexion - avgContactFlex),
          0,
          H.kneeAtContact.falloff,
        ),
        headline:
          flexDev === 0
            ? `Your knee is comfortably bent (~${avgContactFlex.toFixed(0)}°) as your foot lands — good shock absorption.`
            : `Your knee appears relatively straight (~${avgContactFlex.toFixed(0)}° bend) as your foot lands in this clip.`,
        detail: `A softly bent knee at contact helps the leg absorb load; a very straight landing leg is a common flag in video gait analysis.`,
        keyTime: stiffest.t,
        values: { knee_flexion_at_contact_deg: +avgContactFlex.toFixed(0) },
        evidence: EVIDENCE.kneeAtContact,
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
