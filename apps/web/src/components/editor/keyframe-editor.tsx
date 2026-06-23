import { useState } from 'react'
import { useTimeline, type Keyframe, type TimelineClip } from './timeline-context.tsx'
import { Button } from '#/components/ui/button.tsx'

const PRESETS = [
  { label: 'Ken Burns In', desc: 'Slow zoom in', fn: (c: TimelineClip): Keyframe[] => [
    { time: 0, x: c.x, y: c.y, width: c.width, height: c.height, opacity: c.opacity, rotation: c.rotation },
    { time: c.duration, x: c.x - c.width * 0.1, y: c.y - c.height * 0.1, width: c.width * 1.2, height: c.height * 1.2, opacity: c.opacity, rotation: c.rotation },
  ] },
  { label: 'Ken Burns Out', desc: 'Slow zoom out', fn: (c: TimelineClip): Keyframe[] => [
    { time: 0, x: c.x - c.width * 0.1, y: c.y - c.height * 0.1, width: c.width * 1.2, height: c.height * 1.2, opacity: c.opacity, rotation: c.rotation },
    { time: c.duration, x: c.x, y: c.y, width: c.width, height: c.height, opacity: c.opacity, rotation: c.rotation },
  ] },
  { label: 'Slide In Left', desc: 'Enter from left', fn: (c: TimelineClip): Keyframe[] => [
    { time: 0, x: -c.width, y: c.y, width: c.width, height: c.height, opacity: c.opacity, rotation: c.rotation },
    { time: 0.5, x: c.x, y: c.y, width: c.width, height: c.height, opacity: c.opacity, rotation: c.rotation },
  ] },
  { label: 'Slide In Right', desc: 'Enter from right', fn: (c: TimelineClip): Keyframe[] => [
    { time: 0, x: 1920, y: c.y, width: c.width, height: c.height, opacity: c.opacity, rotation: c.rotation },
    { time: 0.5, x: c.x, y: c.y, width: c.width, height: c.height, opacity: c.opacity, rotation: c.rotation },
  ] },
  { label: 'Fade In', desc: '0→100% opacity', fn: (c: TimelineClip): Keyframe[] => [
    { time: 0, x: c.x, y: c.y, width: c.width, height: c.height, opacity: 0, rotation: c.rotation },
    { time: 0.5, x: c.x, y: c.y, width: c.width, height: c.height, opacity: 100, rotation: c.rotation },
  ] },
  { label: 'Fade Out', desc: '100→0% opacity', fn: (c: TimelineClip): Keyframe[] => [
    { time: Math.max(0, c.duration - 0.5), x: c.x, y: c.y, width: c.width, height: c.height, opacity: 100, rotation: c.rotation },
    { time: c.duration, x: c.x, y: c.y, width: c.width, height: c.height, opacity: 0, rotation: c.rotation },
  ] },
] as const

export function KeyframeEditor({ clip }: { clip: TimelineClip }) {
  const { playheadTime, updateClipKeyframe, removeClipKeyframe, updateClipProps } = useTimeline()
  const [selectedKfTime, setSelectedKfTime] = useState<number | null>(null)

  const keyframes = clip.keyframes ?? []
  const selectedKf = selectedKfTime !== null
    ? keyframes.find((k) => Math.abs(k.time - selectedKfTime) < 0.01)
    : null

  const relativeTime = Math.max(0, Math.min(clip.duration, playheadTime - clip.startTime))

  const addKeyframeAtPlayhead = () => {
    const kf: Keyframe = {
      time: relativeTime,
      x: clip.x,
      y: clip.y,
      width: clip.width,
      height: clip.height,
      opacity: clip.opacity,
      rotation: clip.rotation,
    }
    updateClipKeyframe(clip.id, kf)
    setSelectedKfTime(kf.time)
  }

  const applyPreset = (presetFn: (c: TimelineClip) => Keyframe[]) => {
    const newKfs = presetFn(clip)
    updateClipProps(clip.id, { keyframes: newKfs })
    setSelectedKfTime(null)
  }

  const updateSelectedKf = (key: keyof Keyframe, val: string) => {
    if (!selectedKf) return
    const n = parseFloat(val)
    if (isNaN(n)) return
    updateClipKeyframe(clip.id, { ...selectedKf, [key]: n })
  }

  const MINI_W = 200
  const pxPerSec = clip.duration > 0 ? MINI_W / clip.duration : MINI_W

  return (
    <div className="px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Keyframes</span>
        <span className="text-[9px] text-muted-foreground">{keyframes.length} keys</span>
      </div>

      {/* Mini timeline */}
      <div className="relative mb-2 h-6 w-full rounded border border-border bg-muted/30" style={{ maxWidth: MINI_W }}>
        {/* Playhead indicator */}
        <div
          className="absolute top-0 h-full w-px bg-red-500/70"
          style={{ left: relativeTime * pxPerSec }}
        />
        {/* Keyframe diamonds */}
        {keyframes.map((kf) => {
          const isActive = selectedKfTime !== null && Math.abs(kf.time - selectedKfTime) < 0.01
          return (
            <button
              key={kf.time}
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 border transition-colors ${
                isActive ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-yellow-400 bg-yellow-400/80 hover:bg-yellow-300'
              }`}
              style={{ left: kf.time * pxPerSec, width: 8, height: 8 }}
              onClick={() => setSelectedKfTime(isActive ? null : kf.time)}
              title={`t=${kf.time.toFixed(2)}s`}
            />
          )
        })}
      </div>

      <div className="mb-2 flex gap-1">
        <Button size="sm" variant="outline" className="h-6 text-[9px]" onClick={addKeyframeAtPlayhead}>
          + Add at {relativeTime.toFixed(1)}s
        </Button>
        {selectedKf && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[9px] text-destructive"
            onClick={() => { removeClipKeyframe(clip.id, selectedKf.time); setSelectedKfTime(null) }}
          >
            Remove
          </Button>
        )}
      </div>

      {/* Selected keyframe editor */}
      {selectedKf && (
        <div className="mb-2 rounded border border-border bg-muted/20 p-2">
          <p className="mb-1 text-[9px] font-bold text-muted-foreground">t = {selectedKf.time.toFixed(2)}s</p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {(['x', 'y', 'width', 'height', 'opacity', 'rotation'] as const).map((k) => (
              <div key={k} className="flex items-center justify-between gap-1">
                <span className="text-[9px] text-muted-foreground">{k}</span>
                <input
                  type="number"
                  value={Math.round(selectedKf[k])}
                  onChange={(e) => updateSelectedKf(k, e.target.value)}
                  className="w-14 rounded border border-border bg-background px-1 py-0.5 text-right text-[9px] text-foreground outline-none focus:border-primary/50"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Presets */}
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.fn)}
            className="rounded border border-border bg-muted/30 px-1.5 py-0.5 text-[8px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={p.desc}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
