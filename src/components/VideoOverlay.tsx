import { useEffect, useRef, useState } from 'react'
import type { MetricKey, PoseSequence } from '../types'
import { METRIC_JOINTS, SKELETON_EDGES } from '../types'

export default function VideoOverlay({
  videoUrl,
  sequence,
  highlight,
  seekRequest,
}: {
  videoUrl: string
  sequence: PoseSequence
  highlight: MetricKey | null
  seekRequest: { time: number; n: number } | null
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const highlightRef = useRef(highlight)
  highlightRef.current = highlight

  useEffect(() => {
    if (seekRequest && videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = seekRequest.time
      setPlaying(false)
    }
  }, [seekRequest])

  useEffect(() => {
    let raf = 0
    const frames = sequence.frames
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2) return
      const w = video.clientWidth
      const h = video.clientHeight
      if (canvas.width !== w * devicePixelRatio) {
        canvas.width = w * devicePixelRatio
        canvas.height = h * devicePixelRatio
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      ctx.clearRect(0, 0, w, h)
      setTime(video.currentTime)

      const t = video.currentTime
      let lo = 0
      let hi = frames.length - 1
      while (lo < hi) {
        const midI = (lo + hi) >> 1
        if (frames[midI].t < t) lo = midI + 1
        else hi = midI
      }
      const frame =
        lo > 0 && Math.abs(frames[lo - 1].t - t) < Math.abs(frames[lo].t - t)
          ? frames[lo - 1]
          : frames[lo]
      if (!frame || Math.abs(frame.t - t) > 0.25) return

      // object-contain mapping: video letterboxed inside the element
      const vAspect = sequence.videoWidth / sequence.videoHeight
      const eAspect = w / h
      let dw = w
      let dh = h
      let ox = 0
      let oy = 0
      if (vAspect > eAspect) {
        dh = w / vAspect
        oy = (h - dh) / 2
      } else {
        dw = h * vAspect
        ox = (w - dw) / 2
      }
      const px = (nx: number) => ox + nx * dw
      const py = (ny: number) => oy + ny * dh

      const hl = highlightRef.current
      const hlJoints = hl ? new Set(METRIC_JOINTS[hl]) : null

      for (const [a, b] of SKELETON_EDGES) {
        const pa = frame.landmarks[a]
        const pb = frame.landmarks[b]
        if (pa.visibility < 0.3 || pb.visibility < 0.3) continue
        const emphasised = hlJoints && hlJoints.has(a) && hlJoints.has(b)
        ctx.strokeStyle = emphasised
          ? 'rgba(34, 211, 238, 0.95)'
          : hlJoints
            ? 'rgba(255,255,255,0.28)'
            : 'rgba(167, 139, 250, 0.85)'
        ctx.lineWidth = emphasised ? 4 : 2.5
        ctx.beginPath()
        ctx.moveTo(px(pa.x), py(pa.y))
        ctx.lineTo(px(pb.x), py(pb.y))
        ctx.stroke()
      }
      frame.landmarks.forEach((p, i) => {
        if (p.visibility < 0.3 || (i > 0 && i < 11)) return
        const emphasised = hlJoints?.has(i)
        ctx.fillStyle = emphasised ? '#22d3ee' : hlJoints ? 'rgba(255,255,255,0.4)' : '#e9e6ff'
        ctx.beginPath()
        ctx.arc(px(p.x), py(p.y), emphasised ? 6 : 3.5, 0, Math.PI * 2)
        ctx.fill()
      })
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [sequence])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  return (
    <div>
      <div className="relative rounded-2xl overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          muted
          loop
          className="w-full max-h-[60vh] object-contain"
          onEnded={() => setPlaying(false)}
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        <div className="absolute bottom-2 right-3 text-xs font-mono text-white/70 bg-black/50 rounded px-1.5 py-0.5">
          {time.toFixed(2)}s
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="shrink-0 w-11 h-11 rounded-full bg-panel2 border border-line flex items-center justify-center text-lg"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={sequence.duration}
          step={0.01}
          value={time}
          onChange={(e) => {
            const v = videoRef.current
            if (v) v.currentTime = parseFloat(e.target.value)
          }}
          className="w-full"
        />
      </div>
    </div>
  )
}
