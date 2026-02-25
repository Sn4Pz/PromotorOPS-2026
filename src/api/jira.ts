import axios, { AxiosInstance, AxiosError } from 'axios'

const JIRA_BASE = 'https://jira.promotor.com'
const BASE_URL  = import.meta.env.VITE_JIRA_BASE_URL ?? '/jira'

function makeClient(authToken: string): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Basic ${authToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // Required by Jira for all write operations (POST/PUT/DELETE) from a
      // browser origin — without this Jira's XSRF filter returns 403.
      'X-Atlassian-Token': 'no-check',
    },
    timeout: 15000,
  })
}

// ── Error helper ───────────────────────────────────────────────────────────

export function extractJiraError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const e    = err as AxiosError<{ errorMessages?: string[]; errors?: Record<string, string>; message?: string }>
    const code = e.response?.status
    const data = e.response?.data
    if (data) {
      const msgs = [...(data.errorMessages ?? []), ...Object.values(data.errors ?? {})].filter(Boolean)
      if (msgs.length) return `[${code}] ${msgs.join(' ')}`
      if (data.message) return `[${code}] ${data.message}`
    }
    if (code === 403) return '[403] Permission denied — service account cannot perform this transition from current state.'
    if (code === 400) return '[400] Transition not valid — issue may already be in this state.'
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

/** One custom field from the Ephor asset — parsed for display */
export interface AssetField {
  name:        string   // field def name e.g. "modelul.echipamentului"
  title:       string   // display title e.g. "Modelul Echipamentelor"
  value:       string   // formatted value
  mobileY:     number   // sort order for mobile display
  templateName: string  // "checkbox" | "date" | "stringline" | "stringarea" | "image"
}

/** Full parsed Ephor asset item */
export interface AssetItem {
  itemId:      string
  typeName:    string
  title:       string
  jiraIssueId: string         // issue key like "PM-123" — from /links endpoint
  fields:      AssetField[]
  imageRef?:   string         // value of the system.image field if present
  createdBy?:  string
  updatedBy?:  string
  created?:    string
  updated?:    string
}

/** A single attachment on a Jira issue */
export interface JiraAttachment {
  id:         string
  filename:   string
  mimeType:   string
  size:       number
  content:    string    // proxied download URL
  thumbnail?: string    // proxied thumbnail URL (images only)
  created:    string
  author:     string
}

/** A single comment on a Jira issue */
export interface JiraComment {
  id:      string
  author:  string
  body:    string
  created: string
  updated: string
}

/** Full Jira issue from GET /rest/api/2/issue/{key} */
export interface JiraIssue {
  id:           string
  key:          string
  browseUrl:    string
  summary:      string
  status:       string
  statusColor:  string
  issueType:    string
  priority?:    string
  assignee?:    string
  reporter?:    string
  description?: string
  created:      string
  updated:      string
  duedate?:     string
  labels:       string[]
  attachments:  JiraAttachment[]
  comments:     JiraComment[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Matches the exact regex from the old Android app's UrlUtils.kt */
export function extractItemIdFromUrl(url: string): string | null {
  const match = url.match(/.+\/item\/(\d+)$/)
  return match?.[1] ?? null
}

function formatTs(ts: string | number): string {
  try {
    return new Date(Number(ts)).toLocaleDateString('ro-RO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return String(ts) }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ro-RO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFields(rawFields: any[]): { fields: AssetField[]; imageRef?: string } {
  const fields: AssetField[] = []
  let imageRef: string | undefined

  for (const f of rawFields) {
    const def          = f.def ?? {}
    const type         = def.type ?? {}
    const templateName: string = type.templateName ?? 'stringline'
    const name:         string = type.name ?? def.name ?? ''
    const title:        string = def.title ?? type.defaultTitle ?? name
    const mobileY:      number = def.mobileY ?? 99
    const rawValues:    string[] = f.values ?? []

    // Skip system fields that are not useful on mobile
    if (name === 'system.image') {
      imageRef = rawValues[0]
      continue
    }

    if (!rawValues.length || rawValues.every(v => !v)) continue

    let value = rawValues[0]

    if (templateName === 'date' && value) {
      value = formatTs(value)
    } else if (templateName === 'checkbox') {
      value = value === '1' ? 'Da' : 'Nu'
    }

    fields.push({ name, title, value, mobileY, templateName })
  }

  // Sort by mobileY (mobile display order defined in Ephor)
  fields.sort((a, b) => a.mobileY - b.mobileY)

  return { fields, imageRef }
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function validateJiraCredentials(username: string, password: string): Promise<JiraUser> {
  const client = makeClient(btoa(`${username}:${password}`))
  const { data } = await client.get<JiraUser>('/rest/api/2/myself')
  return data
}

// ── Asset Manager API ──────────────────────────────────────────────────────

/**
 * Step 1: GET /rest/com-spartez-ephor/1.0/item/{itemId}
 * Fetches asset metadata and rich custom field definitions (titles, types, mobileY order).
 *
 * Step 2: GET /rest/com-spartez-ephor/2.0/assets/{itemId}
 * The v2 API returns an "issues" array with linked Jira issue keys directly.
 * Confirmed: {"issues":["EIS-592"],...}
 */
export async function getAssetItem(itemId: string, userToken: string): Promise<AssetItem> {
  const client = makeClient(userToken)

  // Step 1 — v1 for rich field definitions (titles, types, mobileY ordering)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await client.get<any>(`/rest/com-spartez-ephor/1.0/item/${itemId}`)

  const { fields, imageRef } = parseFields(data.fields ?? [])

  // Title = value of the system.title field
  const titleField = (data.fields ?? []).find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (f: any) => f.def?.type?.name === 'system.title'
  )
  const title = titleField?.values?.[0] ?? data.typeName ?? `Item ${itemId}`

  // Step 2 — v2 API returns the "issues" array with linked Jira issue keys
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: v2data } = await client.get<any>(`/rest/com-spartez-ephor/2.0/assets/${itemId}`)
  const linkedIssues: string[] = v2data.issues ?? []
  const jiraIssueId = linkedIssues[0] ?? ''

  if (!jiraIssueId) {
    throw new Error(
      `No Jira issue linked to asset "${title}" (id: ${itemId}).\n` +
      `Please link a Jira issue via the "JIRA Issues" section in Ephor.`
    )
  }

  return {
    itemId,
    typeName:  data.typeName ?? '',
    title,
    jiraIssueId,
    fields,
    imageRef,
    createdBy: data.createdBy?.fullName?.replace(/\s*\(deleted\)\s*$/i, ''),
    updatedBy: data.updatedBy?.fullName?.replace(/\s*\(deleted\)\s*$/i, ''),
    created:   data.created ? formatTs(data.created) : undefined,
    updated:   data.updated ? formatTs(data.updated) : undefined,
  }
}

// ── Jira Issue API ─────────────────────────────────────────────────────────

export async function getIssueDetails(issueKey: string, userToken: string): Promise<JiraIssue> {
  const client = makeClient(userToken)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await client.get<any>(
    `/rest/api/2/issue/${issueKey}` +
    `?fields=summary,status,issuetype,priority,assignee,reporter,description` +
    `,created,updated,duedate,labels,attachment,comment`
  )
  const f = data.fields ?? {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attachments: JiraAttachment[] = (f.attachment ?? []).map((a: any) => ({
    id:        a.id,
    filename:  a.filename,
    mimeType:  a.mimeType ?? 'application/octet-stream',
    size:      a.size ?? 0,
    // Rewrite Jira base URL → proxy path so all fetches go through /jira
    content:   String(a.content ?? '').replace(JIRA_BASE, BASE_URL),
    thumbnail: a.thumbnail ? String(a.thumbnail).replace(JIRA_BASE, BASE_URL) : undefined,
    created:   formatDate(a.created),
    author:    a.author?.displayName ?? '—',
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comments: JiraComment[] = (f.comment?.comments ?? []).map((c: any) => ({
    id:      c.id,
    author:  c.author?.displayName ?? '—',
    body:    c.body ?? '',
    created: formatDate(c.created),
    updated: formatDate(c.updated),
  }))

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
    duedate:     f.duedate ? formatDate(f.duedate) : undefined,
    labels:      Array.isArray(f.labels) ? f.labels : [],
    attachments,
    comments,
  }
}

// ── Transitions ───────────────────────────────────────────────────────────

/**
 * Transitions an issue using the service account (andrei.buldus) regardless
 * of which user is logged in.
 *
 * The call goes to /api/transition — a Node.js server-side middleware in
 * vite.config.ts — which forwards it directly to Jira using the https module.
 * This completely bypasses the browser's cookie jar and Jira's XSRF filter,
 * exactly as a native Android app would behave.
 *
 * Hardcoded IDs:
 *   checkin  → 21  (Incepere constatare)
 *   checkout → 201 (Finalizare constatare)
 */
export async function transitionIssue(issueId: string, mode: 'checkin' | 'checkout'): Promise<void> {
  const res = await fetch('/api/transition', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issueId, mode }),
  })

  if (!res.ok) {
    let msg = `[${res.status}]`
    try {
      const body = await res.json() as { error?: string; errorMessages?: string[] }
      const detail = body.error ?? body.errorMessages?.join(' ') ?? ''
      if (detail) msg += ` ${detail}`
    } catch { /* ignore */ }
    throw new Error(msg)
  }
}
