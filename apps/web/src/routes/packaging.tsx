import { useState, useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button.tsx'
import { ScrollArea } from '#/components/ui/scroll-area.tsx'

export const Route = createFileRoute('/packaging')({ component: Packaging })

const API = 'http://localhost:3737'

interface TitleOption {
  title: string
  style: string
}

function Packaging() {
  const [concept, setConcept] = useState('')
  const [episodeTitle, setEpisodeTitle] = useState('')
  const [titles, setTitles] = useState<TitleOption[]>([])
  const [selectedTitle, setSelectedTitle] = useState(0)
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [generating, setGenerating] = useState(false)
  const [exported, setExported] = useState(false)

  const [reelStart, setReelStart] = useState('00:00')
  const [reelEnd, setReelEnd] = useState('00:15')
  const [reelExported, setReelExported] = useState(false)

  useEffect(() => {
    fetch(`${API}/brief/today`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json() as Promise<{ title?: string; concept?: string; readingScript?: string }>
      })
      .then((data) => {
        setEpisodeTitle(data.title ?? '')
        setConcept(data.concept ?? data.title ?? '')
      })
      .catch(() => {})
  }, [])

  const [genError, setGenError] = useState<string | null>(null)

  const generatePackaging = async () => {
    if (!concept.trim()) return
    setGenerating(true)
    setExported(false)
    setGenError(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)

    try {
      const res = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content:
                'You are a YouTube packaging expert. Given a video concept, generate YouTube metadata. Respond ONLY with valid JSON, no markdown fences.',
            },
            {
              role: 'user',
              content: `Video concept: "${concept}"

Generate a JSON object with:
- "titles": array of 3 objects, each with "title" (string, max 60 chars, clickable) and "style" (string: "curiosity", "emotional", or "direct")
- "description": full YouTube description string with timestamps (00:00 Intro, etc.), 2-3 paragraph summary, social links placeholders, and hashtags at the end
- "tags": comma-separated string of exactly 30 relevant tags

Respond with ONLY the JSON object.`,
            },
          ],
        }),
      })
      clearTimeout(timeout)
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
      const raw = data.choices?.[0]?.message?.content ?? ''
      const jsonStr = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(jsonStr) as {
        titles: TitleOption[]
        description: string
        tags: string
      }
      setTitles(parsed.titles)
      setSelectedTitle(0)
      setDescription(parsed.description)
      setTags(parsed.tags)
    } catch (err) {
      clearTimeout(timeout)
      if (err instanceof DOMException && err.name === 'AbortError') {
        setGenError('AI response timed out, try again.')
      } else {
        setTitles([{ title: episodeTitle || concept, style: 'direct' }])
        setDescription(`Check out this video about ${concept}.\n\n00:00 Intro\n00:30 Main Content\n\n#shorts #youtube`)
        setTags(concept.split(' ').join(', '))
      }
    } finally {
      setGenerating(false)
    }
  }

  const exportYouTube = async () => {
    try {
      const res = await fetch(`${API}/packaging/export-youtube`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titles[selectedTitle]?.title ?? episodeTitle,
          description,
          tags,
        }),
      })
      if (!res.ok) throw new Error()
      setExported(true)
    } catch {}
  }

  const exportReel = async () => {
    try {
      const res = await fetch(`${API}/packaging/export-reel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: reelStart,
          end: reelEnd,
          title: titles[selectedTitle]?.title ?? episodeTitle,
        }),
      })
      if (!res.ok) throw new Error()
      setReelExported(true)
    } catch {}
  }

  const styleColors: Record<string, string> = {
    curiosity: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400',
    emotional: 'border-pink-500/40 bg-pink-500/10 text-pink-400',
    direct: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
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
        <span className="text-sm font-semibold text-foreground">Packaging</span>
        <div className="w-20" />
      </div>

      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-4xl space-y-8 p-6">
          {/* Concept Input */}
          <div className="rounded-lg border border-border bg-muted/20 p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Video Concept</span>
              {episodeTitle && (
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                  From today's episode
                </span>
              )}
            </div>
            <textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Describe your video concept..."
              className="mb-3 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/50"
              rows={2}
            />
            <div className="flex items-center gap-3">
              <Button onClick={generatePackaging} disabled={generating || !concept.trim()}>
                {generating ? 'Generating...' : 'Generate YouTube Package'}
              </Button>
              {genError && <span className="text-xs text-destructive">{genError}</span>}
            </div>
          </div>

          {/* YouTube Package */}
          {titles.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-5">
              <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                YouTube Package
              </span>

              {/* Title Options */}
              <div className="mb-5">
                <span className="mb-2 block text-[10px] font-semibold uppercase text-muted-foreground/70">
                  Title Options (click to select)
                </span>
                <div className="flex flex-col gap-2">
                  {titles.map((t, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setSelectedTitle(i)}
                      className={`flex items-center gap-3 rounded-md border p-3 text-left transition-all ${
                        selectedTitle === i
                          ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/30'
                          : 'border-border bg-muted/30 hover:border-muted-foreground/30'
                      }`}
                    >
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${styleColors[t.style] ?? styleColors.direct}`}>
                        {t.style}
                      </span>
                      <input
                        value={t.title}
                        onChange={(e) => {
                          const updated = [...titles]
                          updated[i] = { ...updated[i], title: e.target.value }
                          setTitles(updated)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 bg-transparent text-sm font-medium text-foreground outline-none"
                      />
                      <span className="shrink-0 text-[10px] text-muted-foreground">{t.title.length}/60</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="mb-5">
                <span className="mb-2 block text-[10px] font-semibold uppercase text-muted-foreground/70">
                  Description
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary/50"
                  rows={12}
                />
              </div>

              {/* Tags */}
              <div className="mb-5">
                <span className="mb-2 block text-[10px] font-semibold uppercase text-muted-foreground/70">
                  Tags ({tags.split(',').filter((t) => t.trim()).length}/30)
                </span>
                <textarea
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50"
                  rows={3}
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  {tags
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((tag, i) => (
                      <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={exportYouTube}>Export for YouTube</Button>
                {exported && (
                  <span className="text-xs text-green-400">
                    Exported to C:\YouStudio\exports\
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Instagram Reel */}
          <div className="rounded-lg border border-border bg-muted/20 p-5">
            <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Instagram Reel
            </span>
            <div className="mb-4">
              <span className="mb-2 block text-[10px] font-semibold uppercase text-muted-foreground/70">
                Best Moment (timecode)
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="reel-start" className="text-[10px] text-muted-foreground">Start</label>
                  <input
                    id="reel-start"
                    value={reelStart}
                    onChange={(e) => setReelStart(e.target.value)}
                    placeholder="00:00"
                    className="w-20 rounded-md border border-border bg-background px-2 py-1 text-center font-mono text-sm text-foreground outline-none focus:border-primary/50"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="reel-end" className="text-[10px] text-muted-foreground">End</label>
                  <input
                    id="reel-end"
                    value={reelEnd}
                    onChange={(e) => setReelEnd(e.target.value)}
                    placeholder="00:15"
                    className="w-20 rounded-md border border-border bg-background px-2 py-1 text-center font-mono text-sm text-foreground outline-none focus:border-primary/50"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={exportReel}>
                Export Reel Metadata
              </Button>
              {reelExported && (
                <span className="text-xs text-green-400">
                  Reel metadata exported
                </span>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
