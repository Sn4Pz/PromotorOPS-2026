import { useState, useEffect } from 'react'
import { validateJiraCredentials } from '../api/jira'
import {
  loadUser,
  saveUser,
  hashPin,
  StoredUser,
} from '../auth/storage'

type Step = 'pin' | 'jira' | 'set-pin' | 'confirm-pin'

interface Props {
  onLoginSuccess: (user: StoredUser) => void
}

export default function LoginPage({ onLoginSuccess }: Props) {
  const [step, setStep]               = useState<Step>('pin')
  const [storedUser, setStoredUser]   = useState<StoredUser | null>(null)

  // Jira credentials step
  const [username, setUsername]       = useState('')
  const [password, setPassword]       = useState('')
  const [jiraLoading, setJiraLoading] = useState(false)
  const [jiraError, setJiraError]     = useState('')

  // PIN steps
  const [pin, setPin]                 = useState('')
  const [firstPin, setFirstPin]       = useState('')   // remembered during confirm step
  const [pinError, setPinError]       = useState('')
  const [shaking, setShaking]         = useState(false)

  // Determine starting step on mount
  useEffect(() => {
    const user = loadUser()
    if (user) {
      setStoredUser(user)
      setStep('pin')
    } else {
      setStep('jira')
    }
  }, [])

  // ── PIN input helpers ────────────────────────────────────────────────────

  async function handleDigit(d: string) {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    setPinError('')

    if (next.length < 4) return

    setTimeout(async () => {
      if (step === 'pin') {
        // Validate against stored hash
        const hash = await hashPin(next)
        if (hash === storedUser!.pinHash) {
          onLoginSuccess(storedUser!)
        } else {
          triggerShake('Wrong PIN. Try again.')
        }
      } else if (step === 'set-pin') {
        // Store first entry and move to confirm
        setFirstPin(next)
        setPin('')
        setStep('confirm-pin')
      } else if (step === 'confirm-pin') {
        // Confirm matches first entry
        if (next !== firstPin) {
          triggerShake('PINs do not match. Try again.')
          setStep('set-pin')
          setFirstPin('')
        } else {
          // Save user with new PIN
          const pinHash = await hashPin(next)
          const updated: StoredUser = { ...storedUser!, pinHash }
          saveUser(updated)
          onLoginSuccess(updated)
        }
      }
    }, 120)
  }

  function handleDelete() {
    setPin((p) => p.slice(0, -1))
    setPinError('')
  }

  function triggerShake(msg: string) {
    setShaking(true)
    setPinError(msg)
    setPin('')
    setTimeout(() => setShaking(false), 500)
  }

  // ── Jira login ───────────────────────────────────────────────────────────

  async function handleJiraLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setJiraLoading(true)
    setJiraError('')
    try {
      const profile = await validateJiraCredentials(username.trim(), password)
      const jiraToken = btoa(`${username.trim()}:${password}`)
      const partial: StoredUser = {
        username:    username.trim(),
        displayName: profile.displayName || username.trim(),
        pinHash:     '',       // will be set after PIN setup
        jiraToken,
      }
      setStoredUser(partial)
      setPin('')
      setStep('set-pin')
    } catch {
      setJiraError('Invalid Jira credentials. Please try again.')
    } finally {
      setJiraLoading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const numpadDigits = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  function PinDots() {
    return (
      <div className={`flex gap-5 mb-3 ${shaking ? 'animate-shake' : ''}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${
            i < pin.length ? 'bg-brand-400 border-brand-400 scale-110' : 'bg-transparent border-slate-500'
          }`} />
        ))}
      </div>
    )
  }

  function Numpad() {
    return (
      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        {numpadDigits.map((d, i) => {
          if (d === '') return <div key={i} />
          if (d === '⌫') return (
            <button key={i} onClick={handleDelete}
              className="flex items-center justify-center h-20 rounded-2xl bg-slate-700 active:bg-slate-600 text-3xl font-semibold text-slate-300 transition-colors">
              {d}
            </button>
          )
          return (
            <button key={i} onClick={() => handleDigit(d)}
              className="flex items-center justify-center h-20 rounded-2xl bg-slate-700 active:bg-brand-600 text-3xl font-bold text-white transition-colors">
              {d}
            </button>
          )
        })}
      </div>
    )
  }

  // ── Step: Jira credentials ───────────────────────────────────────────────
  if (step === 'jira') {
    return (
      <div className="flex flex-col h-full pt-safe-top pb-safe-bottom">
        {/* Branding — 38% of screen height */}
        <div className="flex flex-col items-center justify-end pb-6 px-6 text-center"
          style={{ flex: '2' }}>
          <img src="/favicon.png" alt="Promotor"
            className="w-32 h-32 mb-6 rounded-3xl shadow-xl object-contain" />
          <h1 className="font-display font-extrabold text-5xl tracking-tight text-white">
            Promotor OPS
          </h1>
          <p className="text-slate-400 text-base mt-3">Sign in with your Jira account</p>
        </div>

        {/* Form — 62% of screen height */}
        <div className="flex flex-col items-center justify-center px-6"
          style={{ flex: '3' }}>
          <form onSubmit={handleJiraLogin} className="space-y-5 w-full max-w-xs">
            <div>
              <label className="block text-sm text-slate-400 mb-2 uppercase tracking-wider font-medium">
                Jira Username
              </label>
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setJiraError('') }}
                disabled={jiraLoading}
                placeholder="your.name"
                className="w-full bg-slate-800 border border-slate-600 rounded-2xl px-5 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 disabled:opacity-50 text-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2 uppercase tracking-wider font-medium">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setJiraError('') }}
                disabled={jiraLoading}
                placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-600 rounded-2xl px-5 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 disabled:opacity-50 text-lg"
              />
            </div>

            {jiraError && <p className="text-red-400 text-base text-center">{jiraError}</p>}

            <button
              type="submit"
              disabled={jiraLoading || !username.trim() || !password}
              className="w-full py-4 rounded-2xl bg-brand-600 active:bg-brand-500 disabled:opacity-40 text-white font-semibold text-lg transition-colors"
            >
              {jiraLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verifying…
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Shared PIN page shell ────────────────────────────────────────────────
  // All three PIN steps use identical structure so the keypad never moves.
  // • Top zone:    logo + title + fixed-height subtitle block (h-12)
  // • Bottom zone: prompt + dots + fixed-height error row + numpad +
  //                fixed-height link slot (invisible when unused)
  // ─────────────────────────────────────────────────────────────────────────

  const pinTopSubtitle =
    step === 'set-pin'
      ? <p className="text-slate-300 text-base font-semibold">
          Welcome, <span className="text-white">{storedUser?.displayName}</span>
        </p>
      : step === 'confirm-pin'
      ? <p className="text-slate-400 text-base">Confirm your PIN</p>
      : <p className="text-slate-300 text-lg font-semibold">
          {storedUser?.displayName ?? storedUser?.username}
        </p>

  const pinPrompt =
    step === 'set-pin'     ? 'Set a 4-digit PIN for future logins'
    : step === 'confirm-pin' ? 'Enter the same PIN again'
    : 'Enter your PIN'

  const pinLinkLabel =
    step === 'confirm-pin' ? 'Start over'
    : step === 'pin'       ? 'Sign in with a different account'
    : null   // set-pin has no link

  function handlePinLink() {
    if (step === 'confirm-pin') { setStep('set-pin'); setPin(''); setFirstPin(''); setPinError('') }
    else if (step === 'pin')    { setStep('jira'); setPin(''); setPinError('') }
  }

  return (
    <div className="flex flex-col h-full select-none pt-safe-top pb-safe-bottom">

      {/* ── Top zone: branding (38%) ── */}
      <div className="flex flex-col items-center justify-center px-6 text-center"
        style={{ flex: '2' }}>
        <img src="/favicon.png" alt="Promotor"
          className="w-24 h-24 mb-5 rounded-3xl shadow-xl object-contain" />
        <h1 className="font-display font-extrabold text-4xl tracking-tight text-white">
          Promotor OPS
        </h1>
        {/* Fixed-height subtitle — prevents layout shift between steps */}
        <div className="h-12 flex flex-col items-center justify-center mt-1">
          {pinTopSubtitle}
        </div>
      </div>

      {/* ── Bottom zone: prompt + keypad (62%) ── */}
      <div className="flex flex-col items-center justify-center px-6 gap-4 pb-12"
        style={{ flex: '3' }}>
        <p className="text-slate-400 text-base">{pinPrompt}</p>
        <PinDots />
        {/* Fixed-height error row — prevents keypad jump on error */}
        <div className="h-5 flex items-center justify-center">
          {pinError && <p className="text-red-400 text-base">{pinError}</p>}
        </div>
        <Numpad />
        {/* Fixed-height link slot — invisible when unused so keypad stays put */}
        <div className="h-10 flex items-center justify-center pt-6">
          {pinLinkLabel && (
            <button onClick={handlePinLink}
              className="text-slate-500 text-base underline">
              {pinLinkLabel}
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
