export default function Analyzing({ progress, stage }: { progress: number; stage: string }) {
  return (
    <div className="flex min-h-[calc(100dvh-57px)] flex-col items-center justify-center px-8 text-center">
      <div className="relative h-28 w-28">
        <div className="absolute inset-0 rounded-full border-2 border-line" />
        <div
          className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-fern border-r-lime"
          style={{ animationDuration: '1.1s' }}
        />
        <div className="absolute inset-0 flex items-center justify-center font-display text-lg font-semibold">
          {Math.round(progress * 100)}%
        </div>
      </div>
      <p className="mt-8 font-display text-xl text-moss/90">{stage}</p>
      <div className="mt-6 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-panel2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-fern to-lime transition-all duration-300"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <p className="mt-6 text-xs text-moss/45">Analysis runs on your device.</p>
    </div>
  )
}
