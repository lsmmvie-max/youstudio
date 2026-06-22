import { useState, useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button.tsx'
import { ScrollArea } from '#/components/ui/scroll-area.tsx'

export const Route = createFileRoute('/brief')({ component: MorningBrief })

interface Manifest {
  date: string
  title: string
  concept: string
  estimatedDuration: number
  script: string
  images: { filename: string; prompt: string; status: 'pending' | 'generated' }[]
}

function MorningBrief() {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('http://localhost:3737/brief/today')
      .then((res) => {
        if (!res.ok) throw new Error()
        return res.json() as Promise<Manifest>
      })
      .then(setManifest)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

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
          {loading && (
            <div className="flex items-center justify-center py-20">
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          )}
          {!loading && (error || !manifest) && <EmptyState />}
          {!loading && manifest && <BriefContent manifest={manifest} />}
        </div>
      </ScrollArea>
    </div>
  )
}

function BriefContent({ manifest }: { manifest: Manifest }) {
  const wordCount = manifest.script.split(/\s+/).filter(Boolean).length

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-primary">{manifest.date}</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{manifest.title}</h1>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Concept</p>
        <p className="text-sm leading-relaxed text-foreground">{manifest.concept}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Duration" value={`${manifest.estimatedDuration}m`} />
        <Stat label="Script" value={`${wordCount} words`} />
        <Stat label="Images" value={`${manifest.images.length} planned`} />
      </div>

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Image Storyboard</p>
        <div className="grid grid-cols-3 gap-3">
          {manifest.images.map((img, i) => (
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
                  <span className="px-2 text-center text-[9px] leading-tight text-muted-foreground">{img.prompt}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <Button size="lg" className="mt-2 w-full bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold">
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

function EmptyState() {
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
      <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
        Run Overnight Brain Now
      </Button>
    </div>
  )
}
