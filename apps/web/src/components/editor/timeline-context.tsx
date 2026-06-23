import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'

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
}

export const TRACK_META = [
  { label: 'BG', color: 'bg-blue-600/40', accent: '#3b82f6' },
  { label: 'CHR', color: 'bg-purple-600/40', accent: '#7c3aed' },
  { label: 'VO', color: 'bg-emerald-600/40', accent: '#10b981' },
  { label: 'MUS', color: 'bg-orange-500/40', accent: '#f97316' },
] as const

export const TRACK_COUNT = 4

interface TimelineContextValue {
  clips: TimelineClip[]
  playheadTime: number
  selectedClipId: string | null
  isPlaying: boolean
  totalDuration: number
  hiddenTracks: Set<number>
  defaultClipDuration: number
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
}

const TimelineContext = createContext<TimelineContextValue | null>(null)

export function useTimeline() {
  const ctx = useContext(TimelineContext)
  if (!ctx) throw new Error('useTimeline must be used within TimelineProvider')
  return ctx
}

let nextId = 1

export function TimelineProvider({ children }: { children: ReactNode }) {
  const [clips, setClips] = useState<TimelineClip[]>([])
  const [playheadTime, setPlayheadTime] = useState(0)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hiddenTracks, setHiddenTracks] = useState<Set<number>>(new Set())
  const [defaultClipDuration, setDefaultClipDuration] = useState(() => {
    const saved = localStorage.getItem('youstudio-default-clip-duration')
    return saved ? Number(saved) : 3
  })
  const animRef = useRef<number>(0)
  const lastFrameRef = useRef<number>(0)

  const totalDuration = clips.length === 0 ? 30 : Math.max(...clips.map((c) => c.startTime + c.duration), 30)

  useEffect(() => {
    localStorage.setItem('youstudio-default-clip-duration', String(defaultClipDuration))
  }, [defaultClipDuration])

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

  const addClip = useCallback((clip: Omit<TimelineClip, 'id' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity'>) => {
    const id = `clip-${nextId++}`
    setClips((prev) => [...prev, { ...clip, id, x: 0, y: 0, width: 1920, height: 1080, rotation: 0, opacity: 100 }])
    return id
  }, [])

  const removeClip = useCallback((id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id))
    setSelectedClipId((sel) => (sel === id ? null : sel))
  }, [])

  const moveClip = useCallback((id: string, startTime: number) => {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, startTime: Math.max(0, startTime) } : c)))
  }, [])

  const trimClip = useCallback((id: string, duration: number) => {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, duration: Math.max(0.5, duration) } : c)))
  }, [])

  const selectClip = useCallback((id: string | null) => { setSelectedClipId(id) }, [])

  const updateClipProps = useCallback((id: string, props: Partial<TimelineClip>) => {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...props } : c)))
  }, [])

  const setPlayhead = useCallback((time: number) => { setPlayheadTime(Math.max(0, time)) }, [])

  const togglePlay = useCallback(() => { setIsPlaying((p) => !p) }, [])

  const clearTimeline = useCallback(() => {
    setClips([])
    setSelectedClipId(null)
    setPlayheadTime(0)
    setIsPlaying(false)
  }, [])

  const toggleTrackVisibility = useCallback((track: number) => {
    setHiddenTracks((prev) => {
      const next = new Set(prev)
      if (next.has(track)) next.delete(track)
      else next.add(track)
      return next
    })
  }, [])

  return (
    <TimelineContext.Provider value={{
      clips, playheadTime, selectedClipId, isPlaying, totalDuration,
      hiddenTracks, defaultClipDuration,
      addClip, removeClip, moveClip, trimClip, selectClip, updateClipProps,
      setPlayhead, togglePlay, clearTimeline, toggleTrackVisibility,
      setDefaultClipDuration,
    }}>
      {children}
    </TimelineContext.Provider>
  )
}
