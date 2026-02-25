import { useState } from 'react'
import LoginPage from './pages/LoginPage'
import QRScannerPage from './pages/QRScannerPage'
import AssetInfoPage from './pages/AssetInfoPage'
import Toast from './components/Toast'
import { AssetInfo } from './api/jira'

type Screen = 'login' | 'scanner' | 'asset'

export default function App() {
  const [screen, setScreen] = useState<Screen>('login')
  const [assetInfo, setAssetInfo] = useState<AssetInfo | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  return (
    <div className="h-full flex flex-col bg-slate-900 overflow-hidden">
      {screen === 'login' && (
        <LoginPage onLoginSuccess={() => setScreen('scanner')} />
      )}

      {screen === 'scanner' && (
        <QRScannerPage
          onAssetFound={(info) => {
            setAssetInfo(info)
            setScreen('asset')
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {screen === 'asset' && assetInfo && (
        <AssetInfoPage
          assetInfo={assetInfo}
          onActionComplete={(msg, type) => {
            showToast(msg, type)
            setScreen('scanner')
          }}
          onBack={() => setScreen('scanner')}
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
