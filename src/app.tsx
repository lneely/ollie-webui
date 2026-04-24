import { useState, useEffect, useCallback } from 'preact/hooks'
import { Sidebar } from './components/Sidebar'
import { ChatPane } from './components/ChatPane'
import { NewSession } from './components/NewSession'
import {
  listSessions,
  getSessionCfg,
  getChatLines,
  sendPrompt,
  sendCtl,
  createSession,
} from './lib/api'
import type { IdxEntry } from './lib/api'
import { parseChat } from './lib/chat'
import type { ChatMessage } from './lib/chat'

export function App() {
  const [sessions, setSessions]   = useState<IdxEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cfg, setCfg]             = useState<Record<string, string> | null>(null)
  const [messages, setMessages]   = useState<ChatMessage[]>([])
  const [showNew, setShowNew]     = useState(false)

  // Session list — poll every 5s.
  useEffect(() => {
    let alive = true
    const poll = () => listSessions().then(s => { if (alive) setSessions(s) }).catch(() => {})
    poll()
    const id = setInterval(poll, 5000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  // Active session — poll every 2s.
  useEffect(() => {
    if (!selectedId) { setCfg(null); setMessages([]); return }
    let alive = true

    const poll = async () => {
      try {
        const [c, lines] = await Promise.all([
          getSessionCfg(selectedId),
          getChatLines(selectedId),
        ])
        if (!alive) return
        setCfg(c)
        setMessages(parseChat(lines))
      } catch {
        // session may have been removed
      }
    }

    poll()
    const id = setInterval(poll, 2000)
    return () => { alive = false; clearInterval(id) }
  }, [selectedId])

  const handleSend = useCallback((text: string) => {
    if (!selectedId) return
    // fire-and-forget; the 9P write blocks until the turn completes server-side
    sendPrompt(selectedId, text).catch(() => {})
  }, [selectedId])

  const handleStop = useCallback(() => {
    if (!selectedId) return
    sendCtl(selectedId, 'stop').catch(() => {})
  }, [selectedId])

  const handleCreate = useCallback(async (params: {
    cwd: string; backend: string; model: string; agent: string
  }) => {
    await createSession(params)
    setShowNew(false)
    const s = await listSessions()
    setSessions(s)
    // Select the session most likely just created (last in list).
    if (s.length > 0) setSelectedId(s[s.length - 1].id)
  }, [])

  return (
    <div class="layout">
      <Sidebar
        sessions={sessions}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNew={() => setShowNew(true)}
      />
      <ChatPane
        session={sessions.find(s => s.id === selectedId) ?? null}
        cfg={cfg}
        messages={messages}
        onSend={handleSend}
        onStop={handleStop}
      />
      {showNew && (
        <NewSession onClose={() => setShowNew(false)} onCreate={handleCreate} />
      )}
    </div>
  )
}
