export default function Analyzing({ progress, stage }: { progress: number; stage: string }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-8 text-center">
      <div className="relative w-28 h-28">
        <div className="absolute inset-0 rounded-full border-2 border-line" />
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 border-r-violet-400 animate-spin"
          style={{ animationDuration: '1.1s' }}
        />
        <div className="absolute inset-0 flex items-center justify-center font-display text-lg font-semibold">
          {Math.round(progress * 100)}%
        </div>
      </div>
      <p className="mt-8 font-display text-xl text-white/90">{stage}</p>
      <div className="mt-6 h-1.5 w-full max-w-xs rounded-full bg-panel2 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all duration-300"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <p className="mt-6 text-xs text-white/40">Analysis runs on your device.</p>
    </div>
  )
}
