import { useState, useEffect } from 'react'

export function useAuthBlob(url: string | undefined, token: string) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!url)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!url) { setLoading(false); return }
    let active = true
    let obj: string | null = null
    setLoading(true); setError(false)
    fetch(url, { headers: { Authorization: `Basic ${token}` } })
      .then(r  => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob() })
      .then(bl => { if (!active) return; obj = URL.createObjectURL(bl); setBlobUrl(obj); setLoading(false) })
      .catch(() => { if (active) { setError(true); setLoading(false) } })
    return () => { active = false; if (obj) URL.revokeObjectURL(obj) }
  }, [url, token])

  return { blobUrl, loading, error }
}
