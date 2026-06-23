import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Image as KImage, Text, Transformer, Rect, Line, Group } from 'react-konva'
import useImage from 'use-image'
import { useTimeline, interpolateClip, TRACK_META, type TimelineClip } from './timeline-context.tsx'
import type Konva from 'konva'
import KonvaFilters from 'konva'

const CANVAS_ASPECT = 16 / 9
const SNAP_THRESHOLD = 20

const SNAP_LINES_X = [0, 640, 960, 1280, 1920]
const SNAP_LINES_Y = [0, 360, 540, 720, 1080]

function snapValue(val: number, targets: number[], threshold: number): { snapped: number; target: number | null } {
  for (const t of targets) {
    if (Math.abs(val - t) < threshold) return { snapped: t, target: t }
  }
  return { snapped: val, target: null }
}

function ClipImage({ clip, interpolated, isSelected, onSelect, onDragEnd, onTransformEnd, onDragMove }: {
  clip: TimelineClip
  interpolated: { x: number; y: number; width: number; height: number; rotation: number; opacity: number }
  isSelected: boolean
  onSelect: () => void
  onDragEnd: (x: number, y: number) => void
  onTransformEnd: (w: number, h: number, x: number, y: number) => void
  onDragMove: (x: number, y: number) => void
}) {
  const [img] = useImage(clip.src, 'anonymous')
  const shapeRef = useRef<Konva.Image>(null)
  const trRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  // Apply color grading filters
  useEffect(() => {
    const node = shapeRef.current
    if (!node || !img) return
    const cg = clip.colorGrading
    if (!cg) {
      node.filters([])
      node.clearCache()
      return
    }
    const hasGrading = cg.brightness !== 0 || cg.contrast !== 0 || cg.saturation !== 0 || cg.hue !== 0
    if (!hasGrading) {
      node.filters([])
      node.clearCache()
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filters: any[] = []
    if (cg.brightness !== 0) {
      node.brightness(cg.brightness / 100)
      filters.push(KonvaFilters.Filters.Brighten)
    }
    if (cg.contrast !== 0) {
      node.contrast(cg.contrast)
      filters.push(KonvaFilters.Filters.Contrast)
    }
    if (cg.saturation !== 0 || cg.hue !== 0) {
      node.saturation(cg.saturation / 100)
      node.hue(cg.hue * 3.6)
      filters.push(KonvaFilters.Filters.HSL)
    }
    node.filters(filters)
    node.cache()
  }, [clip.colorGrading, img])

  const badge = TRACK_META[clip.track]?.label ?? ''

  return (
    <>
      <KImage
        ref={shapeRef}
        image={img}
        x={interpolated.x}
        y={interpolated.y}
        width={interpolated.width}
        height={interpolated.height}
        rotation={interpolated.rotation}
        opacity={interpolated.opacity / 100}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={(e) => {
          const node = e.target
          const sx = snapValue(node.x(), SNAP_LINES_X, SNAP_THRESHOLD)
          const sy = snapValue(node.y(), SNAP_LINES_Y, SNAP_THRESHOLD)
          const cx = node.x() + node.width() / 2
          const cy = node.y() + node.height() / 2
          const scx = snapValue(cx, [960], SNAP_THRESHOLD)
          const scy = snapValue(cy, [540], SNAP_THRESHOLD)

          let finalX = sx.target !== null ? sx.snapped : node.x()
          let finalY = sy.target !== null ? sy.snapped : node.y()
          if (scx.target !== null) finalX = 960 - node.width() / 2
          if (scy.target !== null) finalY = 540 - node.height() / 2

          if (finalX !== node.x() || finalY !== node.y()) {
            node.x(finalX)
            node.y(finalY)
          }
          onDragMove(node.x(), node.y())
        }}
        onDragEnd={(e) => {
          onDragEnd(e.target.x(), e.target.y())
          onDragMove(-Infinity, -Infinity)
        }}
        onTransformEnd={() => {
          const node = shapeRef.current
          if (!node) return
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()
          node.scaleX(1)
          node.scaleY(1)
          onTransformEnd(
            Math.max(5, node.width() * scaleX),
            Math.max(5, node.height() * scaleY),
            node.x(),
            node.y(),
          )
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(_old, newBox) => ({
            ...newBox,
            width: Math.max(5, newBox.width),
            height: Math.max(5, newBox.height),
          })}
          borderStroke="#7C3AED"
          anchorStroke="#7C3AED"
          anchorFill="#fff"
          anchorSize={8}
        />
      )}
      {badge && img && (
        <>
          <Rect x={interpolated.x + 4} y={interpolated.y + 4} width={30} height={16} fill="rgba(0,0,0,0.6)" cornerRadius={3} listening={false} />
          <Text x={interpolated.x + 4} y={interpolated.y + 5} width={30} text={badge} fontSize={10} fontStyle="bold" fill="#fff" align="center" listening={false} />
        </>
      )}
    </>
  )
}

function VideoClip({ clip, playheadTime, isPlaying }: {
  clip: TimelineClip
  playheadTime: number
  isPlaying: boolean
}) {
  const imageRef = useRef<Konva.Image>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const animFrameRef = useRef<number>(0)

  useEffect(() => {
    const video = document.createElement('video')
    video.src = clip.src
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.muted = true
    video.preload = 'auto'
    videoRef.current = video

    return () => {
      video.pause()
      video.src = ''
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [clip.src])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = clip.speed ?? 1
  }, [clip.speed])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const relTime = playheadTime - clip.startTime
    if (relTime < 0 || relTime > clip.duration) return

    if (isPlaying) {
      video.currentTime = relTime
      video.play().catch(() => {})

      const updateFrame = () => {
        const node = imageRef.current
        if (node) {
          node.image(video)
          node.getLayer()?.batchDraw()
        }
        animFrameRef.current = requestAnimationFrame(updateFrame)
      }
      animFrameRef.current = requestAnimationFrame(updateFrame)
    } else {
      video.pause()
      video.currentTime = relTime
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)

      video.onseeked = () => {
        const node = imageRef.current
        if (node) {
          node.image(video)
          node.getLayer()?.batchDraw()
        }
      }
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [playheadTime, isPlaying, clip.startTime, clip.duration])

  const interp = interpolateClip(clip, playheadTime)

  return (
    <KImage
      ref={imageRef}
      image={undefined as unknown as HTMLImageElement}
      x={interp.x}
      y={interp.y}
      width={interp.width}
      height={interp.height}
      rotation={interp.rotation}
      opacity={interp.opacity / 100}
      listening={false}
    />
  )
}

function TextClip({ clip, playheadTime }: {
  clip: TimelineClip
  playheadTime: number
}) {
  const elapsed = playheadTime - clip.startTime
  const progress = clip.duration > 0 ? Math.min(1, elapsed / clip.duration) : 1
  const text = clip.text ?? ''
  const animation = clip.textAnimation ?? 'none'

  let displayText = text
  let opacity = (clip.opacity ?? 100) / 100
  let offsetY = 0
  let scaleVal = 1

  switch (animation) {
    case 'typewriter': {
      const charCount = Math.floor(progress * text.length)
      displayText = text.substring(0, charCount)
      break
    }
    case 'fade-in': {
      if (progress < 0.3) opacity *= progress / 0.3
      break
    }
    case 'slide-up': {
      if (progress < 0.3) offsetY = 50 * (1 - progress / 0.3)
      break
    }
    case 'slide-down': {
      if (progress < 0.3) offsetY = -50 * (1 - progress / 0.3)
      break
    }
    case 'pop': {
      if (progress < 0.2) scaleVal = 0.5 + 0.5 * (progress / 0.2)
      break
    }
  }

  const interp = interpolateClip(clip, playheadTime)

  return (
    <Text
      x={interp.x}
      y={interp.y + offsetY}
      width={interp.width}
      text={displayText}
      fontSize={clip.fontSize ?? 64}
      fontFamily={clip.fontFamily ?? 'Inter, system-ui, sans-serif'}
      fontStyle={`${clip.bold ? 'bold' : ''} ${clip.italic ? 'italic' : ''}`.trim() || 'normal'}
      fill={clip.fontColor ?? '#ffffff'}
      align={clip.textAlign ?? 'center'}
      opacity={opacity}
      scaleX={scaleVal}
      scaleY={scaleVal}
      listening={false}
    />
  )
}

function CaptionText({ clip, stageWidth, stageHeight }: {
  clip: { text?: string }
  stageWidth: number
  stageHeight: number
}) {
  const fontSize = Math.max(16, Math.round(stageHeight * 0.045))
  return (
    <Text
      x={stageWidth * 0.05}
      y={stageHeight * 0.82}
      width={stageWidth * 0.9}
      text={clip.text ?? ''}
      fontSize={fontSize}
      fontFamily="Inter, system-ui, sans-serif"
      fontStyle="bold"
      fill="#ffffff"
      stroke="#000000"
      strokeWidth={2}
      align="center"
      listening={false}
    />
  )
}

function GridOverlay() {
  const lines: React.ReactNode[] = []
  for (let x = 192; x < 1920; x += 192) {
    const isThird = x === 640 || x === 1280
    lines.push(<Line key={`gx${x}`} points={[x, 0, x, 1080]} stroke={isThird ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'} strokeWidth={1} listening={false} />)
  }
  for (let y = 108; y < 1080; y += 108) {
    const isThird = y === 360 || y === 720
    lines.push(<Line key={`gy${y}`} points={[0, y, 1920, y]} stroke={isThird ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'} strokeWidth={1} listening={false} />)
  }
  lines.push(<Line key="cx" points={[960, 0, 960, 1080]} stroke="#7C3AED" strokeWidth={1} opacity={0.5} listening={false} />)
  lines.push(<Line key="cy" points={[0, 540, 1920, 540]} stroke="#7C3AED" strokeWidth={1} opacity={0.5} listening={false} />)
  return <>{lines}</>
}

function SnapGuides({ guideX, guideY }: { guideX: number | null; guideY: number | null }) {
  return (
    <>
      {guideX !== null && <Line points={[guideX, 0, guideX, 1080]} stroke="#7C3AED" strokeWidth={1} dash={[6, 3]} listening={false} />}
      {guideY !== null && <Line points={[0, guideY, 1920, guideY]} stroke="#7C3AED" strokeWidth={1} dash={[6, 3]} listening={false} />}
    </>
  )
}

// Audio engine hook
function useAudioEngine(clips: TimelineClip[], playheadTime: number, isPlaying: boolean) {
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())

  useEffect(() => {
    const audioClips = clips.filter((c) => c.type === 'audio')

    for (const clip of audioClips) {
      if (!audioElementsRef.current.has(clip.id)) {
        const audio = new Audio(clip.src)
        audio.crossOrigin = 'anonymous'
        audio.preload = 'auto'
        audioElementsRef.current.set(clip.id, audio)
      }
    }

    // Clean up removed clips
    for (const [id, audio] of audioElementsRef.current.entries()) {
      if (!audioClips.find((c) => c.id === id)) {
        audio.pause()
        audio.src = ''
        audioElementsRef.current.delete(id)
      }
    }
  }, [clips])

  useEffect(() => {
    const audioClips = clips.filter((c) => c.type === 'audio')

    for (const clip of audioClips) {
      const audio = audioElementsRef.current.get(clip.id)
      if (!audio) continue

      const relTime = playheadTime - clip.startTime
      const isActive = relTime >= 0 && relTime < clip.duration

      if (!isActive || !isPlaying) {
        audio.pause()
        continue
      }

      const effects = clip.audioEffects
      const speed = effects?.speed ?? 1
      const volume = effects?.volume ?? (clip.volume ?? 1)

      audio.playbackRate = speed
      audio.volume = Math.max(0, Math.min(1, volume))

      // Fade in/out
      if (effects) {
        const fadeIn = effects.fadeIn ?? 0
        const fadeOut = effects.fadeOut ?? 0
        let fadeVolume = volume

        if (fadeIn > 0 && relTime < fadeIn) {
          fadeVolume = volume * (relTime / fadeIn)
        }
        if (fadeOut > 0 && relTime > clip.duration - fadeOut) {
          fadeVolume = volume * ((clip.duration - relTime) / fadeOut)
        }
        audio.volume = Math.max(0, Math.min(1, fadeVolume))
      }

      if (Math.abs(audio.currentTime - relTime) > 0.3) {
        audio.currentTime = relTime
      }
      audio.play().catch(() => {})
    }
  }, [clips, playheadTime, isPlaying])

  // Stop all audio when not playing
  useEffect(() => {
    if (!isPlaying) {
      for (const audio of audioElementsRef.current.values()) {
        audio.pause()
      }
    }
  }, [isPlaying])
}

export function PreviewCanvas() {
  const { clips, transitions, playheadTime, selectedClipId, isPlaying, selectClip, updateClipProps, removeClip, hiddenTracks } = useTimeline()
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 640, h: 360 })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId: string } | null>(null)
  const [showGrid, setShowGrid] = useState(false)
  const [guideX, setGuideX] = useState<number | null>(null)
  const [guideY, setGuideY] = useState<number | null>(null)

  useAudioEngine(clips, playheadTime, isPlaying)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      const pad = 16
      const aw = width - pad * 2
      const ah = height - pad * 2
      let w: number, h: number
      if (aw / ah > CANVAS_ASPECT) {
        h = ah
        w = h * CANVAS_ASPECT
      } else {
        w = aw
        h = w / CANVAS_ASPECT
      }
      setSize({ w: Math.round(w), h: Math.round(h) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scaleX = size.w / 1920
  const scaleY = size.h / 1080

  const activeClips = clips
    .filter((c) =>
      playheadTime >= c.startTime &&
      playheadTime < c.startTime + c.duration &&
      !hiddenTracks.has(c.track)
    )
    .sort((a, b) => a.track - b.track)

  const imageClips = activeClips.filter((c) => c.type === 'image')
  const videoClips = activeClips.filter((c) => c.type === 'video')
  const captionClips = activeClips.filter((c) => c.type === 'caption')
  const textClips = activeClips.filter((c) => c.type === 'text')

  // Compute transition opacity adjustments
  const getTransitionOpacity = useCallback((clip: TimelineClip): { opacity: number; clipRegion?: { x: number; y: number; width: number; height: number }; scale?: number } => {
    for (const tr of transitions) {
      const fromClip = clips.find((c) => c.id === tr.fromClipId)
      const toClip = clips.find((c) => c.id === tr.toClipId)
      if (!fromClip || !toClip) continue

      const overlapStart = Math.max(fromClip.startTime, toClip.startTime - tr.duration)
      const overlapEnd = fromClip.startTime + fromClip.duration

      if (playheadTime < overlapStart || playheadTime >= overlapEnd) continue
      const progress = (playheadTime - overlapStart) / (overlapEnd - overlapStart)

      if (clip.id === tr.fromClipId) {
        switch (tr.type) {
          case 'fade':
          case 'dissolve':
            return { opacity: 1 - progress }
          case 'zoom':
            return { opacity: 1 - progress, scale: 1 + progress * 0.2 }
          default:
            return { opacity: 1 }
        }
      }

      if (clip.id === tr.toClipId) {
        switch (tr.type) {
          case 'fade':
          case 'dissolve':
            return { opacity: progress }
          case 'wipe-left':
            return { opacity: 1, clipRegion: { x: 1920 * (1 - progress), y: 0, width: 1920 * progress, height: 1080 } }
          case 'wipe-right':
            return { opacity: 1, clipRegion: { x: 0, y: 0, width: 1920 * progress, height: 1080 } }
          case 'zoom':
            return { opacity: progress }
          default:
            return { opacity: 1 }
        }
      }
    }
    return { opacity: 1 }
  }, [transitions, clips, playheadTime])

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      selectClip(null)
      setContextMenu(null)
    }
  }, [selectClip])

  const handleContextMenu = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault()
    const target = e.target
    if (target === target.getStage()) return
    const clip = imageClips.find((c) => c.id === selectedClipId)
    if (!clip) return
    setContextMenu({ x: e.evt.clientX, y: e.evt.clientY, clipId: clip.id })
  }, [imageClips, selectedClipId])

  const setTrack = (clipId: string, track: number) => {
    updateClipProps(clipId, { track })
    setContextMenu(null)
  }

  const handleDragMove = useCallback((x: number, y: number) => {
    if (x === -Infinity) { setGuideX(null); setGuideY(null); return }
    const sx = snapValue(x, SNAP_LINES_X, SNAP_THRESHOLD)
    const sy = snapValue(y, SNAP_LINES_Y, SNAP_THRESHOLD)
    setGuideX(sx.target)
    setGuideY(sy.target)
  }, [])

  return (
    <div ref={containerRef} className="relative flex h-full flex-col bg-[oklch(0.1_0.005_285)]">
      {/* Canvas toolbar */}
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border/30 px-3">
        <button
          onClick={() => setShowGrid((g) => !g)}
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
            showGrid ? 'bg-primary/20 text-primary' : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
          title="Toggle grid overlay"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" className="shrink-0">
            <line x1="3.3" y1="0" x2="3.3" y2="10" /><line x1="6.6" y1="0" x2="6.6" y2="10" />
            <line x1="0" y1="3.3" x2="10" y2="3.3" /><line x1="0" y1="6.6" x2="10" y2="6.6" />
          </svg>
          Grid
        </button>
      </div>

      {/* Stage */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Stage
          width={size.w}
          height={size.h}
          scaleX={scaleX}
          scaleY={scaleY}
          className="rounded border border-border/50"
          style={{ background: '#000' }}
          onClick={handleStageClick}
          onContextMenu={handleContextMenu}
        >
          <Layer>
            <Rect x={0} y={0} width={1920} height={1080} fill="#000" listening={false} />
            {imageClips.map((clip) => {
              const interp = interpolateClip(clip, playheadTime)
              const trEffect = getTransitionOpacity(clip)
              const adjustedInterp = {
                ...interp,
                opacity: interp.opacity * trEffect.opacity,
              }
              if (trEffect.clipRegion) {
                return (
                  <Group key={clip.id} clipX={trEffect.clipRegion.x} clipY={trEffect.clipRegion.y} clipWidth={trEffect.clipRegion.width} clipHeight={trEffect.clipRegion.height}>
                    <ClipImage
                      clip={clip}
                      interpolated={adjustedInterp}
                      isSelected={selectedClipId === clip.id}
                      onSelect={() => selectClip(clip.id)}
                      onDragEnd={(x, y) => updateClipProps(clip.id, { x, y })}
                      onTransformEnd={(w, h, x, y) => updateClipProps(clip.id, { width: w, height: h, x, y })}
                      onDragMove={handleDragMove}
                    />
                  </Group>
                )
              }
              return (
                <ClipImage
                  key={clip.id}
                  clip={clip}
                  interpolated={adjustedInterp}
                  isSelected={selectedClipId === clip.id}
                  onSelect={() => selectClip(clip.id)}
                  onDragEnd={(x, y) => updateClipProps(clip.id, { x, y })}
                  onTransformEnd={(w, h, x, y) => updateClipProps(clip.id, { width: w, height: h, x, y })}
                  onDragMove={handleDragMove}
                />
              )
            })}
            {videoClips.map((clip) => (
              <VideoClip
                key={clip.id}
                clip={clip}
                playheadTime={playheadTime}
                isPlaying={isPlaying}
              />
            ))}
          </Layer>

          {/* Grid overlay layer */}
          {showGrid && (
            <Layer listening={false}>
              <GridOverlay />
            </Layer>
          )}

          {/* Snap guides layer */}
          <Layer listening={false}>
            <SnapGuides guideX={guideX} guideY={guideY} />
          </Layer>

          {/* Text + Captions layer (on top) */}
          <Layer listening={false}>
            {textClips.map((clip) => (
              <TextClip key={clip.id} clip={clip} playheadTime={playheadTime} />
            ))}
            {captionClips.map((clip) => (
              <CaptionText key={clip.id} clip={clip} stageWidth={1920} stageHeight={1080} />
            ))}
            {imageClips.length === 0 && videoClips.length === 0 && captionClips.length === 0 && textClips.length === 0 && (
              <>
                <Text x={960} y={520} text="No media" fontSize={28} fill="#666" align="center" offsetX={40} listening={false} />
                <Text x={960} y={555} text="Drop assets onto the timeline" fontSize={20} fill="#444" align="center" offsetX={120} listening={false} />
              </>
            )}
          </Layer>
        </Stage>
      </div>

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 rounded-md border border-border bg-popover py-1 shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button className="block w-full px-3 py-1.5 text-left text-xs hover:bg-accent" onClick={() => setTrack(contextMenu.clipId, 0)}>Set as Background (BG)</button>
            <button className="block w-full px-3 py-1.5 text-left text-xs hover:bg-accent" onClick={() => setTrack(contextMenu.clipId, 1)}>Set as Character (CHR)</button>
            <button className="block w-full px-3 py-1.5 text-left text-xs hover:bg-accent" onClick={() => setTrack(contextMenu.clipId, 2)}>Set as Overlay (OVR)</button>
            <div className="my-1 border-t border-border" />
            <button className="block w-full px-3 py-1.5 text-left text-xs text-destructive hover:bg-accent" onClick={() => { removeClip(contextMenu.clipId); setContextMenu(null) }}>Remove</button>
          </div>
        </>
      )}
    </div>
  )
}
