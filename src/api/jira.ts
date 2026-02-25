import axios, { AxiosInstance, AxiosError } from 'axios'

// ── Service account ────────────────────────────────────────────────────────
// Used ONLY for workflow transitions — mirrors the old Android app exactly.
const ADMIN_USER  = 'andrei.buldus'
const ADMIN_PASS  = 'Coracoid2015'
const ADMIN_TOKEN = btoa(`${ADMIN_USER}:${ADMIN_PASS}`)

const JIRA_BASE = 'https://jira.promotor.com'

// In dev the Vite proxy rewrites /jira/* → https://jira.promotor.com/*
// In production set VITE_JIRA_BASE_URL to the full origin.
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

const adminClient = makeClient(ADMIN_TOKEN)

// ── Error helper ───────────────────────────────────────────────────────────

export function extractJiraError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const e    = err as AxiosError<{ errorMessages?: string[]; errors?: Record<string, string>; message?: string }>
    const code = e.response?.status
    const data = e.response?.data
    if (data) {
      const msgs = [
        ...(data.errorMessages ?? []),
        ...Object.values(data.errors ?? {}),
      ].filter(Boolean)
      if (msgs.length) return `[${code}] ${msgs.join(' ')}`
      if (data.message) return `[${code}] ${data.message}`
    }
    if (code === 403) return '[403] Permission denied — the service account cannot perform this transition from the current state.'
    if (code === 400) return '[400] Transition not valid — the issue may already be in this state.'
    if (code === 404) return '[404] Issue or transition not found.'
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

/** Raw link entry in the Asset Manager item response */
export interface AssetLink {
  issueId?:     number | string
  issueKey?:    string
  jiraIssueId?: string
  key?:         string
}

/** Parsed result from the Asset Manager API — matches old app's AssetInfo */
export interface AssetItem {
  itemId:       string   // the numeric id in the QR URL
  jiraIssueId:  string   // issue key like "PM-123"
  name?:        string
  objectType?:  string
}

/** Full Jira issue — from GET /rest/api/2/issue/{key} */
export interface JiraIssue {
  id:          string
  key:         string
  browseUrl:   string
  summary:     string
  status:      string
  statusColor: string
  issueType:   string
  priority?:   string
  assignee?:   string
  reporter?:   string
  description?: string
  created:     string
  updated:     string
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract the numeric item ID from an Ephor Asset Manager QR URL.
 * Matches the exact regex from the old Android app's UrlUtils.kt
 * Example: https://jira.promotor.com/plugins/servlet/com.spartez.ephor/item/57860
 */
export function extractItemIdFromUrl(url: string): string | null {
  const match = url.match(/.+\/item\/(\d+)$/)
  return match?.[1] ?? null
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ro-RO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function validateJiraCredentials(
  username: string,
  password: string
): Promise<JiraUser> {
  const client = makeClient(btoa(`${username}:${password}`))
  const { data } = await client.get<JiraUser>('/rest/api/2/myself')
  return data
}

// ── Asset Manager API (identical to old app) ───────────────────────────────

/**
 * GET /rest/com-spartez-ephor/1.0/item/{itemId}
 *
 * Exact same endpoint as the old Android app.
 * Parses the jiraIssueId from the `links` array in the response
 * (the old app's AssetInfo.jiraIssueId field).
 */
export async function getAssetItem(
  itemId: string,
  userToken: string
): Promise<AssetItem> {
  const client = makeClient(userToken)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await client.get<any>(
    `/rest/com-spartez-ephor/1.0/item/${itemId}`
  )

  // The API response contains a `links` array with the linked Jira issues.
  // We pick the first link's issue key — same as the old app's jiraIssueId field.
  let jiraIssueId: string | undefined

  // Try direct fields first (old app serialised as jiraIssueId at root)
  jiraIssueId = data.jiraIssueId ?? data.issueKey ?? data.key

  // Then scan the links array
  if (!jiraIssueId && Array.isArray(data.links)) {
    const link: AssetLink = data.links[0] ?? {}
    jiraIssueId = link.issueKey ?? link.jiraIssueId ?? link.key
      ?? (link.issueId ? String(link.issueId) : undefined)
  }

  if (!jiraIssueId) {
    throw new Error(
      'Asset Manager response did not contain a linked Jira issue.\n' +
      `Raw response keys: ${Object.keys(data).join(', ')}`
    )
  }

  return {
    itemId,
    jiraIssueId,
    name:       data.name ?? data.summary,
    objectType: data.objectType?.name ?? data.objectTypeName,
  }
}

// ── Jira Issue API ─────────────────────────────────────────────────────────

/**
 * GET /rest/api/2/issue/{issueKey}
 *
 * Fetches full issue details for the viewing page.
 * Uses the logged-in user's credentials (reads are audited under their account).
 */
export async function getIssueDetails(
  issueKey: string,
  userToken: string
): Promise<JiraIssue> {
  const client = makeClient(userToken)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await client.get<any>(`/rest/api/2/issue/${issueKey}`)

  const f = data.fields ?? {}
  return {
    id:          data.id,
    key:         data.key,
    browseUrl:   `${JIRA_BASE}/browse/${data.key}`,
    summary:     f.summary ?? '(no summary)',
    status:      f.status?.name ?? '—',
    statusColor: f.status?.statusCategory?.colorName ?? 'default',
    issueType:   f.issuetype?.name ?? '—',
    priority:    f.priority?.name,
    assignee:    f.assignee?.displayName,
    reporter:    f.reporter?.displayName,
    description: typeof f.description === 'string' ? f.description : undefined,
    created:     formatDate(f.created),
    updated:     formatDate(f.updated),
  }
}

// ── Transitions (identical to old app) ────────────────────────────────────

/**
 * POST /rest/api/2/issue/{issueId}/transitions
 *
 * Exact same call as the old Android app's JiraApi.transitionIssue().
 * Uses the admin service account. Transition IDs: 21 = check-in, 201 = check-out.
 */
export async function transitionIssue(
  issueId: string,
  transitionId: '21' | '201'
): Promise<void> {
  await adminClient.post(`/rest/api/2/issue/${issueId}/transitions`, {
    transition: { id: transitionId },
  })
}
