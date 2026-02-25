import { useState } from 'react'
import LoginPage from './pages/LoginPage'
import MainMenuPage from './pages/MainMenuPage'
import QRScannerPage from './pages/QRScannerPage'
import AssetInfoPage from './pages/AssetInfoPage'
import Toast from './components/Toast'
import { AssetInfo } from './api/jira'
import { ScanMode } from './types'
import { StoredUser, clearUser } from './auth/storage'

type Screen = 'login' | 'menu' | 'scanner' | 'asset'

export default function App() {
  const [screen, setScreen]       = useState<Screen>('login')
  const [user, setUser]           = useState<StoredUser | null>(null)
  const [scanMode, setScanMode]   = useState<ScanMode>('view')
  const [assetInfo, setAssetInfo] = useState<AssetInfo | null>(null)
  const [toast, setToast]         = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  function handleLoginSuccess(loggedInUser: StoredUser) {
    setUser(loggedInUser)
    setScreen('menu')
  }

  function handleMenuSelect(mode: ScanMode) {
    setScanMode(mode)
    setScreen('scanner')
  }

  function handleLogout() {
    // Clear the in-memory session but keep the stored PIN so they
    // can log back in via PIN next time (unless they switch accounts).
    setUser(null)
    setAssetInfo(null)
    setScreen('login')
    clearUser()
  }

  return (
    <div className="h-full flex flex-col bg-slate-900 overflow-hidden">
      {screen === 'login' && (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}

      {screen === 'menu' && user && (
        <MainMenuPage
          displayName={user.displayName || user.username}
          onSelect={handleMenuSelect}
          onLogout={handleLogout}
        />
      )}

      {screen === 'scanner' && user && (
        <QRScannerPage
          mode={scanMode}
          userToken={user.jiraToken}
          onAssetFound={(info) => {
            setAssetInfo(info)
            setScreen('asset')
          }}
          onError={(msg) => showToast(msg, 'error')}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'asset' && assetInfo && user && (
        <AssetInfoPage
          assetInfo={assetInfo}
          mode={scanMode}
          onActionComplete={(msg, type) => {
            showToast(msg, type)
            setScreen('menu')
          }}
          onBack={() => setScreen('menu')}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  )
}
