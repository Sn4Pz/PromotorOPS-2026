import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'

const TRANSITION_IDS: Record<string, string> = { checkin: '21', checkout: '201' }
const SERVICE_USER = process.env.JIRA_SERVICE_USER ?? 'andrei.buldus'
const SERVICE_PASS = process.env.JIRA_SERVICE_PASS ?? ''
const SERVICE_CREDS = Buffer.from(`${SERVICE_USER}:${SERVICE_PASS}`).toString('base64')

/**
 * Vite plugin that exposes a server-side endpoint for Jira transitions.
 * Because the request is made directly from Node.js (not the browser),
 * it never carries a JSESSIONID cookie and Jira's XSRF filter does not fire.
 */
const jiraTransitionPlugin = {
  name: 'jira-transition-middleware',
  configureServer(server: any) {
    server.middlewares.use('/api/transition', (req: any, res: any) => {
      // Only allow POST
      if (req.method !== 'POST') {
        res.writeHead(405)
        res.end('Method Not Allowed')
        return
      }

      // Read body
      let body = ''
      req.on('data', (chunk: Buffer) => { body += chunk.toString() })
      req.on('end', () => {
        let issueId: string, mode: string
        try {
          const parsed = JSON.parse(body)
          issueId = parsed.issueId
          mode = parsed.mode
        } catch {
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Invalid JSON body' }))
          return
        }

        const transitionId = TRANSITION_IDS[mode]
        if (!issueId || !transitionId) {
          res.writeHead(400)
          res.end(JSON.stringify({ error: `Unknown mode: ${mode}` }))
          return
        }

        const payload = JSON.stringify({ transition: { id: transitionId } })
        const options = {
          hostname: 'jira.promotor.com',
          port: 443,
          path: `/rest/api/2/issue/${issueId}/transitions`,
          method: 'POST',
          headers: {
            'Authorization': `Basic ${SERVICE_CREDS}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'X-Atlassian-Token': 'no-check',
          },
          rejectUnauthorized: true,
        }

        const jiraReq = https.request(options, (jiraRes) => {
          let data = ''
          jiraRes.on('data', (chunk) => { data += chunk })
          jiraRes.on('end', () => {
            res.writeHead(jiraRes.statusCode ?? 500, { 'Content-Type': 'application/json' })
            res.end(data || '{}')
          })
        })

        jiraReq.on('error', (err: Error) => {
          res.writeHead(502)
          res.end(JSON.stringify({ error: err.message }))
        })

        jiraReq.write(payload)
        jiraReq.end()
      })
    })
  },
}

const CERT_HTTP_PORT = 5174

const certServerPlugin = {
  name: 'cert-http-server',
  configureServer(server: any) {
    const certPath = path.resolve(__dirname, '.cert/cert.pem')
    const certPage = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Install Certificate — Promotor OPS</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:24px 16px}
  .card{background:#1e293b;border-radius:16px;padding:24px;margin-bottom:16px;border:1px solid #334155}
  h1{font-size:22px;margin-bottom:8px;color:#fff}
  h2{font-size:17px;margin-bottom:12px;color:#60a5fa}
  .subtitle{color:#94a3b8;font-size:14px;margin-bottom:24px}
  .step{display:flex;gap:12px;margin-bottom:16px;align-items:flex-start}
  .num{background:#3b82f6;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0}
  .step p{font-size:14px;line-height:1.5;padding-top:3px}
  .step p strong{color:#fff}
  .btn{display:block;width:100%;padding:16px;background:#3b82f6;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;text-align:center;text-decoration:none;margin-bottom:24px}
  .btn:active{background:#2563eb}
  .warn{background:#78350f;border-color:#92400e;color:#fbbf24;font-size:13px;padding:16px;line-height:1.5}
  .tabs{display:flex;gap:8px;margin-bottom:16px}
  .tab{flex:1;padding:10px;border-radius:8px;border:1px solid #475569;background:transparent;color:#94a3b8;font-size:14px;font-weight:600;cursor:pointer}
  .tab.active{background:#3b82f6;border-color:#3b82f6;color:#fff}
  .platform{display:none}
  .platform.active{display:block}
</style>
</head>
<body>
<h1>Promotor OPS</h1>
<p class="subtitle">Install the development certificate to enable HTTPS</p>

<a href="/cert.pem" download="promotor-ops.pem" class="btn">Download Certificate</a>

<div class="tabs">
  <button class="tab active" onclick="show('ios')">iOS</button>
  <button class="tab" onclick="show('android')">Android</button>
</div>

<div id="ios" class="platform active">
  <div class="card">
    <h2>iOS Setup</h2>
    <div class="step"><div class="num">1</div><p>Tap <strong>Download Certificate</strong> above. Safari will show "This website is trying to download a configuration profile." Tap <strong>Allow</strong>.</p></div>
    <div class="step"><div class="num">2</div><p>Open the downloaded <strong>promotor-ops.pem</strong> file from the Downloads notification or the Files app.</p></div>
    <div class="step"><div class="num">3</div><p>Open <strong>Settings → General → VPN & Device Management</strong>. Tap the <strong>192.168.123.223</strong> profile.</p></div>
    <div class="step"><div class="num">4</div><p>Tap <strong>Install</strong> (top right), enter your passcode, then tap <strong>Install</strong> again to confirm.</p></div>
    <div class="step"><div class="num">5</div><p>Go to <strong>Settings → General → About → Certificate Trust Settings</strong>.</p></div>
    <div class="step"><div class="num">6</div><p>Find <strong>192.168.123.223</strong> and toggle the switch <strong>ON</strong> to enable full trust.</p></div>
    <div class="step"><div class="num">7</div><p>Open <strong>https://192.168.123.223:5173</strong> in Safari — no warnings.</p></div>
  </div>
</div>

<div id="android" class="platform">
  <div class="card">
    <h2>Android Setup</h2>
    <div class="step"><div class="num">1</div><p>Tap <strong>Download Certificate</strong> above. The file will download to your device.</p></div>
    <div class="step"><div class="num">2</div><p>Open <strong>Settings → Security</strong> (or <strong>Biometrics & Security</strong>).</p></div>
    <div class="step"><div class="num">3</div><p>Tap <strong>Other security settings → Install from device storage</strong> (or <strong>Encryption & credentials → Install a certificate → CA certificate</strong>).</p></div>
    <div class="step"><div class="num">4</div><p>Select the downloaded <strong>promotor-ops.pem</strong> file. Enter your PIN/pattern if prompted.</p></div>
    <div class="step"><div class="num">5</div><p>Name it <strong>Promotor OPS</strong> and ensure <strong>VPN and apps</strong> (or <strong>Wi-Fi</strong>) is selected. Tap <strong>OK</strong>.</p></div>
    <div class="step"><div class="num">6</div><p>Open <strong>https://192.168.123.223:5173</strong> in Chrome — no warnings.</p></div>
  </div>
</div>

<div class="card warn">
  This certificate is for local development only and expires in 365 days. It will be replaced by the production HTTPS certificate from ops.promotor.com.
</div>

<script>
function show(id){
  document.querySelectorAll('.platform').forEach(el=>el.classList.remove('active'))
  document.querySelectorAll('.tab').forEach(el=>el.classList.remove('active'))
  document.getElementById(id).classList.add('active')
  event.target.classList.add('active')
}
</script>
</body>
</html>`

    const srv = http.createServer((req, res) => {
      if (req.url === '/cert.pem') {
        const cert = fs.readFileSync(certPath)
        res.writeHead(200, {
          'Content-Type': 'application/x-pem-file',
          'Content-Disposition': 'attachment; filename="promotor-ops.pem"',
          'Content-Length': cert.length,
        })
        res.end(cert)
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(certPage)
    })

    srv.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`  Certificate installer: port ${CERT_HTTP_PORT} already in use (previous instance still running — OK)`)
      } else {
        console.error('  Certificate server error:', err.message)
      }
    })

    srv.listen(CERT_HTTP_PORT, '192.168.123.223', () => {
      console.log(`\n  Certificate installer: http://192.168.123.223:${CERT_HTTP_PORT}\n`)
    })

    server.httpServer?.on('close', () => srv.close())
  },
}

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    jiraTransitionPlugin,
    certServerPlugin,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Promotor OPS',
        short_name: 'Promotor OPS',
        description: 'Asset check-in / check-out via QR scan',
        theme_color: '#1e40af',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
  server: {
    host: '192.168.123.223',
    port: 5173,
    allowedHosts: ['ops.promotor.com'],
    proxy: {
      '/jira': {
        target: 'https://jira.promotor.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/jira/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('cookie')
            proxyReq.setHeader('X-Atlassian-Token', 'no-check')
          })
        },
      }
    }
  }
})
