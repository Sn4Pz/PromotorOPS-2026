import { useState } from 'react'
import { AssetInfo, transitionIssue } from '../api/jira'

interface Props {
  assetInfo: AssetInfo
  onActionComplete: (msg: string, type: 'success' | 'error') => void
  onBack: () => void
}

export default function AssetInfoPage({ assetInfo, onActionComplete, onBack }: Props) {
  const [loading, setLoading] = useState<'checkin' | 'checkout' | null>(null)

  async function handleTransition(action: 'checkin' | 'checkout') {
    setLoading(action)
    try {
      const transitionId = action === 'checkin' ? '21' : '201'
      await transitionIssue(assetInfo.jiraIssueId, transitionId)
      onActionComplete(
        action === 'checkin'
          ? `✓ Check-in recorded for ${assetInfo.jiraIssueId}`
          : `✓ Check-out recorded for ${assetInfo.jiraIssueId}`,
        'success'
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transition failed.'
      onActionComplete(`${action === 'checkin' ? 'Check-in' : 'Check-out'} failed: ${msg}`, 'error')
    } finally {
      setLoading(null)
    }
  }

  const isWorking = loading !== null

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="px-4 pt-safe-top pt-4 pb-3 flex items-center gap-3 border-b border-slate-700">
        <button
          onClick={onBack}
          disabled={isWorking}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-700 active:bg-slate-600 disabled:opacity-40 transition-colors"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="font-semibold text-white leading-tight">Asset Details</h1>
          <p className="text-xs text-slate-400">ProMotor OPS</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {/* Asset card */}
        <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Jira Issue</p>
              <p className="text-xl font-bold text-white">{assetInfo.jiraIssueId}</p>
            </div>
          </div>

          {assetInfo.summary && (
            <InfoRow label="Summary" value={assetInfo.summary} />
          )}
          {assetInfo.status && (
            <InfoRow label="Status" value={assetInfo.status} highlight />
          )}
          {assetInfo.assignee && (
            <InfoRow label="Assignee" value={assetInfo.assignee} />
          )}
        </div>

        {/* Action buttons */}
        <div className="w-full max-w-sm flex flex-col gap-3">
          <ActionButton
            label="Check-in"
            description="Mark equipment as returned / available"
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M5 13l4 4L19 7" />
              </svg>
            }
            color="green"
            loading={loading === 'checkin'}
            disabled={isWorking}
            onClick={() => handleTransition('checkin')}
          />
          <ActionButton
            label="Check-out"
            description="Mark equipment as taken / in-use"
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            }
            color="blue"
            loading={loading === 'checkout'}
            disabled={isWorking}
            onClick={() => handleTransition('checkout')}
          />
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-brand-400' : 'text-white'}`}>{value}</span>
    </div>
  )
}

interface ActionButtonProps {
  label: string
  description: string
  icon: React.ReactNode
  color: 'green' | 'blue'
  loading: boolean
  disabled: boolean
  onClick: () => void
}

function ActionButton({ label, description, icon, color, loading, disabled, onClick }: ActionButtonProps) {
  const base = color === 'green'
    ? 'bg-green-700 active:bg-green-600 border-green-600'
    : 'bg-brand-700 active:bg-brand-600 border-brand-600'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full flex items-center gap-4 p-4 rounded-2xl border
        ${base}
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-150 shadow-lg
      `}
    >
      <div className="text-white shrink-0">
        {loading ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : icon}
      </div>
      <div className="text-left">
        <p className="text-white font-semibold">{label}</p>
        <p className="text-xs text-white/60">{description}</p>
      </div>
    </button>
  )
}
