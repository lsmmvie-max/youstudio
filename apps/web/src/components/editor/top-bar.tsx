import { useState, useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button.tsx'

export function TopBar() {
  const [name, setName] = useState(() => localStorage.getItem('youstudio-project-name') || 'Untitled Project')
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const save = () => {
    setEditing(false)
    const trimmed = name.trim() || 'Untitled Project'
    setName(trimmed)
    localStorage.setItem('youstudio-project-name', trimmed)
  }

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-primary/30 bg-background px-4">
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary">
          <span className="text-xs font-bold text-primary-foreground">YS</span>
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground">YouStudio</span>
      </div>

      <div className="flex items-center gap-1.5">
        {editing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') { setName(localStorage.getItem('youstudio-project-name') || 'Untitled Project'); setEditing(false) }
            }}
            className="rounded border border-primary/50 bg-background px-2 py-0.5 text-center text-xs text-foreground outline-none"
          />
        ) : (
          <button onClick={() => setEditing(true)} className="cursor-text text-xs text-muted-foreground transition-colors hover:text-foreground">
            {name}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Link to="/brief" className="inline-flex h-8 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          Morning Brief
        </Link>
        <Link to="/script" className="inline-flex h-8 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          Script Studio
        </Link>
        <Link to="/voice" className="inline-flex h-8 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          Voice Booth
        </Link>
        <Link to="/forge" className="inline-flex h-8 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          Asset Forge
        </Link>
        <Link to="/packaging" className="inline-flex h-8 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          Packaging
        </Link>
        <Link to="/settings" className="inline-flex h-8 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          Settings
        </Link>
        <Button size="sm">Export</Button>
      </div>
    </div>
  )
}
