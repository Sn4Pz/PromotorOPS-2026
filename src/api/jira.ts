import axios, { AxiosInstance } from 'axios'

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

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract the numeric item ID from an Ephor Asset Manager QR URL.
 * Example: https://jira.promotor.com/plugins/servlet/com.spartez.ephor/item/57860
 */
export function extractItemIdFromUrl(url: string): string | null {
  const match = url.match(/\/item\/(\d+)$/)
  return match?.[1] ?? null
}

// ── User auth ──────────────────────────────────────────────────────────────

/**
 * Validate Jira credentials by calling /rest/api/2/myself.
 * Returns the user profile on success, throws on failure.
 */
export async function validateJiraCredentials(
  username: string,
  password: string
): Promise<JiraUser> {
  const token  = btoa(`${username}:${password}`)
  const client = makeClient(token)
  const { data } = await client.get<JiraUser>('/rest/api/2/myself')
  return data
}

// ── Asset info (uses the logged-in user's credentials) ─────────────────────

/**
 * Fetch asset information from the Spartez/Ephor Asset Manager plugin.
 * Uses the logged-in user's token so reads are audited under their account.
 */
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

// ── Transitions (admin service account only) ───────────────────────────────

/**
 * Trigger a Jira workflow transition using the admin service account.
 *
 * Transition IDs (confirmed in Jira workflow config):
 *   "21"  → Check-in
 *   "201" → Check-out
 */
export async function transitionIssue(
  issueId: string,
  transitionId: '21' | '201'
): Promise<void> {
  await adminClient.post(`/rest/api/2/issue/${issueId}/transitions`, {
    transition: { id: transitionId },
  })
}
