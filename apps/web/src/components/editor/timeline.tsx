import { useRef, useState, useCallback } from 'react'
import { useTimeline } from './timeline-context.tsx'

const PIXELS_PER_SECOND = 40
const TRACK_HEIGHT = 40
const RULER_HEIGHT = 24
const TRACK_COUNT = 4

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const TRACK_COLORS: Record<string, string> = {
  image: 'bg-sky-600/70 border-sky-500/80',
  audio: 'bg-emerald-600/70 border-emerald-500/80',
}

export function Timeline() {
  const {
    clips, playheadTime, selectedClipId, isPlaying, totalDuration,
    addClip, selectClip, moveClip, setPlayhead, togglePlay,
  } = useTimeline()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [dragClipId, setDragClipId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [dropHighlight, setDropHighlight] = useState(false)

  const timelineWidth = Math.max(totalDuration * PIXELS_PER_SECOND, 800)

  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0)
    setPlayhead(x / PIXELS_PER_SECOND)
  }, [setPlayhead])

  const handleClipMouseDown = useCallback((e: React.MouseEvent, clipId: string, startTime: number) => {
    e.stopPropagation()
    selectClip(clipId)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDragClipId(clipId)
    setDragOffset(e.clientX - rect.left)
  }, [selectClip])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragClipId) return
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    const rect = scrollEl.getBoundingClientRect()
    const x = e.clientX - rect.left + scrollEl.scrollLeft - dragOffset
    moveClip(dragClipId, Math.max(0, x / PIXELS_PER_SECOND))
  }, [dragClipId, dragOffset, moveClip])

  const handleMouseUp = useCallback(() => { setDragClipId(null) }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDropHighlight(false)
    const url = e.dataTransfer.getData('text/plain')
    if (!url) return
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    const rect = scrollEl.getBoundingClientRect()
    const x = e.clientX - rect.left + scrollEl.scrollLeft
    const startTime = Math.max(0, x / PIXELS_PER_SECOND)
    const name = url.split('/').pop() ?? 'clip'
    addClip({ type: 'image', src: url, name, startTime, duration: 3, track: 0 })
  }, [addClip])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDropHighlight(true)
  }, [])

  const handleDragLeave = useCallback(() => { setDropHighlight(false) }, [])

  const rulerMarks: number[] = []
  for (let t = 0; t <= totalDuration; t += 5) rulerMarks.push(t)

  const playheadX = playheadTime * PIXELS_PER_SECOND

  return (
    <div
      className="flex h-full flex-col border-t border-border bg-[oklch(0.12_0.005_285)]"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Controls bar */}
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3">
        <button onClick={togglePlay} className="flex size-6 items-center justify-center rounded hover:bg-muted" title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="text-foreground">
              <rect x="1" y="1" width="4" height="10" /><rect x="7" y="1" width="4" height="10" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="text-foreground">
              <path d="M2 1L11 6L2 11V1Z" />
            </svg>
          )}
        </button>
        <button onClick={() => setPlayhead(0)} className="flex size-6 items-center justify-center rounded hover:bg-muted" title="Go to start">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="text-muted-foreground">
            <rect x="1" y="1" width="2" height="10" /><path d="M11 1L4 6L11 11V1Z" />
          </svg>
        </button>
        <span className="ml-1 font-mono text-[11px] text-foreground">{formatTime(playheadTime)}</span>
        <span className="text-[10px] text-muted-foreground">/ {formatTime(totalDuration)}</span>
        <div className="ml-auto flex items-center gap-1">
          {['V1', 'V2', 'A1', 'A2'].map((label) => (
            <span key={label} className="rounded bg-muted/60 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">{label}</span>
          ))}
        </div>
      </div>

      {/* Scrollable timeline area */}
      <div
        ref={scrollRef}
        className={`relative min-h-0 flex-1 overflow-auto ${dropHighlight ? 'ring-2 ring-inset ring-primary/50' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div style={{ width: timelineWidth, minHeight: RULER_HEIGHT + TRACK_COUNT * TRACK_HEIGHT }}>
          {/* Ruler */}
          <div
            className="sticky top-0 z-20 border-b border-border bg-[oklch(0.14_0.005_285)]"
            style={{ height: RULER_HEIGHT }}
            onClick={handleRulerClick}
          >
            {rulerMarks.map((t) => (
              <div
                key={t}
                className="absolute top-0 flex h-full flex-col items-start"
                style={{ left: t * PIXELS_PER_SECOND }}
              >
                <div className="h-2 w-px bg-muted-foreground/40" />
                <span className="pl-0.5 text-[8px] text-muted-foreground/60">{formatTime(t)}</span>
              </div>
            ))}
          </div>

          {/* Tracks */}
          {Array.from({ length: TRACK_COUNT }).map((_, trackIdx) => (
            <div
              key={trackIdx}
              className="relative border-b border-border/30"
              style={{ height: TRACK_HEIGHT }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0)
                setPlayhead(x / PIXELS_PER_SECOND)
                selectClip(null)
              }}
            >
              {clips
                .filter((c) => c.track === trackIdx)
                .map((clip) => (
                  <div
                    key={clip.id}
                    className={`absolute top-1 cursor-grab select-none overflow-hidden rounded border text-[9px] font-medium ${
                      TRACK_COLORS[clip.type] ?? TRACK_COLORS.image
                    } ${selectedClipId === clip.id ? 'ring-2 ring-primary' : ''}`}
                    style={{
                      left: clip.startTime * PIXELS_PER_SECOND,
                      width: clip.duration * PIXELS_PER_SECOND,
                      height: TRACK_HEIGHT - 8,
                    }}
                    onMouseDown={(e) => handleClipMouseDown(e, clip.id, clip.startTime)}
                  >
                    <div className="flex h-full items-center px-1.5 text-white/90">
                      <span className="truncate">{clip.name}</span>
                    </div>
                  </div>
                ))}
            </div>
          ))}

          {/* Playhead */}
          <div
            className="pointer-events-none absolute top-0 z-30"
            style={{ left: playheadX, height: RULER_HEIGHT + TRACK_COUNT * TRACK_HEIGHT }}
          >
            <div className="relative h-full">
              <div className="absolute -left-1 top-0 size-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-red-500" />
              <div className="absolute left-0 top-0 h-full w-px bg-red-500/80" />
            </div>
          </div>
        </div>

        {/* Empty state */}
        {clips.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground">Drag assets here to build your timeline</span>
              <span className="text-[10px] text-muted-foreground/50">Drop images from the asset panel</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
