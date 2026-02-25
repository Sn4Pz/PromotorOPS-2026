import { ScanMode } from '../types'

interface Props {
  displayName: string
  onSelect: (mode: ScanMode) => void
  onLogout: () => void
}

type MenuItem = {
  mode: ScanMode | 'logout'
  label: string
  icon: React.ReactNode
  color: string
  border: string
  iconBg: string
}

const menuItems: MenuItem[] = [
  {
    mode: 'checkin',
    label: 'Check In',
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
    label: 'Scan Issue / Asset',
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
  {
    mode: 'logout',
    label: 'Logout',
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
          d="M17 16l4-4m0 0l-4-4m4 4H7M13 4H6a2 2 0 00-2 2v12a2 2 0 002 2h7" />
      </svg>
    ),
    color: 'bg-slate-700/60',
    border: 'border-slate-600/50',
    iconBg: 'bg-slate-500',
  },
]

export default function MainMenuPage({ displayName, onSelect, onLogout }: Props) {
  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="px-5 pt-safe-top pt-5 pb-4 text-center">
        <img
          src="/favicon.png"
          alt="ProMotor"
          className="w-14 h-14 mx-auto mb-2 rounded-xl shadow-lg object-contain"
        />
        <h1 className="font-display font-extrabold text-2xl tracking-tight text-white">ProMotor OPS</h1>
        <p className="text-slate-400 text-sm mt-0.5">{displayName}</p>
      </div>

      {/* Vertical list — centred */}
      <div className="flex-1 flex items-center justify-center px-5 pb-safe-bottom pb-6">
        <div className="flex flex-col gap-3 w-full max-w-sm">
          {menuItems.map((item) => (
            <button
              key={item.mode}
              onClick={() => item.mode === 'logout' ? onLogout() : onSelect(item.mode as ScanMode)}
              className={`
                w-full flex items-center gap-4 px-5 py-4 rounded-2xl border
                ${item.color} ${item.border}
                active:scale-[0.97] transition-transform duration-100
                text-left shadow-lg
              `}
            >
              <div className={`w-12 h-12 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0 text-white shadow`}>
                {item.icon}
              </div>
              <span className="text-white font-semibold text-lg leading-tight">
                {item.label}
              </span>
              {item.mode !== 'logout' && (
                <svg className="w-5 h-5 text-slate-400 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
