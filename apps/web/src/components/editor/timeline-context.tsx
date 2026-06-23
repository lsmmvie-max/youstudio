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

export interface ColorGrading {
  brightness: number
  contrast: number
  saturation: number
  hue: number
  temperature: number
  highlights: number
  shadows: number
}

export interface AudioEffects {
  volume: number
  fadeIn: number
  fadeOut: number
  speed: number
}

export interface TimelineClip {
  id: string
  type: 'image' | 'audio' | 'caption' | 'video' | 'text'
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
  thumbnailUrl?: string
  fontSize?: number
  fontFamily?: string
  fontColor?: string
  textAlign?: 'left' | 'center' | 'right'
  bold?: boolean
  italic?: boolean
  textAnimation?: 'none' | 'fade-in' | 'typewriter' | 'slide-up' | 'slide-down' | 'pop'
  colorGrading?: ColorGrading
  audioEffects?: AudioEffects
  speed?: number
}

export interface Transition {
  fromClipId: string
  toClipId: string
  type: 'fade' | 'dissolve' | 'wipe-left' | 'wipe-right' | 'zoom'
  duration: number
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
  transitions: Transition[]
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
  addTransition: (fromClipId: string, toClipId: string, type: Transition['type'], duration: number) => void
  removeTransition: (fromClipId: string, toClipId: string) => void
  splitClip: (clipId: string, splitTime: number) => void
  rippleDelete: (clipId: string) => void
  loadProject: (data: { clips: TimelineClip[]; transitions: Transition[] }) => void
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

function loadTransitions(): Transition[] {
  try {
    const saved = localStorage.getItem('youstudio-timeline-transitions')
    if (!saved) return []
    const parsed = JSON.parse(saved) as Transition[]
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export function TimelineProvider({ children }: { children: ReactNode }) {
  const [clips, setClips] = useState<TimelineClip[]>(loadClips)
  const [transitions, setTransitions] = useState<Transition[]>(loadTransitions)
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
  const transitionsRef = useRef(transitions)
  transitionsRef.current = transitions
  const historyStackRef = useRef<{ clips: TimelineClip[]; transitions: Transition[] }[]>([])
  const historyIndexRef = useRef(-1)
  const [historyVersion, setHistoryVersion] = useState(0)

  const canUndo = historyIndexRef.current >= 0
  const canRedo = historyIndexRef.current < historyStackRef.current.length - 1

  const pushHistory = useCallback(() => {
    const stack = historyStackRef.current
    const idx = historyIndexRef.current
    historyStackRef.current = stack.slice(0, idx + 1)
    historyStackRef.current.push({ clips: clipsRef.current, transitions: transitionsRef.current })
    if (historyStackRef.current.length > MAX_HISTORY) {
      historyStackRef.current.shift()
    }
    historyIndexRef.current = historyStackRef.current.length - 1
  }, [])

  const undo = useCallback(() => {
    if (historyIndexRef.current < 0) return
    const snapshot = historyStackRef.current[historyIndexRef.current]
    historyIndexRef.current--
    setClips(snapshot.clips)
    setTransitions(snapshot.transitions)
    setHistoryVersion((v) => v + 1)
  }, [])

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyStackRef.current.length - 1) return
    historyIndexRef.current++
    const snapshot = historyStackRef.current[historyIndexRef.current]
    setClips(snapshot.clips)
    setTransitions(snapshot.transitions)
    setHistoryVersion((v) => v + 1)
  }, [])

  // --- Playback animation ---
  const animRef = useRef<number>(0)
  const lastFrameRef = useRef<number>(0)

  const totalDuration = clips.length === 0 ? 30 : Math.max(...clips.map((c) => c.startTime + c.duration), 30)

  useEffect(() => {
    localStorage.setItem('youstudio-default-clip-duration', String(defaultClipDuration))
  }, [defaultClipDuration])

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem('youstudio-timeline-clips', JSON.stringify(clips))
    }, 300)
  }, [clips])

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem('youstudio-timeline-transitions', JSON.stringify(transitions))
    }, 300)
  }, [transitions])

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
    setTransitions((prev) => prev.filter((t) => t.fromClipId !== id && t.toClipId !== id))
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
    setTransitions([])
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

  // --- Transition mutations ---

  const addTransition = useCallback((fromClipId: string, toClipId: string, type: Transition['type'], duration: number) => {
    pushHistory()
    setTransitions((prev) => {
      const filtered = prev.filter((t) => !(t.fromClipId === fromClipId && t.toClipId === toClipId))
      return [...filtered, { fromClipId, toClipId, type, duration }]
    })
  }, [pushHistory])

  const removeTransition = useCallback((fromClipId: string, toClipId: string) => {
    pushHistory()
    setTransitions((prev) => prev.filter((t) => !(t.fromClipId === fromClipId && t.toClipId === toClipId)))
  }, [pushHistory])

  // --- Split clip ---

  const splitClip = useCallback((clipId: string, splitTime: number) => {
    pushHistory()
    setClips((prev) => {
      const clip = prev.find((c) => c.id === clipId)
      if (!clip) return prev
      const relSplit = splitTime - clip.startTime
      if (relSplit <= 0.1 || relSplit >= clip.duration - 0.1) return prev

      const firstDuration = relSplit
      const secondDuration = clip.duration - relSplit
      const secondId = `clip-${nextId++}`

      const first: TimelineClip = { ...clip, duration: firstDuration }
      const second: TimelineClip = {
        ...clip,
        id: secondId,
        startTime: splitTime,
        duration: secondDuration,
        keyframes: undefined,
      }

      return prev.map((c) => (c.id === clipId ? first : c)).concat(second)
    })
  }, [pushHistory])

  // --- Ripple delete ---

  const rippleDelete = useCallback((clipId: string) => {
    pushHistory()
    setClips((prev) => {
      const clip = prev.find((c) => c.id === clipId)
      if (!clip) return prev
      const gap = clip.duration
      const track = clip.track
      const clipEnd = clip.startTime
      return prev
        .filter((c) => c.id !== clipId)
        .map((c) => {
          if (c.track === track && c.startTime > clipEnd) {
            return { ...c, startTime: Math.max(0, c.startTime - gap) }
          }
          return c
        })
    })
    setTransitions((prev) => prev.filter((t) => t.fromClipId !== clipId && t.toClipId !== clipId))
    setSelectedClipId((sel) => (sel === clipId ? null : sel))
  }, [pushHistory])

  // --- Load project ---

  const loadProject = useCallback((data: { clips: TimelineClip[]; transitions: Transition[] }) => {
    pushHistory()
    const maxNum = data.clips.reduce((m, c) => {
      const n = parseInt(c.id.replace('clip-', ''), 10)
      return isNaN(n) ? m : Math.max(m, n)
    }, 0)
    if (maxNum >= nextId) nextId = maxNum + 1
    setClips(data.clips)
    setTransitions(data.transitions)
    setSelectedClipId(null)
    setPlayheadTime(0)
    setIsPlaying(false)
  }, [pushHistory])

  // force re-read of canUndo/canRedo
  void historyVersion

  return (
    <TimelineContext.Provider value={{
      clips, transitions, playheadTime, selectedClipId, isPlaying, totalDuration,
      hiddenTracks, defaultClipDuration, canUndo, canRedo,
      addClip, removeClip, moveClip, trimClip, selectClip, updateClipProps,
      setPlayhead, togglePlay, clearTimeline, toggleTrackVisibility,
      setDefaultClipDuration, undo, redo,
      updateClipKeyframe, removeClipKeyframe,
      addTransition, removeTransition,
      splitClip, rippleDelete, loadProject,
    }}>
      {children}
    </TimelineContext.Provider>
  )
}
