export interface IdxEntry {
  id: string
  state: string
  cwd: string
  backend: string
  model: string
}

export async function listSessions(): Promise<IdxEntry[]> {
  const r = await fetch('/s/idx')
  if (!r.ok) return []
  const data = await r.json()
  return Array.isArray(data) ? (data as IdxEntry[]) : []
}

export async function getSessionCfg(id: string): Promise<Record<string, string>> {
  const r = await fetch(`/s/${id}/cfg`)
  if (!r.ok) throw new Error(`cfg ${r.status}`)
  const data = await r.json()
  return (data && typeof data === 'object' && !Array.isArray(data))
    ? (data as Record<string, string>)
    : {}
}

// The gateway returns chat as plain text (one line per key=value pair).
export async function getChatLines(id: string): Promise<string[]> {
  const r = await fetch(`/s/${id}/chat`)
  if (!r.ok) return []
  const text = await r.text()
  if (!text.trim()) return []
  return text.trimEnd().split('\n')
}

export async function sendPrompt(id: string, prompt: string): Promise<void> {
  await fetch(`/s/${id}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
}

export async function sendCtl(id: string, ctl: string): Promise<void> {
  await fetch(`/s/${id}/ctl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ctl }),
  })
}

export async function createSession(params: {
  cwd: string
  backend: string
  model: string
  agent: string
}): Promise<void> {
  await fetch('/s/new', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

export async function getBackends(): Promise<string[]> {
  const r = await fetch('/backends')
  if (!r.ok) return []
  const data = await r.json()
  return Array.isArray(data) ? (data as string[]) : []
}

export async function killSession(id: string): Promise<void> {
  await fetch(`/s/${id}`, { method: 'DELETE' })
}

export async function browse9p(path: string): Promise<any> {
  const r = await fetch(path)
  if (!r.ok) return null
  const ct = r.headers.get('content-type') ?? ''
  if (ct.includes('text/plain')) return await r.text()
  return await r.json()
}

export async function renameSession(id: string, newName: string): Promise<void> {
  await fetch(`/s/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  })
}
