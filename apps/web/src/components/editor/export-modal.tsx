import { useState, useRef, useCallback } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { Button } from '#/components/ui/button.tsx'
import { useTimeline } from './timeline-context.tsx'

interface ExportModalProps {
  open: boolean
  onClose: () => void
}

export function ExportModal({ open, onClose }: ExportModalProps) {
  const { clips } = useTimeline()
  const [resolution, setResolution] = useState<'1080p' | '720p' | '480p'>('1080p')
  const [fps, setFps] = useState(24)
  const [progress, setProgress] = useState(-1)
  const [error, setError] = useState<string | null>(null)
  const ffmpegRef = useRef<FFmpeg | null>(null)

  const resMap = { '1080p': { w: 1920, h: 1080 }, '720p': { w: 1280, h: 720 }, '480p': { w: 854, h: 480 } }

  const doExport = useCallback(async () => {
    setError(null)
    setProgress(0)

    const imageClips = clips
      .filter((c) => c.type === 'image')
      .sort((a, b) => a.startTime - b.startTime)

    if (imageClips.length === 0) {
      setError('No image clips on the timeline.')
      return
    }

    try {
      const ffmpeg = new FFmpeg()
      ffmpegRef.current = ffmpeg
      ffmpeg.on('progress', ({ progress: p }) => setProgress(Math.round(p * 100)))

      await ffmpeg.load({
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
        wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
      })

      const res = resMap[resolution]
      const inputs: string[] = []
      const filterParts: string[] = []

      for (let i = 0; i < imageClips.length; i++) {
        const clip = imageClips[i]
        const ext = clip.src.split('.').pop()?.split('?')[0] ?? 'png'
        const inputName = `img${i}.${ext}`

        const data = await fetchFile(clip.src)
        await ffmpeg.writeFile(inputName, data)
        inputs.push(`-loop 1 -t ${clip.duration} -i ${inputName}`)
        filterParts.push(`[${i}:v]scale=${res.w}:${res.h}:force_original_aspect_ratio=decrease,pad=${res.w}:${res.h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[v${i}]`)
      }

      const concatInputs = imageClips.map((_, i) => `[v${i}]`).join('')
      const filterComplex = filterParts.join(';') + `;${concatInputs}concat=n=${imageClips.length}:v=1:a=0[outv]`

      const audioClips = clips.filter((c) => c.type === 'audio').sort((a, b) => a.startTime - b.startTime)
      let audioArgs = ''
      if (audioClips.length > 0) {
        const audioClip = audioClips[0]
        const audioData = await fetchFile(audioClip.src)
        await ffmpeg.writeFile('audio.webm', audioData)
        audioArgs = `-i audio.webm -map [outv] -map ${imageClips.length}:a -shortest`
      }

      const cmdStr = [
        ...inputs,
        audioArgs,
        `-filter_complex "${filterComplex}"`,
        audioArgs ? '' : '-map [outv]',
        `-r ${fps} -c:v libx264 -preset fast -pix_fmt yuv420p output.mp4`,
      ].filter(Boolean).join(' ')

      await ffmpeg.exec(cmdStr.split(/\s+/))

      const data = await ffmpeg.readFile('output.mp4')
      const blob = new Blob([data], { type: 'video/mp4' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${localStorage.getItem('youstudio-project-name') || 'project'}.mp4`
      a.click()
      URL.revokeObjectURL(url)
      setProgress(100)
    } catch (err) {
      console.error('Export failed:', err)
      setError(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}. Make sure COOP/COEP headers are set.`)
      setProgress(-1)
    }
  }, [clips, resolution, fps])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 shadow-xl">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Export to MP4</h2>

        <div className="mb-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Resolution</span>
            <div className="flex gap-1">
              {(['1080p', '720p', '480p'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setResolution(r)}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                    resolution === r ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">FPS</span>
            <div className="flex gap-1">
              {[24, 30].map((f) => (
                <button
                  key={f}
                  onClick={() => setFps(f)}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                    fps === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Clips</span>
            <span className="text-xs text-foreground">{clips.filter((c) => c.type === 'image').length} images, {clips.filter((c) => c.type === 'audio').length} audio</span>
          </div>
        </div>

        {progress >= 0 && (
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Exporting...</span>
              <span className="text-[10px] font-bold text-foreground">{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {error && <p className="mb-3 text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={doExport} disabled={progress >= 0 && progress < 100}>
            {progress >= 0 && progress < 100 ? 'Exporting...' : progress === 100 ? 'Done!' : 'Export'}
          </Button>
        </div>
      </div>
    </>
  )
}
