import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '#/components/ui/tabs.tsx'
import { TopBar } from '#/components/editor/top-bar.tsx'
import { AssetPanel } from '#/components/editor/asset-panel.tsx'
import { PreviewCanvas } from '#/components/editor/preview-canvas.tsx'
import { TimelinePlaceholder } from '#/components/editor/timeline-placeholder.tsx'
import { PropertiesPanel } from '#/components/editor/properties-panel.tsx'
import { AiChat } from '#/components/editor/ai-chat.tsx'

export const Route = createFileRoute('/')({ component: Editor })

function Editor() {
  const [rightTab, setRightTab] = useState('properties')

  return (
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
            <TimelinePlaceholder />
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
            <TabsContent value="ai" className="min-h-0 flex-1 overflow-hidden">
              <AiChat />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
