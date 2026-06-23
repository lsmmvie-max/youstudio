import { useState, useEffect, useRef, useCallback } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { marked } from 'marked'

export const Route = createFileRoute('/script')({ component: ScriptStudio })

const API = 'http://localhost:3737'

interface EditingBlock {
  timestamp: string
  narration: string
  style: 'LIGHT' | 'INTENSE'
  characterVariant: string
  background: string
}

interface ScriptData {
  readingScript: string
  editingScript: EditingBlock[]
  wordCount: number
}

function ScriptStudio() {
  const [data, setData] = useState<ScriptData | null>(null)
  const [storyQueue, setStoryQueue] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [activeParagraph, setActiveParagraph] = useState<number | null>(null)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editBuffer, setEditBuffer] = useState('')
  const [newIdea, setNewIdea] = useState('')
  const [storiesOpen, setStoriesOpen] = useState(true)
  const [queueOpen, setQueueOpen] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch(`${API}/brief/script`)
      .then((r) => (r.ok ? (r.json() as Promise<ScriptData>) : null))
      .then((d) => { if (d) setData(d) })
      .finally(() => setLoading(false))

    fetch(`${API}/brief/story-queue`)
      .then((r) => (r.ok ? (r.json() as Promise<string[]>) : []))
      .then(setStoryQueue)
      .catch(() => {})
  }, [])

  const paragraphs = data?.readingScript.split(/\n\n+/).filter(Boolean) ?? []
  const wordCount = data?.wordCount ?? 0
  const estimatedMin = Math.round(wordCount / 150)

  const startEditing = useCallback((idx: number) => {
    setEditingIdx(idx)
    setEditBuffer(paragraphs[idx])
    setTimeout(() => textareaRef.current?.focus(), 0)
  }, [paragraphs])

  const commitEdit = useCallback(() => {
    if (editingIdx === null || !data) return
    const updated = [...paragraphs]
    updated[editingIdx] = editBuffer
    const newScript = updated.join('\n\n')
    setData({ ...data, readingScript: newScript, wordCount: newScript.split(/\s+/).filter(Boolean).length })
    setEditingIdx(null)
  }, [editingIdx, editBuffer, data, paragraphs])

  const addStoryIdea = () => {
    const trimmed = newIdea.trim()
    if (!trimmed) return
    const updated = [...storyQueue, trimmed]
    setStoryQueue(updated)
    setNewIdea('')
    fetch(`${API}/brief/story-queue`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {})
  }

  const removeStoryIdea = (idx: number) => {
    const updated = storyQueue.filter((_, i) => i !== idx)
    setStoryQueue(updated)
    fetch(`${API}/brief/story-queue`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {})
  }

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
        <span className="text-sm font-semibold text-foreground">Script Studio</span>
        <div className="w-20" />
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-sm text-muted-foreground">Loading script data...</span>
        </div>
      ) : !data ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">No script available. Run the Overnight Brain first.</p>
          <Link to="/brief">
            <Button size="sm">Go to Morning Brief</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar — Story Bank */}
          <div className="flex w-[200px] shrink-0 flex-col border-r border-border bg-muted/20">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="p-3">
                {/* Editing Script Blocks */}
                <button
                  onClick={() => setStoriesOpen(!storiesOpen)}
                  className="mb-2 flex w-full items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-transform ${storiesOpen ? 'rotate-90' : ''}`}
                  ><path d="m9 18 6-6-6-6"/></svg>
                  Story Bank
                </button>
                {storiesOpen && (
                  <div className="flex flex-col gap-1 mb-4">
                    {data.editingScript.map((block, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveParagraph(i)}
                        className={`rounded px-2 py-1.5 text-left text-[10px] leading-tight transition-colors ${
                          activeParagraph === i
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <span className="font-mono text-[9px] text-muted-foreground/60">{block.timestamp}</span>
                        <span className={`ml-1 inline-block rounded px-1 text-[8px] font-bold uppercase ${
                          block.style === 'INTENSE' ? 'bg-primary/20 text-primary' : 'bg-muted-foreground/10 text-muted-foreground'
                        }`}>{block.style[0]}</span>
                        <p className="mt-0.5 truncate">{block.narration.slice(0, 40)}</p>
                      </button>
                    ))}
                  </div>
                )}

                {/* Story Queue */}
                <button
                  onClick={() => setQueueOpen(!queueOpen)}
                  className="mb-2 flex w-full items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-transform ${queueOpen ? 'rotate-90' : ''}`}
                  ><path d="m9 18 6-6-6-6"/></svg>
                  Story Queue ({storyQueue.length})
                </button>
                {queueOpen && (
                  <div className="flex flex-col gap-1">
                    {storyQueue.length === 0 && (
                      <p className="px-2 text-[10px] text-muted-foreground/50">No ideas queued</p>
                    )}
                    {storyQueue.map((idea, i) => (
                      <div key={i} className="group flex items-start gap-1 rounded px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted">
                        <span className="flex-1 leading-tight">{idea}</span>
                        <button
                          onClick={() => removeStoryIdea(i)}
                          className="mt-0.5 hidden shrink-0 text-muted-foreground/40 hover:text-destructive group-hover:block"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="border-t border-border p-2">
              <form onSubmit={(e) => { e.preventDefault(); addStoryIdea() }} className="flex gap-1">
                <Input
                  placeholder="Add story idea..."
                  value={newIdea}
                  onChange={(e) => setNewIdea(e.target.value)}
                  className="h-6 text-[10px]"
                />
                <Button type="submit" size="sm" variant="ghost" className="h-6 w-6 shrink-0 p-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                </Button>
              </form>
            </div>
          </div>

          {/* Center — Reading Script */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-4 border-b border-border px-4 py-2">
              <span className="text-xs text-muted-foreground">{wordCount} words</span>
              <span className="text-xs text-muted-foreground">~{estimatedMin} min</span>
              <span className="text-xs text-muted-foreground">{paragraphs.length} paragraphs</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-2xl px-6 py-6">
                {paragraphs.map((para, i) => (
                  <div key={i} className="group mb-3 flex gap-3" id={`para-${i}`}>
                    <span className="mt-0.5 w-6 shrink-0 text-right font-mono text-[10px] text-muted-foreground/40 select-none">
                      {i + 1}
                    </span>
                    {editingIdx === i ? (
                      <textarea
                        ref={textareaRef}
                        value={editBuffer}
                        onChange={(e) => setEditBuffer(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === 'Escape') { setEditingIdx(null) } else if (e.key === 'Enter' && e.metaKey) { commitEdit() } }}
                        className="flex-1 resize-none rounded border border-primary/40 bg-muted/30 px-2 py-1 text-sm leading-relaxed text-foreground outline-none focus:border-primary"
                        rows={Math.max(3, editBuffer.split('\n').length + 1)}
                      />
                    ) : (
                      <div
                        onClick={() => startEditing(i)}
                        className={`flex-1 cursor-text rounded px-2 py-1 text-sm leading-relaxed transition-colors [&_strong]:font-semibold [&_p]:m-0 ${
                          activeParagraph === i
                            ? 'bg-primary/10 text-foreground ring-1 ring-primary/30'
                            : 'text-foreground/80 hover:bg-muted/30'
                        }`}
                        dangerouslySetInnerHTML={{ __html: marked.parse(para, { async: false }) as string }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel — Editing Script */}
          <div className="flex w-[300px] shrink-0 flex-col overflow-hidden border-l border-border bg-muted/20">
            <div className="border-b border-border px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Editing Script</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-2 p-3">
                {data.editingScript.map((block, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setActiveParagraph(i)
                      document.getElementById(`para-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }}
                    className={`w-full rounded-md border p-2.5 text-left transition-colors ${
                      block.style === 'INTENSE'
                        ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
                        : 'border-border bg-muted/30 hover:bg-muted/50'
                    } ${activeParagraph === i ? 'ring-1 ring-primary/50' : ''}`}
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className="font-mono text-[9px] text-muted-foreground">{block.timestamp}</span>
                      <span className={`rounded px-1 py-0.5 text-[8px] font-bold uppercase ${
                        block.style === 'INTENSE' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>{block.style}</span>
                    </div>
                    <div className="mb-1 text-[11px] leading-snug text-foreground/80 [&_strong]:font-semibold [&_p]:m-0" dangerouslySetInnerHTML={{ __html: marked.parse(block.narration.slice(0, 80) + '...', { async: false }) as string }} />
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                      <span>{block.characterVariant}</span>
                      <span className="text-muted-foreground/30">|</span>
                      <span>{block.background}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
