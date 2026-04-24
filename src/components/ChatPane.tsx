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
}

function stateClass(state: string) {
  if (state === 'idle') return 'idle'
  if (state === 'stopped') return 'stopped'
  return 'running'
}

export function ChatPane({ session, cfg, messages, onSend, onStop }: Props) {
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
        <Welcome />
      </main>
    )
  }

  const sid = shortId(session.id)
  const state = cfg.state ?? 'stopped'

  return (
    <main class="main">
      <header class="chat-header">
        <div class="chat-path">
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
                <div class="user-text">{msg.content}</div>
              ) : msg.role === 'tool' ? (
                <ToolCall content={msg.content} />
              ) : (
                <div
                  class="md"
                  dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) as string }}
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
    return { name: m[1], body: JSON.stringify(obj, null, 2) }
  } catch {
    return { name: m[1], body: m[2] }
  }
}

function ToolCall({ content }: { content: string }) {
  const { name, body } = formatToolContent(content)
  return (
    <div class="tool-call">
      <span class="tool-arrow">→</span>{' '}
      {name && <span class="tool-name">{name}</span>}
      <pre class="tool-body">{body}</pre>
    </div>
  )
}

function Welcome() {
  const tree: [string, string][] = [
    ['/s/', 'sessions'],
    ['/m/', 'memory'],
    ['/t/', 'tools'],
    ['/a/', 'agents'],
    ['/sk/', 'skills'],
  ]

  return (
    <div class="welcome">
      <div class="welcome-wordmark">ollie</div>
      <div class="welcome-mount">~/mnt/ollie</div>
      <div class="welcome-tree">
        <div class="welcome-tree-title">9p filesystem</div>
        {tree.map(([path, desc]) => (
          <div class="tree-row" key={path}>
            <span class="tree-path">{path}</span>
            <span class="tree-sep">·</span>
            <span class="tree-desc">{desc}</span>
          </div>
        ))}
      </div>
      <div class="welcome-hint">select a session or create one</div>
    </div>
  )
}
