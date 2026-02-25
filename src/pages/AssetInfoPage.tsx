import { useState } from 'react'
import { JiraIssue, transitionIssue, extractJiraError } from '../api/jira'
import { ScanMode, SCAN_MODE_LABELS, SCAN_MODE_COLORS } from '../types'

interface Props {
  issue: JiraIssue
  mode: ScanMode
  onActionComplete: (msg: string, type: 'success' | 'error') => void
  onBack: () => void
}

const STATUS_COLORS: Record<string, string> = {
  'blue-grey': 'bg-slate-600 text-slate-100',
  'yellow':    'bg-yellow-600 text-yellow-100',
  'green':     'bg-emerald-600 text-emerald-100',
  'red':       'bg-red-700 text-red-100',
  'default':   'bg-slate-600 text-slate-100',
}

export default function AssetInfoPage({ issue, mode, onActionComplete, onBack }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    if (mode === 'view') return
    setLoading(true)
    try {
      // Exact same call as the old Android app
      const transitionId = mode === 'checkin' ? '21' : '201'
      await transitionIssue(issue.key, transitionId)
      onActionComplete(
        `✓ ${SCAN_MODE_LABELS[mode]} recorded for ${issue.key}`,
        'success'
      )
    } catch (e) {
      onActionComplete(extractJiraError(e), 'error')
    } finally {
      setLoading(false)
    }
  }

  const modeLabel = SCAN_MODE_LABELS[mode]
  const modeColor = SCAN_MODE_COLORS[mode]
  const statusCls = STATUS_COLORS[issue.statusColor] ?? STATUS_COLORS['default']

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="px-4 pt-safe-top pt-4 pb-3 flex items-center gap-3 border-b border-slate-700 shrink-0">
        <button onClick={onBack} disabled={loading}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-700 active:bg-slate-600 disabled:opacity-40 shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 uppercase tracking-wider">
            {mode === 'view' ? 'Issue / Asset' : 'Confirm action'}
          </p>
          <h1 className={`font-bold text-base leading-tight truncate ${modeColor}`}>
            {mode === 'view' ? issue.key : modeLabel}
          </h1>
        </div>
        {/* Open in Jira */}
        <a href={issue.browseUrl} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-700/60 border border-brand-600/50 text-brand-300 text-xs font-medium shrink-0 active:bg-brand-700">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Jira
        </a>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

        {/* Issue card */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-lg">
          {/* Issue key + summary */}
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-brand-400 font-bold text-lg leading-none">{issue.key}</p>
                <p className="text-white text-sm mt-1 leading-snug">{issue.summary}</p>
              </div>
            </div>
          </div>

          {/* Status + type row */}
          <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-700 flex-wrap">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusCls}`}>
              {issue.status}
            </span>
            <span className="text-xs text-slate-400 bg-slate-700 px-2.5 py-1 rounded-full">
              {issue.issueType}
            </span>
            {issue.priority && (
              <span className="text-xs text-slate-400 bg-slate-700 px-2.5 py-1 rounded-full">
                {issue.priority}
              </span>
            )}
          </div>

          {/* Detail rows */}
          <div className="divide-y divide-slate-700/60">
            {issue.assignee && (
              <DetailRow label="Assignee" value={issue.assignee} icon="👤" />
            )}
            {issue.reporter && (
              <DetailRow label="Reporter" value={issue.reporter} icon="📋" />
            )}
            <DetailRow label="Created" value={issue.created} icon="📅" />
            <DetailRow label="Updated" value={issue.updated} icon="🔄" />
          </div>

          {/* Description */}
          {issue.description && (
            <div className="px-4 py-3 border-t border-slate-700">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1.5">Description</p>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                {issue.description}
              </p>
            </div>
          )}
        </div>

        {/* Action zone */}
        {mode !== 'view' ? (
          <div className="space-y-3 pb-4">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`
                w-full flex items-center justify-center gap-3 py-4 rounded-2xl
                font-semibold text-lg text-white shadow-lg
                ${mode === 'checkin' ? 'bg-emerald-600 active:bg-emerald-500' : 'bg-blue-600 active:bg-blue-500'}
                disabled:opacity-50 transition-colors
              `}
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'checkin' ? (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  )}
                  Confirm {modeLabel}
                </>
              )}
            </button>
            <button onClick={onBack} disabled={loading}
              className="w-full py-3 rounded-2xl bg-slate-700 active:bg-slate-600 disabled:opacity-40 text-slate-300 font-medium transition-colors">
              Cancel — go back to menu
            </button>
          </div>
        ) : (
          <div className="pb-4">
            <button onClick={onBack}
              className="w-full py-3 rounded-2xl bg-slate-700 active:bg-slate-600 text-slate-300 font-medium">
              ← Back to menu
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-3">
      <span className="text-slate-400 text-sm flex items-center gap-1.5 shrink-0">
        <span>{icon}</span>{label}
      </span>
      <span className="text-white text-sm text-right">{value}</span>
    </div>
  )
}
