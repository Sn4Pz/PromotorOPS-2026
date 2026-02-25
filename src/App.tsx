import { useState } from 'react'
import LoginPage from './pages/LoginPage'
import MainMenuPage from './pages/MainMenuPage'
import QRScannerPage, { ScannedData } from './pages/QRScannerPage'
import AssetInfoPage from './pages/AssetInfoPage'
import Toast from './components/Toast'
import { ScanMode } from './types'
import { StoredUser, clearUser } from './auth/storage'
import { releaseCachedStream } from './camera/cache'

type Screen = 'login' | 'menu' | 'scanner' | 'asset'

export default function App() {
  const [screen, setScreen]     = useState<Screen>('login')
  const [user, setUser]         = useState<StoredUser | null>(null)
  const [scanMode, setScanMode] = useState<ScanMode>('view')
  const [scanned, setScanned]   = useState<ScannedData | null>(null)
  const [toast, setToast]       = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  function handleLoginSuccess(u: StoredUser) {
    setUser(u)
    setScreen('menu')
    // Camera permission is requested only when the user opens the scanner,
    // not at login time. This keeps the permission dialog contextual and
    // maximises the chance that iOS persists the grant.
  }

  return (
    <div className="h-full flex flex-col bg-slate-900 overflow-hidden">
      {screen === 'login' && (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}

      {screen === 'menu' && user && (
        <MainMenuPage
          displayName={user.displayName || user.username}
          onSelect={(mode) => { setScanMode(mode); setScreen('scanner') }}
          onLogout={() => {
            releaseCachedStream()
            setUser(null); setScanned(null)
            setScreen('login'); clearUser()
          }}
        />
      )}

      {screen === 'scanner' && user && (
        <QRScannerPage
          mode={scanMode}
          userToken={user.jiraToken}
          onScanned={(data) => { setScanned(data); setScreen('asset') }}
          onError={(msg) => showToast(msg, 'error')}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'asset' && scanned && user && (
        <AssetInfoPage
          asset={scanned.asset}
          issue={scanned.issue}
          mode={scanMode}
          userToken={user.jiraToken}
          onActionComplete={(msg, type) => { showToast(msg, type); setScreen('menu') }}
          onBack={() => setScreen('menu')}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  )
}
