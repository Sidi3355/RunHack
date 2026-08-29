import { useState } from 'react'
import { loadProfile, saveProfile, type ExperienceLevel } from '../lib/history'

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
  const [age, setAge] = useState(profile.age?.toString() ?? '')
  const [years, setYears] = useState(profile.yearsRunning?.toString() ?? '')
  const [goalPace, setGoalPace] = useState(profile.goalPaceMinPerKm?.toString() ?? '')
  const [experience, setExperience] = useState<ExperienceLevel | ''>(profile.experience ?? '')

  const parseNum = (s: string) => {
    const n = parseFloat(s)
    return Number.isFinite(n) && n > 0 ? n : null
  }

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
            <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-line bg-panel p-4 shadow-lg">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-moss/50">
                Your profile
              </p>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-line bg-cream px-3 py-2 text-sm outline-none focus:border-fern"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Age"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-line bg-cream px-3 py-2 text-sm outline-none focus:border-fern"
                />
                <input
                  value={years}
                  onChange={(e) => setYears(e.target.value)}
                  placeholder="Years running"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-line bg-cream px-3 py-2 text-sm outline-none focus:border-fern"
                />
              </div>
              <select
                value={experience}
                onChange={(e) => setExperience(e.target.value as ExperienceLevel | '')}
                className="mt-2 w-full rounded-xl border border-line bg-cream px-3 py-2 text-sm outline-none focus:border-fern"
              >
                <option value="">Experience level…</option>
                <option value="new">New to running</option>
                <option value="amateur">Amateur</option>
                <option value="experienced">Experienced</option>
                <option value="competitive">Competitive</option>
              </select>
              <input
                value={goalPace}
                onChange={(e) => setGoalPace(e.target.value)}
                placeholder="Goal pace (min/km), e.g. 5"
                inputMode="decimal"
                className="mt-2 w-full rounded-xl border border-line bg-cream px-3 py-2 text-sm outline-none focus:border-fern"
              />
              <button
                onClick={() => {
                  const p = {
                    name: draft.trim(),
                    age: parseNum(age),
                    yearsRunning: parseNum(years),
                    goalPaceMinPerKm: parseNum(goalPace),
                    experience: experience || null,
                  }
                  saveProfile(p)
                  setProfile(p)
                  setAccountOpen(false)
                }}
                className="mt-3 w-full rounded-xl bg-fern px-3 py-2 text-sm font-medium text-cream"
              >
                Save
              </button>
              <p className="mt-3 text-[11px] leading-snug text-moss/45">
                Everything is stored on this device — no account server, no uploads. Your details
                personalize the analysis insights.
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
