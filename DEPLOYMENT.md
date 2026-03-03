# Deploying Promotor OPS behind Apache httpd

The app runs in **Vite dev mode** on the server (HTTP, port 5173). Apache httpd acts as a reverse proxy in front of it, terminating HTTPS and forwarding all traffic to Vite.

Vite already handles everything internally: serving the app, proxying `/jira/*` to Jira, and the `/api/transition` middleware. Apache's only job is SSL termination.

## Architecture

```
Browser ──HTTPS──▶ Apache httpd (192.168.123.2 / ops.promotor.com:443)
                      │
                      └── /*  ──HTTP──▶  Vite dev server (192.168.123.223:5173)
                                            ├── /              → app (React)
                                            ├── /jira/*        → proxy to jira.promotor.com
                                            └── /api/transition→ server-side middleware
```

---

## Step 1: Prepare the app

```bash
cd /path/to/promotorops
npm ci
```

No build step needed — the app runs in dev mode.

### Environment variables

Create a `.env` file in the project root:

```env
JIRA_SERVICE_USER=your.service.account
JIRA_SERVICE_PASS=your_password
```

### Vite server config

The Vite dev server is already configured to listen on `192.168.123.223:5173`.
Once Apache is handling HTTPS, remove the `https` block from `vite.config.ts` so Vite serves plain HTTP.
The `certServerPlugin` can also be removed (or left in — it's harmless):

```typescript
server: {
    host: '192.168.123.223',
    port: 5173,
    // https block removed — Apache on 192.168.123.2 handles SSL termination
    proxy: { ... }
}
```

---

## Step 2: Run the app with PM2

```bash
cd /path/to/promotorops
pm2 start npm --name PromotorOPS -- run dev
pm2 save
```

Verify it's running:

```bash
pm2 logs PromotorOPS --lines 10
# Should show: VITE v5.x.x ready in xxx ms
#              ➜ Network: http://192.168.123.223:5173/
```

---

## Step 3: Configure Apache httpd

On the reverse proxy machine (`192.168.123.2`), enable the required modules:

```bash
a2enmod ssl proxy proxy_http proxy_wstunnel rewrite headers
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

    # ── Reverse proxy: everything → Vite on 192.168.123.223:5173 ──
    ProxyPreserveHost On
    ProxyRequests Off

    # WebSocket support (Vite HMR uses WebSockets)
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) ws://192.168.123.223:5173/$1 [P,L]

    # All HTTP traffic → Vite
    ProxyPass        / http://192.168.123.223:5173/
    ProxyPassReverse / http://192.168.123.223:5173/

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

1. Open `https://ops.promotor.com` — the app should load (valid Sectigo cert, no warnings)
2. Log in with Jira credentials — validates through Vite's `/jira` proxy
3. Scan a QR code — fetches asset and issue data
4. Perform a check-in/out — hits `/api/transition` handled by Vite middleware

---

## Step 5: PWA install

Once the site is served over HTTPS with a valid certificate:
- **Android Chrome**: tap the "Install" banner or Menu → "Add to Home screen"
- **iOS Safari**: tap Share → "Add to Home Screen"

The service worker (Workbox) will cache assets for offline shell support.

---

## Updating the app

```bash
cd /path/to/promotorops
git pull
npm ci
pm2 restart PromotorOPS
```

The Vite dev server restarts with the latest code. The PWA auto-update mechanism
will pick up changes within minutes. Users don't need to clear cache or reinstall.

---

## Firewall / network checklist

| Machine | Port | Direction | Purpose |
|---------|------|-----------|---------|
| 192.168.123.2 (Apache) | 443 | Inbound | HTTPS from user devices |
| 192.168.123.2 (Apache) | 80 | Inbound | HTTP → redirect to HTTPS |
| 192.168.123.2 → .223 | 5173 | LAN | Apache → Vite dev server |
| 192.168.123.223 (Vite) | 5173 | Inbound from .2 | App + Jira proxy + transition API |
| 192.168.123.223 (Vite) | 5174 | LAN (optional) | Certificate installer (dev only, not needed in prod) |
| 192.168.123.223 | 443 | Outbound | Vite proxy → jira.promotor.com |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| 502 Bad Gateway | Vite not running or .223 unreachable | `pm2 status` on .223; check firewall allows .2 → .223:5173 |
| 502 on `/jira/*` | .223 can't reach jira.promotor.com | Check outbound 443 / DNS from .223 |
| 403 on Jira transitions | XSRF filter | Vite proxy handles this — check `pm2 logs` on .223 |
| Camera not working | Not HTTPS or cert untrusted | Verify SSL cert on .2: `curl -I https://ops.promotor.com` |
| PWA won't install | Missing manifest or not HTTPS | Check DevTools → Application → Manifest |
| HMR not connecting | WebSocket not proxied | Ensure `proxy_wstunnel` module is enabled on .2 |
