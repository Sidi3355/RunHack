import { useState } from 'react'
import { loadProfile, saveProfile } from '../lib/history'

export type Page = 'analyse' | 'journey' | 'fitbit'

export default function Header({
  page,
  onNavigate,
}: {
  page: Page
  onNavigate: (p: Page) => void
}) {
  const [profile, setProfile] = useState(loadProfile())
  const [accountOpen, setAccountOpen] = useState(false)
  const [draft, setDraft] = useState(profile.name)

  const tabs: { key: Page; label: string }[] = [
    { key: 'analyse', label: 'Analyse' },
    { key: 'journey', label: 'My journey' },
    { key: 'fitbit', label: 'Fitbit' },
  ]

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-panel/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <button
          onClick={() => onNavigate('analyse')}
          className="font-display text-lg font-bold tracking-tight glow-text"
        >
          FormTwin
        </button>
        <nav className="ml-2 flex gap-1 sm:ml-6 sm:gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => onNavigate(t.key)}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                page === t.key
                  ? 'bg-fern text-cream font-medium'
                  : 'text-moss/60 hover:bg-sage/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="relative ml-auto">
          <button
            onClick={() => setAccountOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-sm text-moss/80"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sage font-display text-xs font-bold text-fern">
              {(profile.name || '?').slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden sm:inline">{profile.name || 'Account'}</span>
          </button>
          {accountOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-line bg-panel p-4 shadow-lg">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-moss/50">
                Your profile
              </p>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-line bg-cream px-3 py-2 text-sm outline-none focus:border-fern"
              />
              <button
                onClick={() => {
                  const p = { name: draft.trim() }
                  saveProfile(p)
                  setProfile(p)
                  setAccountOpen(false)
                }}
                className="mt-3 w-full rounded-xl bg-fern px-3 py-2 text-sm font-medium text-cream"
              >
                Save
              </button>
              <p className="mt-3 text-[11px] leading-snug text-moss/45">
                Everything is stored on this device — no account server, no uploads.
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
