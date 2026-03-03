# Promotor OPS — PWA

A Progressive Web App for equipment asset management.
Operators scan QR codes to trigger Jira check-in / check-out transitions via the Ephor Asset Manager plugin.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript + Vite 5 |
| Styling | Tailwind CSS 3 |
| QR Scanning | jsQR (iOS/Safari) + BarcodeDetector (Chrome/Android) |
| HTTP | Axios → Jira REST API v2 + Ephor REST API |
| PWA | vite-plugin-pwa (Workbox, auto-update) |

## Features

- **Login** — Jira credentials + 4-digit PIN for quick re-entry
- **Main Menu** — Check In (work in progress), Check Out (returned), Scan Asset
- **QR Scanner** — Camera-based scanning with Ephor URL parsing
- **Asset / Issue Viewer** — Ephor fields, Jira issue details, attachments, PDF preview, comments
- **Transitions** — Server-side Jira issue transitions via service account

## Development

```bash
npm install
npm run dev
```

The dev server runs on `https://192.168.123.223:5173` with a self-signed certificate.
A certificate installer page is available at `http://192.168.123.223:5174` for mobile testing.

### Environment Variables

Create a `.env` file in the project root (already gitignored):

```env
JIRA_SERVICE_USER=your.service.account
JIRA_SERVICE_PASS=your_password
```

These are used by the Vite dev server middleware for the `/api/transition` endpoint.

## Production Build

```bash
npm run build
```

Output goes to `dist/`. See `DEPLOYMENT.md` for reverse proxy setup.
