import axios, { AxiosInstance, AxiosError } from 'axios'

// ── Service account ────────────────────────────────────────────────────────
// Used ONLY for workflow transitions (check-in / check-out).
// Regular users do not have this permission in Jira, which forces them to
// use this app and physically scan the equipment.
const ADMIN_USER = 'andrei.buldus'
const ADMIN_PASS = 'Coracoid2015'
const ADMIN_TOKEN = btoa(`${ADMIN_USER}:${ADMIN_PASS}`)

const BASE_URL = import.meta.env.VITE_JIRA_BASE_URL ?? '/jira'

function makeClient(authToken: string): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Basic ${authToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: 15000,
  })
}

// Admin client — transitions only
const adminClient = makeClient(ADMIN_TOKEN)

// ── Error helper ───────────────────────────────────────────────────────────

/**
 * Extract a human-readable message from a Jira API error.
 * Jira returns errors as { errorMessages: string[], errors: {} }
 */
export function extractJiraError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<{ errorMessages?: string[]; errors?: Record<string, string>; message?: string }>
    const status = e.response?.status
    const data   = e.response?.data

    if (data) {
      const msgs = data.errorMessages ?? []
      const errs = data.errors ? Object.values(data.errors) : []
      const combined = [...msgs, ...errs].filter(Boolean).join(' ')
      if (combined) return `[${status}] ${combined}`
      if (data.message) return `[${status}] ${data.message}`
    }
    if (status === 403) return `[403] Permission denied — the service account may not have rights to perform this transition in the current issue state.`
    if (status === 400) return `[400] Transition not valid — the issue may already be in this state.`
    if (status === 404) return `[404] Issue or transition not found.`
    return e.message
  }
  return err instanceof Error ? err.message : String(err)
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface JiraUser {
  name: string
  displayName: string
  emailAddress?: string
}

export interface AssetInfo {
  jiraIssueId: string
  summary?: string
  status?: string
  assignee?: string
}

export interface JiraTransition {
  id: string
  name: string
  to: { name: string }
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function extractItemIdFromUrl(url: string): string | null {
  const match = url.match(/\/item\/(\d+)$/)
  return match?.[1] ?? null
}

// Transition name patterns to match against (case-insensitive).
// Includes Romanian terms used in the Promotor Jira workflow.
const CHECK_IN_NAMES  = [
  'check in', 'checkin', 'check-in', 'checked in', 'return', 'returned',
  'incepere constatare', 'incepe constatare', 'constatare',
]
const CHECK_OUT_NAMES = [
  'check out', 'checkout', 'check-out', 'checked out', 'take', 'borrow',
  'finalizare constatare', 'finalizeaza', 'inchidere',
]

function matchesCheckIn(name: string)  { return CHECK_IN_NAMES.some(n  => name.toLowerCase().includes(n)) }
function matchesCheckOut(name: string) { return CHECK_OUT_NAMES.some(n => name.toLowerCase().includes(n)) }

// ── User auth ──────────────────────────────────────────────────────────────

export async function validateJiraCredentials(
  username: string,
  password: string
): Promise<JiraUser> {
  const token  = btoa(`${username}:${password}`)
  const client = makeClient(token)
  const { data } = await client.get<JiraUser>('/rest/api/2/myself')
  return data
}

// ── Asset info ─────────────────────────────────────────────────────────────

export async function getAssetInfo(
  itemId: string,
  userToken: string
): Promise<AssetInfo> {
  const client = makeClient(userToken)
  const { data } = await client.get(
    `/rest/com-spartez-ephor/1.0/item/${itemId}`
  )
  return {
    jiraIssueId: data.jiraIssueId ?? data.issueKey ?? data.key ?? String(data.id),
    summary:     data.summary ?? data.name,
    status:      data.status?.name ?? data.status,
    assignee:    data.assignee?.displayName ?? data.assignee,
  }
}

// ── Available transitions ──────────────────────────────────────────────────

/**
 * Fetch all transitions currently available for this issue (admin account).
 */
export async function getAvailableTransitions(issueId: string): Promise<JiraTransition[]> {
  const { data } = await adminClient.get(
    `/rest/api/2/issue/${issueId}/transitions`
  )
  return (data.transitions ?? []) as JiraTransition[]
}

// ── Transitions ────────────────────────────────────────────────────────────

/**
 * Trigger a workflow transition using the admin service account.
 *
 * Resolution order:
 *   1. Look for a transition whose name matches the action (check-in / check-out)
 *   2. Fall back to the hardcoded ID ("21" check-in, "201" check-out)
 *
 * This makes the app resilient to workflow reconfiguration and avoids
 * hardcoded-ID mismatches being the cause of 403 / 400 errors.
 */
export async function transitionIssue(
  issueId: string,
  action: 'checkin' | 'checkout'
): Promise<{ usedId: string; usedName: string }> {
  const fallbackId = action === 'checkin' ? '21' : '201'

  // Try to resolve the transition ID by name from the available list.
  // If this pre-flight call fails for any reason, we fall back to the
  // hardcoded ID immediately — no error is thrown from here.
  let resolvedId   = fallbackId
  let resolvedName = `id:${fallbackId}`

  try {
    const available = await getAvailableTransitions(issueId)

    const byName = action === 'checkin'
      ? available.find(t => matchesCheckIn(t.name))
      : available.find(t => matchesCheckOut(t.name))

    const byId = available.find(t => t.id === fallbackId)

    const target = byName ?? byId

    if (target) {
      resolvedId   = target.id
      resolvedName = target.name
    } else if (available.length > 0) {
      // No match found — report what IS available so the user can diagnose
      const names = available.map(t => `"${t.name}" (id:${t.id})`).join(', ')
      throw new Error(
        `No "${action}" transition available from current state.\n` +
        `Available: ${names}`
      )
    }
    // If available is empty the pre-flight may have returned nothing valid;
    // fall through to hardcoded ID attempt below.
  } catch (preflightErr) {
    // Re-throw only if it's our own descriptive error (no available transitions).
    // For network/auth errors on the pre-flight, silently fall back to hardcoded ID.
    if (preflightErr instanceof Error && preflightErr.message.startsWith('No "')) {
      throw preflightErr
    }
  }

  // Execute the transition
  await adminClient.post(`/rest/api/2/issue/${issueId}/transitions`, {
    transition: { id: resolvedId },
  })

  return { usedId: resolvedId, usedName: resolvedName }
}
