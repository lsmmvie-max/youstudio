import { useState, useEffect } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Button } from '#/components/ui/button.tsx'
import { ScrollArea } from '#/components/ui/scroll-area.tsx'
import { marked } from 'marked'

export const Route = createFileRoute('/brief')({ component: MorningBrief })

interface EditingBlock {
  timestamp: string
  narration: string
  style: 'LIGHT' | 'INTENSE'
  characterVariant: string
  background: string
}

interface ImagePrompt {
  scene: number
  prompt: string
  filename: string
  status: 'pending' | 'generated'
}

interface Manifest {
  date: string
  title: string
  concept: string
  estimatedDuration: number
  wordCount: number
  readingScript: string
  editingScript: EditingBlock[]
  imagePrompts: ImagePrompt[]
  imagesGenerated: number
  imagesTotal: number
  generatedAt: string
}

function MorningBrief() {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [running, setRunning] = useState(false)

  const fetchToday = () => {
    setLoading(true)
    setError(false)
    fetch('http://localhost:3737/brief/today')
      .then((res) => {
        if (!res.ok) throw new Error()
        return res.json() as Promise<Manifest>
      })
      .then(setManifest)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchToday() }, [])

  const handleRunBrain = () => {
    setRunning(true)
    fetch('http://localhost:3737/brief/run', { method: 'POST' })
      .then((res) => {
        if (!res.ok) throw new Error()
        return res.json() as Promise<Manifest>
      })
      .then((m) => {
        setManifest(m)
        setError(false)
      })
      .catch(() => setError(true))
      .finally(() => setRunning(false))
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-primary/30 px-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span className="text-xs">Back to Editor</span>
          </Link>
        </div>
        <span className="text-sm font-semibold text-foreground">Morning Brief</span>
        <div className="w-20" />
      </div>

      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-2xl px-6 py-10">
          {loading && !running && (
            <div className="flex items-center justify-center py-20">
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          )}
          {running && <RunningState />}
          {!loading && !running && (error || !manifest) && <EmptyState onRun={handleRunBrain} />}
          {!loading && !running && manifest && <BriefContent manifest={manifest} onRegenerate={async () => {
            setRunning(true)
            try {
              await fetch('http://localhost:3737/brief/today', { method: 'DELETE' })
              const res = await fetch('http://localhost:3737/brief/run', { method: 'POST' })
              if (!res.ok) throw new Error()
              const m = await res.json() as Manifest
              setManifest(m)
              setError(false)
            } catch { setError(true) } finally { setRunning(false) }
          }} />}
        </div>
      </ScrollArea>
    </div>
  )
}

function renderMd(text: string): string {
  return marked.parse(text, { async: false }) as string
}

function BriefContent({ manifest, onRegenerate }: { manifest: Manifest; onRegenerate: () => void }) {
  const navigate = useNavigate()

  const handleStartEpisode = () => {
    localStorage.setItem('youstudio-autoload-forge', '1')
    navigate({ to: '/script' })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-primary">{manifest.date}</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{manifest.title}</h1>
        </div>
        <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={onRegenerate}>
          Regenerate Episode
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Concept</p>
        <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-foreground [&_strong]:text-foreground [&_strong]:font-semibold" dangerouslySetInnerHTML={{ __html: renderMd(manifest.concept) }} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Duration" value={`~${manifest.estimatedDuration}m`} />
        <Stat label="Script" value={`${manifest.wordCount} words`} />
        <Stat label="Images" value={`${manifest.imagesGenerated}/${manifest.imagesTotal}`} />
      </div>

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Editing Blocks</p>
        <div className="flex flex-col gap-2">
          {manifest.editingScript.map((block, i) => (
            <div
              key={i}
              className={`rounded-md border p-3 ${block.style === 'INTENSE' ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/30'}`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground">{block.timestamp}</span>
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${block.style === 'INTENSE' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {block.style}
                </span>
                <span className="text-[10px] text-muted-foreground">{block.characterVariant}</span>
              </div>
              <div className="text-xs leading-relaxed text-foreground/80 [&_strong]:font-semibold" dangerouslySetInnerHTML={{ __html: renderMd(block.narration.slice(0, 120) + '...') }} />
              <p className="mt-1 text-[10px] text-muted-foreground">BG: {block.background}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Image Storyboard</p>
        <div className="grid grid-cols-3 gap-3">
          {manifest.imagePrompts.map((img, i) => (
            <div
              key={i}
              className="flex aspect-video flex-col items-center justify-center rounded-md border border-border bg-muted/50"
            >
              {img.status === 'generated' ? (
                <img
                  src={`http://localhost:3737/brief/image/${manifest.date}/${img.filename}`}
                  alt={img.prompt}
                  className="size-full rounded-md object-cover"
                />
              ) : (
                <>
                  <div className="mb-1 size-6 rounded bg-muted-foreground/20" />
                  <span className="px-2 text-center text-[9px] leading-tight text-muted-foreground">{img.prompt.slice(0, 60)}...</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <Button size="lg" className="mt-2 w-full bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold" onClick={handleStartEpisode}>
        Start Today's Episode
      </Button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  )
}

function RunningState() {
  return (
    <div className="flex flex-col items-center gap-6 py-20 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-primary"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      </div>
      <div>
        <h2 className="mb-2 text-xl font-semibold text-foreground">Overnight Brain is running...</h2>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          Generating story concept, writing script, and creating image prompts.
          This usually takes 1-2 minutes.
        </p>
      </div>
      <div className="flex flex-col gap-2 text-xs text-muted-foreground">
        <Step label="Picking story concept" />
        <Step label="Writing reading script (~2000 words)" />
        <Step label="Creating editing blocks & image prompts" />
      </div>
    </div>
  )
}

function Step({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="size-1.5 rounded-full bg-muted-foreground/40" />
      <span>{label}</span>
    </div>
  )
}

function EmptyState({ onRun }: { onRun: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-20 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      </div>
      <div>
        <h2 className="mb-2 text-xl font-semibold text-foreground">Nothing prepared yet</h2>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          The Overnight Brain runs while you sleep — it picks a trending topic, writes a script,
          generates image prompts, and prepares everything so you can review and record in the morning.
        </p>
      </div>
      <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={onRun}>
        Run Overnight Brain Now
      </Button>
    </div>
  )
}
