import axios from 'axios'

// Service account used for all Jira API calls.
// These credentials hold the transition permission so that end-users
// are forced to use this app to scan the physical asset — the Jira
// button is not visible to regular users.
const JIRA_USER = 'andrei.buldus'
const JIRA_PASS = 'Coracoid2015'
const BASIC_TOKEN = btoa(`${JIRA_USER}:${JIRA_PASS}`)

// In development the Vite proxy rewrites /jira/* → https://jira.promotor.com/*
// In production build, point VITE_JIRA_BASE_URL to the real origin.
const BASE_URL = import.meta.env.VITE_JIRA_BASE_URL ?? '/jira'

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Basic ${BASIC_TOKEN}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15000,
})

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── API calls ──────────────────────────────────────────────────────────────

/**
 * Fetch asset information from the Spartez/Ephor Asset Manager plugin.
 */
export async function getAssetInfo(itemId: string): Promise<AssetInfo> {
  const { data } = await client.get(
    `/rest/com-spartez-ephor/1.0/item/${itemId}`
  )
  return {
    jiraIssueId: data.jiraIssueId ?? data.issueKey ?? data.key ?? String(data.id),
    summary: data.summary ?? data.name,
    status: data.status?.name ?? data.status,
    assignee: data.assignee?.displayName ?? data.assignee,
  }
}

/**
 * Trigger a Jira workflow transition on the linked issue.
 *
 * Transition IDs (confirmed in Jira workflow config):
 *   "21"  → Check-in
 *   "201" → Check-out
 */
export async function transitionIssue(
  issueId: string,
  transitionId: '21' | '201'
): Promise<void> {
  await client.post(`/rest/api/2/issue/${issueId}/transitions`, {
    transition: { id: transitionId },
  })
}
