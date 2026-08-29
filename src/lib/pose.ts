import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import type { PoseFrame, PoseSequence } from '../types'
import { LM } from '../types'

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

let landmarkerPromise: Promise<PoseLandmarker> | null = null

export function loadLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL)
      return PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      })
    })().catch(async () => {
      // GPU delegate can fail on some devices — retry on CPU
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL)
      return PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      })
    })
  }
  return landmarkerPromise
}

const KEY_LANDMARKS = [
  LM.leftShoulder, LM.rightShoulder,
  LM.leftHip, LM.rightHip,
  LM.leftKnee, LM.rightKnee,
  LM.leftAnkle, LM.rightAnkle,
]

const TARGET_FPS = 24
const MAX_FRAMES = 300
const MAX_ANALYSIS_SECONDS = 15

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => { cleanup(); resolve() }
    const onError = () => { cleanup(); reject(new Error('Video seek failed')) }
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
    }
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', onError)
    video.currentTime = t
  })
}

export async function extractPoseSequence(
  file: File,
  onProgress: (fraction: number, stage: string) => void,
): Promise<PoseSequence> {
  onProgress(0.02, 'Loading pose model…')
  const landmarker = await loadLandmarker()

  onProgress(0.06, 'Reading your video…')
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('This video could not be read. Try a different file (MP4/WebM/MOV work best).'))
    })

    const duration = Math.min(video.duration, MAX_ANALYSIS_SECONDS)
    if (!isFinite(duration) || duration < 1) {
      throw new Error('The clip is too short. Aim for roughly 5–10 seconds of running.')
    }

    const frameCount = Math.min(MAX_FRAMES, Math.max(24, Math.floor(duration * TARGET_FPS)))
    const dt = duration / frameCount
    const frames: PoseFrame[] = []
    let lastVideoTs = -1

    for (let i = 0; i < frameCount; i++) {
      const t = Math.min(i * dt, duration - 0.001)
      await seekTo(video, t)
      // MediaPipe VIDEO mode requires strictly increasing timestamps
      let ts = Math.round(t * 1000)
      if (ts <= lastVideoTs) ts = lastVideoTs + 1
      lastVideoTs = ts
      const result = landmarker.detectForVideo(video, ts)
      if (result.landmarks.length > 0 && result.worldLandmarks.length > 0) {
        frames.push({
          t,
          landmarks: result.landmarks[0].map((p) => ({
            x: p.x, y: p.y, z: p.z, visibility: p.visibility ?? 0,
          })),
          world: result.worldLandmarks[0].map((p) => ({
            x: p.x, y: p.y, z: p.z, visibility: p.visibility ?? 0,
          })),
        })
      }
      const frac = 0.08 + 0.9 * ((i + 1) / frameCount)
      onProgress(frac, progressCopy(frac))
    }

    if (frames.length < frameCount * 0.4 || frames.length < 12) {
      throw new Error(
        "We couldn't clearly see your full stride. Try filming from the side with your entire body in frame, in decent lighting.",
      )
    }

    let visSum = 0
    let visCount = 0
    for (const f of frames) {
      for (const idx of KEY_LANDMARKS) {
        visSum += f.landmarks[idx].visibility
        visCount++
      }
    }
    const confidence = visCount ? visSum / visCount : 0
    if (confidence < 0.45) {
      throw new Error(
        "We couldn't clearly see your full stride. Try filming from the side with your entire body in frame, in decent lighting.",
      )
    }

    onProgress(1, 'Building your movement twin…')
    return {
      frames,
      duration,
      fps: frames.length / duration,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      confidence,
    }
  } finally {
    video.src = ''
    URL.revokeObjectURL(url)
  }
}

function progressCopy(frac: number): string {
  if (frac < 0.3) return 'Finding your joints…'
  if (frac < 0.6) return 'Reconstructing your movement…'
  if (frac < 0.9) return 'Analysing your stride…'
  return 'Building your movement twin…'
}
