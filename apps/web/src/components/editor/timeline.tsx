import { useRef, useState, useCallback, useEffect } from 'react'
import { useTimeline, TRACK_META, TRACK_COUNT } from './timeline-context.tsx'

const API = 'http://localhost:3737'
const PIXELS_PER_SECOND = 40
const TRACK_HEIGHT = 44
const RULER_HEIGHT = 24

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function Timeline() {
  const {
    clips, playheadTime, selectedClipId, isPlaying, totalDuration,
    hiddenTracks, defaultClipDuration,
    addClip, removeClip, selectClip, moveClip, setPlayhead, togglePlay,
    toggleTrackVisibility, updateClipProps,
  } = useTimeline()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [dragClipId, setDragClipId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [dropHighlight, setDropHighlight] = useState(false)
  const [captionsEnabled, setCaptionsEnabled] = useState(false)
  const [snapLineX, setSnapLineX] = useState<number | null>(null)
  const musicInputRef = useRef<HTMLInputElement>(null)

  const SNAP_THRESHOLD_PX = 8

  const timelineWidth = Math.max(totalDuration * PIXELS_PER_SECOND, 800)

  // Keyboard shortcuts (Delete, Backspace, E for expression cycle)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedClipId) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeClip(selectedClipId)
      }
      if (e.key === 'e' || e.key === 'E') {
        const clip = clips.find((c) => c.id === selectedClipId)
        if (clip?.characterName) {
          window.dispatchEvent(new CustomEvent('youstudio:cycle-expression', { detail: { clipId: clip.id } }))
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedClipId, clips, removeClip])

  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0)
    setPlayhead(x / PIXELS_PER_SECOND)
  }, [setPlayhead])

  const handleClipMouseDown = useCallback((e: React.MouseEvent, clipId: string) => {
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
    const rawX = e.clientX - rect.left + scrollEl.scrollLeft - dragOffset
    let time = Math.max(0, rawX / PIXELS_PER_SECOND)

    // Build snap targets
    const snapTimes: number[] = [playheadTime]
    for (const c of clips) {
      if (c.id === dragClipId) continue
      snapTimes.push(c.startTime, c.startTime + c.duration)
    }
    for (let t = 0; t <= totalDuration; t += 1) snapTimes.push(t)

    const thresholdSec = SNAP_THRESHOLD_PX / PIXELS_PER_SECOND
    let snapped = false
    for (const st of snapTimes) {
      if (Math.abs(time - st) < thresholdSec) {
        time = st
        setSnapLineX(st * PIXELS_PER_SECOND)
        snapped = true
        break
      }
    }
    if (!snapped) setSnapLineX(null)

    moveClip(dragClipId, time)
  }, [dragClipId, dragOffset, moveClip, clips, playheadTime, totalDuration])

  const handleMouseUp = useCallback(() => { setDragClipId(null); setSnapLineX(null) }, [])

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
    const trackY = e.clientY - rect.top - RULER_HEIGHT
    const track = Math.max(0, Math.min(TRACK_COUNT - 1, Math.floor(trackY / TRACK_HEIGHT)))
    addClip({ type: 'image', src: url, name, startTime, duration: defaultClipDuration, track })
  }, [addClip, defaultClipDuration])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDropHighlight(true)
  }, [])

  const handleDragLeave = useCallback(() => { setDropHighlight(false) }, [])

  const loadCaptions = async () => {
    try {
      const res = await fetch(`${API}/voice/transcript`)
      if (!res.ok) return
      const data = (await res.json()) as { segments?: { start: number; end: number; text: string }[]; text?: string }
      if (data.segments && data.segments.length > 0) {
        for (const seg of data.segments) {
          addClip({ type: 'caption', src: '', name: 'Caption', text: seg.text, startTime: seg.start, duration: seg.end - seg.start, track: 0 })
        }
      } else if (data.text) {
        const words = data.text.split(/\s+/)
        const chunkSize = 8
        for (let i = 0; i < words.length; i += chunkSize) {
          const text = words.slice(i, i + chunkSize).join(' ')
          addClip({ type: 'caption', src: '', name: 'Caption', text, startTime: (i / chunkSize) * 3, duration: 3, track: 0 })
        }
      }
      setCaptionsEnabled(true)
    } catch {}
  }

  const autoPlaceFromScript = async () => {
    try {
      const [briefRes, assetsRes] = await Promise.all([
        fetch(`${API}/brief/today`),
        fetch(`${API}/forge/assets`),
      ])
      if (!briefRes.ok || !assetsRes.ok) return
      const manifest = (await briefRes.json()) as {
        editingScript?: { scene?: number; style?: string; timestamp?: number; duration?: number }[]
        imagePrompts?: { scene?: number; filename?: string }[]
      }
      const { assets } = (await assetsRes.json()) as { assets: { filename: string; url: string }[] }
      const script = manifest.editingScript ?? []
      const prompts = manifest.imagePrompts ?? []

      for (let i = 0; i < script.length; i++) {
        const scene = script[i]
        const prompt = prompts.find((p) => p.scene === scene.scene)
        const asset = prompt ? assets.find((a) => a.filename === prompt.filename) : assets[i]
        if (!asset) continue

        const startTime = scene.timestamp ?? i * (defaultClipDuration)
        const duration = script[i + 1]
          ? (script[i + 1].timestamp ?? (i + 1) * defaultClipDuration) - startTime
          : defaultClipDuration
        const isBackground = asset.filename.toLowerCase().includes('bg') || asset.filename.toLowerCase().includes('background')

        addClip({
          type: 'image',
          src: `${API}/forge${asset.url.startsWith('/') ? '' : '/'}${asset.url}`,
          name: asset.filename,
          startTime,
          duration,
          track: isBackground ? 0 : 1,
        })
      }
    } catch {}
  }

  const addMusicTrack = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    addClip({ type: 'audio', src: url, name: file.name, startTime: 0, duration: 60, track: 3, volume: 0.3 })
    e.target.value = ''
  }

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

        <div className="mx-2 h-4 w-px bg-border" />

        <button
          onClick={autoPlaceFromScript}
          className="rounded bg-muted/60 px-2 py-0.5 text-[9px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Auto-place images from editing script"
        >
          Auto-Place
        </button>
        <button
          onClick={captionsEnabled ? () => setCaptionsEnabled(false) : loadCaptions}
          className={`rounded px-2 py-0.5 text-[9px] font-medium ${
            captionsEnabled ? 'bg-primary/20 text-primary' : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
          title="Toggle captions from transcript"
        >
          Captions
        </button>
        <button
          onClick={() => musicInputRef.current?.click()}
          className="rounded bg-muted/60 px-2 py-0.5 text-[9px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Add music/SFX"
        >
          Add Music
        </button>
        <input ref={musicInputRef} type="file" accept="audio/*" className="hidden" onChange={addMusicTrack} />

        <div className="ml-auto flex items-center gap-1">
          {TRACK_META.map((meta, i) => (
            <button
              key={i}
              onClick={() => toggleTrackVisibility(i)}
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition-colors ${
                hiddenTracks.has(i)
                  ? 'bg-muted/30 text-muted-foreground/40 line-through'
                  : 'text-white'
              }`}
              style={{ backgroundColor: hiddenTracks.has(i) ? undefined : meta.accent + '40' }}
              title={`Toggle ${meta.label} track`}
            >
              {meta.label}
            </button>
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
          {Array.from({ length: TRACK_COUNT }).map((_, trackIdx) => {
            const meta = TRACK_META[trackIdx]
            return (
              <div
                key={trackIdx}
                className="relative border-b border-border/30"
                style={{
                  height: TRACK_HEIGHT,
                  backgroundColor: hiddenTracks.has(trackIdx) ? 'transparent' : meta.accent + '08',
                }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0)
                  setPlayhead(x / PIXELS_PER_SECOND)
                  selectClip(null)
                }}
              >
                {/* Track label */}
                <div className="pointer-events-none absolute left-1 top-1 z-10 rounded px-1 py-0.5 text-[8px] font-bold text-white/30" style={{ backgroundColor: meta.accent + '20' }}>
                  {meta.label}
                </div>

                {clips
                  .filter((c) => c.track === trackIdx)
                  .map((clip) => {
                    const isSelected = selectedClipId === clip.id
                    const clipW = clip.duration * PIXELS_PER_SECOND
                    const isAudio = clip.type === 'audio'
                    const isCaption = clip.type === 'caption'

                    return (
                      <div
                        key={clip.id}
                        className={`absolute top-1 cursor-grab select-none overflow-hidden rounded border ${
                          isSelected ? 'border-[#7C3AED] ring-1 ring-[#7C3AED]' : 'border-white/20'
                        }`}
                        style={{
                          left: clip.startTime * PIXELS_PER_SECOND,
                          width: clipW,
                          height: TRACK_HEIGHT - 8,
                          ...(clip.type === 'image' && clip.src
                            ? { backgroundImage: `url(${clip.src})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                            : {}),
                        }}
                        onMouseDown={(e) => handleClipMouseDown(e, clip.id)}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          const newDur = window.prompt('Duration (seconds):', String(clip.duration))
                          if (newDur) {
                            const n = parseFloat(newDur)
                            if (!isNaN(n) && n > 0) updateClipProps(clip.id, { duration: n })
                          }
                        }}
                      >
                        {/* Dark overlay for readability */}
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundColor: isAudio
                              ? (trackIdx === 3 ? 'rgba(249,115,22,0.7)' : 'rgba(16,185,129,0.7)')
                              : isCaption
                                ? 'rgba(255,255,255,0.15)'
                                : 'rgba(0,0,0,0.45)',
                          }}
                        />
                        <div className="relative z-10 flex h-full items-center gap-1 px-1.5">
                          {isAudio && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="shrink-0 text-white/70">
                              <rect x="0" y="3" width="1.5" height="4" /><rect x="2.5" y="1" width="1.5" height="8" />
                              <rect x="5" y="2" width="1.5" height="6" /><rect x="7.5" y="3.5" width="1.5" height="3" />
                            </svg>
                          )}
                          <span className="truncate text-[9px] font-medium text-white/90">
                            {isCaption ? clip.text : clip.name}
                          </span>
                        </div>
                        {/* Keyframe diamonds */}
                        {clip.keyframes && clip.keyframes.length > 0 && clipW > 0 && (
                          <div className="pointer-events-none absolute inset-x-0 bottom-0.5 z-20 h-2">
                            {clip.keyframes.map((kf) => {
                              const pct = clip.duration > 0 ? (kf.time / clip.duration) * 100 : 0
                              return (
                                <div
                                  key={kf.time}
                                  className="absolute -translate-x-1/2 rotate-45 border border-yellow-300 bg-yellow-400"
                                  style={{ left: `${pct}%`, width: 6, height: 6 }}
                                />
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            )
          })}

          {/* Snap line */}
          {snapLineX !== null && (
            <div
              className="pointer-events-none absolute top-0 z-30"
              style={{ left: snapLineX, height: RULER_HEIGHT + TRACK_COUNT * TRACK_HEIGHT }}
            >
              <div className="h-full w-px bg-yellow-400/80" />
            </div>
          )}

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
              <span className="text-[10px] text-muted-foreground/50">BG track on top, CHR below, then VO and MUS</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
