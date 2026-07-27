// ── Video helpers ─────────────────────────────────────────────────────────────

export function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    // youtube.com/watch?v=ID
    if ((u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com' || u.hostname === 'm.youtube.com') && u.searchParams.get('v')) {
      return `https://www.youtube.com/embed/${u.searchParams.get('v')}?autoplay=1`
    }
    // youtu.be/ID
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed${u.pathname}?autoplay=1`
    }
    // youtube.com/shorts/ID
    if ((u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') && u.pathname.startsWith('/shorts/')) {
      const id = u.pathname.replace('/shorts/', '')
      return `https://www.youtube.com/embed/${id}?autoplay=1`
    }
    // fallback — try embedding as-is
    return url
  } catch {
    return null
  }
}

export function VideoButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-blue-400 active:text-blue-600 p-1 shrink-0 ${className}`}
      aria-label="Watch video"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  )
}

export default function VideoSheet({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const embedUrl = toEmbedUrl(url)

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full bg-black rounded-t-2xl overflow-hidden">
        {/* Handle + title */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
          <p className="text-white text-sm font-semibold truncate flex-1 pt-1">{title}</p>
          <button onClick={onClose} className="text-white/60 active:text-white ml-2 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video */}
        {embedUrl ? (
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-white/60 text-sm">
            Unable to embed this video.
          </div>
        )}
        <div className="h-6" />
      </div>
    </div>
  )
}
