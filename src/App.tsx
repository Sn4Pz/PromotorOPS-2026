import { useState } from 'react'
import LoginPage from './pages/LoginPage'
import MainMenuPage from './pages/MainMenuPage'
import QRScannerPage from './pages/QRScannerPage'
import AssetInfoPage from './pages/AssetInfoPage'
import Toast from './components/Toast'
import { JiraIssue } from './api/jira'
import { ScanMode } from './types'
import { StoredUser, clearUser } from './auth/storage'

type Screen = 'login' | 'menu' | 'scanner' | 'asset'

export default function App() {
  const [screen, setScreen]     = useState<Screen>('login')
  const [user, setUser]         = useState<StoredUser | null>(null)
  const [scanMode, setScanMode] = useState<ScanMode>('view')
  const [issue, setIssue]       = useState<JiraIssue | null>(null)
  const [toast, setToast]       = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
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
    setUser(null)
    setIssue(null)
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
          onIssueFound={(found) => {
            setIssue(found)
            setScreen('asset')
          }}
          onError={(msg) => showToast(msg, 'error')}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'asset' && issue && user && (
        <AssetInfoPage
          issue={issue}
          mode={scanMode}
          onActionComplete={(msg, type) => {
            showToast(msg, type)
            setScreen('menu')
          }}
          onBack={() => setScreen('menu')}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  )
}
