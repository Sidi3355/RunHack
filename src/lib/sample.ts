import type { LandmarkPoint, PoseFrame, PoseSequence } from '../types'
import { LM } from '../types'

/**
 * Procedurally generated running motion used ONLY for the clearly-labelled
 * "View sample analysis" mode, so the results UI can be demonstrated without
 * a live recording. It is synthetic and never presented as a real analysis.
 */

const D2R = Math.PI / 180

const THIGH = 0.42
const SHANK = 0.42
const FOOT = 0.14
const TORSO = 0.52
const UPPER_ARM = 0.28
const FOREARM = 0.26
const HEAD = 0.22
const SHOULDER_HALF = 0.16
const HIP_HALF = 0.1

function makeFrame(t: number): PoseFrame {
  const cadence = 1.35 // strides per second per leg
  const phi = 2 * Math.PI * cadence * t

  // world space: x forward (+), y DOWN (MediaPipe world convention), z lateral
  const pts: { x: number; y: number; z: number }[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }))

  const bobY = 0.03 * Math.sin(2 * phi)
  const lean = 8 * D2R

  const hipC = { x: 0, y: bobY, z: 0 }
  const shoulderC = {
    x: hipC.x + TORSO * Math.sin(lean),
    y: hipC.y - TORSO * Math.cos(lean),
    z: 0,
  }

  pts[LM.leftHip] = { ...hipC, z: -HIP_HALF }
  pts[LM.rightHip] = { ...hipC, z: HIP_HALF }
  pts[LM.leftShoulder] = { ...shoulderC, z: -SHOULDER_HALF }
  pts[LM.rightShoulder] = { ...shoulderC, z: SHOULDER_HALF }
  pts[LM.nose] = { x: shoulderC.x + 0.06, y: shoulderC.y - HEAD, z: 0 }
  pts[LM.leftEar] = { x: shoulderC.x, y: shoulderC.y - HEAD, z: -0.08 }
  pts[LM.rightEar] = { x: shoulderC.x, y: shoulderC.y - HEAD, z: 0.08 }

  const legs: ['left' | 'right', number][] = [
    ['left', 0],
    ['right', Math.PI],
  ]
  for (const [side, off] of legs) {
    const p = phi + off
    const thighAngle = 32 * D2R * Math.sin(p) // from vertical, + forward
    const swing = (Math.sin(p - 1.3) + 1) / 2 // 0..1
    const flex = (18 + 78 * swing) * D2R // knee flexion
    const hip = side === 'left' ? pts[LM.leftHip] : pts[LM.rightHip]

    const knee = {
      x: hip.x + THIGH * Math.sin(thighAngle),
      y: hip.y + THIGH * Math.cos(thighAngle),
      z: hip.z,
    }
    const shankAngle = thighAngle - flex
    const ankle = {
      x: knee.x + SHANK * Math.sin(shankAngle),
      y: knee.y + SHANK * Math.cos(shankAngle),
      z: knee.z,
    }
    const heel = { x: ankle.x - 0.05, y: ankle.y + 0.03, z: ankle.z }
    const toe = { x: ankle.x + FOOT, y: ankle.y + 0.05, z: ankle.z }

    const [kneeI, ankleI, heelI, toeI] =
      side === 'left'
        ? [LM.leftKnee, LM.leftAnkle, LM.leftHeel, LM.leftFoot]
        : [LM.rightKnee, LM.rightAnkle, LM.rightHeel, LM.rightFoot]
    pts[kneeI] = knee
    pts[ankleI] = ankle
    pts[heelI] = heel
    pts[toeI] = toe

    // arms swing opposite to same-side leg
    const armAngle = -28 * D2R * Math.sin(p)
    const shoulder = side === 'left' ? pts[LM.leftShoulder] : pts[LM.rightShoulder]
    const elbow = {
      x: shoulder.x + UPPER_ARM * Math.sin(armAngle),
      y: shoulder.y + UPPER_ARM * Math.cos(armAngle),
      z: shoulder.z,
    }
    const wrist = {
      x: elbow.x + FOREARM * Math.sin(armAngle + 80 * D2R),
      y: elbow.y + FOREARM * Math.cos(armAngle + 80 * D2R),
      z: elbow.z,
    }
    const [elbowI, wristI] = side === 'left' ? [LM.leftElbow, LM.leftWrist] : [LM.rightElbow, LM.rightWrist]
    pts[elbowI] = elbow
    pts[wristI] = wrist
  }

  const world: LandmarkPoint[] = pts.map((p) => ({ ...p, visibility: 0.96 }))
  // simple side-on "camera": project world into normalized image space
  const landmarks: LandmarkPoint[] = pts.map((p) => ({
    x: 0.5 + p.x * 0.28,
    y: 0.52 + p.y * 0.28,
    z: p.z,
    visibility: 0.96,
  }))
  return { t, landmarks, world }
}

export function sampleSequence(): PoseSequence {
  const duration = 6
  const fps = 24
  const frames: PoseFrame[] = []
  for (let i = 0; i < duration * fps; i++) frames.push(makeFrame(i / fps))
  return {
    frames,
    duration,
    fps,
    videoWidth: 720,
    videoHeight: 1280,
    confidence: 0.96,
  }
}
