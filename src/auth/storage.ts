// Persisted user record stored in localStorage.
// The PIN is stored as a simple hash (SHA-256 via Web Crypto).
// Jira credentials are stored to maintain the user session across app opens.

const STORAGE_KEY = 'promotor_user_v1'

export interface StoredUser {
  username: string        // Jira username
  displayName: string     // Full name from Jira /myself
  pinHash: string         // SHA-256 hex of PIN
  jiraToken: string       // base64(username:password) — Basic auth token for user's own calls
  avatarUrl?: string      // Base64 data URL of the user's Jira avatar
}

export async function hashPin(pin: string): Promise<string> {
  if (crypto.subtle) {
    const data = new TextEncoder().encode(pin)
    const buf  = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  // Fallback for insecure contexts (HTTP on LAN IP during dev).
  // Simple djb2-based hash — acceptable for a 4-digit PIN stored locally.
  let h = 5381
  for (let i = 0; i < pin.length; i++) {
    h = ((h << 5) + h + pin.charCodeAt(i)) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

export function saveUser(user: StoredUser): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

export function loadUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredUser) : null
  } catch {
    return null
  }
}

export function clearUser(): void {
  localStorage.removeItem(STORAGE_KEY)
}
