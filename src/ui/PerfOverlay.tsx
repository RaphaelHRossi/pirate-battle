import { useEffect, useRef } from 'react'

const REFRESH_MS = 500

/**
 * `?perf=1` badge with live FPS and peak entity count. It writes to the
 * DOM directly on a timer, so measuring never makes React re-render per
 * frame. Decorative: the numbers end up in the downloadable report.
 */
export function PerfOverlay({
  read,
}: {
  read: () => { fps: number; entities: number } | null
}) {
  const textRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const id = window.setInterval(() => {
      const stats = read()
      if (!textRef.current || !stats) return
      textRef.current.textContent = `${stats.fps.toFixed(0)} FPS · max ${String(stats.entities)} entities`
    }, REFRESH_MS)
    return () => {
      window.clearInterval(id)
    }
  }, [read])

  return (
    <span
      className="perf-overlay"
      aria-hidden="true"
      data-testid="perf-overlay"
    >
      <span ref={textRef}>perf: recording…</span>
    </span>
  )
}
