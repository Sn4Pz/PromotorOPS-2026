import { useState, useEffect } from 'react'
import {
  AssetItem, JiraIssue, JiraAttachment, JiraComment,
  transitionIssue, extractJiraError,
} from '../api/jira'
import { ScanMode, SCAN_MODE_LABELS, SCAN_MODE_COLORS } from '../types'

interface Props {
  asset:            AssetItem
  issue:            JiraIssue
  mode:             ScanMode
  userToken:        string
  onActionComplete: (msg: string, type: 'success' | 'error') => void
  onBack:           () => void
}

type Tab = 'asset' | 'issue'

// ── Helpers ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  'blue-grey': 'bg-slate-600 text-slate-100',
  'yellow':    'bg-yellow-600 text-yellow-100',
  'green':     'bg-emerald-600 text-emerald-100',
  'red':       'bg-red-700 text-red-100',
  'default':   'bg-slate-600 text-slate-100',
}

function formatBytes(b: number) {
  if (b < 1024)        return `${b} B`
  if (b < 1_048_576)   return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1_048_576).toFixed(1)} MB`
}
function isImage(mime: string) { return mime.startsWith('image/') }
function isPdf(mime: string)   { return mime === 'application/pdf' }

// ── Auth-blob hook ────────────────────────────────────────────────────────

function useAuthBlob(url: string | undefined, token: string) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!url)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!url) { setLoading(false); return }
    let active = true
    let obj: string | null = null
    setLoading(true); setError(false)
    fetch(url, { headers: { Authorization: `Basic ${token}` } })
      .then(r  => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob() })
      .then(bl => { if (!active) return; obj = URL.createObjectURL(bl); setBlobUrl(obj); setLoading(false) })
      .catch(() => { if (active) { setError(true); setLoading(false) } })
    return () => { active = false; if (obj) URL.revokeObjectURL(obj) }
  }, [url, token])

  return { blobUrl, loading, error }
}

async function downloadBlob(url: string, filename: string, token: string) {
  try {
    const r = await fetch(url, { headers: { Authorization: `Basic ${token}` } })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const blob = await r.blob()

    // iOS PWA: anchor[download] is ignored — the browser navigates to the blob
    // URL inside the WKWebView, then pressing Done resets the app to the login
    // screen. Use the Web Share API instead, which opens the native share sheet
    // (Save to Files, AirDrop, …) without touching the navigation stack.
    const file = new File([blob], filename, { type: blob.type })
    if (
      typeof navigator.share === 'function' &&
      navigator.canShare?.({ files: [file] })
    ) {
      await navigator.share({ files: [file] })
      return
    }

    // Desktop / Android Chrome fallback
    const objUrl = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), {
      href: objUrl, download: filename,
    })
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000)
  } catch (e) {
    // navigator.share throws AbortError if the user cancels — not an error
    if (e instanceof Error && e.name === 'AbortError') return
    alert(`Download failed: ${e instanceof Error ? e.message : e}`)
  }
}

// ── Lightbox ──────────────────────────────────────────────────────────────

function Lightbox({ att, token, onClose }: { att: JiraAttachment; token: string; onClose: () => void }) {
  const { blobUrl, loading } = useAuthBlob(att.content, token)
  const [dl, setDl] = useState(false)
  async function handleDl() { setDl(true); await downloadBlob(att.content, att.filename, token); setDl(false) }
  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="flex items-center gap-3 px-4 pt-safe-top pt-4 pb-3 shrink-0">
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 active:bg-white/20 shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <p className="flex-1 text-white text-sm font-medium truncate text-center">{att.filename}</p>
        <button onClick={handleDl} disabled={dl || loading} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 active:bg-white/20 disabled:opacity-40 shrink-0">
          {dl ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>}
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-auto p-4">
        {loading && <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        {!loading && blobUrl && <img src={blobUrl} alt={att.filename} className="max-w-full max-h-full object-contain rounded-xl" />}
        {!loading && !blobUrl && <p className="text-slate-400 text-sm">Could not load image</p>}
      </div>
      <div className="px-4 pb-safe-bottom pb-6 pt-2 text-center shrink-0">
        <p className="text-slate-400 text-xs">{att.author} · {att.created} · {formatBytes(att.size)}</p>
      </div>
    </div>
  )
}

// ── Thumbnail card ────────────────────────────────────────────────────────

function ImageCard({ att, token, onPreview }: { att: JiraAttachment; token: string; onPreview: () => void }) {
  const { blobUrl, loading, error } = useAuthBlob(att.thumbnail ?? att.content, token)
  return (
    <button onClick={onPreview} className="relative aspect-square rounded-xl overflow-hidden bg-slate-700 border border-slate-600 active:opacity-75">
      {loading && <div className="absolute inset-0 flex items-center justify-center"><div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /></div>}
      {blobUrl && <img src={blobUrl} alt={att.filename} className="w-full h-full object-cover" />}
      {!loading && error && <div className="absolute inset-0 flex items-center justify-center">
        <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
        <p className="text-white text-xs truncate leading-tight">{att.filename}</p>
      </div>
      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded bg-black/50 flex items-center justify-center">
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </div>
    </button>
  )
}

// ── Document viewer (fullscreen, shown instead of direct download) ─────────

function DocViewer({ att, token, onClose }: { att: JiraAttachment; token: string; onClose: () => void }) {
  const { blobUrl, loading, error } = useAuthBlob(att.content, token)
  const [dl, setDl] = useState(false)
  const pdf = isPdf(att.mimeType)

  async function handleDl() { setDl(true); await downloadBlob(att.content, att.filename, token); setDl(false) }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe-top pt-4 pb-3 shrink-0 bg-black/80 backdrop-blur">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 active:bg-white/20 shrink-0"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <p className="flex-1 text-white text-sm font-medium truncate">{att.filename}</p>
        <button
          onClick={handleDl}
          disabled={dl || loading}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 active:bg-white/20 disabled:opacity-40 shrink-0"
        >
          {dl
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && error && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8">
            <p className="text-red-400 text-sm text-center">Could not load file.</p>
            <button onClick={handleDl} className="px-5 py-2.5 rounded-xl bg-slate-700 text-white text-sm font-medium active:bg-slate-600">
              Download instead
            </button>
          </div>
        )}
        {!loading && blobUrl && pdf && (
          <iframe
            src={blobUrl}
            className="flex-1 w-full border-0"
            title={att.filename}
          />
        )}
        {!loading && blobUrl && !pdf && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
            <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center gap-1">
              <svg className="w-9 h-9 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs font-bold text-slate-400">
                {att.filename.split('.').pop()?.toUpperCase() ?? 'FILE'}
              </span>
            </div>
            <p className="text-white font-medium text-center">{att.filename}</p>
            <p className="text-slate-400 text-sm text-center">Preview not available for this file type.</p>
            <button
              onClick={handleDl}
              disabled={dl}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 active:bg-blue-500 text-white font-semibold disabled:opacity-50"
            >
              {dl
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>}
              Save / Share
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && blobUrl && (
        <div className="px-4 pb-safe-bottom pb-4 pt-2 text-center shrink-0 bg-black/60">
          <p className="text-slate-500 text-xs">{att.author} · {att.created} · {formatBytes(att.size)}</p>
        </div>
      )}
    </div>
  )
}

// ── Document card ─────────────────────────────────────────────────────────

function DocCard({ att, onPreview }: { att: JiraAttachment; onPreview: () => void }) {
  const ext = att.filename.split('.').pop()?.toUpperCase() ?? 'FILE'
  const pdf = isPdf(att.mimeType)
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 shrink-0 border ${pdf ? 'bg-red-900/50 border-red-700/50' : 'bg-slate-700 border-slate-600'}`}>
        <svg className={`w-5 h-5 ${pdf ? 'text-red-400' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className={`text-xs font-bold leading-none ${pdf ? 'text-red-400' : 'text-slate-400'}`}>{ext}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{att.filename}</p>
        <p className="text-slate-400 text-xs mt-0.5">{formatBytes(att.size)} · {att.author} · {att.created}</p>
      </div>
      {/* Eye icon — opens viewer */}
      <button
        onClick={onPreview}
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-700 active:bg-slate-600 shrink-0"
      >
        <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </button>
    </div>
  )
}

// ── Comment card ──────────────────────────────────────────────────────────

function CommentCard({ c }: { c: JiraComment }) {
  const [exp, setExp] = useState(false)
  const long = c.body.length > 200
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="text-white text-sm font-medium truncate">{c.author}</span>
        <span className="text-slate-500 text-xs shrink-0">{c.created}</span>
      </div>
      <p className={`text-slate-300 text-sm leading-relaxed whitespace-pre-wrap ${long && !exp ? 'line-clamp-4' : ''}`}>{c.body}</p>
      {long && <button onClick={() => setExp(v => !v)} className="text-blue-400 text-xs mt-1 active:opacity-70">{exp ? 'Show less' : 'Show more'}</button>}
    </div>
  )
}

// ── Card shell ────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-lg ${className}`}>
      {children}
    </div>
  )
}

function CardHeader({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="px-4 pt-3 pb-2 border-b border-slate-700 flex items-center justify-between gap-2">
      <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">
        {title}{count !== undefined && count > 0 ? ` (${count})` : ''}
      </p>
      {action}
    </div>
  )
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 gap-3">
      <span className="text-slate-400 text-sm shrink-0">{label}</span>
      <span className="text-white text-sm text-right">{value}</span>
    </div>
  )
}

function FieldRow({ field }: { field: import('../api/jira').AssetField }) {
  const long  = field.templateName === 'stringarea'
  const check = field.templateName === 'checkbox'
  return (
    <div className={`px-4 py-2.5 ${long ? 'flex flex-col gap-1' : 'flex items-start justify-between gap-3'}`}>
      <span className="text-slate-400 text-sm shrink-0">{field.title}</span>
      {check
        ? <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${field.value === 'Da' ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-700 text-slate-300'}`}>{field.value}</span>
        : <span className={`text-sm text-white ${long ? '' : 'text-right'}`}>{field.value}</span>}
    </div>
  )
}

// ── Tab: Asset ────────────────────────────────────────────────────────────

function AssetTab({ asset }: { asset: AssetItem }) {
  return (
    <div className="space-y-3">
      <Card>
        <div className="px-4 pt-3 pb-2 border-b border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wider">{asset.typeName}</p>
          <p className="text-white font-semibold text-base">{asset.title}</p>
        </div>
        <div className="divide-y divide-slate-700/60">
          {asset.fields.map(f => <FieldRow key={f.name} field={f} />)}
          {asset.created   && <MiniRow label="Created at"   value={asset.created} />}
          {asset.createdBy && <MiniRow label="Created by"   value={asset.createdBy} />}
          {asset.updated   && <MiniRow label="Updated at"   value={asset.updated} />}
          {asset.updatedBy && <MiniRow label="Updated by"   value={asset.updatedBy} />}
        </div>
      </Card>
    </div>
  )
}

// ── Tab: Issue ────────────────────────────────────────────────────────────

function IssueTab({
  issue, userToken, onLightbox, onDocViewer,
}: { issue: JiraIssue; userToken: string; onLightbox: (att: JiraAttachment) => void; onDocViewer: (att: JiraAttachment) => void }) {
  const statusCls   = STATUS_COLORS[issue.statusColor] ?? STATUS_COLORS['default']
  const imageAtts   = issue.attachments.filter(a => isImage(a.mimeType))
  const docAtts     = issue.attachments.filter(a => !isImage(a.mimeType))

  return (
    <div className="space-y-3">
      {/* Summary & status */}
      <Card>
        <CardHeader
          title="Issue Details"
          action={
            <a
              href={issue.browseUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-blue-400 active:opacity-70"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open in Jira
            </a>
          }
        />

        {/* Badges */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusCls}`}>{issue.status}</span>
          <span className="text-xs text-slate-300 bg-slate-700 px-2.5 py-1 rounded-full">{issue.issueType}</span>
          {issue.priority && <span className="text-xs text-slate-300 bg-slate-700 px-2.5 py-1 rounded-full">↑ {issue.priority}</span>}
        </div>

        {/* Summary */}
        <div className="px-4 pb-3">
          <p className="text-white font-semibold text-base leading-snug">{issue.summary}</p>
        </div>

        {/* Key/value details */}
        <div className="border-t border-slate-700/60 divide-y divide-slate-700/60">
          {issue.assignee && <MiniRow label="Responsabil"   value={issue.assignee} />}
          {issue.reporter && <MiniRow label="Reported by"   value={issue.reporter} />}
          <MiniRow label="Created at"   value={issue.created} />
          <MiniRow label="Updated at"   value={issue.updated} />
          {issue.duedate  && <MiniRow label="Termen limita" value={issue.duedate} />}
        </div>

        {/* Labels */}
        {issue.labels.length > 0 && (
          <div className="border-t border-slate-700/60 px-4 py-2.5 flex flex-wrap gap-1.5">
            {issue.labels.map(l => (
              <span key={l} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{l}</span>
            ))}
          </div>
        )}

        {/* Description */}
        {issue.description && (
          <div className="border-t border-slate-700/60 px-4 py-3">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Descriere</p>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{issue.description}</p>
          </div>
        )}
      </Card>

      {/* Attachments */}
      {issue.attachments.length > 0 && (
        <Card>
          <CardHeader title="Attachments" count={issue.attachments.length} />
          {imageAtts.length > 0 && (
            <div className="p-3 grid grid-cols-3 gap-2">
              {imageAtts.map(att => (
                <ImageCard key={att.id} att={att} token={userToken} onPreview={() => onLightbox(att)} />
              ))}
            </div>
          )}
          {docAtts.length > 0 && (
            <div className={`divide-y divide-slate-700/60 ${imageAtts.length > 0 ? 'border-t border-slate-700' : ''}`}>
              {docAtts.map(att => <DocCard key={att.id} att={att} onPreview={() => onDocViewer(att)} />)}
            </div>
          )}
        </Card>
      )}

      {/* Comments */}
      {issue.comments.length > 0 && (
        <Card>
          <CardHeader title="Comments" count={issue.comments.length} />
          <div className="divide-y divide-slate-700/60">
            {issue.comments.map(c => <CommentCard key={c.id} c={c} />)}
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function AssetInfoPage({
  asset, issue, mode, userToken, onActionComplete, onBack,
}: Props) {
  const [tab,            setTab]            = useState<Tab>('asset')
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [lightbox,       setLightbox]       = useState<JiraAttachment | null>(null)
  const [docViewer,      setDocViewer]      = useState<JiraAttachment | null>(null)

  const modeLabel = SCAN_MODE_LABELS[mode]
  const modeColor = SCAN_MODE_COLORS[mode]

  async function handleConfirm() {
    if (mode === 'view') return
    setConfirmLoading(true)
    try {
      await transitionIssue(issue.key, mode as 'checkin' | 'checkout')
      onActionComplete(`✓ ${modeLabel} recorded for ${issue.key}`, 'success')
    } catch (e) {
      onActionComplete(extractJiraError(e), 'error')
    } finally {
      setConfirmLoading(false)
    }
  }

  return (
    <>
      {lightbox   && <Lightbox   att={lightbox}   token={userToken} onClose={() => setLightbox(null)} />}
      {docViewer  && <DocViewer  att={docViewer}  token={userToken} onClose={() => setDocViewer(null)} />}

      <div className="flex flex-col h-full bg-slate-900">

        {/* ── Header ── */}
        <div className="px-4 pt-safe-top pt-4 pb-0 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3 pb-3">
            <button
              onClick={onBack}
              disabled={confirmLoading}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-700 active:bg-slate-600 disabled:opacity-40 shrink-0"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 uppercase tracking-wider">
                {mode === 'view' ? asset.typeName : 'Confirm action'}
              </p>
              <h1 className={`font-bold text-base leading-tight truncate ${modeColor}`}>
                {mode === 'view' ? asset.title : modeLabel}
              </h1>
            </div>
          </div>

          {/* ── Tab bar ── */}
          <div className="flex gap-1 pb-0">
            <TabButton
              active={tab === 'asset'}
              onClick={() => setTab('asset')}
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              }
              label="Asset"
            />
            <TabButton
              active={tab === 'issue'}
              onClick={() => setTab('issue')}
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
              label="Issue"
            />
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {tab === 'asset'
            ? <AssetTab asset={asset} />
            : <IssueTab issue={issue} userToken={userToken} onLightbox={setLightbox} onDocViewer={setDocViewer} />}
        </div>

        {/* ── Sticky action bar ── */}
        {mode !== 'view' ? (
          <div className="shrink-0 px-4 pb-safe-bottom pb-5 pt-3 border-t border-slate-700 bg-slate-900 space-y-2">
            <button
              onClick={handleConfirm}
              disabled={confirmLoading}
              className={`
                w-full flex items-center justify-center gap-3 py-4 rounded-2xl
                font-semibold text-lg text-white shadow-lg transition-colors disabled:opacity-50
                ${mode === 'checkin' ? 'bg-emerald-600 active:bg-emerald-500' : 'bg-blue-600 active:bg-blue-500'}
              `}
            >
              {confirmLoading
                ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <>
                    {mode === 'checkin'
                      ? <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>}
                    Confirm {modeLabel}
                  </>}
            </button>
            <button
              onClick={onBack}
              disabled={confirmLoading}
              className="w-full py-3 rounded-2xl bg-slate-700 active:bg-slate-600 disabled:opacity-40 text-slate-300 font-medium"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="shrink-0 px-4 pb-safe-bottom pb-5 pt-3 border-t border-slate-700 bg-slate-900">
            <button
              onClick={onBack}
              className="w-full py-3 rounded-2xl bg-slate-700 active:bg-slate-600 text-slate-300 font-medium"
            >
              ← Back to menu
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Tab button ────────────────────────────────────────────────────────────

function TabButton({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-xl
        border-b-2 transition-colors
        ${active
          ? 'text-white border-blue-500 bg-slate-800/60'
          : 'text-slate-400 border-transparent hover:text-slate-300 active:text-slate-200'}
      `}
    >
      {icon}
      {label}
    </button>
  )
}
