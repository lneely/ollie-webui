import { useEffect, useRef, useState } from 'preact/hooks'
import { marked } from 'marked'

import mermaid from 'mermaid'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import plantumlEncoder from 'plantuml-encoder'
import type { IdxEntry } from '../lib/api'
import { write9p, browse9p } from '../lib/api'
import type { ChatMessage } from '../lib/chat'
import { shortId, truncate } from '../lib/chat'
import { PromptBar } from './PromptBar'

mermaid.initialize({ startOnLoad: false, theme: 'dark' })

function diagramWrap(label: string, rendered: string, source: string): string {
  return `<div class="diagram-wrap">` +
    `<button class="diagram-toggle" type="button" data-label="${label}">${label}</button>` +
    rendered +
    `<pre class="diagram-source">${escapeHtml(source)}</pre>` +
    `</div>`
}

const renderer = {
  code(code: string, lang: string | undefined): string {
    const l = (lang ?? '').toLowerCase()
    if (l === 'mermaid') {
      return diagramWrap('mermaid', `<div class="diagram-mermaid">${escapeHtml(code)}</div>`, code)
    }
    if (l === 'math' || l === 'latex' || l === 'tex') {
      let rendered: string
      try {
        rendered = `<div class="diagram-math">${katex.renderToString(code, { displayMode: true, throwOnError: false })}</div>`
      } catch {
        rendered = `<pre class="diagram-error">${escapeHtml(code)}</pre>`
      }
      return diagramWrap('math', rendered, code)
    }
    if (l === 'plantuml') {
      const encoded = plantumlEncoder.encode(code)
      return diagramWrap('plantuml',
        `<div class="diagram-plantuml"><img src="https://www.plantuml.com/plantuml/svg/${encoded}" alt="PlantUML diagram" loading="lazy" /></div>`,
        code)
    }
    return `<pre><code class="language-${escapeHtml(lang ?? '')}">${escapeHtml(code)}</code></pre>`
  },
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function linkifyPaths(html: string, cwd: string): string {
  return html.replace(/<code>([^<]+)<\/code>/g, (_match, inner: string) => {
    // Match: has a file extension, or contains a /
    if (!/\.\w+/.test(inner) && !inner.includes('/')) return _match
    // Exclude things that are clearly not paths (spaces, parens, etc.)
    if (/[\s(){}[\]|;]/.test(inner)) return _match
    const filePart = inner.split(':')[0]
    const href = filePart.startsWith('/') ? `file://${filePart}` : `file://${cwd}/${filePart}`
    const fullPath = filePart.startsWith('/') ? filePart : cwd + '/' + filePart
    return `<code><a class="file-link" href="#" data-fpath="${escapeHtml(fullPath)}">${inner}</a></code>`
  })
}

marked.use({ gfm: true, breaks: false, renderer })

// Display math: $$...$$ as a block or inline paragraph
marked.use({
  extensions: [
    {
      name: 'displayMath',
      level: 'block',
      start(src: string) { return src.indexOf('$$') },
      tokenizer(src: string) {
        const m = src.match(/^\$\$([\s\S]+?)\$\$/)
        if (m) return { type: 'displayMath', raw: m[0], text: m[1].trim() }
      },
      renderer(token: any) {
        const rendered = `<div class="diagram-math">${katex.renderToString(token.text, { displayMode: true, throwOnError: false })}</div>`
        return diagramWrap('math', rendered, token.text)
      },
    },
    {
      name: 'inlineMath',
      level: 'inline',
      start(src: string) { return src.indexOf('$') },
      tokenizer(src: string) {
        const m = src.match(/^\$([^$\n]+?)\$/)
        if (m) return { type: 'inlineMath', raw: m[0], text: m[1] }
      },
      renderer(token: any) {
        return katex.renderToString(token.text, { displayMode: false, throwOnError: false })
      },
    },
  ],
})

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
  onRename: (id: string, newName: string) => void
}

function stateClass(state: string) {
  if (state === 'idle') return 'idle'
  if (state === 'stopped') return 'stopped'
  return 'running'
}

export function ChatPane({ session, cfg, messages, onSend, onStop, browsePath, browseData, onBrowse, onSelectSession, onRename }: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)

  const isRunning = !!cfg?.state && cfg.state !== 'idle' && cfg.state !== 'stopped'

  useEffect(() => {
    if (atBottom && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length, isRunning, atBottom])

  useEffect(() => {
    if (!listRef.current) return
    const nodes = Array.from(listRef.current.querySelectorAll<HTMLElement>('.diagram-mermaid:not([data-processed])'))
    if (nodes.length === 0) return
    mermaid.run({ nodes }).catch(() => {})
  }, [messages.length])

  const handleScroll = () => {
    const el = listRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }

  const [modalHtml, setModalHtml] = useState<string | null>(null)

  const handleDiagramClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement

    // File path links — open in editor
    const link = target.closest('.file-link') as HTMLElement | null
    if (link) {
      e.preventDefault()
      e.stopPropagation()
      const fp = link.getAttribute('data-fpath')
      if (fp) fetch('/open?path=' + encodeURIComponent(fp))
      return
    }

    // Toggle button: switch between rendered and source
    const btn = target.closest('.diagram-toggle') as HTMLElement | null
    if (btn) {
      const wrap = btn.closest('.diagram-wrap') as HTMLElement | null
      if (!wrap) return
      const isSource = wrap.classList.toggle('show-source')
      btn.textContent = isSource ? 'render' : btn.dataset.label ?? ''
      if (!isSource) {
        const node = wrap.querySelector<HTMLElement>('.diagram-mermaid:not([data-processed])')
        if (node) mermaid.run({ nodes: [node] }).catch(() => {})
      }
      return
    }

    // Click on rendered diagram content → open zoom modal
    const wrap = target.closest('.diagram-wrap') as HTMLElement | null
    if (!wrap || wrap.classList.contains('show-source')) return
    const rendered = wrap.querySelector<HTMLElement>('.diagram-mermaid, .diagram-plantuml, .diagram-math')
    if (rendered) setModalHtml(rendered.outerHTML)
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

  const sid = session.id
  const state = cfg.state ?? 'stopped'
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState('')

  const startRename = () => { setRenaming(true); setRenameVal(sid) }
  const commitRename = () => {
    setRenaming(false)
    const name = renameVal.trim()
    if (name && name !== sid) onRename(sid, name)
  }

  return (
    <main class="main">
      <header class="chat-header">
        <div class="chat-path">
          <span class="fs-path-link" onClick={() => onBrowse('/mnt/s/')}>↑</span>{' '}
          /s/{renaming ? (
            <input
              class="session-rename-input"
              value={renameVal}
              onInput={e => setRenameVal((e.target as HTMLInputElement).value)}
              onBlur={() => commitRename()}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false) }}
              autoFocus
            />
          ) : (
            <span class="path-hi" onDblClick={startRename}>{sid}</span>
          )}/chat
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

      {modalHtml && <DiagramModal html={modalHtml} onClose={() => setModalHtml(null)} />}

      <div class="message-list" ref={listRef} onScroll={handleScroll} onClick={handleDiagramClick as any}>
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
              ) : msg.role === 'info' ? (
                <div class="info-text">{msg.content}</div>
              ) : (
                <div
                  class="md"
                  dangerouslySetInnerHTML={{ __html: linkifyPaths((marked.parse(msg.content) as string).replace(/^<p>/, '<p><span class="msg-prefix">a: </span>'), session.cwd) }}
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

function DiagramModal({ html, onClose }: { html: string; onClose: () => void }) {
  // Transform state kept in a ref so wheel handler never captures stale values
  const xf = useRef({ scale: 1, ox: 0, oy: 0 })
  const [, rerender] = useState(0)
  const bump = () => rerender(n => n + 1)

  const dragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // Non-passive wheel for zoom-to-cursor
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      // cursor position relative to canvas center (where content is naturally anchored)
      const dx = (e.clientX - rect.left) - rect.width / 2
      const dy = (e.clientY - rect.top) - rect.height / 2
      const { scale: s, ox, oy } = xf.current
      const ns = Math.max(0.05, Math.min(20, s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
      const r = ns / s
      xf.current = { scale: ns, ox: dx - (dx - ox) * r, oy: dy - (dy - oy) * r }
      bump()
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const onMouseDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    dragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: xf.current.ox, oy: xf.current.oy }
    e.preventDefault()
  }
  const onMouseMove = (e: MouseEvent) => {
    if (!dragging.current) return
    xf.current = { ...xf.current, ox: dragStart.current.ox + e.clientX - dragStart.current.mx, oy: dragStart.current.oy + e.clientY - dragStart.current.my }
    bump()
  }
  const onMouseUp = () => { dragging.current = false }

  const { scale, ox, oy } = xf.current

  return (
    <div class="diagram-modal-overlay" onClick={onClose}>
      <div class="diagram-modal-toolbar" onClick={e => e.stopPropagation()}>
        <button class="dmt-btn" onClick={() => { xf.current = { ...xf.current, scale: Math.min(20, xf.current.scale * 1.25) }; bump() }}>+</button>
        <button class="dmt-btn" onClick={() => { xf.current = { scale: 1, ox: 0, oy: 0 }; bump() }}>reset</button>
        <button class="dmt-btn" onClick={() => { xf.current = { ...xf.current, scale: Math.max(0.05, xf.current.scale / 1.25) }; bump() }}>−</button>
        <button class="dmt-btn dmt-close" onClick={onClose}>✕</button>
      </div>
      <div
        class="diagram-modal-canvas"
        ref={canvasRef}
        onMouseDown={onMouseDown as any}
        onMouseMove={onMouseMove as any}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={e => e.stopPropagation()}
      >
        <div
          class="diagram-modal-content"
          style={{ transform: `translate(${ox}px, ${oy}px) scale(${scale})` }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}

function formatToolContent(raw: string): { name: string; detail: string; body: string; output: string } {
  // Call is always on the first line; output follows after the newline.
  const nl = raw.indexOf('\n')
  const callLine = nl === -1 ? raw : raw.slice(0, nl)
  const output = nl === -1 ? '' : raw.slice(nl + 1).trimEnd()
  const m = callLine.match(/^(\w+)\((.*)\)$/)
  if (!m) return { name: '', detail: '', body: raw, output: '' }
  const name = m[1]
  const argsRaw = m[2]
  try {
    const obj = JSON.parse(argsRaw)
    let detail = ''
    if (obj.steps?.[0]?.tool) detail = obj.steps[0].tool
    else if (obj.steps?.[0]?.code) detail = obj.language ?? 'bash'
    return { name, detail, body: JSON.stringify(obj, null, 2), output }
  } catch {
    return { name, detail: '', body: argsRaw, output }
  }
}

const TOOL_ICONS: Record<string, string> = {
  reasoning_think: '💭',
  file_edit: '📝',
  file_write: '📝',
  file_read: '📄',
  file_glob: '📂',
  file_grep: '🔍',
  memory_recall: '🧠',
  memory_remember: '🧠',
  browser_screencap: '📸',
  denote_view: '📓',
  subagent_spawn: '🧵',
  task_add: '☑️',
  task_check: '☑️',
  task_clear: '☑️',
  bash: '🖥️',
}

function toolIcon(detail: string): string {
  return TOOL_ICONS[detail] ?? '🖥️'
}

function ToolCall({ content }: { content: string }) {
  const { name, detail, body, output } = formatToolContent(content)
  const [open, setOpen] = useState(false)
  return (
    <div class="tool-call">
      <details open={open} onToggle={(e: Event) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary class="tool-header">
          <span class="tool-arrow">{toolIcon(detail)}</span>
          {name && <span class="tool-name">{name}</span>}
          {detail && <span class="tool-detail">{detail}</span>}
        </summary>
        <pre class="tool-body">{body}</pre>
      </details>
      {output && <pre class="tool-output">{output}</pre>}
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
  const isDir = Array.isArray(data) && data.length > 0 && typeof data[0] === 'object'
  const apiPath = path.startsWith('/mnt/') ? '/' + path.slice(5) : path

  const fileContent = data === null || isDir ? null
    : Array.isArray(data) ? data.join('\n')
    : typeof data === 'object' ? Object.entries(data).map(([k, v]) => `${k}=${v}`).join('\n')
    : String(data)

  const [draft, setDraft] = useState(fileContent ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (fileContent !== null) setDraft(fileContent) }, [fileContent])

  const filteredData = isSessionDir && Array.isArray(data)
    ? data.filter((e: any) => e.is_dir)
    : data

  const handleSave = async () => {
    setSaving(true)
    await write9p(apiPath, draft)
    setSaving(false)
  }

  const handleReload = async () => {
    const fresh = await browse9p(apiPath)
    const text = fresh === null ? ''
      : Array.isArray(fresh) ? fresh.join('\n')
      : typeof fresh === 'object' ? Object.entries(fresh).map(([k, v]) => `${k}=${v}`).join('\n')
      : String(fresh)
    setDraft(text)
  }

  return (
    <div class="fs-browser">
      <div class="fs-path">
        {parent && <span class="fs-path-link" onClick={() => onNavigate(parent)}>..</span>}
        {parent && ' '}{displayPath}
        {fileContent !== null && <span class="fs-path-link" onClick={handleSave}>{saving ? '…' : 'Put'}</span>}
        {fileContent !== null && <span class="fs-path-link" onClick={handleReload}>Get</span>}
      </div>
      <div class="fs-content">
        {filteredData === null ? (
          <div class="fs-empty">loading…</div>
        ) : isDir ? (
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
        ) : (
          <textarea class="fs-editor" value={draft} onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)} />
        )}
      </div>
    </div>
  )
}
