import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import https from 'https'

// Transition IDs: 21 = check-in ("Incepere constatare"), 201 = check-out
const TRANSITION_IDS: Record<string, string> = { checkin: '21', checkout: '201' }
const SERVICE_CREDS = Buffer.from('andrei.buldus:Coracoid2015').toString('base64')

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

export default defineConfig({
  plugins: [
    react(),
    jiraTransitionPlugin,
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
    host: '192.168.123.177',
    port: 5173,
    https: {
      key:  fs.readFileSync('./192.168.123.177-key.pem'),
      cert: fs.readFileSync('./192.168.123.177.pem'),
    },
    proxy: {
      '/jira': {
        target: 'https://jira.promotor.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/jira/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Strip session cookies so Jira always authenticates via the
            // Basic Auth header. If a JSESSIONID cookie is forwarded, Jira
            // switches to session-based auth and then demands an XSRF token
            // that we don't have — resulting in "XSRF check failed".
            proxyReq.removeHeader('cookie')
            // Belt-and-suspenders: also tell Jira to skip its XSRF filter.
            proxyReq.setHeader('X-Atlassian-Token', 'no-check')
          })
        },
      }
    }
  }
})
