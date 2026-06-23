import { useState, useEffect, useRef } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '#/components/ui/tabs.tsx'
import { Button } from '#/components/ui/button.tsx'

const API = 'http://localhost:3737'

interface Asset {
  date: string
  filename: string
  url: string
  size: number
}

interface Character {
  name: string
  variants: { filename: string; url: string }[]
  variantCount: number
}

interface BgFile {
  filename: string
  url: string
}

const FOLDERS = [
  { id: 'assets', label: 'Assets' },
  { id: 'characters', label: 'Chars' },
  { id: 'backgrounds', label: 'BGs' },
] as const

type FolderTab = (typeof FOLDERS)[number]['id']

export function AssetPanel() {
  const [tab, setTab] = useState<FolderTab>('assets')
  const [search, setSearch] = useState('')
  const [assets, setAssets] = useState<Asset[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [backgrounds, setBackgrounds] = useState<BgFile[]>([])
  const assetInputRef = useRef<HTMLInputElement>(null)
  const charInputRef = useRef<HTMLInputElement>(null)
  const bgInputRef = useRef<HTMLInputElement>(null)

  const fetchAll = () => {
    fetch(`${API}/forge/assets`)
      .then((r) => r.json() as Promise<{ assets: Asset[] }>)
      .then((d) => setAssets(d.assets))
      .catch(() => {})
    fetch(`${API}/forge/characters`)
      .then((r) => r.json() as Promise<{ characters: Character[] }>)
      .then((d) => setCharacters(d.characters))
      .catch(() => {})
    fetch(`${API}/forge/backgrounds`)
      .then((r) => r.json() as Promise<{ backgrounds: BgFile[] }>)
      .then((d) => setBackgrounds(d.backgrounds))
      .catch(() => {})
  }

  useEffect(() => { fetchAll() }, [])

  const uploadFile = async (endpoint: string, file: File, extra?: Record<string, string>) => {
    const form = new FormData()
    form.append('image', file)
    if (extra) Object.entries(extra).forEach(([k, v]) => form.append(k, v))
    await fetch(`${API}/forge/${endpoint}`, { method: 'POST', body: form })
    fetchAll()
  }

  const filteredAssets = search
    ? assets.filter((a) => a.filename.toLowerCase().includes(search.toLowerCase()))
    : assets
  const filteredChars = search
    ? characters.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : characters
  const filteredBgs = search
    ? backgrounds.filter((b) => b.filename.toLowerCase().includes(search.toLowerCase()))
    : backgrounds

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
        <div className="min-h-0 flex-1 overflow-y-auto">
          {FOLDERS.map((f) => (
            <TabsContent key={f.id} value={f.id}>
              {f.id === 'assets' && <AssetsGrid assets={filteredAssets} />}
              {f.id === 'characters' && <CharsGrid characters={filteredChars} />}
              {f.id === 'backgrounds' && <BgsGrid backgrounds={filteredBgs} />}
            </TabsContent>
          ))}
        </div>
        <div className="shrink-0 border-t border-border p-2">
          <input ref={assetInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile('upload-asset', f); e.target.value = '' }} />
          <input ref={charInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const name = window.prompt('Character name:') || 'uploaded'; uploadFile('upload-character', f, { name }) } e.target.value = '' }} />
          <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile('upload-background', f); e.target.value = '' }} />
          {tab === 'assets' && <Button size="sm" variant="outline" className="w-full text-[10px]" onClick={() => assetInputRef.current?.click()}>Upload Asset</Button>}
          {tab === 'characters' && <Button size="sm" variant="outline" className="w-full text-[10px]" onClick={() => charInputRef.current?.click()}>Upload Character</Button>}
          {tab === 'backgrounds' && <Button size="sm" variant="outline" className="w-full text-[10px]" onClick={() => bgInputRef.current?.click()}>Upload Background</Button>}
        </div>
      </Tabs>
    </div>
  )
}

function AssetsGrid({ assets }: { assets: Asset[] }) {
  if (assets.length === 0) {
    return (
      <div className="flex items-center justify-center p-6">
        <span className="text-xs text-muted-foreground">No assets generated yet</span>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2 p-2">
      {assets.map((a) => (
        <div
          key={`${a.date}-${a.filename}`}
          className="group cursor-pointer overflow-hidden rounded-md border border-border bg-muted/50 transition-colors hover:border-primary/50"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', `${API}${a.url}`)
          }}
        >
          <img src={`${API}${a.url}`} alt={a.filename} className="aspect-video w-full object-cover" loading="lazy" />
          <div className="px-1.5 py-1">
            <span className="block truncate text-[9px] text-muted-foreground group-hover:text-foreground">{a.filename}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function CharsGrid({ characters }: { characters: Character[] }) {
  if (characters.length === 0) {
    return (
      <div className="flex items-center justify-center p-6">
        <span className="text-xs text-muted-foreground">No characters yet</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2 p-2">
      {characters.map((c) => (
        <div key={c.name} className="rounded-md border border-border bg-muted/50 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="truncate text-[10px] font-medium text-foreground">{c.name}</span>
            <span className="text-[9px] text-muted-foreground">{c.variantCount}</span>
          </div>
          {c.variants.length > 0 && (
            <div className="flex gap-1 overflow-x-auto">
              {c.variants.slice(0, 3).map((v) => (
                <img key={v.filename} src={`${API}${v.url}`} alt={v.filename} className="size-10 shrink-0 rounded border border-border object-cover" loading="lazy" />
              ))}
              {c.variants.length > 3 && (
                <div className="flex size-10 shrink-0 items-center justify-center rounded border border-border bg-muted text-[9px] text-muted-foreground">
                  +{c.variants.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function BgsGrid({ backgrounds }: { backgrounds: BgFile[] }) {
  if (backgrounds.length === 0) {
    return (
      <div className="flex items-center justify-center p-6">
        <span className="text-xs text-muted-foreground">No backgrounds yet</span>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2 p-2">
      {backgrounds.map((b) => (
        <div
          key={b.filename}
          className="group cursor-pointer overflow-hidden rounded-md border border-border bg-muted/50 transition-colors hover:border-primary/50"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', `${API}${b.url}`)
          }}
        >
          <img src={`${API}${b.url}`} alt={b.filename} className="aspect-video w-full object-cover" loading="lazy" />
          <div className="px-1.5 py-1">
            <span className="block truncate text-[9px] text-muted-foreground group-hover:text-foreground">{b.filename}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
