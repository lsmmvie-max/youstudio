export function PreviewCanvas() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[oklch(0.1_0.005_285)]">
      <div className="flex aspect-video w-full max-w-[640px] items-center justify-center rounded border border-border/50 bg-black/40">
        <div className="flex flex-col items-center gap-2">
          <div className="flex size-12 items-center justify-center rounded-full border border-muted-foreground/30">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-muted-foreground">
              <path d="M7 5L15 10L7 15V5Z" fill="currentColor" />
            </svg>
          </div>
          <span className="text-xs text-muted-foreground">No media loaded</span>
          <span className="text-[10px] text-muted-foreground/60">Drop a file or select from assets</span>
        </div>
      </div>
    </div>
  )
}
