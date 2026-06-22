import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '#/components/ui/resizable.tsx'
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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <TopBar />

      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        {/* Left: Asset Browser */}
        <ResizablePanel defaultSize={18} minSize={12} maxSize={30}>
          <div className="h-full overflow-hidden">
            <AssetPanel />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center: Preview + Timeline */}
        <ResizablePanel defaultSize={62} minSize={40}>
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize={62} minSize={30}>
              <PreviewCanvas />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={38} minSize={15}>
              <TimelinePlaceholder />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Properties / AI Chat */}
        <ResizablePanel defaultSize={20} minSize={14} maxSize={30}>
          <div className="h-full overflow-hidden">
            <Tabs
              value={rightTab}
              onValueChange={setRightTab}
              className="flex h-full flex-col gap-0"
            >
              <div className="shrink-0 border-b border-border px-2 pt-2">
                <TabsList variant="line" className="w-full">
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
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
