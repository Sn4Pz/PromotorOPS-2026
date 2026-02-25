import { ScanMode } from '../types'

interface Props {
  displayName: string
  onSelect: (mode: ScanMode) => void
  onLogout: () => void
}

type ActionItem = {
  mode: ScanMode
  label: string
  sub: string
  icon: React.ReactNode
  color: string
  border: string
  iconBg: string
}

const actionItems: ActionItem[] = [
  {
    mode: 'checkin',
    label: 'Check In',
    sub: 'Scan equipment to mark as received',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
    color: 'bg-emerald-800/60',
    border: 'border-emerald-600/50',
    iconBg: 'bg-emerald-600',
  },
  {
    mode: 'checkout',
    label: 'Check Out',
    sub: 'Scan equipment to mark as returned',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
    color: 'bg-blue-800/60',
    border: 'border-blue-600/50',
    iconBg: 'bg-blue-600',
  },
  {
    mode: 'view',
    label: 'Scan Asset / Issue',
    sub: 'Look up asset or issue information',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
    ),
    color: 'bg-violet-800/60',
    border: 'border-violet-600/50',
    iconBg: 'bg-violet-600',
  },
]

export default function MainMenuPage({ displayName, onSelect, onLogout }: Props) {
  return (
    <div className="flex flex-col h-full bg-slate-900">

      {/* ── Top bar ── */}
      <div className="shrink-0 px-5 pt-safe-top pt-4 pb-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.png" alt="Promotor" className="w-9 h-9 rounded-xl object-contain" />
          <h1 className="font-display font-extrabold text-2xl tracking-tight text-white">
            Promotor OPS
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold leading-none">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-slate-400 text-sm font-medium max-w-[130px] truncate">
            {displayName}
          </span>
        </div>
      </div>

      {/* ── Action cards — stretch to fill available space, outer padding keeps them from being too tall ── */}
      <div className="flex-1 flex flex-col px-5 gap-5 py-14">
        {actionItems.map((item) => (
          <button
            key={item.mode}
            onClick={() => onSelect(item.mode)}
            className={`
              flex-1 w-full flex items-center gap-5 px-6 rounded-3xl border
              ${item.color} ${item.border}
              active:scale-[0.97] transition-transform duration-100
              text-left shadow-lg
            `}
          >
            <div className={`w-16 h-16 rounded-2xl ${item.iconBg} flex items-center justify-center shrink-0 text-white shadow`}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-xl leading-tight">{item.label}</p>
              <p className="text-slate-300/70 text-base mt-2 leading-snug">{item.sub}</p>
            </div>
            <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>

      {/* ── Sign out ── */}
      <div className="shrink-0 px-5 pb-safe-bottom pb-6 flex items-center justify-center">
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-700 text-slate-400 active:text-white active:border-slate-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7M13 4H6a2 2 0 00-2 2v12a2 2 0 002 2h7" />
          </svg>
          <span className="text-sm font-medium">Sign out</span>
        </button>
      </div>

    </div>
  )
}
