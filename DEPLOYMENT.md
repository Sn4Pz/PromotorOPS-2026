# Deploying Promotor OPS behind Apache httpd

This guide covers deploying the app at `ops.promotor.com` behind an Apache reverse proxy that terminates HTTPS.

## Architecture

```
Browser ──HTTPS──▶ Apache httpd (ops.promotor.com:443)
                      ├── /                → static files (dist/)
                      ├── /jira/*          → proxy to jira.promotor.com
                      └── /api/transition  → proxy to Node.js backend (:3001)
```

Three things must be served:

1. **Static files** — the built `dist/` folder (HTML, JS, CSS, icons)
2. **Jira proxy** — `/jira/*` requests forwarded to `https://jira.promotor.com` with auth headers
3. **Transition API** — `/api/transition` handled by a small Node.js process (the service account endpoint)

---

## Step 1: Build the app

```bash
cd /path/to/promotorops
npm ci
npm run build
```

This produces the `dist/` folder with all static assets.

Copy it to the web server:

```bash
cp -r dist/ /var/www/ops.promotor.com/
```

---

## Step 2: Set up the transition backend

The `/api/transition` endpoint uses a service account to perform Jira transitions.
In development this runs as Vite middleware; in production it needs a standalone process.

Create `/opt/promotorops/server.mjs`:

```javascript
import http from 'http'
import https from 'https'

const PORT = 3001
const TRANSITION_IDS = { checkin: '21', checkout: '201' }
const SERVICE_CREDS = Buffer.from(
  `${process.env.JIRA_SERVICE_USER}:${process.env.JIRA_SERVICE_PASS}`
).toString('base64')

const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': 'https://ops.promotor.com',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  if (req.method !== 'POST' || req.url !== '/api/transition') {
    res.writeHead(404)
    res.end('Not Found')
    return
  }

  let body = ''
  req.on('data', (chunk) => { body += chunk.toString() })
  req.on('end', () => {
    let issueId, mode
    try {
      const parsed = JSON.parse(body)
      issueId = parsed.issueId
      mode = parsed.mode
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid JSON body' }))
      return
    }

    const transitionId = TRANSITION_IDS[mode]
    if (!issueId || !transitionId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
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
    }

    const jiraReq = https.request(options, (jiraRes) => {
      let data = ''
      jiraRes.on('data', (chunk) => { data += chunk })
      jiraRes.on('end', () => {
        res.writeHead(jiraRes.statusCode ?? 500, { 'Content-Type': 'application/json' })
        res.end(data || '{}')
      })
    })

    jiraReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    })

    jiraReq.write(payload)
    jiraReq.end()
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Transition API listening on http://127.0.0.1:${PORT}`)
})
```

Run it with PM2:

```bash
JIRA_SERVICE_USER=your.user JIRA_SERVICE_PASS=your_pass pm2 start /opt/promotorops/server.mjs --name PromotorOPS-API
pm2 save
```

---

## Step 3: Configure Apache httpd

Enable the required modules:

```bash
a2enmod ssl proxy proxy_http rewrite headers
systemctl restart httpd
```

Create the virtual host at `/etc/httpd/conf.d/ops.promotor.com.conf`
(or `/etc/apache2/sites-available/` on Debian-based systems):

```apache
<VirtualHost *:80>
    ServerName ops.promotor.com
    RewriteEngine On
    RewriteRule ^(.*)$ https://%{HTTP_HOST}$1 [R=301,L]
</VirtualHost>

<VirtualHost *:443>
    ServerName ops.promotor.com

    # ── SSL (certificates from your CA or Let's Encrypt) ──
    SSLEngine on
    SSLCertificateFile      /etc/ssl/certs/ops.promotor.com.crt
    SSLCertificateKeyFile   /etc/ssl/private/ops.promotor.com.key
    SSLCertificateChainFile /etc/ssl/certs/ops.promotor.com-chain.crt

    # ── Security headers ──
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    # ── Jira reverse proxy (/jira/* → jira.promotor.com) ──
    SSLProxyEngine on
    ProxyPreserveHost Off

    <Location /jira/>
        ProxyPass        https://jira.promotor.com/
        ProxyPassReverse https://jira.promotor.com/

        # Strip browser cookies so Jira's XSRF filter doesn't fire
        RequestHeader unset Cookie
        RequestHeader set X-Atlassian-Token "no-check"
    </Location>

    # ── Transition API (/api/transition → Node.js on :3001) ──
    <Location /api/transition>
        ProxyPass        http://127.0.0.1:3001/api/transition
        ProxyPassReverse http://127.0.0.1:3001/api/transition
    </Location>

    # ── Static files (the built PWA) ──
    DocumentRoot /var/www/ops.promotor.com

    <Directory /var/www/ops.promotor.com>
        Options -Indexes
        AllowOverride None
        Require all granted

        # Cache static assets aggressively (Vite hashes filenames)
        <FilesMatch "\.(js|css|png|svg|ico|woff2?)$">
            Header set Cache-Control "public, max-age=31536000, immutable"
        </FilesMatch>
    </Directory>

    # ── SPA fallback: serve index.html for all non-file routes ──
    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/jira/
    RewriteCond %{REQUEST_URI} !^/api/
    RewriteCond %{DOCUMENT_ROOT}%{REQUEST_URI} !-f
    RewriteCond %{DOCUMENT_ROOT}%{REQUEST_URI} !-d
    RewriteRule ^ /index.html [L]

    # ── Logging ──
    ErrorLog  /var/log/httpd/ops.promotor.com-error.log
    CustomLog /var/log/httpd/ops.promotor.com-access.log combined
</VirtualHost>
```

Test and reload:

```bash
apachectl configtest
systemctl reload httpd
```

---

## Step 4: Verify

1. Open `https://ops.promotor.com` — the PWA should load
2. Log in with Jira credentials — validates against `/jira/rest/api/2/myself`
3. Scan a QR code — fetches asset and issue data through `/jira/rest/...`
4. Perform a check-in/out — hits `/api/transition` → Node.js → Jira

---

## Step 5: PWA install

Once the site is served over HTTPS with a valid certificate:
- **Android Chrome**: tap the "Install" banner or Menu → "Add to Home screen"
- **iOS Safari**: tap Share → "Add to Home Screen"

The service worker (Workbox) will cache all assets for offline shell support.

---

## Updating the app

```bash
cd /path/to/promotorops
git pull
npm ci
npm run build
cp -r dist/* /var/www/ops.promotor.com/
```

The PWA auto-update (via `registerType: 'autoUpdate'`) will pick up the new service worker
within minutes. Users don't need to clear cache or reinstall.

---

## Firewall / network checklist

| Port | Direction | Purpose |
|------|-----------|---------|
| 443 | Inbound | HTTPS from user devices |
| 80 | Inbound | HTTP → redirect to HTTPS |
| 443 | Outbound | Apache → jira.promotor.com |
| 3001 | Loopback only | Apache → Node.js transition API |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| 502 on `/jira/*` | Apache can't reach jira.promotor.com | Check `SSLProxyEngine on` and outbound 443 |
| 403 on Jira transitions | XSRF filter | Ensure `RequestHeader set X-Atlassian-Token "no-check"` |
| Camera not working | Not HTTPS or cert untrusted | Verify SSL cert is valid (`curl -I https://ops.promotor.com`) |
| PWA won't install | Missing manifest or not HTTPS | Check DevTools → Application → Manifest |
| Stale content after update | Old service worker | Wait 1-2 min or manually unregister in DevTools |
