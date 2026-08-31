import { useCallback, useEffect, useRef, useState } from 'react'
import type { Analysis, CoachAdvice } from './types'
import { extractPoseSequence, loadLandmarker } from './lib/pose'
import { analyseSequence } from './lib/metrics'
import { getCoachAdvice, templatedAdvice } from './lib/coach'
import { sampleSequence } from './lib/sample'
import { saveAnalysis } from './lib/history'
import { completeAuthIfRedirected } from './lib/fitbit'
import Landing from './components/Landing'
import Analyzing from './components/Analyzing'
import Results from './components/Results'
import Journey from './components/Journey'
import FitbitPage from './components/FitbitPage'
import Header, { type Page } from './components/Header'

type Screen =
  | { name: 'landing'; error?: string }
  | { name: 'analyzing'; progress: number; stage: string }
  | { name: 'results'; analysis: Analysis; videoUrl: string | null; coach: CoachAdvice; isSample: boolean }

export default function App() {
  const [page, setPage] = useState<Page>('analyse')
  const [screen, setScreen] = useState<Screen>({ name: 'landing' })
  const videoUrlRef = useRef<string | null>(null)

  // warm up the pose model + finish a Fitbit sign-in redirect if present
  useEffect(() => {
    if (import.meta.env.DEV) {
      // headless validation harness: run the full pipeline on a File and return the analysis
      const w = window as Window & {
        __formtwinAnalyse?: (file: File) => Promise<Analysis>
        __formtwinExtract?: (file: File) => Promise<unknown>
      }
      w.__formtwinAnalyse = async (file: File) =>
        analyseSequence(await extractPoseSequence(file, () => {}))
      w.__formtwinExtract = async (file: File) => extractPoseSequence(file, () => {})
    }
    loadLandmarker().catch(() => {})
    void completeAuthIfRedirected().then((ok) => {
      if (ok) setPage('fitbit')
    })
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
      saveAnalysis(analysis)
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
    // The bundled example clip (public/sample-run.mp4) was analysed once with
    // the real pipeline and the result shipped as static JSON, so the sample
    // opens instantly for every visitor. Falls back to the synthetic sequence
    // if the precomputed analysis can't be fetched.
    try {
      const res = await fetch('/sample-analysis.json')
      if (!res.ok) throw new Error(`sample analysis ${res.status}`)
      const analysis = (await res.json()) as Analysis
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
      videoUrlRef.current = null
      const coach = await getCoachAdvice(analysis).catch(() => templatedAdvice(analysis))
      setScreen({ name: 'results', analysis, videoUrl: '/sample-run.mp4', coach, isSample: true })
    } catch {
      const analysis = analyseSequence(sampleSequence())
      const coach = await getCoachAdvice(analysis).catch(() => templatedAdvice(analysis))
      setScreen({ name: 'results', analysis, videoUrl: null, coach, isSample: true })
    }
  }, [])

  const reset = useCallback(() => setScreen({ name: 'landing' }), [])

  const navigate = (p: Page) => {
    setPage(p)
    if (p === 'analyse') setScreen({ name: 'landing' })
  }

  let body
  if (page === 'journey') body = <Journey />
  else if (page === 'fitbit') body = <FitbitPage />
  else if (screen.name === 'analyzing')
    body = <Analyzing progress={screen.progress} stage={screen.stage} />
  else if (screen.name === 'results')
    body = (
      <Results
        analysis={screen.analysis}
        videoUrl={screen.videoUrl}
        coach={screen.coach}
        isSample={screen.isSample}
        onReset={reset}
      />
    )
  else body = <Landing onFile={analyse} onSample={showSample} error={screen.error} />

  return (
    <div className="leaf-bg min-h-dvh">
      <Header page={page} onNavigate={navigate} />
      {body}
    </div>
  )
}
