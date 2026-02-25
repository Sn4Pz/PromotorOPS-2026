import { ScanMode } from '../types'

interface Props {
  displayName: string
  onSelect: (mode: ScanMode) => void
  onLogout: () => void
}

type Tile = {
  mode: ScanMode | 'logout'
  label: string
  icon: React.ReactNode
  color: string
  iconBg: string
}

const tiles: Tile[] = [
  {
    mode: 'checkin',
    label: 'Check In',
    icon: (
      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
    color: 'bg-emerald-800/70 border-emerald-600/60 active:bg-emerald-700/80',
    iconBg: 'bg-emerald-600',
  },
  {
    mode: 'checkout',
    label: 'Check Out',
    icon: (
      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
    color: 'bg-blue-800/70 border-blue-600/60 active:bg-blue-700/80',
    iconBg: 'bg-blue-600',
  },
  {
    mode: 'view',
    label: 'Scan Asset',
    icon: (
      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
    ),
    color: 'bg-violet-800/70 border-violet-600/60 active:bg-violet-700/80',
    iconBg: 'bg-violet-600',
  },
  {
    mode: 'logout',
    label: 'Logout',
    icon: (
      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
          d="M17 16l4-4m0 0l-4-4m4 4H7M13 4H6a2 2 0 00-2 2v12a2 2 0 002 2h7" />
      </svg>
    ),
    color: 'bg-slate-700/70 border-slate-600/60 active:bg-slate-600/80',
    iconBg: 'bg-slate-500',
  },
]

export default function MainMenuPage({ displayName, onSelect, onLogout }: Props) {
  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="px-5 pt-safe-top pt-6 pb-2 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-700 mb-3 shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h4l3 8 4-16 3 8h4" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white">ProMotor OPS</h1>
        <p className="text-slate-400 text-sm mt-0.5">{displayName}</p>
      </div>

      {/* 2×2 grid — vertically centred */}
      <div className="flex-1 flex items-center justify-center px-5 pb-safe-bottom">
        <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
          {tiles.map((tile) => (
            <button
              key={tile.mode}
              onClick={() => tile.mode === 'logout' ? onLogout() : onSelect(tile.mode as ScanMode)}
              className={`
                flex flex-col items-center justify-center gap-3
                aspect-square rounded-3xl border
                ${tile.color}
                active:scale-95 transition-transform duration-100
                shadow-lg
              `}
            >
              <div className={`w-16 h-16 rounded-2xl ${tile.iconBg} flex items-center justify-center text-white shadow`}>
                {tile.icon}
              </div>
              <span className="text-white font-semibold text-base leading-tight text-center px-2">
                {tile.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
