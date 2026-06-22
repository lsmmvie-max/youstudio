import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '#/components/ui/tabs.tsx'
import { ScrollArea } from '#/components/ui/scroll-area.tsx'

const FOLDERS = [
  { id: 'assets', label: 'Assets' },
  { id: 'characters', label: 'Chars' },
  { id: 'backgrounds', label: 'BGs' },
] as const

type FolderTab = (typeof FOLDERS)[number]['id']

function PlaceholderGrid({ folder }: { folder: FolderTab }) {
  const items = Array.from({ length: 6 }, (_, i) => `${folder}-${i + 1}`)
  return (
    <div className="grid grid-cols-2 gap-2 p-2">
      {items.map((id) => (
        <div
          key={id}
          className="group flex aspect-video cursor-pointer flex-col items-center justify-center rounded-md border border-border bg-muted/50 transition-colors hover:border-primary/50 hover:bg-muted"
        >
          <div className="mb-1 size-5 rounded bg-muted-foreground/20" />
          <span className="text-[10px] text-muted-foreground group-hover:text-foreground">{id}</span>
        </div>
      ))}
    </div>
  )
}

export function AssetPanel() {
  const [tab, setTab] = useState<FolderTab>('assets')

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Tabs value={tab} onValueChange={(v) => setTab(v as FolderTab)} className="flex h-full flex-col gap-0 overflow-hidden">
        <div className="shrink-0 border-b border-border px-2 pt-2">
          <TabsList variant="line" className="w-auto">
            {FOLDERS.map((f) => (
              <TabsTrigger key={f.id} value={f.id}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {FOLDERS.map((f) => (
            <TabsContent key={f.id} value={f.id}>
              <PlaceholderGrid folder={f.id} />
            </TabsContent>
          ))}
        </ScrollArea>
      </Tabs>
    </div>
  )
}
