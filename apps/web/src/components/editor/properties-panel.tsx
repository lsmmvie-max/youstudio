import { Separator } from '#/components/ui/separator.tsx'

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] text-foreground">{value}</span>
    </div>
  )
}

export function PropertiesPanel() {
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
