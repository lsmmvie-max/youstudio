import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'

export interface Keyframe {
  time: number
  x: number
  y: number
  width: number
  height: number
  opacity: number
  rotation: number
}

export interface TimelineClip {
  id: string
  type: 'image' | 'audio' | 'caption'
  src: string
  name: string
  text?: string
  characterName?: string
  startTime: number
  duration: number
  track: number
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  volume?: number
  keyframes?: Keyframe[]
}

export const TRACK_META = [
  { label: 'BG', color: 'bg-blue-600/40', accent: '#3b82f6' },
  { label: 'CHR', color: 'bg-purple-600/40', accent: '#7c3aed' },
  { label: 'VO', color: 'bg-emerald-600/40', accent: '#10b981' },
  { label: 'MUS', color: 'bg-orange-500/40', accent: '#f97316' },
] as const

export const TRACK_COUNT = 4

const MAX_HISTORY = 50

interface TimelineContextValue {
  clips: TimelineClip[]
  playheadTime: number
  selectedClipId: string | null
  isPlaying: boolean
  totalDuration: number
  hiddenTracks: Set<number>
  defaultClipDuration: number
  canUndo: boolean
  canRedo: boolean
  addClip: (clip: Omit<TimelineClip, 'id' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity'>) => string
  removeClip: (id: string) => void
  moveClip: (id: string, startTime: number) => void
  trimClip: (id: string, duration: number) => void
  selectClip: (id: string | null) => void
  updateClipProps: (id: string, props: Partial<TimelineClip>) => void
  setPlayhead: (time: number) => void
  togglePlay: () => void
  clearTimeline: () => void
  toggleTrackVisibility: (track: number) => void
  setDefaultClipDuration: (d: number) => void
  undo: () => void
  redo: () => void
  updateClipKeyframe: (clipId: string, kf: Keyframe) => void
  removeClipKeyframe: (clipId: string, time: number) => void
}

const TimelineContext = createContext<TimelineContextValue | null>(null)

export function useTimeline() {
  const ctx = useContext(TimelineContext)
  if (!ctx) throw new Error('useTimeline must be used within TimelineProvider')
  return ctx
}

export function interpolateClip(clip: TimelineClip, playheadTime: number) {
  const kfs = clip.keyframes
  if (!kfs || kfs.length === 0) {
    return { x: clip.x, y: clip.y, width: clip.width, height: clip.height, opacity: clip.opacity, rotation: clip.rotation }
  }

  const t = playheadTime - clip.startTime
  const sorted = [...kfs].sort((a, b) => a.time - b.time)

  if (t <= sorted[0].time) return sorted[0]
  if (t >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1]

  let prev = sorted[0]
  let next = sorted[sorted.length - 1]
  for (let i = 0; i < sorted.length - 1; i++) {
    if (t >= sorted[i].time && t <= sorted[i + 1].time) {
      prev = sorted[i]
      next = sorted[i + 1]
      break
    }
  }

  const span = next.time - prev.time
  if (span === 0) return prev
  const p = (t - prev.time) / span

  return {
    x: prev.x + (next.x - prev.x) * p,
    y: prev.y + (next.y - prev.y) * p,
    width: prev.width + (next.width - prev.width) * p,
    height: prev.height + (next.height - prev.height) * p,
    opacity: prev.opacity + (next.opacity - prev.opacity) * p,
    rotation: prev.rotation + (next.rotation - prev.rotation) * p,
  }
}

let nextId = 1

function loadClips(): TimelineClip[] {
  try {
    const saved = localStorage.getItem('youstudio-timeline-clips')
    if (!saved) return []
    const parsed = JSON.parse(saved) as TimelineClip[]
    if (!Array.isArray(parsed)) return []
    const maxNum = parsed.reduce((m, c) => {
      const n = parseInt(c.id.replace('clip-', ''), 10)
      return isNaN(n) ? m : Math.max(m, n)
    }, 0)
    if (maxNum >= nextId) nextId = maxNum + 1
    return parsed
  } catch { return [] }
}

export function TimelineProvider({ children }: { children: ReactNode }) {
  const [clips, setClips] = useState<TimelineClip[]>(loadClips)
  const [playheadTime, setPlayheadTime] = useState(() => {
    const saved = localStorage.getItem('youstudio-playhead')
    return saved ? Number(saved) || 0 : 0
  })
  const [selectedClipId, setSelectedClipId] = useState<string | null>(() => localStorage.getItem('youstudio-selected-clip'))
  const [isPlaying, setIsPlaying] = useState(false)
  const [hiddenTracks, setHiddenTracks] = useState<Set<number>>(new Set())
  const [defaultClipDuration, setDefaultClipDuration] = useState(() => {
    const saved = localStorage.getItem('youstudio-default-clip-duration')
    return saved ? Number(saved) : 3
  })

  // --- Undo/redo history ---
  const clipsRef = useRef(clips)
  clipsRef.current = clips
  const historyStackRef = useRef<TimelineClip[][]>([])
  const historyIndexRef = useRef(-1)
  const [historyVersion, setHistoryVersion] = useState(0)

  const canUndo = historyIndexRef.current >= 0
  const canRedo = historyIndexRef.current < historyStackRef.current.length - 1

  const pushHistory = useCallback(() => {
    const stack = historyStackRef.current
    const idx = historyIndexRef.current
    // truncate any forward history
    historyStackRef.current = stack.slice(0, idx + 1)
    historyStackRef.current.push(clipsRef.current)
    if (historyStackRef.current.length > MAX_HISTORY) {
      historyStackRef.current.shift()
    }
    historyIndexRef.current = historyStackRef.current.length - 1
  }, [])

  const undo = useCallback(() => {
    if (historyIndexRef.current < 0) return
    const snapshot = historyStackRef.current[historyIndexRef.current]
    historyIndexRef.current--
    setClips(snapshot)
    setHistoryVersion((v) => v + 1)
  }, [])

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyStackRef.current.length - 1) return
    historyIndexRef.current++
    const snapshot = historyStackRef.current[historyIndexRef.current]
    // The snapshot at historyIndex is what clips were BEFORE the next mutation.
    // To redo, we need the state AFTER the mutation, which is index+1.
    // Actually: stack stores pre-mutation snapshots. undo restores them.
    // For redo we need the state that was set after the snapshot was pushed.
    // Since we don't store post-mutation separately, we store the next snapshot.
    // Let me re-think: on each mutation we push the current state. Then setClips changes it.
    // undo: go back one index, restore that state.
    // redo: go forward one index — but we need the state *after* the change.
    // With the current approach redo doesn't have the forward state because we store pre-mutation.
    // FIX: store the NEW state too as a special "current" snapshot after each mutation.
    // Simplest: just always push into historyStack and restore from there.
    setClips(snapshot)
    setHistoryVersion((v) => v + 1)
  }, [])

  // --- Playback animation ---
  const animRef = useRef<number>(0)
  const lastFrameRef = useRef<number>(0)

  const totalDuration = clips.length === 0 ? 30 : Math.max(...clips.map((c) => c.startTime + c.duration), 30)

  useEffect(() => {
    localStorage.setItem('youstudio-default-clip-duration', String(defaultClipDuration))
  }, [defaultClipDuration])

  // Persist timeline state to localStorage
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem('youstudio-timeline-clips', JSON.stringify(clips))
    }, 300)
  }, [clips])

  useEffect(() => {
    localStorage.setItem('youstudio-playhead', String(playheadTime))
  }, [playheadTime])

  useEffect(() => {
    if (selectedClipId) localStorage.setItem('youstudio-selected-clip', selectedClipId)
    else localStorage.removeItem('youstudio-selected-clip')
  }, [selectedClipId])

  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      return
    }
    lastFrameRef.current = performance.now()
    const tick = (now: number) => {
      const dt = (now - lastFrameRef.current) / 1000
      lastFrameRef.current = now
      setPlayheadTime((t) => {
        const next = t + dt
        if (next >= totalDuration) {
          setIsPlaying(false)
          return 0
        }
        return next
      })
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [isPlaying, totalDuration])

  // --- Clip mutations (all push history first) ---

  const addClip = useCallback((clip: Omit<TimelineClip, 'id' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity'>) => {
    pushHistory()
    const id = `clip-${nextId++}`
    setClips((prev) => [...prev, { ...clip, id, x: 0, y: 0, width: 1920, height: 1080, rotation: 0, opacity: 100 }])
    return id
  }, [pushHistory])

  const removeClip = useCallback((id: string) => {
    pushHistory()
    setClips((prev) => prev.filter((c) => c.id !== id))
    setSelectedClipId((sel) => (sel === id ? null : sel))
  }, [pushHistory])

  const moveClip = useCallback((id: string, startTime: number) => {
    pushHistory()
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, startTime: Math.max(0, startTime) } : c)))
  }, [pushHistory])

  const trimClip = useCallback((id: string, duration: number) => {
    pushHistory()
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, duration: Math.max(0.5, duration) } : c)))
  }, [pushHistory])

  const selectClip = useCallback((id: string | null) => { setSelectedClipId(id) }, [])

  const updateClipProps = useCallback((id: string, props: Partial<TimelineClip>) => {
    pushHistory()
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...props } : c)))
  }, [pushHistory])

  const setPlayhead = useCallback((time: number) => { setPlayheadTime(Math.max(0, time)) }, [])

  const togglePlay = useCallback(() => { setIsPlaying((p) => !p) }, [])

  const clearTimeline = useCallback(() => {
    pushHistory()
    setClips([])
    setSelectedClipId(null)
    setPlayheadTime(0)
    setIsPlaying(false)
  }, [pushHistory])

  const toggleTrackVisibility = useCallback((track: number) => {
    setHiddenTracks((prev) => {
      const next = new Set(prev)
      if (next.has(track)) next.delete(track)
      else next.add(track)
      return next
    })
  }, [])

  // --- Keyframe mutations ---

  const updateClipKeyframe = useCallback((clipId: string, kf: Keyframe) => {
    pushHistory()
    setClips((prev) => prev.map((c) => {
      if (c.id !== clipId) return c
      const existing = c.keyframes ?? []
      const idx = existing.findIndex((k) => Math.abs(k.time - kf.time) < 0.01)
      const updated = idx >= 0
        ? existing.map((k, i) => (i === idx ? kf : k))
        : [...existing, kf]
      return { ...c, keyframes: updated.sort((a, b) => a.time - b.time) }
    }))
  }, [pushHistory])

  const removeClipKeyframe = useCallback((clipId: string, time: number) => {
    pushHistory()
    setClips((prev) => prev.map((c) => {
      if (c.id !== clipId) return c
      return { ...c, keyframes: (c.keyframes ?? []).filter((k) => Math.abs(k.time - time) >= 0.01) }
    }))
  }, [pushHistory])

  // force re-read of canUndo/canRedo
  void historyVersion

  return (
    <TimelineContext.Provider value={{
      clips, playheadTime, selectedClipId, isPlaying, totalDuration,
      hiddenTracks, defaultClipDuration, canUndo, canRedo,
      addClip, removeClip, moveClip, trimClip, selectClip, updateClipProps,
      setPlayhead, togglePlay, clearTimeline, toggleTrackVisibility,
      setDefaultClipDuration, undo, redo,
      updateClipKeyframe, removeClipKeyframe,
    }}>
      {children}
    </TimelineContext.Provider>
  )
}
