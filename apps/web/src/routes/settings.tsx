import { useState, useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { ScrollArea } from '#/components/ui/scroll-area.tsx'

export const Route = createFileRoute('/settings')({ component: Settings })

const API = 'http://localhost:3737'

interface KeysData {
  openrouter: string[]
  groq: string[]
  cloudflare: { accountId: string; tokens: string[] }
  fal: string[]
  stability: string[]
  youtube: string
}

interface ChannelProfile {
  channelName: string
  mainCharacterName: string
  contentStyle: string
  targetAudienceAge: string
  language: string
}

const EMPTY_KEYS: KeysData = {
  openrouter: ['', '', '', '', ''],
  groq: ['', '', '', '', ''],
  cloudflare: { accountId: '', tokens: ['', '', '', '', ''] },
  fal: ['', '', '', '', ''],
  stability: ['', '', '', '', ''],
  youtube: '',
}

const EMPTY_PROFILE: ChannelProfile = {
  channelName: '',
  mainCharacterName: '',
  contentStyle: 'Storytelling',
  targetAudienceAge: '',
  language: 'Portuguese',
}

function Settings() {
  const [tab, setTab] = useState<'keys' | 'profile' | 'brain' | 'about'>('keys')
  const [keys, setKeys] = useState<KeysData>(EMPTY_KEYS)
  const [keysSaved, setKeysSaved] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, 'ok' | 'fail' | 'testing'>>({})
  const [profile, setProfile] = useState<ChannelProfile>(EMPTY_PROFILE)
  const [profileSaved, setProfileSaved] = useState(false)
  const [brainEnabled, setBrainEnabled] = useState(false)
  const [brainTime, setBrainTime] = useState('02:00')
  const [brainRunning, setBrainRunning] = useState(false)

  useEffect(() => {
    fetch(`${API}/settings/keys`)
      .then((r) => r.ok ? r.json() as Promise<KeysData> : null)
      .then((d) => { if (d) setKeys(d) })
      .catch(() => {})

    fetch(`${API}/settings/profile`)
      .then((r) => r.ok ? r.json() as Promise<ChannelProfile> : null)
      .then((d) => { if (d) setProfile(d) })
      .catch(() => {})
  }, [])

  const saveKeys = async () => {
    setKeysSaved(false)
    const res = await fetch(`${API}/settings/keys`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(keys),
    })
    if (res.ok) setKeysSaved(true)
  }

  const testKey = async (provider: string, key: string, idx: number) => {
    const id = `${provider}-${idx}`
    setTestResults((r) => ({ ...r, [id]: 'testing' }))
    try {
      const res = await fetch(`${API}/settings/test-key?provider=${provider}&key=${encodeURIComponent(key)}`)
      const data = (await res.json()) as { ok: boolean }
      setTestResults((r) => ({ ...r, [id]: data.ok ? 'ok' : 'fail' }))
    } catch {
      setTestResults((r) => ({ ...r, [id]: 'fail' }))
    }
  }

  const saveProfile = async () => {
    setProfileSaved(false)
    const res = await fetch(`${API}/settings/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })
    if (res.ok) setProfileSaved(true)
  }

  const runBrainNow = async () => {
    setBrainRunning(true)
    try {
      await fetch(`${API}/brief/run`, { method: 'POST' })
    } catch {}
    setBrainRunning(false)
  }

  const tabs = [
    { id: 'keys' as const, label: 'API Keys' },
    { id: 'profile' as const, label: 'Channel Profile' },
    { id: 'brain' as const, label: 'Overnight Brain' },
    { id: 'about' as const, label: 'About' },
  ]

  const updateArr = (arr: string[], idx: number, val: string) => {
    const copy = [...arr]
    copy[idx] = val
    return copy
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-primary/30 px-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span className="text-xs">Back to Editor</span>
          </Link>
        </div>
        <span className="text-sm font-semibold text-foreground">Settings</span>
        <div className="w-20" />
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-[180px] shrink-0 flex-col border-r border-border bg-muted/20 p-3 gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${
                tab === t.id ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-3xl p-6">
            {tab === 'keys' && (
              <div className="space-y-8">
                <KeySection label="OpenRouter" keys={keys.openrouter} provider="openrouter"
                  onChange={(i, v) => setKeys({ ...keys, openrouter: updateArr(keys.openrouter, i, v) })}
                  testResults={testResults} onTest={testKey} />
                <KeySection label="Groq" keys={keys.groq} provider="groq"
                  onChange={(i, v) => setKeys({ ...keys, groq: updateArr(keys.groq, i, v) })}
                  testResults={testResults} onTest={testKey} />
                <div className="rounded-lg border border-border bg-muted/20 p-5">
                  <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-muted-foreground">Cloudflare</span>
                  <div className="mb-4">
                    <label className="mb-1 block text-[10px] font-semibold text-muted-foreground/70">Account ID</label>
                    <KeyInput idx={-1} value={keys.cloudflare.accountId} provider="cloudflare" label="Account"
                      onChange={(v) => setKeys({ ...keys, cloudflare: { ...keys.cloudflare, accountId: v } })}
                      onTest={() => {}} />
                  </div>
                  {keys.cloudflare.tokens.map((tok, i) => (
                    <KeyInput key={i} idx={i} value={tok} provider="cloudflare" label="Cloudflare"
                      onChange={(v) => setKeys({ ...keys, cloudflare: { ...keys.cloudflare, tokens: updateArr(keys.cloudflare.tokens, i, v) } })}
                      testStatus={testResults[`cloudflare-${i}`]}
                      onTest={() => testKey('cloudflare', tok, i)} />
                  ))}
                </div>
                <KeySection label="fal.ai" keys={keys.fal} provider="fal"
                  onChange={(i, v) => setKeys({ ...keys, fal: updateArr(keys.fal, i, v) })}
                  testResults={testResults} onTest={testKey} />
                <KeySection label="Stability AI" keys={keys.stability} provider="stability"
                  onChange={(i, v) => setKeys({ ...keys, stability: updateArr(keys.stability, i, v) })}
                  testResults={testResults} onTest={testKey} />
                <div className="rounded-lg border border-border bg-muted/20 p-5">
                  <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-muted-foreground">YouTube</span>
                  <div className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-right text-[10px] text-muted-foreground">Key</span>
                    <Input value={typeof keys.youtube === 'string' ? keys.youtube : ''} onChange={(e) => setKeys({ ...keys, youtube: e.target.value })}
                      className="font-mono text-xs" placeholder="YouTube API key" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={saveKeys}>Save All Keys</Button>
                  {keysSaved && <span className="text-xs text-green-400">Keys saved and reloaded</span>}
                </div>
              </div>
            )}

            {tab === 'profile' && (
              <div className="space-y-6">
                <div className="rounded-lg border border-border bg-muted/20 p-5 space-y-4">
                  <span className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">Channel Profile</span>
                  <Field label="Channel Name" value={profile.channelName}
                    onChange={(v) => setProfile({ ...profile, channelName: v })} placeholder="My YouTube Channel" />
                  <Field label="Main Character Name" value={profile.mainCharacterName}
                    onChange={(v) => setProfile({ ...profile, mainCharacterName: v })} placeholder="e.g. Leandro" />
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-muted-foreground/70">Content Style</label>
                    <select value={profile.contentStyle}
                      onChange={(e) => setProfile({ ...profile, contentStyle: e.target.value })}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50">
                      <option value="Comedy">Comedy</option>
                      <option value="Educational">Educational</option>
                      <option value="Storytelling">Storytelling</option>
                    </select>
                  </div>
                  <Field label="Target Audience Age" value={profile.targetAudienceAge}
                    onChange={(v) => setProfile({ ...profile, targetAudienceAge: v })} placeholder="e.g. 13-25" />
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-muted-foreground/70">Language</label>
                    <select value={profile.language}
                      onChange={(e) => setProfile({ ...profile, language: e.target.value })}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50">
                      <option value="Portuguese">Portuguese</option>
                      <option value="English">English</option>
                      <option value="Both">Both</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={saveProfile}>Save Profile</Button>
                  {profileSaved && <span className="text-xs text-green-400">Profile saved</span>}
                </div>
              </div>
            )}

            {tab === 'brain' && (
              <div className="space-y-6">
                <div className="rounded-lg border border-border bg-muted/20 p-5 space-y-5">
                  <span className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">Overnight Brain Schedule</span>
                  <div className="flex items-center gap-4">
                    <label className="text-sm text-foreground">Run daily at</label>
                    <Input type="time" value={brainTime} onChange={(e) => setBrainTime(e.target.value)}
                      className="w-32 font-mono text-sm" />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setBrainEnabled(!brainEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${brainEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    >
                      <span className={`inline-block size-4 rounded-full bg-white transition-transform ${brainEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className="text-sm text-foreground">{brainEnabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Windows Task Scheduler task: "YouStudio Overnight Brain". Change the time above and save to update the scheduled time.
                  </p>
                </div>
                <Button onClick={runBrainNow} disabled={brainRunning}>
                  {brainRunning ? 'Running...' : 'Run Overnight Brain Now'}
                </Button>
              </div>
            )}

            {tab === 'about' && (
              <div className="space-y-6">
                <div className="rounded-lg border border-border bg-muted/20 p-5 space-y-4">
                  <span className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">About YouStudio</span>
                  <div className="space-y-3 text-sm text-foreground">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Version</span>
                      <span className="font-mono">0.1.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data Folder</span>
                      <span className="font-mono text-xs">C:\YouStudio\</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Server</span>
                      <span className="font-mono text-xs">http://localhost:3737</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GitHub</span>
                      <span className="font-mono text-xs text-primary">github.com/lsmmvie-max/youstudio</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

function KeySection({ label, keys, provider, onChange, testResults, onTest }: {
  label: string
  keys: string[]
  provider: string
  onChange: (idx: number, val: string) => void
  testResults: Record<string, 'ok' | 'fail' | 'testing'>
  onTest: (provider: string, key: string, idx: number) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-5">
      <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      {keys.map((key, i) => (
        <KeyInput key={i} idx={i} value={key} provider={provider} label={label}
          onChange={(v) => onChange(i, v)} testStatus={testResults[`${provider}-${i}`]}
          onTest={() => onTest(provider, key, i)} />
      ))}
    </div>
  )
}

function KeyInput({ idx, value, label, onChange, testStatus, onTest }: {
  idx: number; value: string; provider?: string; label: string
  onChange: (v: string) => void; testStatus?: 'ok' | 'fail' | 'testing'; onTest: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [localVal, setLocalVal] = useState('')
  const isMasked = value.endsWith('...')

  const handleFocus = () => {
    setEditing(true)
    setLocalVal(isMasked ? '' : value)
  }
  const handleBlur = () => {
    setEditing(false)
    if (localVal) onChange(localVal)
  }

  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="w-12 shrink-0 text-right text-[10px] text-muted-foreground">Key {idx + 1}</span>
      <Input
        value={editing ? localVal : value}
        onChange={(e) => setLocalVal(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="font-mono text-xs"
        placeholder={editing ? `Paste new ${label} key` : `${label} API key`}
      />
      <TestButton status={testStatus} disabled={!value || isMasked} onClick={onTest} />
    </div>
  )
}

function TestButton({ status, disabled, onClick }: { status?: 'ok' | 'fail' | 'testing'; disabled: boolean; onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" className="h-8 w-14 shrink-0 text-[10px]" disabled={disabled || status === 'testing'} onClick={onClick}>
      {status === 'testing' ? '...' : status === 'ok' ? 'OK' : status === 'fail' ? 'FAIL' : 'Test'}
    </Button>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold text-muted-foreground/70">{label}</label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="text-sm" />
    </div>
  )
}
