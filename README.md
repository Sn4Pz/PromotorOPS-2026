# ProMotor OPS — PWA (2026)

A Progressive Web App replacing the legacy ProMotor Android app.  
Operators scan equipment QR codes to trigger Jira check-in / check-out transitions.

## Why PWA?

- Runs in Chrome on any Android / iOS device — no APK, no Play Store
- Installable to home screen with full-screen experience
- Uses the device camera via browser APIs
- Built and deployed without Android Studio

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript + Vite 5 |
| Styling | Tailwind CSS 3 |
| QR Scanning | html5-qrcode |
| API | Axios + Jira REST API v2 |
| PWA | vite-plugin-pwa (Workbox) |

## Screens

1. **PIN Login** — 4-digit PIN gates access; all Jira calls use the service account
2. **QR Scanner** — Full-screen camera feed; parses Ephor Asset Manager URLs
3. **Asset Details** — Shows issue ID, summary, status; Check-in / Check-out buttons

## API Endpoints Used

| Endpoint | Purpose |
|---|---|
| `GET /rest/com-spartez-ephor/1.0/item/{itemId}` | Fetch asset info |
| `POST /rest/api/2/issue/{issueId}/transitions` `{transition:{id:"21"}}` | Check-in |
| `POST /rest/api/2/issue/{issueId}/transitions` `{transition:{id:"201"}}` | Check-out |

## Development

```bash
npm install
npm run dev
# Open http://localhost:5173
```

## Production Build

```bash
npm run build
# Serve the dist/ folder with any static host (Nginx, Netlify, etc.)
```

## Configuration

Copy `.env.example` → `.env.local` and set `VITE_JIRA_BASE_URL` if the Jira origin differs.
In dev mode the Vite proxy automatically forwards `/jira/*` calls to `https://jira.promotor.com`.
