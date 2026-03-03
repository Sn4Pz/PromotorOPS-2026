/**
 * Module-level camera stream cache.
 *
 * Keeps the MediaStream alive across React component mounts/unmounts so iOS
 * does not trigger a permission prompt every time the QR scanner is opened.
 *
 * Permission strategy:
 *  - prewarmCamera() is called right after login so the permission dialog
 *    appears ONCE at login time, not when the scanner is opened.
 *  - The stream is reused until the user explicitly releases it (Back button /
 *    logout) or the app regains focus after being backgrounded.
 *  - iOS remembers the grant permanently only when the user taps "Allow"
 *    (not "Allow Once"). We cannot force that choice, but we can minimise how
 *    often the dialog appears by keeping the stream alive.
 */

let _stream: MediaStream | null = null

export function getCachedStream(): MediaStream | null {
  if (_stream && _stream.active) return _stream
  _stream = null
  return null
}

export function setCachedStream(s: MediaStream): void {
  _stream = s
}

export function releaseCachedStream(): void {
  _stream?.getTracks().forEach(t => t.stop())
  _stream = null
}

