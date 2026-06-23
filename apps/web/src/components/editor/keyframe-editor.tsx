import { useState } from 'react'
import { useTimeline, type Keyframe, type TimelineClip } from './timeline-context.tsx'
import { Button } from '#/components/ui/button.tsx'

const PRESETS: { label: string; icon: string; desc: string; fn: (c: TimelineClip) => Keyframe[] }[] = [
  { label: 'Ken Burns In', icon: '+', desc: 'Slow zoom in', fn: (c) => [
    { time: 0, x: c.x, y: c.y, width: c.width, height: c.height, opacity: c.opacity, rotation: c.rotation },
    { time: c.duration, x: c.x - c.width * 0.1, y: c.y - c.height * 0.1, width: c.width * 1.2, height: c.height * 1.2, opacity: c.opacity, rotation: c.rotation },
  ] },
  { label: 'Ken Burns Out', icon: '-', desc: 'Slow zoom out', fn: (c) => [
    { time: 0, x: c.x - c.width * 0.1, y: c.y - c.height * 0.1, width: c.width * 1.2, height: c.height * 1.2, opacity: c.opacity, rotation: c.rotation },
    { time: c.duration, x: c.x, y: c.y, width: c.width, height: c.height, opacity: c.opacity, rotation: c.rotation },
  ] },
  { label: 'Slide Left', icon: '→', desc: 'Enter from left', fn: (c) => [
    { time: 0, x: -c.width, y: c.y, width: c.width, height: c.height, opacity: c.opacity, rotation: c.rotation },
    { time: 0.5, x: c.x, y: c.y, width: c.width, height: c.height, opacity: c.opacity, rotation: c.rotation },
  ] },
  { label: 'Slide Right', icon: '←', desc: 'Enter from right', fn: (c) => [
    { time: 0, x: 1920, y: c.y, width: c.width, height: c.height, opacity: c.opacity, rotation: c.rotation },
    { time: 0.5, x: c.x, y: c.y, width: c.width, height: c.height, opacity: c.opacity, rotation: c.rotation },
  ] },
  { label: 'Fade In', icon: '◐', desc: '0 to 100% opacity', fn: (c) => [
    { time: 0, x: c.x, y: c.y, width: c.width, height: c.height, opacity: 0, rotation: c.rotation },
    { time: 0.5, x: c.x, y: c.y, width: c.width, height: c.height, opacity: 100, rotation: c.rotation },
  ] },
  { label: 'Fade Out', icon: '◑', desc: '100 to 0% opacity', fn: (c) => [
    { time: Math.max(0, c.duration - 0.5), x: c.x, y: c.y, width: c.width, height: c.height, opacity: 100, rotation: c.rotation },
    { time: c.duration, x: c.x, y: c.y, width: c.width, height: c.height, opacity: 0, rotation: c.rotation },
  ] },
]

function describeKf(kf: Keyframe): string {
  const parts: string[] = []
  if (kf.x !== 0 || kf.y !== 0) parts.push(`pos:${Math.round(kf.x)},${Math.round(kf.y)}`)
  const zoom = Math.round((kf.width / 1920) * 100)
  if (zoom !== 100) parts.push(`zoom:${zoom}%`)
  if (kf.opacity !== 100) parts.push(`op:${Math.round(kf.opacity)}%`)
  if (kf.rotation !== 0) parts.push(`rot:${Math.round(kf.rotation)}`)
  return parts.length > 0 ? parts.join(' ') : 'default'
}

export function KeyframeEditor({ clip }: { clip: TimelineClip }) {
  const { playheadTime, updateClipKeyframe, removeClipKeyframe, updateClipProps } = useTimeline()
  const [editingIdx, setEditingIdx] = useState<number | null>(null)

  const keyframes = clip.keyframes ?? []
  const relativeTime = Math.max(0, Math.min(clip.duration, playheadTime - clip.startTime))

  const addKeyframeAtPlayhead = () => {
    const kf: Keyframe = {
      time: relativeTime,
      x: clip.x, y: clip.y,
      width: clip.width, height: clip.height,
      opacity: clip.opacity, rotation: clip.rotation,
    }
    updateClipKeyframe(clip.id, kf)
  }

  const applyPreset = (fn: (c: TimelineClip) => Keyframe[]) => {
    updateClipProps(clip.id, { keyframes: fn(clip) })
    setEditingIdx(null)
  }

  const editingKf = editingIdx !== null ? keyframes[editingIdx] : null

  const updateKfField = (key: keyof Keyframe, val: string) => {
    if (!editingKf) return
    const n = parseFloat(val)
    if (isNaN(n)) return
    updateClipKeyframe(clip.id, { ...editingKf, [key]: n })
  }

  return (
    <div className="px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Motion Presets</span>
      </div>

      {/* 2x3 preset grid */}
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.fn)}
            className="flex flex-col items-center gap-0.5 rounded-md border border-border bg-muted/30 px-2 py-1.5 transition-colors hover:border-primary/50 hover:bg-muted"
          >
            <span className="text-sm leading-none">{p.icon}</span>
            <span className="text-[8px] font-bold text-foreground">{p.label}</span>
            <span className="text-[7px] text-muted-foreground">{p.desc}</span>
          </button>
        ))}
      </div>

      {/* Add keyframe button */}
      <Button size="sm" variant="outline" className="mb-2 w-full text-[10px]" onClick={addKeyframeAtPlayhead}>
        + Keyframe at {relativeTime.toFixed(1)}s
      </Button>

      {/* Keyframe list */}
      {keyframes.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Keyframes ({keyframes.length})
          </span>
          {keyframes.map((kf, i) => {
            const isEditing = editingIdx === i
            return (
              <div key={i} className={`rounded border p-1.5 ${isEditing ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/20'}`}>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setEditingIdx(isEditing ? null : i)}
                    className="flex items-center gap-1.5 text-left"
                  >
                    <span className="inline-block size-2 rotate-45 bg-yellow-400" />
                    <span className="font-mono text-[9px] font-bold text-foreground">{kf.time.toFixed(2)}s</span>
                    <span className="text-[8px] text-muted-foreground">{describeKf(kf)}</span>
                  </button>
                  <button
                    onClick={() => { removeClipKeyframe(clip.id, kf.time); setEditingIdx(null) }}
                    className="text-[9px] text-destructive hover:underline"
                  >
                    Del
                  </button>
                </div>
                {isEditing && (
                  <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1">
                    {(['time', 'x', 'y', 'width', 'height', 'opacity', 'rotation'] as const).map((k) => (
                      <div key={k} className="flex items-center justify-between gap-1">
                        <span className="text-[8px] text-muted-foreground">{k}</span>
                        <input
                          type="number"
                          value={Math.round(kf[k] * 100) / 100}
                          onChange={(e) => updateKfField(k, e.target.value)}
                          className="w-14 rounded border border-border bg-background px-1 py-0.5 text-right text-[9px] text-foreground outline-none focus:border-primary/50"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
