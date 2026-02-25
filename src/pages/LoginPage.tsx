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
      <div className={`flex gap-4 mb-3 ${shaking ? 'animate-shake' : ''}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
            i < pin.length ? 'bg-brand-400 border-brand-400 scale-110' : 'bg-transparent border-slate-500'
          }`} />
        ))}
      </div>
    )
  }

  function Numpad() {
    return (
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {numpadDigits.map((d, i) => {
          if (d === '') return <div key={i} />
          if (d === '⌫') return (
            <button key={i} onClick={handleDelete}
              className="flex items-center justify-center h-16 rounded-2xl bg-slate-700 active:bg-slate-600 text-2xl font-semibold text-slate-300 transition-colors">
              {d}
            </button>
          )
          return (
            <button key={i} onClick={() => handleDigit(d)}
              className="flex items-center justify-center h-16 rounded-2xl bg-slate-700 active:bg-brand-600 text-2xl font-semibold text-white transition-colors">
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
      <div className="flex flex-col items-center justify-center h-full px-6">
        <div className="w-full max-w-xs">
          {/* Logo */}
          <div className="text-center mb-8">
            <img
              src="/favicon.png"
              alt="ProMotor"
              className="w-20 h-20 mx-auto mb-4 rounded-2xl shadow-xl object-contain"
            />
            <h1 className="font-display font-extrabold text-4xl tracking-tight text-white">
              Promotor OPS
            </h1>
            <p className="text-slate-400 text-sm mt-2">Sign in with your Jira account</p>
          </div>

          <form onSubmit={handleJiraLogin} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">
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
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 disabled:opacity-50 text-base"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setJiraError('') }}
                disabled={jiraLoading}
                placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 disabled:opacity-50 text-base"
              />
            </div>

            {jiraError && (
              <p className="text-red-400 text-sm text-center">{jiraError}</p>
            )}

            <button
              type="submit"
              disabled={jiraLoading || !username.trim() || !password}
              className="w-full py-3.5 rounded-xl bg-brand-600 active:bg-brand-500 disabled:opacity-40 text-white font-semibold text-base transition-colors mt-2"
            >
              {jiraLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verifying…
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Step: Set PIN (first time) ───────────────────────────────────────────
  if (step === 'set-pin') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 select-none">
        <div className="text-center mb-8">
          <p className="text-slate-400 text-sm">
            Welcome, <span className="text-white font-semibold">{storedUser?.displayName}</span>
          </p>
          <h2 className="text-xl font-bold text-white mt-1">Set a 4-digit PIN</h2>
          <p className="text-slate-400 text-sm mt-1">You'll use this PIN for future logins</p>
        </div>
        <PinDots />
        <div className="h-5 mb-6">
          {pinError && <p className="text-red-400 text-sm text-center">{pinError}</p>}
        </div>
        <Numpad />
      </div>
    )
  }

  // ── Step: Confirm PIN ────────────────────────────────────────────────────
  if (step === 'confirm-pin') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 select-none">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-white">Confirm your PIN</h2>
          <p className="text-slate-400 text-sm mt-1">Enter the same PIN again</p>
        </div>
        <PinDots />
        <div className="h-5 mb-6">
          {pinError && <p className="text-red-400 text-sm text-center">{pinError}</p>}
        </div>
        <Numpad />
        <button
          onClick={() => { setStep('set-pin'); setPin(''); setFirstPin(''); setPinError('') }}
          className="mt-6 text-slate-400 text-sm underline"
        >
          Start over
        </button>
      </div>
    )
  }

  // ── Step: PIN login (returning user) ────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 select-none">
      <div className="text-center mb-8">
        <img
          src="/favicon.png"
          alt="ProMotor"
          className="w-20 h-20 mx-auto mb-4 rounded-2xl shadow-xl object-contain"
        />
        <h1 className="font-display font-extrabold text-4xl tracking-tight text-white">
          Promotor OPS
        </h1>
        <p className="text-slate-300 text-sm mt-2 font-medium">
          {storedUser?.displayName ?? storedUser?.username}
        </p>
        <p className="text-slate-400 text-xs mt-0.5">Enter your PIN</p>
      </div>

      <PinDots />
      <div className="h-5 mb-6">
        {pinError && <p className="text-red-400 text-sm text-center">{pinError}</p>}
      </div>
      <Numpad />

      <button
        onClick={() => { setStep('jira'); setPin(''); setPinError('') }}
        className="mt-6 text-slate-400 text-sm underline"
      >
        Sign in with a different account
      </button>
    </div>
  )
}
