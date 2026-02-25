import { useEffect, useRef, useState, useCallback } from 'react'
import jsQR from 'jsqr'
import { getAssetInfo, extractItemIdFromUrl, AssetInfo } from '../api/jira'
import { ScanMode, SCAN_MODE_LABELS, SCAN_MODE_COLORS } from '../types'

interface Props {
  mode: ScanMode
  userToken: string
  onAssetFound: (info: AssetInfo) => void
  onError: (msg: string) => void
  onBack: () => void
}

type ScanState = 'requesting' | 'scanning' | 'loading' | 'error'

export default function QRScannerPage({ mode, userToken, onAssetFound, onError, onBack }: Props) {
  const videoRef     = useRef<HTMLVideoElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const streamRef    = useRef<MediaStream | null>(null)
  const rafRef       = useRef<number>(0)
  const handledRef   = useRef(false)

  const [scanState, setScanState] = useState<ScanState>('requesting')
  const [statusMsg, setStatusMsg] = useState('Requesting camera access…')

  // ── Camera teardown ────────────────────────────────────────────────────
  function stopCamera() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  // ── Frame scanning loop ────────────────────────────────────────────────
  const scanFrame = useCallback(async () => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame)
      return
    }

    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) { rafRef.current = requestAnimationFrame(scanFrame); return }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    })

    if (code?.data && !handledRef.current) {
      handledRef.current = true
      setScanState('loading')
      setStatusMsg('QR detected — fetching asset info…')

      const itemId = extractItemIdFromUrl(code.data)
      if (!itemId) {
        const msg = 'Not a valid Asset Manager QR code.'
        setScanState('error')
        setStatusMsg(msg)
        onError(msg)
        setTimeout(() => {
          handledRef.current = false
          setScanState('scanning')
          setStatusMsg('Point camera at the QR code on the equipment')
          rafRef.current = requestAnimationFrame(scanFrame)
        }, 2000)
        return
      }

      try {
        const info = await getAssetInfo(itemId, userToken)
        stopCamera()
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
          rafRef.current = requestAnimationFrame(scanFrame)
        }, 2500)
      }
      return
    }

    rafRef.current = requestAnimationFrame(scanFrame)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userToken])

  // ── Camera start ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      try {
        // iOS Safari requires 'exact' facingMode or it defaults to front camera.
        // We try 'environment' first, then fall back to any camera.
        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width:  { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          })
        } catch {
          // Fallback: any camera
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        }

        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }

        streamRef.current = stream
        const video = videoRef.current!
        video.srcObject = stream

        // 'playsinline' is critical for iOS — without it the video goes
        // full-screen and breaks the layout.
        video.setAttribute('playsinline', 'true')
        video.setAttribute('muted', 'true')
        video.muted = true

        await video.play()

        setScanState('scanning')
        setStatusMsg('Point camera at the QR code on the equipment')
        rafRef.current = requestAnimationFrame(scanFrame)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setScanState('error')
        setStatusMsg(
          msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')
            ? 'Camera permission denied. Please allow camera access in your browser settings.'
            : `Camera error: ${msg}`
        )
      }
    }

    startCamera()
    return () => {
      cancelled = true
      stopCamera()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const modeLabel = SCAN_MODE_LABELS[mode]
  const modeColor = SCAN_MODE_COLORS[mode]

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="absolute top-0 inset-x-0 z-10 px-4 pt-safe-top pt-4 pb-3 flex items-center gap-3"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)' }}>
        <button
          onClick={() => { stopCamera(); onBack() }}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur active:bg-black/60 transition-colors shrink-0"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/60 uppercase tracking-wider">Active action</p>
          <h1 className={`font-bold text-base leading-tight ${modeColor}`}>{modeLabel}</h1>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-2 h-2 rounded-full ${
            scanState === 'scanning'   ? 'bg-green-400 animate-pulse' :
            scanState === 'loading'    ? 'bg-yellow-400 animate-pulse' :
            scanState === 'requesting' ? 'bg-slate-400 animate-pulse' :
                                         'bg-red-400'
          }`} />
          <span className="text-xs text-white/60 capitalize">{scanState}</span>
        </div>
      </div>

      {/* Full-screen camera feed */}
      {/* Video is hidden — we render the canvas instead so we control the frame */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        autoPlay
      />
      <canvas
        ref={canvasRef}
        className="flex-1 w-full object-cover"
        style={{ display: scanState === 'requesting' || scanState === 'error' ? 'none' : 'block' }}
      />

      {/* Corner frame overlay */}
      {(scanState === 'scanning' || scanState === 'loading') && (
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
            {scanState === 'scanning' && (
              <div className="absolute inset-x-0 top-0 h-0.5 bg-brand-400 opacity-80 animate-scanline" />
            )}
          </div>
        </div>
      )}

      {/* Requesting / error placeholder */}
      {(scanState === 'requesting' || scanState === 'error') && (
        <div className="flex-1 flex items-center justify-center bg-slate-900">
          {scanState === 'requesting' && (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-300 text-sm">Requesting camera…</p>
            </div>
          )}
        </div>
      )}

      {/* Loading overlay */}
      {scanState === 'loading' && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 z-20">
          <div className="w-14 h-14 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-white text-sm font-medium">Fetching asset info…</p>
        </div>
      )}

      {/* Status bar */}
      <div className="absolute bottom-0 inset-x-0 z-10 px-4 py-3 pb-safe-bottom flex items-center justify-center min-h-[56px]"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)' }}>
        <p className={`text-sm text-center font-medium ${
          scanState === 'error' ? 'text-red-400' :
          scanState === 'loading' ? 'text-yellow-300' : 'text-white/80'
        }`}>
          {statusMsg}
        </p>
      </div>
    </div>
  )
}
