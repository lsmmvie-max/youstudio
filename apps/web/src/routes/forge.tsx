import { useState, useEffect, useCallback, useRef } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button.tsx'
import { ScrollArea } from '#/components/ui/scroll-area.tsx'

export const Route = createFileRoute('/forge')({ component: AssetForge })

const API = 'http://localhost:3737'

interface CharacterVariant {
  filename: string
  url: string
}
interface Character {
  name: string
  variants: CharacterVariant[]
  variantCount: number
}

interface Asset {
  date: string
  filename: string
  url: string
  size: number
  createdAt: string
}

interface QueueItem {
  scene: number
  prompt: string
  filename: string
  style: 'LIGHT' | 'INTENSE'
  status: 'pending' | 'generating' | 'done' | 'error'
  resultUrl?: string
}

function AssetForge() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState<'LIGHT' | 'INTENSE'>('LIGHT')
  const [generating, setGenerating] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [batchRunning, setBatchRunning] = useState(false)
  const batchAbortRef = useRef(false)

  const fetchCharacters = useCallback(() => {
    fetch(`${API}/forge/characters`)
      .then((r) => r.json() as Promise<{ characters: Character[] }>)
      .then((d) => setCharacters(d.characters))
      .catch(() => {})
  }, [])

  const fetchAssets = useCallback(() => {
    fetch(`${API}/forge/assets`)
      .then((r) => r.json() as Promise<{ assets: Asset[] }>)
      .then((d) => setAssets(d.assets))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchCharacters()
    fetchAssets()
  }, [fetchCharacters, fetchAssets])

  const generateSingle = async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    setGeneratedUrl(null)
    try {
      const res = await fetch(`${API}/forge/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), style }),
      })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { url: string }
      setGeneratedUrl(`${API}${data.url}`)
      fetchAssets()
    } catch {
      setGeneratedUrl(null)
    } finally {
      setGenerating(false)
    }
  }

  const loadFromEpisode = async () => {
    try {
      const res = await fetch(`${API}/brief/today`)
      if (!res.ok) return
      const manifest = (await res.json()) as {
        imagePrompts?: { scene: number; prompt: string; filename: string }[]
        editingScript?: { style: 'LIGHT' | 'INTENSE' }[]
      }
      if (!manifest.imagePrompts?.length) return
      setQueue(
        manifest.imagePrompts.map((ip, i) => ({
          scene: ip.scene,
          prompt: ip.prompt,
          filename: ip.filename,
          style: manifest.editingScript?.[i]?.style ?? 'LIGHT',
          status: 'pending',
        }))
      )
    } catch {}
  }

  const generateAll = async () => {
    setBatchRunning(true)
    batchAbortRef.current = false

    for (let i = 0; i < queue.length; i++) {
      if (batchAbortRef.current) break
      if (queue[i].status === 'done') continue

      setQueue((q) => q.map((item, idx) => (idx === i ? { ...item, status: 'generating' } : item)))

      try {
        const res = await fetch(`${API}/forge/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: queue[i].prompt,
            style: queue[i].style,
            filename: queue[i].filename,
          }),
        })
        if (!res.ok) throw new Error()
        const data = (await res.json()) as { url: string }
        setQueue((q) =>
          q.map((item, idx) =>
            idx === i ? { ...item, status: 'done', resultUrl: `${API}${data.url}` } : item
          )
        )
        fetchAssets()
      } catch {
        setQueue((q) => q.map((item, idx) => (idx === i ? { ...item, status: 'error' } : item)))
      }

      if (i < queue.length - 1 && !batchAbortRef.current) {
        await new Promise((r) => setTimeout(r, 2000))
      }
    }

    setBatchRunning(false)
    fetchAssets()
  }

  const doneCount = queue.filter((q) => q.status === 'done').length
  const formatSize = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`)

  const assetsByDate = assets.reduce<Record<string, Asset[]>>((acc, a) => {
    ;(acc[a.date] ??= []).push(a)
    return acc
  }, {})

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-primary/30 px-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span className="text-xs">Back to Editor</span>
          </Link>
        </div>
        <span className="text-sm font-semibold text-foreground">Asset Forge</span>
        <div className="w-20" />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left — Character Library */}
        <div className="flex w-[200px] shrink-0 flex-col border-r border-border bg-muted/20">
          <div className="shrink-0 border-b border-border px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Characters</span>
          </div>
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-2 p-3">
              {characters.length === 0 && (
                <p className="py-6 text-center text-[10px] text-muted-foreground/50">
                  No characters yet. Add folders to C:\YouStudio\characters\
                </p>
              )}
              {characters.map((char) => (
                <div key={char.name} className="rounded-md border border-border bg-muted/30 p-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="truncate text-xs font-medium text-foreground">{char.name}</span>
                    <span className="shrink-0 text-[9px] text-muted-foreground">{char.variantCount} variants</span>
                  </div>
                  {char.variants.length > 0 && (
                    <div className="flex gap-1 overflow-x-auto">
                      {char.variants.slice(0, 4).map((v) => (
                        <img
                          key={v.filename}
                          src={`${API}${v.url}`}
                          alt={v.filename}
                          className="size-10 shrink-0 rounded border border-border object-cover"
                        />
                      ))}
                      {char.variants.length > 4 && (
                        <div className="flex size-10 shrink-0 items-center justify-center rounded border border-border bg-muted text-[9px] text-muted-foreground">
                          +{char.variants.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="shrink-0 border-t border-border p-2">
            <Button size="sm" variant="outline" className="w-full text-[10px]" disabled>
              Add Character
            </Button>
          </div>
        </div>

        {/* Center — Scene Generator + Batch Queue */}
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Scene Generator (top ~40%) */}
          <div className="flex shrink-0 flex-col border-b border-border p-4" style={{ height: '40%' }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Scene Generator</span>
              <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
                <button
                  onClick={() => setStyle('LIGHT')}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase transition-colors ${
                    style === 'LIGHT' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => setStyle('INTENSE')}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase transition-colors ${
                    style === 'INTENSE' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Intense
                </button>
              </div>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the scene to generate... (e.g. anime style, Portuguese teenage boy standing in classroom, afternoon sunlight)"
              className="mb-2 min-h-0 flex-1 resize-none rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/50"
            />
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={generateSingle} disabled={generating || !prompt.trim()}>
                {generating ? 'Generating...' : 'Generate'}
              </Button>
              {generatedUrl && (
                <img src={generatedUrl} alt="Generated" className="h-16 rounded border border-border object-cover" />
              )}
              {style === 'INTENSE' && (
                <span className="text-[9px] text-primary/60">+ dark dramatic lighting, high contrast, intense atmosphere</span>
              )}
            </div>
          </div>

          {/* Batch Queue (bottom ~60%) */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Batch Queue {queue.length > 0 && `(${doneCount}/${queue.length})`}
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={loadFromEpisode}>
                  Load from Episode
                </Button>
                {queue.length > 0 && (
                  batchRunning ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] text-destructive"
                      onClick={() => { batchAbortRef.current = true }}
                    >
                      Stop
                    </Button>
                  ) : (
                    <Button size="sm" className="h-6 text-[10px]" onClick={generateAll}>
                      Generate All
                    </Button>
                  )
                )}
              </div>
            </div>
            {queue.length > 0 && (
              <div className="shrink-0 px-4 pt-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${queue.length > 0 ? (doneCount / queue.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-1.5 p-4">
                {queue.length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground/50">
                    Click "Load from Episode" to import image prompts from today's manifest.
                  </p>
                )}
                {queue.map((item, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 rounded-md border p-2.5 ${
                      item.status === 'generating'
                        ? 'border-primary/40 bg-primary/5'
                        : item.status === 'done'
                          ? 'border-green-500/30 bg-green-500/5'
                          : item.status === 'error'
                            ? 'border-destructive/30 bg-destructive/5'
                            : 'border-border bg-muted/20'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">#{item.scene}</span>
                        <span
                          className={`rounded px-1 py-0.5 text-[8px] font-bold uppercase ${
                            item.style === 'INTENSE' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {item.style}
                        </span>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="text-[11px] leading-snug text-foreground/70">{item.prompt.slice(0, 120)}...</p>
                    </div>
                    {item.resultUrl ? (
                      <img src={item.resultUrl} alt={`Scene ${item.scene}`} className="h-20 w-32 shrink-0 rounded border border-border object-cover" />
                    ) : item.status === 'generating' ? (
                      <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded border border-primary/30 bg-primary/5">
                        <div className="size-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right — Asset Panel */}
        <div className="flex w-[260px] shrink-0 flex-col border-l border-border bg-muted/20">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Assets</span>
            <span className="text-[10px] text-muted-foreground">{assets.length} images</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="p-3">
              {assets.length === 0 && (
                <p className="py-8 text-center text-[10px] text-muted-foreground/50">
                  No assets generated yet.
                </p>
              )}
              {Object.entries(assetsByDate).map(([date, dateAssets]) => (
                <div key={date} className="mb-4">
                  <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">{date}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {dateAssets.map((asset) => (
                      <div
                        key={`${asset.date}-${asset.filename}`}
                        className="group cursor-grab rounded-md border border-border bg-muted/30 overflow-hidden"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', `${API}${asset.url}`)
                          e.dataTransfer.setData('application/x-youstudio-asset', JSON.stringify(asset))
                        }}
                      >
                        <img
                          src={`${API}${asset.url}`}
                          alt={asset.filename}
                          className="aspect-video w-full object-cover"
                          loading="lazy"
                        />
                        <div className="px-1.5 py-1">
                          <p className="truncate text-[9px] text-foreground/70">{asset.filename}</p>
                          <p className="text-[8px] text-muted-foreground">{formatSize(asset.size)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: QueueItem['status'] }) {
  const styles = {
    pending: 'bg-muted text-muted-foreground',
    generating: 'bg-primary/20 text-primary animate-pulse',
    done: 'bg-green-500/20 text-green-400',
    error: 'bg-destructive/20 text-destructive',
  }
  return (
    <span className={`rounded px-1 py-0.5 text-[8px] font-bold uppercase ${styles[status]}`}>
      {status}
    </span>
  )
}
