import { useEffect, useRef, useState } from 'preact/hooks'
import { marked } from 'marked'
import type { IdxEntry } from '../lib/api'
import type { ChatMessage } from '../lib/chat'
import { shortId, truncate } from '../lib/chat'
import { PromptBar } from './PromptBar'

marked.use({ gfm: true, breaks: false })

interface Props {
  session: IdxEntry | null
  cfg: Record<string, string> | null
  messages: ChatMessage[]
  onSend: (text: string) => void
  onStop: () => void
  browsePath: string | null
  browseData: any
  onBrowse: (path: string) => void
  onSelectSession: (id: string) => void
}

function stateClass(state: string) {
  if (state === 'idle') return 'idle'
  if (state === 'stopped') return 'stopped'
  return 'running'
}

export function ChatPane({ session, cfg, messages, onSend, onStop, browsePath, browseData, onBrowse, onSelectSession }: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)

  const isRunning = !!cfg?.state && cfg.state !== 'idle' && cfg.state !== 'stopped'

  useEffect(() => {
    if (atBottom && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length, isRunning, atBottom])

  const handleScroll = () => {
    const el = listRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }

  if (!session || !cfg) {
    return (
      <main class="main">
        {browsePath && browsePath !== '/mnt/' ? (
          <FsBrowser path={browsePath} data={browseData} onNavigate={onBrowse} onSelectSession={onSelectSession} />
        ) : (
          <Welcome onBrowse={onBrowse} />
        )}
      </main>
    )
  }

  const sid = shortId(session.id)
  const state = cfg.state ?? 'stopped'

  return (
    <main class="main">
      <header class="chat-header">
        <div class="chat-path">
          <span class="fs-path-link" onClick={() => onBrowse('/mnt/s/')}>↑</span>{' '}
          /s/<span class="path-hi">{sid}</span>/chat
        </div>
        <div class="header-meta">
          <div class={`state-dot ${stateClass(state)}`} style="margin-right: 2px;" />
          <span class="badge accent">{cfg.backend ?? session.backend}</span>
          <span class="badge">{truncate(cfg.model ?? session.model, 24)}</span>
          {cfg.agent && cfg.agent !== 'default' && (
            <span class="badge warn">{cfg.agent}</span>
          )}
        </div>
      </header>

      <div class="message-list" ref={listRef} onScroll={handleScroll}>
        {messages.length === 0 && !isRunning && (
          <div class="message-empty">/s/{sid}/chat</div>
        )}

        {messages.map((msg, i) => (
          <div key={i} class={`message ${msg.role}`}>
            <div class="msg-bubble">
              {msg.role === 'user' ? (
                <div class="user-text"><span class="msg-prefix">u: </span>{msg.content}</div>
              ) : msg.role === 'tool' ? (
                <ToolCall content={msg.content} />
              ) : (
                <div
                  class="md"
                  dangerouslySetInnerHTML={{ __html: (marked.parse(msg.content) as string).replace(/^<p>/, '<p><span class="msg-prefix">a: </span>') }}
                />
              )}
            </div>
          </div>
        ))}

        {isRunning && (
          <div class="typing">
            <div class="typing-dot" />
            <div class="typing-dot" />
            <div class="typing-dot" />
          </div>
        )}
      </div>

      <PromptBar running={isRunning} onSend={onSend} onStop={onStop} />
    </main>
  )
}

function formatToolContent(raw: string): { name: string; body: string } {
  const m = raw.match(/^(\w+)\(([\s\S]*)\)\s*$/)
  if (!m) return { name: '', body: raw }
  try {
    const obj = JSON.parse(m[2])
    // For execute_code, extract just the code/tool from steps
    if (m[1] === 'execute_code' && obj.steps) {
      const lines = obj.steps.map((s: any) => s.code ?? s.tool ?? JSON.stringify(s)).join('\n')
      return { name: m[1], body: lines }
    }
    return { name: m[1], body: JSON.stringify(obj, null, 2) }
  } catch {
    return { name: m[1], body: m[2] }
  }
}

function ToolCall({ content }: { content: string }) {
  const { name, body } = formatToolContent(content)
  return (
    <div class="tool-call">
      <div class="tool-header">
        <span class="tool-arrow">🖥️</span>
        {name && <span class="tool-name">{name}</span>}
      </div>
      <pre class="tool-body">{body}</pre>
    </div>
  )
}

function Welcome({ onBrowse }: { onBrowse: (path: string) => void }) {
  const tree: [string, string][] = [
    ['/mnt/s/', 'sessions'],
    ['/mnt/m/', 'memory'],
    ['/mnt/t/', 'tools'],
    ['/mnt/a/', 'agents'],
    ['/mnt/sk/', 'skills'],
  ]

  return (
    <div class="welcome">
      <div class="welcome-wordmark">ollie</div>
      <div class="welcome-mount">~/mnt/ollie</div>
      <div class="welcome-tree">
        <div class="welcome-tree-title">9p filesystem</div>
        {tree.map(([path, desc]) => (
          <div class="tree-row tree-row-link" key={path} onClick={() => onBrowse(path)}>
            <span class="tree-path">{path.replace('/mnt', '')}</span>
            <span class="tree-sep">·</span>
            <span class="tree-desc">{desc}</span>
          </div>
        ))}
      </div>
      <div class="welcome-hint">select a session or browse the filesystem</div>
    </div>
  )
}

function FsBrowser({ path, data, onNavigate, onSelectSession }: { path: string; data: any; onNavigate: (p: string) => void; onSelectSession: (id: string) => void }) {
  const parent = path === '/mnt/' ? null : path.replace(/[^/]+\/?$/, '') || '/mnt/'
  const displayPath = path.startsWith('/mnt') ? path.slice(4) : path
  const isSessionDir = path === '/mnt/s/'

  // For /s/, filter to directories only and clicking selects the session
  const filteredData = isSessionDir && Array.isArray(data)
    ? data.filter((e: any) => e.is_dir)
    : data
  return (
    <div class="fs-browser">
      <div class="fs-path">
        {parent && <span class="fs-path-link" onClick={() => onNavigate(parent)}>↑</span>}
        {parent && ' '}{displayPath}
      </div>
      <div class="fs-content">
        {filteredData === null ? (
          <div class="fs-empty">loading…</div>
        ) : Array.isArray(filteredData) && filteredData.length > 0 && typeof filteredData[0] === 'object' ? (
          filteredData.map((entry: any) => (
            <div
              key={entry.name}
              class={`fs-entry${entry.is_dir ? ' fs-dir' : ''}`}
              onClick={() => isSessionDir && entry.is_dir
                ? onSelectSession(entry.name)
                : entry.is_dir ? onNavigate(path + entry.name + '/') : onNavigate(path + entry.name)}
            >
              <span class="fs-entry-name">{entry.name}{entry.is_dir ? '/' : ''}</span>
              {entry.size > 0 && <span class="fs-entry-size">{entry.size}</span>}
            </div>
          ))
        ) : Array.isArray(filteredData) ? (
          <pre class="fs-file">{filteredData.join('\n')}</pre>
        ) : typeof filteredData === 'object' ? (
          <pre class="fs-file">{Object.entries(filteredData).map(([k, v]) => `${k}=${v}`).join('\n')}</pre>
        ) : (
          <pre class="fs-file">{String(filteredData)}</pre>
        )}
      </div>
    </div>
  )
}
