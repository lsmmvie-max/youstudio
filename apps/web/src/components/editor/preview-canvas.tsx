import { useRef, useEffect } from 'react'
import { useTimeline } from './timeline-context.tsx'

export function PreviewCanvas() {
  const { clips, playheadTime } = useTimeline()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map())

  const activeClip = clips
    .filter((c) => c.type === 'image' && playheadTime >= c.startTime && playheadTime < c.startTime + c.duration)
    .sort((a, b) => b.track - a.track)[0]

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const cw = container.clientWidth
    const ch = container.clientHeight
    const aspect = 16 / 9
    let w: number, h: number
    if (cw / ch > aspect) {
      h = ch
      w = h * aspect
    } else {
      w = cw
      h = w / aspect
    }
    canvas.width = w
    canvas.height = h

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h)

    if (!activeClip) {
      ctx.fillStyle = '#666'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No media', w / 2, h / 2 - 8)
      ctx.font = '11px sans-serif'
      ctx.fillStyle = '#555'
      ctx.fillText('Drop assets onto the timeline', w / 2, h / 2 + 12)
      return
    }

    const cached = imgCache.current.get(activeClip.src)
    if (cached && cached.complete) {
      drawImage(ctx, cached, w, h, activeClip)
    } else {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        imgCache.current.set(activeClip.src, img)
        drawImage(ctx, img, w, h, activeClip)
      }
      img.src = activeClip.src
    }
  }, [activeClip, playheadTime, clips])

  return (
    <div ref={containerRef} className="flex h-full items-center justify-center bg-[oklch(0.1_0.005_285)] p-4">
      <canvas ref={canvasRef} className="rounded border border-border/50" />
    </div>
  )
}

function drawImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cw: number,
  ch: number,
  clip: { x: number; y: number; width: number; height: number; rotation: number; opacity: number }
) {
  ctx.clearRect(0, 0, cw, ch)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, cw, ch)

  ctx.save()
  ctx.globalAlpha = clip.opacity / 100

  const scaleX = cw / 1920
  const scaleY = ch / 1080
  const scale = Math.min(scaleX, scaleY)

  const dw = img.naturalWidth * scale * (clip.width / 1920)
  const dh = img.naturalHeight * scale * (clip.height / 1080)

  const imgAspect = img.naturalWidth / img.naturalHeight
  const boxAspect = cw / ch
  let fitW: number, fitH: number
  if (imgAspect > boxAspect) {
    fitW = cw
    fitH = cw / imgAspect
  } else {
    fitH = ch
    fitW = ch * imgAspect
  }
  const dx = (cw - fitW) / 2 + clip.x * scale
  const dy = (ch - fitH) / 2 + clip.y * scale

  if (clip.rotation !== 0) {
    const cx = dx + fitW / 2
    const cy = dy + fitH / 2
    ctx.translate(cx, cy)
    ctx.rotate((clip.rotation * Math.PI) / 180)
    ctx.drawImage(img, -fitW / 2, -fitH / 2, fitW, fitH)
  } else {
    ctx.drawImage(img, dx, dy, fitW, fitH)
  }

  ctx.restore()
}
