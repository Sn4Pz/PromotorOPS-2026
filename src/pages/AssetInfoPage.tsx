import { useState, useEffect } from 'react'
import { AssetInfo, transitionIssue, getAvailableTransitions, JiraTransition, extractJiraError } from '../api/jira'
import { ScanMode, SCAN_MODE_LABELS, SCAN_MODE_COLORS } from '../types'

interface Props {
  assetInfo: AssetInfo
  mode: ScanMode
  onActionComplete: (msg: string, type: 'success' | 'error') => void
  onBack: () => void
}

export default function AssetInfoPage({ assetInfo, mode, onActionComplete, onBack }: Props) {
  const [loading, setLoading]                       = useState(false)
  const [transitions, setTransitions]               = useState<JiraTransition[]>([])
  const [transitionsLoading, setTransitionsLoading] = useState(true)

  // Pre-fetch available transitions so we can detect mismatches before the
  // user taps Confirm, and surface useful diagnostic info if needed.
  useEffect(() => {
    if (mode === 'view') { setTransitionsLoading(false); return }
    getAvailableTransitions(assetInfo.jiraIssueId)
      .then(setTransitions)
      .catch(() => { /* non-fatal — transitionIssue will give details */ })
      .finally(() => setTransitionsLoading(false))
  }, [assetInfo.jiraIssueId, mode])

  async function handleConfirm() {
    if (mode === 'view') return
    setLoading(true)
    try {
      const result = await transitionIssue(
        assetInfo.jiraIssueId,
        mode as 'checkin' | 'checkout'
      )
      onActionComplete(
        `✓ ${SCAN_MODE_LABELS[mode]} recorded for ${assetInfo.jiraIssueId} (via "${result.usedName}")`,
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

  // Check if the desired transition is visible in available list
  const CHECK_IN_NAMES  = ['check in', 'checkin', 'check-in', 'checked in', 'return']
  const CHECK_OUT_NAMES = ['check out', 'checkout', 'check-out', 'checked out', 'take']
  const matchFn = mode === 'checkin'
    ? (t: JiraTransition) => CHECK_IN_NAMES.some(n => t.name.toLowerCase().includes(n))
    : (t: JiraTransition) => CHECK_OUT_NAMES.some(n => t.name.toLowerCase().includes(n))

  const matchedTransition = transitions.find(matchFn)
    ?? transitions.find(t => t.id === (mode === 'checkin' ? '21' : '201'))

  const noMatchWarning = !transitionsLoading && mode !== 'view' && transitions.length > 0 && !matchedTransition

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="px-4 pt-safe-top pt-4 pb-3 flex items-center gap-3 border-b border-slate-700">
        <button
          onClick={onBack}
          disabled={loading}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-700 active:bg-slate-600 disabled:opacity-40 transition-colors shrink-0"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 uppercase tracking-wider">
            {mode === 'view' ? 'Asset Info' : 'Confirm action'}
          </p>
          <h1 className={`font-bold text-base leading-tight ${modeColor}`}>{modeLabel}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 gap-4 overflow-y-auto py-4">
        {/* Asset card */}
        <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-brand-700 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Jira Issue</p>
              <p className="text-2xl font-bold text-white">{assetInfo.jiraIssueId}</p>
            </div>
          </div>
          <div className="divide-y divide-slate-700">
            {assetInfo.summary  && <InfoRow label="Summary"  value={assetInfo.summary} />}
            {assetInfo.status   && <InfoRow label="Status"   value={assetInfo.status} highlight />}
            {assetInfo.assignee && <InfoRow label="Assignee" value={assetInfo.assignee} />}
            {/* Show matched transition name so user can verify */}
            {matchedTransition && (
              <InfoRow label="Transition" value={`"${matchedTransition.name}" (id: ${matchedTransition.id})`} />
            )}
          </div>
        </div>

        {/* Warning: no matching transition found */}
        {noMatchWarning && (
          <div className="w-full max-w-sm bg-amber-900/40 border border-amber-600/50 rounded-2xl p-4">
            <p className="text-amber-300 text-sm font-semibold mb-1">⚠ No matching transition</p>
            <p className="text-amber-200/70 text-xs mb-2">
              No "{modeLabel}" transition is available from the current state.
              Available transitions:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {transitions.map(t => (
                <span key={t.id} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-lg">
                  {t.name} <span className="text-slate-500">(id:{t.id})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action zone */}
        {mode !== 'view' ? (
          <div className="w-full max-w-sm space-y-3">
            <button
              onClick={handleConfirm}
              disabled={loading || transitionsLoading}
              className={`
                w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-lg
                ${mode === 'checkin' ? 'bg-emerald-600 active:bg-emerald-500' : 'bg-blue-600 active:bg-blue-500'}
                disabled:opacity-50 transition-colors shadow-lg text-white
              `}
            >
              {loading || transitionsLoading ? (
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
            <button
              onClick={onBack}
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-slate-700 active:bg-slate-600 disabled:opacity-40 text-slate-300 font-medium transition-colors"
            >
              Cancel — go back to menu
            </button>
          </div>
        ) : (
          <div className="w-full max-w-sm">
            {/* Show all available transitions in view mode too (diagnostic) */}
            {transitions.length > 0 && (
              <div className="mb-3 bg-slate-800 rounded-2xl p-4 border border-slate-700">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Available transitions</p>
                <div className="flex flex-wrap gap-1.5">
                  {transitions.map(t => (
                    <span key={t.id} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-lg">
                      {t.name} <span className="text-slate-500">(id:{t.id})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={onBack}
              className="w-full py-3 rounded-2xl bg-slate-700 active:bg-slate-600 text-slate-300 font-medium transition-colors"
            >
              ← Back to menu
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2.5 gap-3">
      <span className="text-slate-400 text-sm shrink-0">{label}</span>
      <span className={`text-sm font-medium text-right ${highlight ? 'text-brand-400' : 'text-white'}`}>
        {value}
      </span>
    </div>
  )
}
