import { useState, useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button.tsx'
import { ExportModal } from './export-modal.tsx'
import { useTimeline } from './timeline-context.tsx'

const API = 'http://localhost:3737'

interface SavedProject {
  id: string
  name: string
  date: string
  clipCount: number
}

export function TopBar() {
  const { clips, transitions, loadProject } = useTimeline()
  const [name, setName] = useState(() => localStorage.getItem('youstudio-project-name') || 'Untitled Project')
  const [editing, setEditing] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showLoad, setShowLoad] = useState(false)
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
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

  const saveProject = async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch(`${API}/projects/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, clips, transitions }),
      })
      if (res.ok) {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } else {
        // Fallback: save to localStorage
        saveToLocalStorage()
      }
    } catch {
      // Server unreachable, save locally
      saveToLocalStorage()
    }
  }

  const saveToLocalStorage = () => {
    const projects = JSON.parse(localStorage.getItem('youstudio-saved-projects') || '[]') as SavedProject[]
    const id = `proj-${Date.now()}`
    const project = {
      id,
      name,
      date: new Date().toISOString(),
      clipCount: clips.length,
      data: { clips, transitions },
    }
    const existing = projects.findIndex((p) => p.name === name)
    if (existing >= 0) {
      projects[existing] = { id, name, date: project.date, clipCount: clips.length }
    } else {
      projects.push({ id, name, date: project.date, clipCount: clips.length })
    }
    localStorage.setItem('youstudio-saved-projects', JSON.stringify(projects))
    localStorage.setItem(`youstudio-project-data-${id}`, JSON.stringify(project.data))
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }

  const loadSavedProjects = async () => {
    const projects: SavedProject[] = []

    // Try server first
    try {
      const res = await fetch(`${API}/projects/list`)
      if (res.ok) {
        const data = (await res.json()) as { projects: SavedProject[] }
        projects.push(...data.projects)
      }
    } catch {}

    // Also load from localStorage
    try {
      const localProjects = JSON.parse(localStorage.getItem('youstudio-saved-projects') || '[]') as SavedProject[]
      for (const lp of localProjects) {
        if (!projects.find((p) => p.id === lp.id)) {
          projects.push(lp)
        }
      }
    } catch {}

    setSavedProjects(projects.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
    setShowLoad(true)
  }

  const handleLoadProject = async (project: SavedProject) => {
    // Try server first
    try {
      const res = await fetch(`${API}/projects/${project.id}`)
      if (res.ok) {
        const data = (await res.json()) as { clips: typeof clips; transitions: typeof transitions }
        loadProject(data)
        setName(project.name)
        localStorage.setItem('youstudio-project-name', project.name)
        setShowLoad(false)
        return
      }
    } catch {}

    // Fallback to localStorage
    try {
      const dataStr = localStorage.getItem(`youstudio-project-data-${project.id}`)
      if (dataStr) {
        const data = JSON.parse(dataStr) as { clips: typeof clips; transitions: typeof transitions }
        loadProject(data)
        setName(project.name)
        localStorage.setItem('youstudio-project-name', project.name)
      }
    } catch {}

    setShowLoad(false)
  }

  return (
    <>
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
          <button
            onClick={saveProject}
            className="flex size-6 items-center justify-center rounded hover:bg-muted"
            title="Save project"
          >
            {saveStatus === 'saving' ? (
              <span className="text-[10px] text-muted-foreground">...</span>
            ) : saveStatus === 'saved' ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#10b981" strokeWidth="2">
                <path d="M3 7L6 10L11 4" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <rect x="2" y="1" width="10" height="12" rx="1" />
                <path d="M4 1V5H10V1" />
                <rect x="7" y="2" width="2" height="2" />
              </svg>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadSavedProjects}
            className="inline-flex h-8 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Load
          </button>
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
          <Button size="sm" onClick={() => setShowExport(true)}>Export</Button>
        </div>
      </div>
      <ExportModal open={showExport} onClose={() => setShowExport(false)} />

      {/* Load Project Modal */}
      {showLoad && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowLoad(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[420px] max-h-[500px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="text-sm font-semibold text-foreground">Load Project</h2>
              <button onClick={() => setShowLoad(false)} className="text-muted-foreground hover:text-foreground">&times;</button>
            </div>
            <div className="max-h-[380px] overflow-auto p-4">
              {savedProjects.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground">No saved projects found</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {savedProjects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleLoadProject(p)}
                      className="flex items-center justify-between rounded-md border border-border p-3 text-left transition-colors hover:bg-muted"
                    >
                      <div>
                        <div className="text-xs font-medium text-foreground">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(p.date).toLocaleDateString()} &middot; {p.clipCount} clips
                        </div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                        <path d="M5 3L9 7L5 11" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
