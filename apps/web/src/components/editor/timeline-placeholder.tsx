export function TimelinePlaceholder() {
  return (
    <div className="flex h-full flex-col border-t border-border bg-[oklch(0.12_0.005_285)]">
      <div className="flex h-7 shrink-0 items-center gap-3 border-b border-border px-3">
        <span className="text-[11px] font-medium text-foreground">Timeline</span>
        <div className="flex items-center gap-1">
          {['V1', 'V2', 'A1', 'A2'].map((track) => (
            <span
              key={track}
              className="rounded bg-muted/60 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground"
            >
              {track}
            </span>
          ))}
        </div>
        <span className="ml-auto text-[10px] text-muted-foreground/60">00:00:00:00</span>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted-foreground">Timeline — coming soon</span>
          <span className="text-[10px] text-muted-foreground/50">Drag clips here to start editing</span>
        </div>
      </div>
    </div>
  )
}
