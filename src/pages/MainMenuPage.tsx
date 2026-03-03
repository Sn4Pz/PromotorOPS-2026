import { ScanMode } from '../types'

interface Props {
  displayName: string
  username: string
  avatarUrl?: string
  jiraToken: string
  onSelect: (mode: ScanMode) => void
  onLogout: () => void
}

type ActionItem = {
  mode: ScanMode
  label: string
  sub: React.ReactNode
  icon: React.ReactNode
  color: string
  border: string
  iconBg: string
  glow: string
}

const actionItems: ActionItem[] = [
  {
    mode: 'checkin',
    label: 'Check In',
    sub: <>Scan equipment to mark as<br /><span className="font-bold uppercase">work in progress</span></>,
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
    color: 'bg-gradient-to-br from-emerald-900/70 via-emerald-800/50 to-emerald-800/35',
    border: 'border-emerald-600/20',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    glow: '0 2px 12px -4px rgba(16, 185, 129, 0.15)',
  },
  {
    mode: 'checkout',
    label: 'Check Out',
    sub: <>Scan equipment to mark as<br /><span className="font-bold uppercase">returned</span></>,
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
    color: 'bg-gradient-to-br from-blue-900/70 via-blue-800/50 to-blue-800/35',
    border: 'border-blue-600/20',
    iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
    glow: '0 2px 12px -4px rgba(59, 130, 246, 0.15)',
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
    color: 'bg-gradient-to-br from-violet-900/70 via-violet-800/50 to-violet-800/35',
    border: 'border-violet-600/20',
    iconBg: 'bg-gradient-to-br from-violet-500 to-violet-600',
    glow: '0 2px 12px -4px rgba(139, 92, 246, 0.15)',
  },
]

function Avatar({ displayName, avatarUrl }: { displayName: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName}
        className="w-8 h-8 rounded-full object-cover shrink-0"
      />
    )
  }

  return (
    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
      <span className="text-white text-sm font-bold leading-none">
        {displayName.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

export default function MainMenuPage({ displayName, username, avatarUrl, jiraToken, onSelect, onLogout }: Props) {
  const profileDest = `/secure/ViewProfile.jspa?name=${encodeURIComponent(username)}`

  function openProfile() {
    const decoded = atob(jiraToken)
    const sep = decoded.indexOf(':')
    const user = decoded.substring(0, sep)
    const pass = decoded.substring(sep + 1)

    const form = document.createElement('form')
    form.method = 'POST'
    form.action = `https://jira.promotor.com/login.jsp`
    form.target = '_blank'
    form.style.display = 'none'

    for (const [k, v] of [['os_username', user], ['os_password', pass], ['os_destination', profileDest]]) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = k
      input.value = v
      form.appendChild(input)
    }

    document.body.appendChild(form)
    form.submit()
    document.body.removeChild(form)
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-900">

      {/* ── Top bar ── */}
      <div className="shrink-0 px-5 pt-safe-top py-3 flex items-center justify-center border-b border-slate-800">
        <img src="/favicon.png" alt="Promotor" className="w-9 h-9 rounded-xl object-contain shrink-0" />
        <h1 className="font-display font-extrabold text-xl tracking-tight text-white whitespace-nowrap ml-2.5">
          Promotor OPS
        </h1>
      </div>

      {/* ── Middle: cards centered ── */}
      <div className="flex-1 min-h-0 flex flex-col items-stretch justify-center px-4 gap-3">
        {actionItems.map((item) => (
          <button
            key={item.mode}
            onClick={() => onSelect(item.mode)}
            className={`
              flex-1 w-full max-h-[8.5rem] flex items-center gap-4 px-5 rounded-3xl border
              ${item.color} ${item.border}
              active:scale-[0.97] transition-all duration-200
              text-left relative overflow-hidden
            `}
            style={{ boxShadow: item.glow }}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.04] pointer-events-none" />
            <div className={`w-12 h-12 rounded-2xl ${item.iconBg} flex items-center justify-center shrink-0 text-white shadow-lg relative`}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0 relative">
              <p className="text-white font-bold text-base leading-tight">{item.label}</p>
              <p className="text-slate-300/70 text-sm mt-0.5 leading-snug">{item.sub}</p>
            </div>
            <svg className="w-5 h-5 text-slate-400 shrink-0 relative" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>

      {/* ── Bottom bar ── */}
      <div className="shrink-0 px-5 pt-2 pb-2 flex flex-col items-center gap-2"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <button
          onClick={openProfile}
          className="flex items-center gap-2.5 active:opacity-70"
        >
          <Avatar displayName={displayName} avatarUrl={avatarUrl} />
          <span className="text-white text-sm font-medium">{displayName}</span>
        </button>
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
