import { useEffect, useRef, useState, useCallback } from 'react'
import jsQR from 'jsqr'
import { getAssetItem, getIssueDetails, extractItemIdFromUrl, AssetItem, JiraIssue } from '../api/jira'
import { ScanMode, SCAN_MODE_LABELS, SCAN_MODE_COLORS } from '../types'
import { getCachedStream, setCachedStream, releaseCachedStream } from '../camera/cache'

// BarcodeDetector is natively available in Chrome on Android (hardware-accelerated).
// We use it when present and fall back to jsQR on iOS/Safari/Firefox.
interface NativeBarcodeDetector {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => NativeBarcodeDetector
  }
}

function createNativeDetector(): NativeBarcodeDetector | null {
  if (typeof window === 'undefined' || !window.BarcodeDetector) return null
  try {
    return new window.BarcodeDetector({ formats: ['qr_code'] })
  } catch {
    return null
  }
}
// Module-level singleton — instantiated once, reused across mounts
const nativeDetector = createNativeDetector()

export interface ScannedData {
  asset: AssetItem
  issue: JiraIssue
}

interface Props {
  mode: ScanMode
  userToken: string
  onScanned: (data: ScannedData) => void
  onError: (msg: string) => void
  onBack: () => void
}

type ScanState = 'permission' | 'requesting' | 'scanning' | 'loading' | 'error' | 'denied'

// jsQR scan interval: ~8 fps is plenty for QR detection and much lighter on the CPU
const JSQR_INTERVAL_MS = 120
// Max width fed to jsQR — QR codes don't need high resolution to decode
const JSQR_MAX_WIDTH = 640

export default function QRScannerPage({ mode, userToken, onScanned, onError, onBack }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const rafRef      = useRef<number>(0)
  const handledRef  = useRef(false)
  const lastScanRef = useRef<number>(0)

  const [scanState, setScanState] = useState<ScanState>('permission')
  const [statusMsg, setStatusMsg] = useState('')

  // Stop scanning loop but keep stream alive in module cache for next mount
  function pauseCamera() {
    cancelAnimationFrame(rafRef.current)
  }

  // Fully release stream (explicit back / scan success)
  function stopCamera() {
    cancelAnimationFrame(rafRef.current)
    releaseCachedStream()
    streamRef.current = null
  }

  const handleQrData = useCallback(async (data: string) => {
    if (handledRef.current) return
    handledRef.current = true
    setScanState('loading')
    setStatusMsg('QR detected…')

    const itemId = extractItemIdFromUrl(data)
    if (!itemId) {
      const msg = 'Not a valid Asset Manager QR code.'
      setScanState('error'); setStatusMsg(msg); onError(msg)
      setTimeout(() => {
        handledRef.current = false
        setScanState('scanning')
        setStatusMsg('Point camera at the QR code')
      }, 2500)
      return
    }

    try {
      setStatusMsg('Fetching asset info…')
      const asset = await getAssetItem(itemId, userToken)
      setStatusMsg(`Loading issue ${asset.jiraIssueId}…`)
      const issue = await getIssueDetails(asset.jiraIssueId, userToken)
      stopCamera()
      onScanned({ asset, issue })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load asset.'
      setScanState('error'); setStatusMsg(msg); onError(msg)
      setTimeout(() => {
        handledRef.current = false
        setScanState('scanning')
        setStatusMsg('Point camera at the QR code on the equipment')
        rafRef.current = requestAnimationFrame(scanFrame)
      }, 4000)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userToken])

  const scanFrame = useCallback(async () => {
    const video = videoRef.current
    if (!video || video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame); return
    }

    if (nativeDetector) {
      // ── Fast path: BarcodeDetector (Chrome on Android) ──────────────────
      // Reads directly from the video element — no canvas, no GPU→CPU readback.
      try {
        const barcodes = await nativeDetector.detect(video)
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          await handleQrData(barcodes[0].rawValue)
          return
        }
      } catch {
        // Single frame failure — just continue
      }
    } else {
      // ── Fallback path: jsQR (iOS / Safari / Firefox) ────────────────────
      // Throttle to JSQR_INTERVAL_MS so we don't saturate the JS thread.
      const now = performance.now()
      if (now - lastScanRef.current < JSQR_INTERVAL_MS) {
        rafRef.current = requestAnimationFrame(scanFrame); return
      }
      lastScanRef.current = now

      const canvas = canvasRef.current
      if (!canvas) { rafRef.current = requestAnimationFrame(scanFrame); return }

      // Downscale: QR codes decode fine at 640 px wide, saves ~75% pixel work vs 1280
      const scanW = Math.min(video.videoWidth, JSQR_MAX_WIDTH)
      const scanH = Math.round(video.videoHeight * (scanW / video.videoWidth))
      canvas.width  = scanW
      canvas.height = scanH
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) { rafRef.current = requestAnimationFrame(scanFrame); return }

      ctx.drawImage(video, 0, 0, scanW, scanH)
      const imageData = ctx.getImageData(0, 0, scanW, scanH)
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' })
      if (code?.data) {
        await handleQrData(code.data)
        return
      }
    }

    rafRef.current = requestAnimationFrame(scanFrame)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleQrData])

  // Called when the user taps "Enable Camera" on the permission screen,
  // or immediately if a cached stream already exists.
  async function requestCamera() {
    try {
      let stream = getCachedStream()

      if (!stream) {
        // Only show the spinner when we actually need to wait for getUserMedia
        setScanState('requesting')
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          })
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        }
        setCachedStream(stream)
      }

      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      video.setAttribute('playsinline', 'true')
      video.muted = true
      await video.play().catch(() => {})
      setScanState('scanning')
      setStatusMsg('Point camera at the QR code on the equipment')
      rafRef.current = requestAnimationFrame(scanFrame)
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
      if (msg.includes('denied') || msg.includes('not allowed') || msg.includes('permission')) {
        setScanState('denied')
      } else {
        setScanState('error')
        setStatusMsg(`Camera error: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  useEffect(() => {
    let cancelled = false

    async function init() {
      // If we already have a live cached stream, skip the permission screen and go straight in
      if (getCachedStream()) {
        if (!cancelled) requestCamera()
        return
      }

      // Check permission state without triggering a prompt (Safari 16+ / Chrome)
      try {
        if (navigator.permissions) {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
          if (result.state === 'granted') {
            if (!cancelled) requestCamera()
            return
          }
          if (result.state === 'denied') {
            if (!cancelled) setScanState('denied')
            return
          }
        }
      } catch {
        // navigator.permissions not supported — fall through to permission screen
      }

      // Show our in-context permission screen before the iOS dialog fires
      if (!cancelled) setScanState('permission')
    }

    init()

    return () => { cancelled = true; pauseCamera() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const modeLabel = SCAN_MODE_LABELS[mode]
  const modeColor = SCAN_MODE_COLORS[mode]

  const cornerColor =
    mode === 'checkin'  ? 'border-emerald-400' :
    mode === 'checkout' ? 'border-blue-400'    : 'border-violet-400'

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-black relative">
      <div className="absolute top-0 inset-x-0 z-10 px-4 pt-safe-top pt-4 pb-4 flex items-center gap-3"
        style={{ background: 'linear-gradient(to bottom,rgba(15,23,42,.95) 0%,rgba(15,23,42,.65) 80%,transparent 100%)' }}>
        <button onClick={() => { stopCamera(); onBack() }}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/50 backdrop-blur active:bg-black/70 shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/60 uppercase tracking-wider">Active action</p>
          <h1 className={`font-bold text-lg leading-tight ${modeColor}`}>{modeLabel}</h1>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-2.5 h-2.5 rounded-full ${
            scanState === 'scanning'   ? 'bg-green-400 animate-pulse' :
            scanState === 'loading'    ? 'bg-yellow-400 animate-pulse' :
            scanState === 'requesting' ? 'bg-slate-400 animate-pulse' : 'bg-red-400'
          }`} />
          <span className="text-sm text-white/60 capitalize">{scanState}</span>
        </div>
      </div>

      {/* Video element is the live viewfinder — shown directly, no canvas copy needed */}
      <video
        ref={videoRef}
        className="flex-1 w-full object-cover"
        playsInline
        muted
        autoPlay
        style={{ display: scanState === 'scanning' || scanState === 'loading' ? 'block' : 'none' }}
      />
      {/* Hidden canvas used only by the jsQR fallback path (iOS/Safari) */}
      <canvas ref={canvasRef} className="hidden" />

      {(scanState === 'scanning' || scanState === 'loading') && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-64 h-64">
            {['top-0 left-0 border-t-4 border-l-4 rounded-tl-xl',
              'top-0 right-0 border-t-4 border-r-4 rounded-tr-xl',
              'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl',
              'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl',
            ].map((cls, i) => <div key={i} className={`absolute w-10 h-10 ${cornerColor} ${cls}`} />)}
          </div>
        </div>
      )}

      {/* ── Permission request screen (shown before iOS dialog fires) ── */}
      {scanState === 'permission' && (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 px-8 gap-6">
          <div className="w-20 h-20 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="text-center">
            <h2 className="text-white font-bold text-xl mb-2">Camera Access Needed</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Promotor OPS needs your camera to scan QR codes on equipment.
            </p>
          </div>
          <div className="bg-blue-900/40 border border-blue-700/50 rounded-2xl px-5 py-4 w-full max-w-xs">
            <p className="text-blue-200 text-sm leading-relaxed text-center">
              When your browser asks, tap <span className="text-white font-bold">"Allow"</span> to grant access.
            </p>
          </div>
          <button
            onClick={requestCamera}
            className="w-full max-w-xs py-4 rounded-2xl bg-blue-600 active:bg-blue-500 text-white font-semibold text-base"
          >
            Enable Camera
          </button>
        </div>
      )}

      {/* ── Requesting (spinner while getUserMedia resolves) ── */}
      {scanState === 'requesting' && (
        <div className="flex-1 flex items-center justify-center bg-slate-900 px-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-300 text-sm">Starting camera…</p>
          </div>
        </div>
      )}

      {/* ── Permission denied screen ── */}
      {scanState === 'denied' && (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 px-8 gap-5">
          <div className="w-16 h-16 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div className="text-center">
            <h2 className="text-white font-bold text-lg mb-2">Camera Access Blocked</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Camera permission was denied. To fix this:
            </p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 w-full max-w-xs space-y-2">
            <p className="text-slate-300 text-sm leading-relaxed">
              Open your browser's site settings and allow camera access for this page, then return here.
            </p>
          </div>
          <button
            onClick={requestCamera}
            className="w-full max-w-xs py-3 rounded-2xl bg-slate-700 active:bg-slate-600 text-white font-semibold text-sm"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Generic error ── */}
      {scanState === 'error' && (
        <div className="flex-1 flex items-center justify-center bg-slate-900 px-8">
          <p className="text-red-400 text-sm text-center leading-relaxed">{statusMsg}</p>
        </div>
      )}

      {scanState === 'loading' && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 z-20">
          <div className="w-14 h-14 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-white text-sm font-medium text-center px-8">{statusMsg}</p>
        </div>
      )}

      {scanState === 'scanning' && (
        <div className="absolute bottom-0 inset-x-0 z-10 px-4 py-3 pb-safe-bottom flex items-center justify-center"
          style={{ background: 'linear-gradient(to top,rgba(0,0,0,.75) 0%,transparent 100%)' }}>
          <p className="text-white/80 text-sm text-center font-medium">{statusMsg}</p>
        </div>
      )}
    </div>
  )
}
