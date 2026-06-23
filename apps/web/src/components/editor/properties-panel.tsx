import { Separator } from '#/components/ui/separator.tsx'
import { useTimeline } from './timeline-context.tsx'
import { ExpressionPanel } from './expression-panel.tsx'

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
  const { clips, selectedClipId, updateClipProps, removeClip, defaultClipDuration, setDefaultClipDuration } = useTimeline()
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
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Settings</span>
          </div>
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[11px] text-muted-foreground">Default clip (s)</span>
            <input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={defaultClipDuration}
              onChange={(e) => {
                const n = parseFloat(e.target.value)
                if (!isNaN(n) && n >= 1 && n <= 10) setDefaultClipDuration(n)
              }}
              className="w-16 rounded border border-border bg-background px-1.5 py-0.5 text-right text-[11px] text-foreground outline-none focus:border-primary/50"
            />
          </div>
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

  const trackLabels = ['Background (BG)', 'Character (CHR)', 'Voiceover (VO)', 'Music (MUS)']

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="truncate text-[11px] font-medium text-foreground">{clip.name}</span>
        <button onClick={() => removeClip(clip.id)} className="text-[10px] text-destructive hover:underline">Remove</button>
      </div>
      <div className="flex flex-col py-2">
        <div className="px-3 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Clip Info</span>
        </div>
        <PropertyRow label="Type" value={clip.type} />
        <PropertyRow label="Track" value={trackLabels[clip.track] ?? `Track ${clip.track}`} />
        <PropertyInput label="Start (s)" value={String(clip.startTime)} onChange={(v) => setNum('startTime', v)} />
        <PropertyInput label="Duration (s)" value={String(clip.duration)} onChange={(v) => setNum('duration', v)} />
        {clip.type === 'audio' && (
          <PropertyInput label="Volume" value={String(clip.volume ?? 1)} onChange={(v) => {
            const n = parseFloat(v)
            if (!isNaN(n)) updateClipProps(clip.id, { volume: Math.max(0, Math.min(1, n)) })
          }} />
        )}

        {clip.type === 'image' && (
          <>
            <Separator className="my-2" />
            <div className="px-3 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Transform</span>
            </div>
            <PropertyInput label="X" value={String(clip.x)} onChange={(v) => setNum('x', v)} />
            <PropertyInput label="Y" value={String(clip.y)} onChange={(v) => setNum('y', v)} />
            <PropertyInput label="Width" value={String(Math.round(clip.width))} onChange={(v) => setNum('width', v)} />
            <PropertyInput label="Height" value={String(Math.round(clip.height))} onChange={(v) => setNum('height', v)} />
            <PropertyInput label="Rotation" value={String(clip.rotation)} onChange={(v) => setNum('rotation', v)} />
            <Separator className="my-2" />
            <div className="px-3 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Appearance</span>
            </div>
            <PropertyInput label="Opacity" value={String(clip.opacity)} onChange={(v) => setNum('opacity', v)} />
          </>
        )}

        {clip.type === 'caption' && (
          <>
            <Separator className="my-2" />
            <div className="px-3 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Caption Text</span>
            </div>
            <div className="px-3 py-1">
              <textarea
                value={clip.text ?? ''}
                onChange={(e) => updateClipProps(clip.id, { text: e.target.value })}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary/50"
                rows={3}
              />
            </div>
          </>
        )}

        {clip.type === 'image' && clip.track === 1 && (
          <>
            <Separator className="my-2" />
            <ExpressionPanel />
          </>
        )}
      </div>
    </div>
  )
}
