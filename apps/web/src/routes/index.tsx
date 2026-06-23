import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '#/components/ui/tabs.tsx'
import { TopBar } from '#/components/editor/top-bar.tsx'
import { AssetPanel } from '#/components/editor/asset-panel.tsx'
import { PreviewCanvas } from '#/components/editor/preview-canvas.tsx'
import { Timeline } from '#/components/editor/timeline.tsx'
import { PropertiesPanel } from '#/components/editor/properties-panel.tsx'
import { AiChat } from '#/components/editor/ai-chat.tsx'
import { TimelineProvider, useTimeline } from '#/components/editor/timeline-context.tsx'

export const Route = createFileRoute('/')({ component: Editor })

function KeyboardListener() {
  const { undo, redo, clips, selectedClipId, updateClipProps, trimClip, splitClip, rippleDelete, playheadTime } = useTimeline()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); undo(); return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); redo(); return
      }

      // Split clip (Ctrl+K)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        if (selectedClipId) splitClip(selectedClipId, playheadTime)
        return
      }

      // Ripple delete (Shift+Delete)
      if (e.shiftKey && e.key === 'Delete') {
        e.preventDefault()
        if (selectedClipId) rippleDelete(selectedClipId)
        return
      }

      if (!selectedClipId) return
      const clip = clips.find((c) => c.id === selectedClipId)
      if (!clip) return

      const step = e.shiftKey ? 10 : 1

      // Arrow keys nudge position on canvas
      if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        updateClipProps(clip.id, { x: clip.x - step })
      }
      if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        updateClipProps(clip.id, { x: clip.x + step })
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        updateClipProps(clip.id, { y: clip.y - step })
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        updateClipProps(clip.id, { y: clip.y + step })
      }

      // [ and ] adjust duration
      if (e.key === '[') {
        e.preventDefault()
        trimClip(clip.id, clip.duration - 0.1)
      }
      if (e.key === ']') {
        e.preventDefault()
        trimClip(clip.id, clip.duration + 0.1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, clips, selectedClipId, updateClipProps, trimClip, splitClip, rippleDelete, playheadTime])

  return null
}

function Editor() {
  const [rightTab, setRightTab] = useState('properties')

  return (
    <TimelineProvider>
      <KeyboardListener />
      <div style={{ width: '100%', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} className="bg-background">
        <TopBar />

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 260px', flex: 1, minHeight: 0 }}>
          {/* Left: Asset Browser */}
          <div className="overflow-hidden border-r border-border">
            <AssetPanel />
          </div>

          {/* Center: Preview + Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
            <div style={{ flex: '1 1 60%', minHeight: 0 }}>
              <PreviewCanvas />
            </div>
            <div style={{ flex: '1 1 40%', minHeight: 0 }}>
              <Timeline />
            </div>
          </div>

          {/* Right: Properties / AI Chat */}
          <div className="overflow-hidden border-l border-border">
            <Tabs
              value={rightTab}
              onValueChange={setRightTab}
              className="flex h-full flex-col gap-0 overflow-hidden"
            >
              <div className="shrink-0 border-b border-border px-2 pt-2">
                <TabsList variant="line" className="w-auto">
                  <TabsTrigger value="properties">Properties</TabsTrigger>
                  <TabsTrigger value="ai">AI Chat</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="properties" className="min-h-0 flex-1 overflow-auto">
                <PropertiesPanel />
              </TabsContent>
              <TabsContent value="ai" className="min-h-0 flex-1 overflow-hidden [&>div]:h-full">
                <AiChat />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </TimelineProvider>
  )
}
