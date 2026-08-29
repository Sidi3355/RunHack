import { useCallback, useEffect, useRef, useState } from 'react'
import type { Analysis, CoachAdvice } from './types'
import { extractPoseSequence, loadLandmarker } from './lib/pose'
import { analyseSequence } from './lib/metrics'
import { getCoachAdvice, templatedAdvice } from './lib/coach'
import { sampleSequence } from './lib/sample'
import Landing from './components/Landing'
import Analyzing from './components/Analyzing'
import Results from './components/Results'

type Screen =
  | { name: 'landing'; error?: string }
  | { name: 'analyzing'; progress: number; stage: string }
  | { name: 'results'; analysis: Analysis; videoUrl: string | null; coach: CoachAdvice; isSample: boolean }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'landing' })
  const videoUrlRef = useRef<string | null>(null)

  // warm up the pose model in the background
  useEffect(() => {
    loadLandmarker().catch(() => {})
  }, [])

  const analyse = useCallback(async (file: File) => {
    setScreen({ name: 'analyzing', progress: 0, stage: 'Loading pose model…' })
    try {
      const seq = await extractPoseSequence(file, (progress, stage) =>
        setScreen({ name: 'analyzing', progress, stage }),
      )
      const analysis = analyseSequence(seq)
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
      const videoUrl = URL.createObjectURL(file)
      videoUrlRef.current = videoUrl
      const coach = await getCoachAdvice(analysis).catch(() => templatedAdvice(analysis))
      setScreen({ name: 'results', analysis, videoUrl, coach, isSample: false })
    } catch (e) {
      const raw = e instanceof Error ? e.message : ''
      const technical = !raw || /INVALID_ARGUMENT|CalculatorGraph|MediaPipe|wasm/i.test(raw)
      setScreen({
        name: 'landing',
        error: technical
          ? 'Something went wrong analysing that clip. Please try again or use another video.'
          : raw,
      })
    }
  }, [])

  const showSample = useCallback(async () => {
    const analysis = analyseSequence(sampleSequence())
    const coach = await getCoachAdvice(analysis).catch(() => templatedAdvice(analysis))
    setScreen({ name: 'results', analysis, videoUrl: null, coach, isSample: true })
  }, [])

  const reset = useCallback(() => setScreen({ name: 'landing' }), [])

  if (screen.name === 'analyzing') {
    return <Analyzing progress={screen.progress} stage={screen.stage} />
  }
  if (screen.name === 'results') {
    return (
      <Results
        analysis={screen.analysis}
        videoUrl={screen.videoUrl}
        coach={screen.coach}
        isSample={screen.isSample}
        onReset={reset}
      />
    )
  }
  return <Landing onFile={analyse} onSample={showSample} error={screen.error} />
}
