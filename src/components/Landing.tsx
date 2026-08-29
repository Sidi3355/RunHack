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
    <div className="min-h-dvh flex flex-col items-center px-6 pt-16 pb-8 text-center relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #22d3ee 0%, #a78bfa 45%, transparent 70%)' }}
      />
      <main className="flex-1 flex flex-col items-center justify-center max-w-md w-full relative">
        <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-tight glow-text">
          FORMTWIN
        </h1>
        <p className="mt-3 font-display text-xl text-white/90">Turn movement into insight.</p>
        <p className="mt-4 text-white/60 leading-relaxed">
          Record a few seconds. See your movement in 3D. Understand what to work on.
        </p>

        {error && (
          <div className="mt-6 w-full rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        )}

        <button
          onClick={() => inputRef.current?.click()}
          className="mt-8 w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-400 px-8 py-5 font-display text-lg font-bold text-ink text-black shadow-lg shadow-cyan-500/25 active:scale-[0.98] transition-transform"
        >
          ANALYSE MY RUN
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

        <div className="mt-5 flex gap-4 text-sm text-white/50">
          <span>No wearables.</span>
          <span>No markers.</span>
          <span>Just your phone.</span>
        </div>

        <div className="mt-8 w-full rounded-2xl border border-line bg-panel p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">
            Quick recording guide
          </p>
          <ul className="space-y-1.5 text-sm text-white/70">
            <li>→ Film from the side</li>
            <li>→ Keep the whole body visible</li>
            <li>→ 5–10 seconds is enough</li>
          </ul>
        </div>

        <button
          onClick={onSample}
          className="mt-6 text-sm text-cyan-300/80 underline underline-offset-4 decoration-cyan-300/30"
        >
          View sample analysis
        </button>

        <p className="mt-8 text-xs text-white/40 max-w-xs">
          Your movement stays yours. Video analysis happens on your device — your video is never
          uploaded.
        </p>
      </main>
      <footer className="mt-10 text-[11px] text-white/30 max-w-sm">
        FormTwin is a prototype coaching tool and is not a medical device or substitute for
        professional medical advice.
      </footer>
    </div>
  )
}
