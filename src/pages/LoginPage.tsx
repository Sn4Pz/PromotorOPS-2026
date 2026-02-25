import { useState } from 'react'

// Simple PIN-based access gate.
// This does NOT authenticate against Jira — all Jira API calls use the
// service account (andrei.buldus). This PIN just prevents casual access
// to the app so operators must be in front of the physical equipment.
const APP_PIN = '1234'

interface Props {
  onLoginSuccess: () => void
}

export default function LoginPage({ onLoginSuccess }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [shaking, setShaking] = useState(false)

  function handleDigit(d: string) {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    setError('')

    if (next.length === 4) {
      setTimeout(() => {
        if (next === APP_PIN) {
          onLoginSuccess()
        } else {
          setShaking(true)
          setError('Wrong PIN. Try again.')
          setPin('')
          setTimeout(() => setShaking(false), 500)
        }
      }, 120)
    }
  }

  function handleDelete() {
    setPin((p) => p.slice(0, -1))
    setError('')
  }

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 select-none">
      {/* Logo / title */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-brand-700 mb-4 shadow-lg">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 10h4l3 8 4-16 3 8h4" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">ProMotor OPS</h1>
        <p className="text-slate-400 text-sm mt-1">Enter your PIN to continue</p>
      </div>

      {/* PIN dots */}
      <div className={`flex gap-4 mb-8 ${shaking ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-colors duration-150 ${
              i < pin.length
                ? 'bg-brand-500 border-brand-500'
                : 'bg-transparent border-slate-500'
            }`}
          />
        ))}
      </div>

      {/* Error */}
      <div className="h-5 mb-6">
        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {digits.map((d, i) => {
          if (d === '') return <div key={i} />
          if (d === '⌫') {
            return (
              <button
                key={i}
                onClick={handleDelete}
                className="flex items-center justify-center h-16 rounded-2xl bg-slate-700 active:bg-slate-600 text-2xl font-semibold text-slate-300 transition-colors"
              >
                {d}
              </button>
            )
          }
          return (
            <button
              key={i}
              onClick={() => handleDigit(d)}
              className="flex items-center justify-center h-16 rounded-2xl bg-slate-700 active:bg-brand-600 text-2xl font-semibold text-white transition-colors"
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}
