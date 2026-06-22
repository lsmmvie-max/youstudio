import { Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button.tsx'

export function TopBar() {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-primary/30 bg-background px-4">
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary">
          <span className="text-xs font-bold text-primary-foreground">YS</span>
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground">YouStudio</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Untitled Project</span>
      </div>

      <div className="flex items-center gap-2">
        <Link to="/brief" className="inline-flex h-8 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          Morning Brief
        </Link>
        <Button variant="ghost" size="sm">
          Settings
        </Button>
        <Button size="sm">Export</Button>
      </div>
    </div>
  )
}
