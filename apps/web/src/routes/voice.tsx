import { useState, useEffect, useRef, useCallback } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button.tsx'
import { ScrollArea } from '#/components/ui/scroll-area.tsx'
import WaveSurfer from 'wavesurfer.js'

export const Route = createFileRoute('/voice')({ component: VoiceBooth })

const API = 'http://localhost:3737'

interface Take {
  id: string
  filename: string
  size: number
  duration: number | null
  createdAt: string
}

function VoiceBooth() {
  const [script, setScript] = useState('')
  const [takes, setTakes] = useState<Take[]>([])
  const [selectedTake, setSelectedTake] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [scrollSpeed, setScrollSpeed] = useState(30)
  const [transcribing, setTranscribing] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [loadedTakeId, setLoadedTakeId] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const analyserRef = useRef<AnalyserNode | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const teleprompterRef = useRef<HTMLDivElement>(null)
  const scrollAnimRef = useRef<number>(0)
  const wavesurferContainerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)

  const fetchTakes = useCallback(() => {
    fetch(`${API}/voice/takes`)
      .then((r) => r.json() as Promise<{ takes: Take[]; selected: string | null }>)
      .then((d) => { setTakes(d.takes); setSelectedTake(d.selected) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`${API}/brief/script`)
      .then((r) => (r.ok ? (r.json() as Promise<{ readingScript: string }>) : null))
      .then((d) => { if (d) setScript(d.readingScript) })
      .catch(() => {})
    fetchTakes()
  }, [fetchTakes])

  // Live recording waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)

      ctx.fillStyle = 'hsl(240 6% 10%)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const barWidth = (canvas.width / bufferLength) * 2.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height
        const intensity = dataArray[i] / 255
        ctx.fillStyle = `hsl(270 ${60 + intensity * 40}% ${30 + intensity * 40}%)`
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)
        x += barWidth + 1
      }
    }

    draw()
  }, [])

  const drawIdle = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = 'hsl(240 6% 10%)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = 'hsl(270 50% 40%)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, canvas.height / 2)
    ctx.lineTo(canvas.width, canvas.height / 2)
    ctx.stroke()
  }, [])

  useEffect(() => { drawIdle() }, [drawIdle])

  // Auto-scroll teleprompter
  useEffect(() => {
    if (!recording) {
      cancelAnimationFrame(scrollAnimRef.current)
      return
    }
    const el = teleprompterRef.current
    if (!el) return

    let lastTime = performance.now()
    const scroll = (now: number) => {
      const dt = (now - lastTime) / 1000
      lastTime = now
      el.scrollTop += scrollSpeed * dt
      scrollAnimRef.current = requestAnimationFrame(scroll)
    }
    scrollAnimRef.current = requestAnimationFrame(scroll)
    return () => cancelAnimationFrame(scrollAnimRef.current)
  }, [recording, scrollSpeed])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      const mediaRecorder = new MediaRecorder(stream)
      chunksRef.current = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        cancelAnimationFrame(animFrameRef.current)
        drawIdle()

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const form = new FormData()
        form.append('audio', blob, `take-${Date.now()}.webm`)

        try {
          await fetch(`${API}/voice/upload`, { method: 'POST', body: form })
          fetchTakes()
        } catch {}
      }

      mediaRecorder.start(250)
      mediaRecorderRef.current = mediaRecorder
      setRecording(true)
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
      drawWaveform()
    } catch (err) {
      console.error('Microphone access denied:', err)
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const loadTakeWaveform = useCallback((filename: string, takeId: string) => {
    if (loadedTakeId === takeId && wavesurferRef.current) return
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy()
      wavesurferRef.current = null
    }
    setPlayingId(null)
    setLoadedTakeId(takeId)

    const container = wavesurferContainerRef.current
    if (!container) return

    const ws = WaveSurfer.create({
      container,
      waveColor: '#7C3AED',
      progressColor: '#5b21b6',
      cursorColor: '#a855f7',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 80,
      url: `${API}/voice/audio/${filename}`,
    })

    ws.on('finish', () => {
      setPlayingId(null)
    })

    wavesurferRef.current = ws
  }, [loadedTakeId])

  const selectTake = (id: string) => {
    fetch(`${API}/voice/takes/${id}/select`, { method: 'PUT' })
      .then(() => {
        setSelectedTake(id)
        fetchTakes()
        const take = takes.find((t) => t.id === id)
        if (take) loadTakeWaveform(take.filename, id)
      })
      .catch(() => {})
  }

  const deleteTake = (id: string) => {
    if (loadedTakeId === id) {
      wavesurferRef.current?.destroy()
      wavesurferRef.current = null
      setLoadedTakeId(null)
      setPlayingId(null)
    }
    fetch(`${API}/voice/takes/${id}`, { method: 'DELETE' })
      .then(() => fetchTakes())
      .catch(() => {})
  }

  const playTake = (_filename: string, id: string) => {
    const ws = wavesurferRef.current
    if (!ws || loadedTakeId !== id) {
      const take = takes.find((t) => t.id === id)
      if (take) {
        loadTakeWaveform(take.filename, id)
        // wait for ready then play
        setTimeout(() => {
          wavesurferRef.current?.on('ready', () => {
            wavesurferRef.current?.play()
            setPlayingId(id)
          })
        }, 50)
      }
      return
    }

    if (playingId === id) {
      ws.pause()
      setPlayingId(null)
    } else {
      ws.play()
      setPlayingId(id)
    }
  }

  // Auto-load selected take waveform on mount
  useEffect(() => {
    if (selectedTake && takes.length > 0 && !loadedTakeId) {
      const take = takes.find((t) => t.id === selectedTake)
      if (take) loadTakeWaveform(take.filename, selectedTake)
    }
  }, [selectedTake, takes, loadedTakeId, loadTakeWaveform])

  useEffect(() => {
    return () => {
      wavesurferRef.current?.destroy()
    }
  }, [])

  const transcribeLatest = () => {
    setTranscribing(true)
    setTranscript(null)
    fetch(`${API}/voice/transcribe`, { method: 'POST' })
      .then((r) => r.json() as Promise<{ text: string }>)
      .then((d) => setTranscript(d.text))
      .catch(() => setTranscript('Transcription failed'))
      .finally(() => setTranscribing(false))
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const formatSize = (b: number) => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`

  const paragraphs = script.split(/\n\n+/).filter(Boolean)

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
        <span className="text-sm font-semibold text-foreground">Voice Booth</span>
        <div className="w-20" />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left — Teleprompter */}
        <div className="flex w-[220px] shrink-0 flex-col border-r border-border bg-muted/20">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Teleprompter</span>
            {recording ? (
              <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-400">Live</span>
            ) : (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">Paused</span>
            )}
          </div>
          <div className="shrink-0 border-b border-border px-3 py-2">
            <label className="mb-1 block text-[9px] uppercase tracking-wider text-muted-foreground">Scroll Speed</label>
            <input
              type="range"
              min={10}
              max={80}
              value={scrollSpeed}
              onChange={(e) => setScrollSpeed(Number(e.target.value))}
              className="h-1 w-full cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground/50">
              <span>Slow</span>
              <span>Fast</span>
            </div>
          </div>
          <div ref={teleprompterRef} className="min-h-0 flex-1 overflow-y-auto scroll-smooth">
            <div className="px-3 py-4">
              {paragraphs.length === 0 ? (
                <p className="text-xs text-muted-foreground/50">No script loaded. Run the Overnight Brain first.</p>
              ) : (
                paragraphs.map((p, i) => (
                  <p key={i} className="mb-4 text-xs leading-relaxed text-foreground/70">{p}</p>
                ))
              )}
              <div className="h-[60vh]" />
            </div>
          </div>
        </div>

        {/* Center — Recording Controls */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-8">
          {/* Record button */}
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`flex size-28 items-center justify-center rounded-full border-4 transition-all ${
              recording
                ? 'border-red-500 bg-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.3)] hover:bg-red-500/30'
                : 'border-muted-foreground/30 bg-muted/30 hover:border-primary hover:bg-primary/10'
            }`}
          >
            {recording ? (
              <div className="size-10 rounded-sm bg-red-500" />
            ) : (
              <div className="size-10 rounded-full bg-red-500" />
            )}
          </button>

          {/* Timer */}
          <div className="text-center">
            <p className={`font-mono text-3xl font-bold tabular-nums ${recording ? 'text-red-400' : 'text-muted-foreground'}`}>
              {formatTime(elapsed)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {recording ? 'Recording... click to stop' : 'Click to start recording'}
            </p>
          </div>

          {/* Waveform — live recording uses canvas, idle/playback uses WaveSurfer */}
          {recording ? (
            <canvas
              ref={canvasRef}
              width={500}
              height={100}
              className="w-full max-w-lg rounded-lg border border-border"
            />
          ) : (
            <div className="w-full max-w-lg">
              <div
                ref={wavesurferContainerRef}
                className="w-full rounded-lg border border-border bg-[hsl(240_6%_10%)]"
                style={{ minHeight: loadedTakeId ? undefined : 80, display: loadedTakeId ? 'block' : 'none' }}
              />
              {!loadedTakeId && (
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={80}
                  className="w-full rounded-lg border border-border"
                />
              )}
              {loadedTakeId && (
                <p className="mt-1 text-center text-[9px] text-muted-foreground/50">
                  {playingId ? 'Playing...' : 'Click waveform to seek, Play to start'}
                </p>
              )}
            </div>
          )}

          {/* Transcribe button */}
          <div className="flex flex-col items-center gap-2">
            <Button
              onClick={transcribeLatest}
              disabled={transcribing || !selectedTake}
              variant="outline"
              size="sm"
            >
              {transcribing ? 'Transcribing...' : 'Transcribe Selected Take'}
            </Button>
            {transcript && (
              <div className="mt-2 max-w-lg rounded-md border border-border bg-muted/30 p-3">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Transcript</p>
                <p className="text-xs leading-relaxed text-foreground/80">{transcript}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right — Take Manager */}
        <div className="flex w-[260px] shrink-0 flex-col border-l border-border bg-muted/20">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Takes</span>
            <span className="text-[10px] text-muted-foreground">{takes.length} recorded</span>
          </div>
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-2 p-3">
              {takes.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground/50">No takes yet. Hit record!</p>
              )}
              {takes.map((take) => (
                <div
                  key={take.id}
                  className={`rounded-lg border p-2.5 transition-colors ${
                    selectedTake === take.id
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="truncate font-mono text-[10px] text-foreground/80">{take.filename}</span>
                    {selectedTake === take.id && (
                      <span className="shrink-0 rounded bg-primary/20 px-1 py-0.5 text-[8px] font-bold uppercase text-primary">Best</span>
                    )}
                  </div>
                  <div className="mb-2 flex items-center gap-2 text-[9px] text-muted-foreground">
                    <span>{formatSize(take.size)}</span>
                    <span>{new Date(take.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant={playingId === take.id ? 'default' : 'ghost'}
                      className="h-6 px-2 text-[10px]"
                      onClick={() => playTake(take.filename, take.id)}
                    >
                      {playingId === take.id ? 'Stop' : 'Play'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => selectTake(take.id)}
                      disabled={selectedTake === take.id}
                    >
                      Use This
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-6 px-2 text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => deleteTake(take.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
