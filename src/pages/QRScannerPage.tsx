import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { getAssetInfo, extractItemIdFromUrl, AssetInfo } from '../api/jira'
import { ScanMode, SCAN_MODE_LABELS, SCAN_MODE_COLORS } from '../types'

interface Props {
  mode: ScanMode
  userToken: string
  onAssetFound: (info: AssetInfo) => void
  onError: (msg: string) => void
  onBack: () => void
}

type ScanState = 'scanning' | 'loading' | 'error'

export default function QRScannerPage({ mode, userToken, onAssetFound, onError, onBack }: Props) {
  const scannerRef  = useRef<Html5Qrcode | null>(null)
  const handledRef  = useRef(false)
  const [scanState, setScanState] = useState<ScanState>('scanning')
  const [statusMsg, setStatusMsg] = useState('Point camera at the QR code on the equipment')

  useEffect(() => {
    const qr = new Html5Qrcode('qr-reader')
    scannerRef.current = qr

    qr.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
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
          setTimeout(() => {
            handledRef.current = false
            setScanState('scanning')
            setStatusMsg('Point camera at the QR code on the equipment')
          }, 2000)
          return
        }

        try {
          const info = await getAssetInfo(itemId, userToken)
          await qr.stop()
          onAssetFound(info)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed to fetch asset info.'
          setScanState('error')
          setStatusMsg(msg)
          onError(msg)
          setTimeout(() => {
            handledRef.current = false
            setScanState('scanning')
            setStatusMsg('Point camera at the QR code on the equipment')
          }, 2500)
        }
      },
      () => { /* per-frame scan failure — ignore */ }
    ).catch((err: Error) => {
      setScanState('error')
      setStatusMsg(`Camera error: ${err?.message ?? err}`)
    })

    return () => {
      if (qr.isScanning) qr.stop().catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const modeLabel = SCAN_MODE_LABELS[mode]
  const modeColor = SCAN_MODE_COLORS[mode]

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="px-4 pt-safe-top pt-4 pb-3 flex items-center gap-3 border-b border-slate-700">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-700 active:bg-slate-600 transition-colors shrink-0"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Active action</p>
          <h1 className={`font-bold text-base leading-tight ${modeColor}`}>{modeLabel}</h1>
        </div>

        {/* Status dot */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-2 h-2 rounded-full ${
            scanState === 'scanning' ? 'bg-green-400 animate-pulse' :
            scanState === 'loading'  ? 'bg-yellow-400 animate-pulse' :
                                       'bg-red-400'
          }`} />
          <span className="text-xs text-slate-400 capitalize">{scanState}</span>
        </div>
      </div>

      {/* Camera viewport */}
      <div className="flex-1 relative overflow-hidden bg-black">
        <div id="qr-reader" className="w-full h-full" />

        {/* Corner frame overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-64 h-64">
            {[
              'top-0 left-0 border-t-4 border-l-4 rounded-tl-xl',
              'top-0 right-0 border-t-4 border-r-4 rounded-tr-xl',
              'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl',
              'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl',
            ].map((cls, i) => (
              <div key={i} className={`absolute w-10 h-10 border-brand-400 ${cls}`} />
            ))}
            {/* Scan line animation */}
            {scanState === 'scanning' && (
              <div className="absolute inset-x-0 top-0 h-0.5 bg-brand-400 opacity-70 animate-[scanline_2s_ease-in-out_infinite]" />
            )}
          </div>
        </div>

        {/* Loading overlay */}
        {scanState === 'loading' && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-sm font-medium">Fetching asset info…</p>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="px-4 py-3 pb-safe-bottom border-t border-slate-700 min-h-[60px] flex items-center justify-center">
        <p className={`text-sm text-center ${
          scanState === 'error'   ? 'text-red-400' :
          scanState === 'loading' ? 'text-yellow-300' : 'text-slate-300'
        }`}>
          {statusMsg}
        </p>
      </div>
    </div>
  )
}
