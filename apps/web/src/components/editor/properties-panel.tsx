import { Separator } from '#/components/ui/separator.tsx'
import { useTimeline, type ColorGrading, type AudioEffects } from './timeline-context.tsx'
import { ExpressionPanel } from './expression-panel.tsx'
import { KeyframeEditor } from './keyframe-editor.tsx'

function PropertyInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 rounded border border-border bg-background px-1.5 py-0.5 text-right text-[11px] text-foreground outline-none focus:border-primary/50"
      />
    </div>
  )
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] text-foreground">{value}</span>
    </div>
  )
}

function RangeSlider({ label, value, min, max, step, onChange, suffix }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1">
      <span className="w-16 shrink-0 text-[10px] text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 flex-1 cursor-pointer appearance-none rounded bg-muted accent-primary"
      />
      <span className="w-10 text-right text-[9px] text-foreground">{value}{suffix ?? ''}</span>
    </div>
  )
}

const FONT_FAMILIES = [
  'Inter', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman',
  'Courier New', 'Verdana', 'Impact', 'Comic Sans MS', 'Trebuchet MS',
]

const TEXT_ANIMATIONS = [
  { value: 'none', label: 'None' },
  { value: 'fade-in', label: 'Fade In' },
  { value: 'typewriter', label: 'Typewriter' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'slide-down', label: 'Slide Down' },
  { value: 'pop', label: 'Pop' },
] as const

export function PropertiesPanel() {
  const { clips, selectedClipId, updateClipProps, removeClip, rippleDelete, defaultClipDuration, setDefaultClipDuration } = useTimeline()
  const clip = clips.find((c) => c.id === selectedClipId)

  if (!clip) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-8 shrink-0 items-center border-b border-border px-3">
          <span className="text-[11px] font-medium text-muted-foreground">No Selection</span>
        </div>
        <div className="flex flex-col py-2">
          <div className="px-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Transform</span>
          </div>
          <PropertyRow label="X" value="0" />
          <PropertyRow label="Y" value="0" />
          <PropertyRow label="Width" value="1920" />
          <PropertyRow label="Height" value="1080" />
          <PropertyRow label="Rotation" value="0°" />
          <Separator className="my-2" />
          <div className="px-3 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Settings</span>
          </div>
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[11px] text-muted-foreground">Default clip (s)</span>
            <input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={defaultClipDuration}
              onChange={(e) => {
                const n = parseFloat(e.target.value)
                if (!isNaN(n) && n >= 1 && n <= 10) setDefaultClipDuration(n)
              }}
              className="w-16 rounded border border-border bg-background px-1.5 py-0.5 text-right text-[11px] text-foreground outline-none focus:border-primary/50"
            />
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-center py-6">
            <span className="text-[10px] text-muted-foreground/50">Select a clip to edit properties</span>
          </div>
        </div>
      </div>
    )
  }

  const setNum = (key: keyof typeof clip, val: string) => {
    const n = parseFloat(val)
    if (!isNaN(n)) updateClipProps(clip.id, { [key]: n })
  }

  const trackLabels = ['Background (BG)', 'Character (CHR)', 'Voiceover (VO)', 'Music (MUS)']

  const colorGrading: ColorGrading = clip.colorGrading ?? {
    brightness: 0, contrast: 0, saturation: 0, hue: 0,
    temperature: 0, highlights: 0, shadows: 0,
  }

  const updateGrading = (key: keyof ColorGrading, value: number) => {
    updateClipProps(clip.id, {
      colorGrading: { ...colorGrading, [key]: value },
    })
  }

  const resetGrading = () => {
    updateClipProps(clip.id, {
      colorGrading: { brightness: 0, contrast: 0, saturation: 0, hue: 0, temperature: 0, highlights: 0, shadows: 0 },
    })
  }

  const audioEffects: AudioEffects = clip.audioEffects ?? {
    volume: clip.volume ?? 1, fadeIn: 0, fadeOut: 0, speed: 1,
  }

  const updateAudioEffect = (key: keyof AudioEffects, value: number) => {
    updateClipProps(clip.id, {
      audioEffects: { ...audioEffects, [key]: value },
    })
  }

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="truncate text-[11px] font-medium text-foreground">{clip.name}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => rippleDelete(clip.id)} className="text-[10px] text-orange-400 hover:underline" title="Ripple Delete (removes clip and closes gap)">Ripple</button>
          <button onClick={() => removeClip(clip.id)} className="text-[10px] text-destructive hover:underline">Remove</button>
        </div>
      </div>
      <div className="flex flex-col py-2">
        <div className="px-3 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Clip Info</span>
        </div>
        <PropertyRow label="Type" value={clip.type} />
        <PropertyRow label="Track" value={trackLabels[clip.track] ?? `Track ${clip.track}`} />
        <PropertyInput label="Start (s)" value={String(clip.startTime)} onChange={(v) => setNum('startTime', v)} />
        <PropertyInput label="Duration (s)" value={String(clip.duration)} onChange={(v) => setNum('duration', v)} />
        {clip.type === 'audio' && (
          <PropertyInput label="Volume" value={String(clip.volume ?? 1)} onChange={(v) => {
            const n = parseFloat(v)
            if (!isNaN(n)) updateClipProps(clip.id, { volume: Math.max(0, Math.min(1, n)) })
          }} />
        )}

        {/* Speed control for video and audio */}
        {(clip.type === 'video' || clip.type === 'audio') && (
          <>
            <Separator className="my-2" />
            <div className="px-3 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Speed</span>
            </div>
            <RangeSlider
              label="Speed"
              value={clip.speed ?? 1}
              min={0.25}
              max={4}
              step={0.25}
              onChange={(v) => updateClipProps(clip.id, { speed: v })}
              suffix="x"
            />
          </>
        )}

        {(clip.type === 'image' || clip.type === 'video') && (
          <>
            <Separator className="my-2" />
            <div className="px-3 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Transform</span>
            </div>
            <PropertyInput label="X" value={String(clip.x)} onChange={(v) => setNum('x', v)} />
            <PropertyInput label="Y" value={String(clip.y)} onChange={(v) => setNum('y', v)} />
            <PropertyInput label="Width" value={String(Math.round(clip.width))} onChange={(v) => setNum('width', v)} />
            <PropertyInput label="Height" value={String(Math.round(clip.height))} onChange={(v) => setNum('height', v)} />
            <PropertyInput label="Rotation" value={String(clip.rotation)} onChange={(v) => setNum('rotation', v)} />
            <Separator className="my-2" />
            <div className="px-3 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Appearance</span>
            </div>
            <PropertyInput label="Opacity" value={String(clip.opacity)} onChange={(v) => setNum('opacity', v)} />
          </>
        )}

        {/* Text clip properties */}
        {clip.type === 'text' && (
          <>
            <Separator className="my-2" />
            <div className="px-3 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Text Content</span>
            </div>
            <div className="px-3 py-1">
              <textarea
                value={clip.text ?? ''}
                onChange={(e) => updateClipProps(clip.id, { text: e.target.value })}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary/50"
                rows={3}
              />
            </div>

            <RangeSlider
              label="Font Size"
              value={clip.fontSize ?? 64}
              min={12}
              max={200}
              step={1}
              onChange={(v) => updateClipProps(clip.id, { fontSize: v })}
              suffix="px"
            />

            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-[10px] text-muted-foreground">Font</span>
              <select
                value={clip.fontFamily ?? 'Inter'}
                onChange={(e) => updateClipProps(clip.id, { fontFamily: e.target.value })}
                className="w-28 rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground outline-none"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-[10px] text-muted-foreground">Color</span>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={clip.fontColor ?? '#ffffff'}
                  onChange={(e) => updateClipProps(clip.id, { fontColor: e.target.value })}
                  className="size-5 cursor-pointer rounded border border-border"
                />
                <input
                  type="text"
                  value={clip.fontColor ?? '#ffffff'}
                  onChange={(e) => updateClipProps(clip.id, { fontColor: e.target.value })}
                  className="w-16 rounded border border-border bg-background px-1 py-0.5 text-[9px] text-foreground outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-[10px] text-muted-foreground">Style</span>
              <div className="flex gap-1">
                <button
                  onClick={() => updateClipProps(clip.id, { bold: !clip.bold })}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold ${clip.bold ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  B
                </button>
                <button
                  onClick={() => updateClipProps(clip.id, { italic: !clip.italic })}
                  className={`rounded px-2 py-0.5 text-[10px] italic ${clip.italic ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  I
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-[10px] text-muted-foreground">Align</span>
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => updateClipProps(clip.id, { textAlign: a })}
                    className={`rounded px-2 py-0.5 text-[9px] ${clip.textAlign === a ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                  >
                    {a === 'left' ? '⫷' : a === 'center' ? '☰' : '⫸'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-[10px] text-muted-foreground">Animation</span>
              <select
                value={clip.textAnimation ?? 'none'}
                onChange={(e) => updateClipProps(clip.id, { textAnimation: e.target.value as typeof clip.textAnimation })}
                className="w-28 rounded border border-border bg-background px-1 py-0.5 text-[10px] text-foreground outline-none"
              >
                {TEXT_ANIMATIONS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>

            <Separator className="my-2" />
            <div className="px-3 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Transform</span>
            </div>
            <PropertyInput label="X" value={String(clip.x)} onChange={(v) => setNum('x', v)} />
            <PropertyInput label="Y" value={String(clip.y)} onChange={(v) => setNum('y', v)} />
            <PropertyInput label="Width" value={String(Math.round(clip.width))} onChange={(v) => setNum('width', v)} />
            <PropertyInput label="Opacity" value={String(clip.opacity)} onChange={(v) => setNum('opacity', v)} />
          </>
        )}

        {clip.type === 'caption' && (
          <>
            <Separator className="my-2" />
            <div className="px-3 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Caption Text</span>
            </div>
            <div className="px-3 py-1">
              <textarea
                value={clip.text ?? ''}
                onChange={(e) => updateClipProps(clip.id, { text: e.target.value })}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary/50"
                rows={3}
              />
            </div>
          </>
        )}

        {/* Color Grading for image and video clips */}
        {(clip.type === 'image' || clip.type === 'video') && (
          <>
            <Separator className="my-2" />
            <div className="flex items-center justify-between px-3 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Color Grading</span>
              <button onClick={resetGrading} className="text-[9px] text-muted-foreground hover:text-foreground hover:underline">Reset</button>
            </div>
            <RangeSlider label="Brightness" value={colorGrading.brightness} min={-100} max={100} onChange={(v) => updateGrading('brightness', v)} />
            <RangeSlider label="Contrast" value={colorGrading.contrast} min={-100} max={100} onChange={(v) => updateGrading('contrast', v)} />
            <RangeSlider label="Saturation" value={colorGrading.saturation} min={-100} max={100} onChange={(v) => updateGrading('saturation', v)} />
            <RangeSlider label="Hue" value={colorGrading.hue} min={-100} max={100} onChange={(v) => updateGrading('hue', v)} />
            <RangeSlider label="Temp" value={colorGrading.temperature} min={-100} max={100} onChange={(v) => updateGrading('temperature', v)} />
            <RangeSlider label="Highlights" value={colorGrading.highlights} min={-100} max={100} onChange={(v) => updateGrading('highlights', v)} />
            <RangeSlider label="Shadows" value={colorGrading.shadows} min={-100} max={100} onChange={(v) => updateGrading('shadows', v)} />
          </>
        )}

        {/* Audio Effects for audio clips */}
        {clip.type === 'audio' && (
          <>
            <Separator className="my-2" />
            <div className="px-3 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Audio Effects</span>
            </div>
            <RangeSlider
              label="Volume"
              value={Math.round(audioEffects.volume * 100)}
              min={0}
              max={200}
              step={1}
              onChange={(v) => updateAudioEffect('volume', v / 100)}
              suffix="%"
            />
            <RangeSlider
              label="Speed"
              value={audioEffects.speed}
              min={0.25}
              max={4}
              step={0.25}
              onChange={(v) => updateAudioEffect('speed', v)}
              suffix="x"
            />
            <RangeSlider
              label="Fade In"
              value={audioEffects.fadeIn}
              min={0}
              max={5}
              step={0.1}
              onChange={(v) => updateAudioEffect('fadeIn', v)}
              suffix="s"
            />
            <RangeSlider
              label="Fade Out"
              value={audioEffects.fadeOut}
              min={0}
              max={5}
              step={0.1}
              onChange={(v) => updateAudioEffect('fadeOut', v)}
              suffix="s"
            />
          </>
        )}

        {(clip.type === 'image' || clip.type === 'video') && (
          <>
            <Separator className="my-2" />
            <KeyframeEditor clip={clip} />
          </>
        )}

        {clip.type === 'image' && clip.track === 1 && (
          <>
            <Separator className="my-2" />
            <ExpressionPanel />
          </>
        )}
      </div>
    </div>
  )
}
