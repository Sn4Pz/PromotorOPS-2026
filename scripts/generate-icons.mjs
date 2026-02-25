/**
 * Generates PWA icons from favicon.png.
 * Each icon gets the app background colour (#0f172a) as a solid base so iOS
 * never shows a black fill behind transparent pixels.
 * The favicon is centred and scaled to 75% of the canvas so there's a
 * comfortable padding on all sides.
 */
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')
const src       = path.join(publicDir, 'favicon.png')

// App background — must match tailwind / manifest background_color
const BG = { r: 15, g: 23, b: 42, alpha: 1 }   // #0f172a

async function makeIcon(size, destName, padding = 0.18) {
  const logoSize = Math.round(size * (1 - padding * 2))

  // Resize the logo (preserve transparency)
  const logo = await sharp(src)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  const offset = Math.round((size - logoSize) / 2)

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, top: offset, left: offset }])
    .png()
    .toFile(path.join(publicDir, destName))

  console.log(`✓  ${destName}  (${size}×${size})`)
}

await makeIcon(192, 'pwa-192x192.png')
await makeIcon(512, 'pwa-512x512.png')
await makeIcon(180, 'apple-touch-icon.png')   // iOS home screen
await makeIcon(32,  'favicon-32.png', 0.1)    // optional small favicon
console.log('Done.')
