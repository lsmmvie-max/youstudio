import { useState, useEffect, useCallback } from 'react'
import { useTimeline } from './timeline-context.tsx'

const API = 'http://localhost:3737'

interface CharacterVariant {
  filename: string
  url: string
}

interface Character {
  name: string
  variants: CharacterVariant[]
}

export function ExpressionPanel() {
  const { clips, selectedClipId, updateClipProps } = useTimeline()
  const [characters, setCharacters] = useState<Character[]>([])

  const selectedClip = clips.find((c) => c.id === selectedClipId)
  const isCharacterClip = selectedClip?.type === 'image' && selectedClip.track === 1

  useEffect(() => {
    fetch(`${API}/forge/characters`)
      .then((r) => r.json() as Promise<{ characters: Character[] }>)
      .then((d) => setCharacters(d.characters))
      .catch(() => {})
  }, [])

  const matchedChar = isCharacterClip
    ? characters.find((c) => {
        if (selectedClip.characterName) return c.name === selectedClip.characterName
        return selectedClip.src.includes(`/character-image/${c.name}/`)
      })
    : null

  const cycleExpression = useCallback((clipId: string) => {
    const clip = clips.find((c) => c.id === clipId)
    if (!clip || !matchedChar || matchedChar.variants.length < 2) return
    const currentIdx = matchedChar.variants.findIndex((v) => clip.src.includes(v.filename))
    const nextIdx = (currentIdx + 1) % matchedChar.variants.length
    const next = matchedChar.variants[nextIdx]
    updateClipProps(clipId, {
      src: `${API}${next.url}`,
      name: next.filename,
      characterName: matchedChar.name,
    })
  }, [clips, matchedChar, updateClipProps])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { clipId: string }
      if (detail.clipId) cycleExpression(detail.clipId)
    }
    window.addEventListener('youstudio:cycle-expression', handler)
    return () => window.removeEventListener('youstudio:cycle-expression', handler)
  }, [cycleExpression])

  if (!isCharacterClip) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-[10px] text-muted-foreground/50">Select a character clip (Track CHR) to swap expressions</p>
      </div>
    )
  }

  if (!matchedChar) {
    return (
      <div className="px-3 py-4">
        <p className="mb-2 text-[10px] text-muted-foreground">No character match found.</p>
        <div className="flex flex-col gap-1">
          {characters.map((c) => (
            <button
              key={c.name}
              onClick={() => updateClipProps(selectedClip.id, { characterName: c.name })}
              className="rounded border border-border px-2 py-1 text-left text-[10px] text-foreground hover:bg-muted"
            >
              Link to: {c.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Expressions — {matchedChar.name}
        </span>
        <span className="text-[9px] text-muted-foreground">{matchedChar.variants.length} variants</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {matchedChar.variants.map((v) => {
          const isCurrent = selectedClip.src.includes(v.filename)
          return (
            <button
              key={v.filename}
              onClick={() => {
                updateClipProps(selectedClip.id, {
                  src: `${API}${v.url}`,
                  name: v.filename,
                  characterName: matchedChar.name,
                })
              }}
              className={`overflow-hidden rounded-md border-2 transition-colors ${
                isCurrent ? 'border-[#7C3AED]' : 'border-border hover:border-primary/50'
              }`}
            >
              <img
                src={`${API}${v.url}`}
                alt={v.filename}
                className="size-14 object-cover"
                loading="lazy"
              />
              <div className="px-1 py-0.5">
                <span className="block truncate text-[8px] text-muted-foreground">{v.filename.replace(/\.(png|jpg|jpeg|webp)$/i, '')}</span>
              </div>
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-[9px] text-muted-foreground/50">Press E to cycle expressions</p>
    </div>
  )
}
