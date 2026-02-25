export type ScanMode = 'checkin' | 'checkout' | 'view'

export const SCAN_MODE_LABELS: Record<ScanMode, string> = {
  checkin:  'Check In',
  checkout: 'Check Out',
  view:     'Scan Asset / Issue',
}

export const SCAN_MODE_COLORS: Record<ScanMode, string> = {
  checkin:  'text-emerald-400',
  checkout: 'text-blue-400',
  view:     'text-violet-400',
}

export const SCAN_MODE_TRANSITION: Record<Exclude<ScanMode, 'view'>, '21' | '201'> = {
  checkin:  '21',
  checkout: '201',
}
