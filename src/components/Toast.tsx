interface Props {
  message: string
  type: 'success' | 'error'
  onDismiss: () => void
}

export default function Toast({ message, type, onDismiss }: Props) {
  return (
    <div
      className="fixed bottom-6 left-4 right-4 z-50 flex items-start gap-3 p-4 rounded-2xl shadow-2xl cursor-pointer animate-[slideUp_0.25s_ease-out]"
      style={{
        background: type === 'success' ? '#166534' : '#7f1d1d',
        border: `1px solid ${type === 'success' ? '#16a34a' : '#ef4444'}`,
      }}
      onClick={onDismiss}
    >
      <div className="shrink-0 mt-0.5">
        {type === 'success' ? (
          <svg className="w-5 h-5 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>
      <p className={`text-sm font-medium leading-snug ${type === 'success' ? 'text-green-100' : 'text-red-100'}`}>
        {message}
      </p>
    </div>
  )
}
