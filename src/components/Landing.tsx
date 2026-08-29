import { useRef } from 'react'

export default function Landing({
  onFile,
  onSample,
  error,
}: {
  onFile: (f: File) => void
  onSample: () => void
  error?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-57px)] max-w-6xl flex-col px-4 pt-10 pb-8 sm:px-6">
      <main className="grid flex-1 items-center gap-10 lg:grid-cols-2">
        {/* hero */}
        <div className="text-center lg:text-left">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-fern/70">
            Run with awareness
          </p>
          <h1 className="mt-3 font-display text-5xl font-bold tracking-tight sm:text-6xl">
            Turn <span className="glow-text">movement</span> into insight.
          </h1>
          <p className="mx-auto mt-4 max-w-md leading-relaxed text-moss/60 lg:mx-0">
            Record a few seconds of your run. See your body as a living 3D movement twin, and
            understand — gently, clearly — what to work on.
          </p>

          {error && (
            <div className="mt-6 rounded-2xl border border-peach/60 bg-peach/15 px-4 py-3 text-sm text-moss">
              {error}
            </div>
          )}

          <button
            onClick={() => inputRef.current?.click()}
            className="mt-8 w-full rounded-full bg-fern px-8 py-5 font-display text-lg font-bold text-cream shadow-lg shadow-fern/20 transition-transform active:scale-[0.98] sm:w-auto sm:px-14"
          >
            Analyse my run
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
              e.target.value = ''
            }}
          />

          <div className="mt-5 flex justify-center gap-4 text-sm text-moss/50 lg:justify-start">
            <span>No wearables.</span>
            <span>No markers.</span>
            <span>Just your phone.</span>
          </div>

          <button
            onClick={onSample}
            className="mt-6 text-sm text-fern underline decoration-fern/30 underline-offset-4"
          >
            View sample analysis
          </button>
        </div>

        {/* guide + privacy */}
        <div className="mx-auto w-full max-w-md space-y-4">
          <div className="rounded-3xl border border-line bg-panel p-6 text-left">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-moss/50">
              Quick recording guide
            </p>
            <ul className="space-y-2.5 text-sm text-moss/75">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage font-display text-xs font-bold text-fern">
                  1
                </span>
                Film from the side
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage font-display text-xs font-bold text-fern">
                  2
                </span>
                Keep the whole body visible
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage font-display text-xs font-bold text-fern">
                  3
                </span>
                5–10 seconds is enough
              </li>
            </ul>
          </div>
          <div className="rounded-3xl bg-sage/50 p-5 text-left text-sm leading-relaxed text-moss/70">
            Your movement stays yours. Video analysis happens on your device — your video is never
            uploaded.
          </div>
        </div>
      </main>
      <footer className="mt-10 text-center text-[11px] text-moss/40">
        FormTwin is a prototype coaching tool and is not a medical device or substitute for
        professional medical advice.
      </footer>
    </div>
  )
}
