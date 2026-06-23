import { useState, useRef, useEffect } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { ScrollArea } from '#/components/ui/scroll-area.tsx'
import { useTimeline } from './timeline-context.tsx'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface TimelineCommand {
  command: 'add_clip' | 'remove_clip' | 'move_clip' | 'trim_clip' | 'clear_timeline' | 'none'
  params: Record<string, unknown>
  description?: string
}

export function AiChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { clips, addClip, removeClip, moveClip, trimClip, clearTimeline } = useTimeline()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function executeCommand(cmd: TimelineCommand) {
    switch (cmd.command) {
      case 'add_clip': {
        const p = cmd.params as { src?: string; name?: string; startTime?: number; duration?: number; track?: number }
        addClip({
          type: 'image',
          src: p.src ?? '',
          name: p.name ?? 'AI clip',
          startTime: p.startTime ?? 0,
          duration: p.duration ?? 3,
          track: p.track ?? 0,
        })
        return `Added clip "${p.name ?? 'AI clip'}" at ${p.startTime ?? 0}s`
      }
      case 'remove_clip': {
        const p = cmd.params as { id?: string }
        if (p.id) removeClip(p.id)
        return `Removed clip ${p.id}`
      }
      case 'move_clip': {
        const p = cmd.params as { id?: string; startTime?: number }
        if (p.id && p.startTime != null) moveClip(p.id, p.startTime)
        return `Moved clip ${p.id} to ${p.startTime}s`
      }
      case 'trim_clip': {
        const p = cmd.params as { id?: string; duration?: number }
        if (p.id && p.duration != null) trimClip(p.id, p.duration)
        return `Trimmed clip ${p.id} to ${p.duration}s`
      }
      case 'clear_timeline':
        clearTimeline()
        return 'Cleared timeline'
      default:
        return null
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setLoading(true)

    try {
      const [chatRes, cmdRes] = await Promise.all([
        fetch('http://localhost:3737/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content })),
          }),
        }),
        fetch('http://localhost:3737/ai/timeline-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            timelineState: { clips: clips.map((c) => ({ id: c.id, name: c.name, startTime: c.startTime, duration: c.duration, track: c.track })) },
          }),
        }),
      ])

      const chatData = (await chatRes.json()) as { choices?: { message?: { content?: string } }[] }
      const reply = chatData.choices?.[0]?.message?.content ?? 'No response'
      const newMessages: Message[] = [{ role: 'assistant', content: reply }]

      if (cmdRes.ok) {
        const cmd = (await cmdRes.json()) as TimelineCommand
        if (cmd.command && cmd.command !== 'none') {
          const actionMsg = executeCommand(cmd)
          if (actionMsg) {
            newMessages.push({ role: 'system', content: `Timeline action: ${actionMsg}` })
          }
        }
      }

      setMessages((prev) => [...prev, ...newMessages])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Failed to reach AI server.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 overflow-auto">
        <div className="flex flex-col gap-3 p-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/20">
                <span className="text-xs text-primary">AI</span>
              </div>
              <span className="text-[11px] text-muted-foreground">Ask me anything about your project</span>
              <span className="text-[10px] text-muted-foreground/50">I can help edit the timeline, generate, and plan</span>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-[11px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : msg.role === 'system'
                      ? 'border border-primary/30 bg-primary/10 text-primary'
                      : 'bg-muted text-foreground'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2">
                <div className="flex gap-1">
                  <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
                </div>
                <span className="text-[10px] text-muted-foreground">Thinking…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="relative z-10 shrink-0 border-t border-border p-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="flex gap-1.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI…"
            className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <Button type="submit" size="sm" disabled={loading || !input.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  )
}
