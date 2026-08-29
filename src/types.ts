export interface LandmarkPoint {
  x: number
  y: number
  z: number
  visibility: number
}

export interface PoseFrame {
  /** timestamp in seconds within the video */
  t: number
  /** 33 normalized image-space landmarks (x,y in 0..1) */
  landmarks: LandmarkPoint[]
  /** 33 world landmarks in meters, hip-centered */
  world: LandmarkPoint[]
}

export interface PoseSequence {
  frames: PoseFrame[]
  duration: number
  fps: number
  videoWidth: number
  videoHeight: number
  /** mean visibility over key landmarks, 0..1 */
  confidence: number
}

export type MetricKey =
  | 'posture'
  | 'footPlacement'
  | 'kneeMotion'
  | 'symmetry'
  | 'cadence'
  | 'verticalOscillation'
  | 'kneeAtContact'

export interface MetricResult {
  key: MetricKey
  label: string
  /** 0-100 prototype heuristic score */
  score: number
  /** short human readable headline */
  headline: string
  /** longer detail sentence */
  detail: string
  /** representative video timestamp (s) to jump to */
  keyTime: number
  /** raw values for the coach payload */
  values: Record<string, number>
  /** true when the clip didn't let us measure this signal with confidence */
  unreliable?: boolean
  /** why this score: target range + research source behind the heuristic */
  evidence?: string
}

export interface Analysis {
  sequence: PoseSequence
  metrics: MetricResult[]
  overallScore: number
  confidence: number
  /** metric with lowest score → headline observation */
  primary: MetricResult
}

export interface CoachAdvice {
  noticed: string
  tryThis: string
  why: string
  /** true if produced by a live LLM, false if templated fallback */
  generative: boolean
}

// MediaPipe Pose landmark indices
export const LM = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFoot: 31,
  rightFoot: 32,
} as const

export const SKELETON_EDGES: [number, number][] = [
  [LM.leftShoulder, LM.rightShoulder],
  [LM.leftShoulder, LM.leftElbow],
  [LM.leftElbow, LM.leftWrist],
  [LM.rightShoulder, LM.rightElbow],
  [LM.rightElbow, LM.rightWrist],
  [LM.leftShoulder, LM.leftHip],
  [LM.rightShoulder, LM.rightHip],
  [LM.leftHip, LM.rightHip],
  [LM.leftHip, LM.leftKnee],
  [LM.leftKnee, LM.leftAnkle],
  [LM.rightHip, LM.rightKnee],
  [LM.rightKnee, LM.rightAnkle],
  [LM.leftAnkle, LM.leftHeel],
  [LM.leftHeel, LM.leftFoot],
  [LM.leftAnkle, LM.leftFoot],
  [LM.rightAnkle, LM.rightHeel],
  [LM.rightHeel, LM.rightFoot],
  [LM.rightAnkle, LM.rightFoot],
]

/** joints to emphasise per metric in overlays */
export const METRIC_JOINTS: Record<MetricKey, number[]> = {
  posture: [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip],
  footPlacement: [LM.leftHip, LM.rightHip, LM.leftAnkle, LM.rightAnkle, LM.leftFoot, LM.rightFoot],
  kneeMotion: [LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle],
  symmetry: [LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle],
  cadence: [LM.leftAnkle, LM.rightAnkle, LM.leftFoot, LM.rightFoot],
  verticalOscillation: [LM.leftHip, LM.rightHip],
  kneeAtContact: [LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle],
}
