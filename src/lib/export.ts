import type { Analysis, CoachAdvice, PoseFrame, PoseSequence } from '../types'
import { SKELETON_EDGES } from '../types'
import type { Profile } from './history'
import { hasPersonalization, personalInsights } from './personalize'
import { MAX_SCORE } from './heuristics'

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Download the original uploaded clip as-is. */
export async function downloadOriginalVideo(videoUrl: string) {
  const res = await fetch(videoUrl)
  const blob = await res.blob()
  const ext = blob.type.includes('webm') ? 'webm' : 'mp4'
  triggerDownload(blob, `formtwin-original.${ext}`)
}

function nearestFrame(frames: PoseFrame[], t: number): PoseFrame | null {
  let lo = 0
  let hi = frames.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (frames[mid].t < t) lo = mid + 1
    else hi = mid
  }
  const frame =
    lo > 0 && Math.abs(frames[lo - 1].t - t) < Math.abs(frames[lo].t - t)
      ? frames[lo - 1]
      : frames[lo]
  return frame && Math.abs(frame.t - t) <= 0.25 ? frame : null
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  frame: PoseFrame,
  w: number,
  h: number,
  scale: number,
) {
  for (const [a, b] of SKELETON_EDGES) {
    const pa = frame.landmarks[a]
    const pb = frame.landmarks[b]
    if (pa.visibility < 0.3 || pb.visibility < 0.3) continue
    ctx.strokeStyle = 'rgba(143, 181, 115, 0.9)'
    ctx.lineWidth = 2.5 * scale
    ctx.beginPath()
    ctx.moveTo(pa.x * w, pa.y * h)
    ctx.lineTo(pb.x * w, pb.y * h)
    ctx.stroke()
  }
  frame.landmarks.forEach((p, i) => {
    if (p.visibility < 0.3 || (i > 0 && i < 11)) return
    ctx.fillStyle = '#e9f2df'
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, 3.5 * scale, 0, Math.PI * 2)
    ctx.fill()
  })
}

/**
 * Re-render the clip with the pose skeleton burned in and download it as a
 * WebM. Runs entirely in the browser via canvas capture + MediaRecorder.
 */
export async function exportOverlayVideo(
  videoUrl: string,
  sequence: PoseSequence,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const video = document.createElement('video')
  video.src = videoUrl
  video.muted = true
  video.playsInline = true
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('Could not load the video for export.'))
  })

  const w = video.videoWidth
  const h = video.videoHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available for export.')

  const stream = canvas.captureStream(30)
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm'
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const scale = Math.max(1, w / 640)
  const duration = video.duration

  await new Promise<void>((resolve, reject) => {
    let raf = 0
    const draw = () => {
      ctx.drawImage(video, 0, 0, w, h)
      const frame = nearestFrame(sequence.frames, video.currentTime)
      if (frame) drawSkeleton(ctx, frame, w, h, scale)
      onProgress?.(Math.min(1, video.currentTime / duration))
      if (video.ended) {
        recorder.stop()
        return
      }
      raf = requestAnimationFrame(draw)
    }
    recorder.onstop = () => {
      cancelAnimationFrame(raf)
      resolve()
    }
    recorder.onerror = () => {
      cancelAnimationFrame(raf)
      reject(new Error('Recording the overlay video failed.'))
    }
    recorder.start(250)
    video
      .play()
      .then(() => {
        raf = requestAnimationFrame(draw)
      })
      .catch(() => reject(new Error('Could not play the video for export.')))
  })

  triggerDownload(new Blob(chunks, { type: 'video/webm' }), 'formtwin-skeleton-overlay.webm')
}

/* ------------------------------------------------------------------ */
/* Shareable results card (PNG / PDF)                                  */
/* ------------------------------------------------------------------ */

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(' ')
  let line = ''
  let yy = y
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy)
      line = word
      yy += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, yy)
  return yy + lineHeight
}

/** Render the shareable results card onto an offscreen canvas. */
export function renderResultsCard(
  analysis: Analysis,
  coach: CoachAdvice,
  profile: Profile,
): HTMLCanvasElement {
  const W = 1080
  const insights = hasPersonalization(profile) ? personalInsights(analysis, profile) : []

  // measure pass: rough height estimate, generous
  const H =
    620 +
    analysis.metrics.length * 64 +
    insights.length * 130 +
    360
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  // background
  ctx.fillStyle = '#f7f5ec'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#fffdf6'
  ctx.strokeStyle = '#e0dcc9'
  ctx.lineWidth = 2

  const pad = 64
  let y = 96

  // header
  ctx.fillStyle = '#3f6b4f'
  ctx.font = 'bold 56px "Space Grotesk", system-ui, sans-serif'
  ctx.fillText('FormTwin', pad, y)
  ctx.fillStyle = '#22372b'
  ctx.globalAlpha = 0.55
  ctx.font = '26px Inter, system-ui, sans-serif'
  const dateStr = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  ctx.fillText(`Movement snapshot · ${dateStr}${profile.name ? ` · ${profile.name}` : ''}`, pad, y + 40)
  ctx.globalAlpha = 1
  y += 110

  // overall score
  ctx.fillStyle = '#3f6b4f'
  ctx.font = 'bold 120px "Space Grotesk", system-ui, sans-serif'
  ctx.fillText(`${analysis.overallScore}`, pad, y + 90)
  const scoreW = ctx.measureText(`${analysis.overallScore}`).width
  ctx.fillStyle = '#22372b'
  ctx.globalAlpha = 0.4
  ctx.font = '36px Inter, system-ui, sans-serif'
  ctx.fillText('/100 overall', pad + scoreW + 16, y + 88)
  ctx.globalAlpha = 0.55
  ctx.font = '24px Inter, system-ui, sans-serif'
  ctx.fillText(
    `Analysis confidence ${Math.round(analysis.confidence * 100)}% · best possible score ${MAX_SCORE}`,
    pad,
    y + 132,
  )
  ctx.globalAlpha = 1
  y += 190

  // headline observation
  ctx.fillStyle = '#22372b'
  ctx.font = 'bold 30px "Space Grotesk", system-ui, sans-serif'
  ctx.fillText('What we noticed', pad, y)
  y += 40
  ctx.font = '26px Inter, system-ui, sans-serif'
  ctx.globalAlpha = 0.75
  y = wrapText(ctx, analysis.primary.headline, pad, y, W - pad * 2, 36)
  ctx.globalAlpha = 1
  y += 24

  // metric rows
  ctx.font = 'bold 30px "Space Grotesk", system-ui, sans-serif'
  ctx.fillText('Your signals', pad, y)
  y += 44
  for (const m of analysis.metrics) {
    ctx.fillStyle = '#22372b'
    ctx.globalAlpha = 0.8
    ctx.font = '26px Inter, system-ui, sans-serif'
    ctx.fillText(m.label, pad, y)
    if (m.unreliable) {
      ctx.globalAlpha = 0.4
      ctx.fillText('not measurable in this clip', pad + 320, y)
    } else {
      // score bar
      const barX = pad + 320
      const barW = W - barX - pad - 90
      ctx.globalAlpha = 0.15
      ctx.fillStyle = '#3f6b4f'
      ctx.fillRect(barX, y - 20, barW, 24)
      ctx.globalAlpha = 1
      ctx.fillStyle = m.score >= 80 ? '#3f6b4f' : m.score >= 60 ? '#c98a3d' : '#c05e5e'
      ctx.fillRect(barX, y - 20, barW * (m.score / 100), 24)
      ctx.fillStyle = '#22372b'
      ctx.font = 'bold 26px Inter, system-ui, sans-serif'
      ctx.fillText(`${m.score}`, barX + barW + 20, y)
    }
    ctx.globalAlpha = 1
    y += 64
  }
  y += 12

  // coaching
  ctx.fillStyle = '#22372b'
  ctx.font = 'bold 30px "Space Grotesk", system-ui, sans-serif'
  ctx.fillText('Next steps', pad, y)
  y += 40
  ctx.font = '26px Inter, system-ui, sans-serif'
  ctx.globalAlpha = 0.75
  y = wrapText(ctx, `Try this: ${coach.tryThis}`, pad, y, W - pad * 2, 36)
  y += 6
  y = wrapText(ctx, `Why: ${coach.why}`, pad, y, W - pad * 2, 36)
  ctx.globalAlpha = 1
  y += 24

  // personalized insights
  if (insights.length) {
    ctx.font = 'bold 30px "Space Grotesk", system-ui, sans-serif'
    ctx.fillText('For you', pad, y)
    y += 40
    for (const ins of insights) {
      ctx.font = 'bold 26px Inter, system-ui, sans-serif'
      ctx.globalAlpha = 0.85
      y = wrapText(ctx, ins.title, pad, y, W - pad * 2, 34)
      ctx.font = '24px Inter, system-ui, sans-serif'
      ctx.globalAlpha = 0.65
      y = wrapText(ctx, ins.text, pad, y, W - pad * 2, 32)
      ctx.globalAlpha = 0.45
      ctx.font = '20px Inter, system-ui, sans-serif'
      y = wrapText(ctx, `Source: ${ins.source}`, pad, y, W - pad * 2, 28)
      ctx.globalAlpha = 1
      y += 12
    }
  }

  // footer
  y += 12
  ctx.globalAlpha = 0.45
  ctx.font = '20px Inter, system-ui, sans-serif'
  y = wrapText(
    ctx,
    'Approximate camera-based signals from a single side-on clip — prototype coaching heuristics, not clinical measurements. FormTwin is not a medical device or a substitute for professional medical advice.',
    pad,
    y,
    W - pad * 2,
    28,
  )
  ctx.globalAlpha = 1

  // trim canvas to used height
  const finalH = Math.min(H, y + 48)
  const trimmed = document.createElement('canvas')
  trimmed.width = W
  trimmed.height = finalH
  const tctx = trimmed.getContext('2d')
  if (tctx) {
    tctx.fillStyle = '#f7f5ec'
    tctx.fillRect(0, 0, W, finalH)
    tctx.drawImage(canvas, 0, 0)
  }
  return tctx ? trimmed : canvas
}

export function downloadCardPng(canvas: HTMLCanvasElement) {
  canvas.toBlob((blob) => {
    if (blob) triggerDownload(blob, 'formtwin-results.png')
  }, 'image/png')
}

/**
 * Build a minimal single-page PDF embedding the card as a JPEG
 * (DCTDecode image XObject) — no PDF library needed.
 */
export function downloadCardPdf(canvas: HTMLCanvasElement) {
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92)
  const jpegBytes = atob(jpegDataUrl.split(',')[1])
  const imgData = new Uint8Array(jpegBytes.length)
  for (let i = 0; i < jpegBytes.length; i++) imgData[i] = jpegBytes.charCodeAt(i)

  // page sized to the image at 72dpi/1.5 for a reasonable print size
  const pw = canvas.width / 1.5
  const ph = canvas.height / 1.5

  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (s: string | Uint8Array) => {
    const b = typeof s === 'string' ? enc.encode(s) : s
    parts.push(b)
    length += b.length
  }
  const beginObj = (n: number, body: string) => {
    offsets[n] = length
    push(`${n} 0 obj\n${body}\nendobj\n`)
  }

  push('%PDF-1.4\n')
  beginObj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  beginObj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  beginObj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw.toFixed(2)} ${ph.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  )
  offsets[4] = length
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgData.length} >>\nstream\n`,
  )
  push(imgData)
  push('\nendstream\nendobj\n')
  const content = `q ${pw.toFixed(2)} 0 0 ${ph.toFixed(2)} 0 0 cm /Im0 Do Q`
  beginObj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`)

  const xrefStart = length
  const pad10 = (n: number) => String(n).padStart(10, '0')
  push(
    `xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5]
      .map((n) => `${pad10(offsets[n])} 00000 n \n`)
      .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
  )

  const blob = new Blob(parts as BlobPart[], { type: 'application/pdf' })
  triggerDownload(blob, 'formtwin-results.pdf')
}
