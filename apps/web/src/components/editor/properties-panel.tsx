import { Separator } from '#/components/ui/separator.tsx'
import { useTimeline } from './timeline-context.tsx'

function PropertyInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 rounded border border-border bg-background px-1.5 py-0.5 text-right text-[11px] text-foreground outline-none focus:border-primary/50"
      />
    </div>
  )
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] text-foreground">{value}</span>
    </div>
  )
}

export function PropertiesPanel() {
  const { clips, selectedClipId, updateClipProps, removeClip } = useTimeline()
  const clip = clips.find((c) => c.id === selectedClipId)

  if (!clip) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-8 shrink-0 items-center border-b border-border px-3">
          <span className="text-[11px] font-medium text-muted-foreground">No Selection</span>
        </div>
        <div className="flex flex-col py-2">
          <div className="px-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Transform</span>
          </div>
          <PropertyRow label="X" value="0" />
          <PropertyRow label="Y" value="0" />
          <PropertyRow label="Width" value="1920" />
          <PropertyRow label="Height" value="1080" />
          <PropertyRow label="Rotation" value="0°" />
          <Separator className="my-2" />
          <div className="px-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Appearance</span>
          </div>
          <PropertyRow label="Opacity" value="100%" />
          <PropertyRow label="Blend" value="Normal" />
          <Separator className="my-2" />
          <div className="flex items-center justify-center py-6">
            <span className="text-[10px] text-muted-foreground/50">Select a clip to edit properties</span>
          </div>
        </div>
      </div>
    )
  }

  const setNum = (key: keyof typeof clip, val: string) => {
    const n = parseFloat(val)
    if (!isNaN(n)) updateClipProps(clip.id, { [key]: n })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="truncate text-[11px] font-medium text-foreground">{clip.name}</span>
        <button onClick={() => removeClip(clip.id)} className="text-[10px] text-destructive hover:underline">Remove</button>
      </div>
      <div className="flex flex-col py-2">
        <div className="px-3 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Clip Info</span>
        </div>
        <PropertyRow label="Type" value={clip.type} />
        <PropertyInput label="Start (s)" value={String(clip.startTime)} onChange={(v) => setNum('startTime', v)} />
        <PropertyInput label="Duration (s)" value={String(clip.duration)} onChange={(v) => setNum('duration', v)} />
        <Separator className="my-2" />
        <div className="px-3 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Transform</span>
        </div>
        <PropertyInput label="X" value={String(clip.x)} onChange={(v) => setNum('x', v)} />
        <PropertyInput label="Y" value={String(clip.y)} onChange={(v) => setNum('y', v)} />
        <PropertyInput label="Width" value={String(clip.width)} onChange={(v) => setNum('width', v)} />
        <PropertyInput label="Height" value={String(clip.height)} onChange={(v) => setNum('height', v)} />
        <PropertyInput label="Rotation" value={String(clip.rotation)} onChange={(v) => setNum('rotation', v)} />
        <Separator className="my-2" />
        <div className="px-3 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Appearance</span>
        </div>
        <PropertyInput label="Opacity" value={String(clip.opacity)} onChange={(v) => setNum('opacity', v)} />
        <PropertyRow label="Blend" value="Normal" />
      </div>
    </div>
  )
}
