import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { Stage, Layer, Image as KImage, Text, Transformer, Rect } from 'react-konva'
import useImage from 'use-image'
import { useTimeline, interpolateClip, TRACK_META, type TimelineClip } from './timeline-context.tsx'
import type Konva from 'konva'

const CANVAS_ASPECT = 16 / 9

function ClipImage({ clip, interpolated, isSelected, onSelect, onDragEnd, onTransformEnd }: {
  clip: TimelineClip
  interpolated: { x: number; y: number; width: number; height: number; rotation: number; opacity: number }
  isSelected: boolean
  onSelect: () => void
  onDragEnd: (x: number, y: number) => void
  onTransformEnd: (w: number, h: number, x: number, y: number) => void
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
        onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
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

export function PreviewCanvas() {
  const { clips, playheadTime, selectedClipId, selectClip, updateClipProps, removeClip, hiddenTracks } = useTimeline()
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 640, h: 360 })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId: string } | null>(null)

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
  const captionClips = activeClips.filter((c) => c.type === 'caption')

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

  return (
    <div ref={containerRef} className="relative flex h-full items-center justify-center bg-[oklch(0.1_0.005_285)]">
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
            return (
              <ClipImage
                key={clip.id}
                clip={clip}
                interpolated={interp}
                isSelected={selectedClipId === clip.id}
                onSelect={() => selectClip(clip.id)}
                onDragEnd={(x, y) => updateClipProps(clip.id, { x, y })}
                onTransformEnd={(w, h, x, y) => updateClipProps(clip.id, { width: w, height: h, x, y })}
              />
            )
          })}
          {captionClips.map((clip) => (
            <CaptionText key={clip.id} clip={clip} stageWidth={1920} stageHeight={1080} />
          ))}
          {imageClips.length === 0 && captionClips.length === 0 && (
            <>
              <Text x={960} y={520} text="No media" fontSize={28} fill="#666" align="center" offsetX={40} listening={false} />
              <Text x={960} y={555} text="Drop assets onto the timeline" fontSize={20} fill="#444" align="center" offsetX={120} listening={false} />
            </>
          )}
        </Layer>
      </Stage>

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
