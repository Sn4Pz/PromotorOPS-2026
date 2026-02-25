import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { getAssetInfo, extractItemIdFromUrl, AssetInfo } from '../api/jira'

interface Props {
  onAssetFound: (info: AssetInfo) => void
  onError: (msg: string) => void
}

type ScanState = 'idle' | 'scanning' | 'loading' | 'error'

export default function QRScannerPage({ onAssetFound, onError }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [statusMsg, setStatusMsg] = useState<string>('')
  const handledRef = useRef(false)

  useEffect(() => {
    const qr = new Html5Qrcode('qr-reader')
    scannerRef.current = qr

    setScanState('scanning')
    setStatusMsg('Point camera at the QR code on the equipment')

    qr.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      async (decodedText) => {
        if (handledRef.current) return
        handledRef.current = true

        setScanState('loading')
        setStatusMsg('QR detected — fetching asset info…')

        const itemId = extractItemIdFromUrl(decodedText)
        if (!itemId) {
          setScanState('error')
          setStatusMsg('Not a valid Asset Manager QR code.')
          onError('Not a valid Asset Manager QR code.')
          handledRef.current = false
          setScanState('scanning')
          setStatusMsg('Point camera at the QR code on the equipment')
          return
        }

        try {
          const info = await getAssetInfo(itemId)
          await qr.stop()
          onAssetFound(info)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed to fetch asset info.'
          setScanState('error')
          setStatusMsg(msg)
          onError(msg)
          handledRef.current = false
          setScanState('scanning')
          setStatusMsg('Point camera at the QR code on the equipment')
        }
      },
      (_errorMsg) => {
        // per-frame scan failure — ignore
      }
    ).catch((err) => {
      setScanState('error')
      setStatusMsg(`Camera error: ${err?.message ?? err}`)
    })

    return () => {
      qr.isScanning && qr.stop().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="px-4 pt-safe-top pt-4 pb-3 flex items-center gap-3 border-b border-slate-700">
        <div className="w-8 h-8 rounded-lg bg-brand-700 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        </div>
        <div>
          <h1 className="font-semibold text-white leading-tight">Scan Equipment QR</h1>
          <p className="text-xs text-slate-400">ProMotor OPS</p>
        </div>

        {/* Status indicator */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${
            scanState === 'scanning' ? 'bg-green-400 animate-pulse' :
            scanState === 'loading'  ? 'bg-yellow-400 animate-pulse' :
            scanState === 'error'    ? 'bg-red-400' : 'bg-slate-500'
          }`} />
          <span className="text-xs text-slate-400 capitalize">{scanState}</span>
        </div>
      </div>

      {/* Camera viewport */}
      <div className="flex-1 relative overflow-hidden">
        <div id="qr-reader" className="w-full h-full" />

        {/* Overlay frame */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-64 h-64">
            {/* Corner markers */}
            {[
              'top-0 left-0 border-t-4 border-l-4 rounded-tl-lg',
              'top-0 right-0 border-t-4 border-r-4 rounded-tr-lg',
              'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg',
              'bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg',
            ].map((cls, i) => (
              <div key={i} className={`absolute w-8 h-8 border-brand-400 ${cls}`} />
            ))}
          </div>
        </div>

        {/* Loading overlay */}
        {scanState === 'loading' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-sm font-medium">Fetching asset…</p>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="px-4 py-3 pb-safe-bottom border-t border-slate-700 min-h-[60px] flex items-center justify-center">
        <p className={`text-sm text-center ${
          scanState === 'error' ? 'text-red-400' :
          scanState === 'loading' ? 'text-yellow-300' : 'text-slate-300'
        }`}>
          {statusMsg}
        </p>
      </div>
    </div>
  )
}
