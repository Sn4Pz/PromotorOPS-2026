import { useState } from 'react'
import LoginPage from './pages/LoginPage'
import MainMenuPage from './pages/MainMenuPage'
import QRScannerPage from './pages/QRScannerPage'
import AssetInfoPage from './pages/AssetInfoPage'
import Toast from './components/Toast'
import { AssetInfo } from './api/jira'
import { ScanMode } from './types'

type Screen = 'login' | 'menu' | 'scanner' | 'asset'

export default function App() {
  const [screen, setScreen]       = useState<Screen>('login')
  const [scanMode, setScanMode]   = useState<ScanMode>('view')
  const [assetInfo, setAssetInfo] = useState<AssetInfo | null>(null)
  const [toast, setToast]         = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  function handleMenuSelect(mode: ScanMode) {
    setScanMode(mode)
    setScreen('scanner')
  }

  function handleLogout() {
    setScreen('login')
    setAssetInfo(null)
  }

  return (
    <div className="h-full flex flex-col bg-slate-900 overflow-hidden">
      {screen === 'login' && (
        <LoginPage onLoginSuccess={() => setScreen('menu')} />
      )}

      {screen === 'menu' && (
        <MainMenuPage
          onSelect={handleMenuSelect}
          onLogout={handleLogout}
        />
      )}

      {screen === 'scanner' && (
        <QRScannerPage
          mode={scanMode}
          onAssetFound={(info) => {
            setAssetInfo(info)
            setScreen('asset')
          }}
          onError={(msg) => showToast(msg, 'error')}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'asset' && assetInfo && (
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
