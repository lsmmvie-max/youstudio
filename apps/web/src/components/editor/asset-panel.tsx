import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '#/components/ui/tabs.tsx'
import { ScrollArea } from '#/components/ui/scroll-area.tsx'

const FOLDERS = [
  { id: 'assets', label: 'Assets' },
  { id: 'characters', label: 'Chars' },
  { id: 'backgrounds', label: 'BGs' },
] as const

type FolderTab = (typeof FOLDERS)[number]['id']

function PlaceholderGrid({ folder, search }: { folder: FolderTab; search: string }) {
  const items = Array.from({ length: 6 }, (_, i) => `${folder}-${i + 1}`)
  const filtered = search
    ? items.filter((id) => id.toLowerCase().includes(search.toLowerCase()))
    : items

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center p-6">
        <span className="text-xs text-muted-foreground">No results</span>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 p-2">
      {filtered.map((id) => (
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
  const [search, setSearch] = useState('')

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
        <div className="shrink-0 px-2 pt-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets…"
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {FOLDERS.map((f) => (
            <TabsContent key={f.id} value={f.id}>
              <PlaceholderGrid folder={f.id} search={search} />
            </TabsContent>
          ))}
        </ScrollArea>
      </Tabs>
    </div>
  )
}
