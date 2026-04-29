import { useState } from 'preact/hooks'
import type { IdxEntry } from '../lib/api'
import type { Theme } from '../lib/theme'

interface Props {
  sessions: IdxEntry[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onNew: () => void
  onKill: (id: string) => void
  onRename: (id: string, newName: string) => void
  themes: Theme[]
  currentTheme: string
  onThemeChange: (name: string) => void
}

function stateClass(state: string) {
  if (state === 'idle') return 'idle'
  if (state === 'stopped') return 'stopped'
  return 'running'
}

interface SessionNode {
  session: IdxEntry | null
  children: Map<string, SessionNode>
}

function buildTree(sessions: IdxEntry[]): SessionNode {
  const root: SessionNode = { session: null, children: new Map() }
  for (const s of sessions) {
    const parts = s.id.split('__')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts.slice(0, i + 1).join('__')
      if (!node.children.has(key)) {
        node.children.set(key, { session: null, children: new Map() })
      }
      node = node.children.get(key)!
    }
    if (node.children.has(s.id)) {
      node.children.get(s.id)!.session = s
    } else {
      node.children.set(s.id, { session: s, children: new Map() })
    }
  }
  return root
}

function leafName(id: string): string {
  const parts = id.split('__')
  return parts[parts.length - 1]
}

export function Sidebar({ sessions, selectedId, onSelect, onNew, onKill, onRename, themes, currentTheme, onThemeChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const startRename = (e: MouseEvent, id: string) => {
    e.stopPropagation()
    setEditingId(id)
    setEditValue(id)
  }

  const commitRename = (oldId: string) => {
    const name = editValue.trim()
    setEditingId(null)
    if (name && name !== oldId) onRename(oldId, name)
  }

  const toggle = (id: string, e: MouseEvent) => {
    e.stopPropagation()
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const tree = buildTree(sessions)

  function renderNode(node: SessionNode, depth: number): any {
    const items: any[] = []
    for (const [id, child] of node.children) {
      const s = child.session
      const hasChildren = child.children.size > 0
      const isCollapsed = collapsed.has(id)

      if (s) {
        items.push(
          <div key={id} class="stree-node" style={{ marginLeft: (depth * 14) + 'px' }}>
            <div
              class={`stree-row${s.id === selectedId ? ' selected' : ''}`}
              onClick={() => onSelect(s.id === selectedId ? null : s.id)}
            >
              {hasChildren && (
                <span class={`stree-chevron${isCollapsed ? ' collapsed' : ''}`} onClick={(e: MouseEvent) => toggle(id, e)}>&#9662;</span>
              )}
              <span class={`state-dot ${stateClass(s.state)}`} />
              {editingId === s.id ? (
                <input
                  class="session-rename-input"
                  value={editValue}
                  onInput={e => setEditValue((e.target as HTMLInputElement).value)}
                  onBlur={() => commitRename(s.id)}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(s.id); if (e.key === 'Escape') setEditingId(null) }}
                  onClick={e => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <span class="stree-label" onDblClick={(e: MouseEvent) => startRename(e, s.id)}>{leafName(s.id)}</span>
              )}
              <span class="stree-state">{s.state}</span>
              <button
                class="btn-kill"
                title="Kill session"
                onClick={(e: MouseEvent) => { e.stopPropagation(); onKill(s.id) }}
              >&#10005;</button>
            </div>
            {hasChildren && !isCollapsed && renderNode(child, depth + 1)}
          </div>
        )
      } else if (hasChildren) {
        items.push(
          <div key={id}>
            {renderNode(child, depth + 1)}
          </div>
        )
      }
    }
    return items
  }

  return (
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L15 8L8 15L1 8Z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/>
            <path d="M8 4.5L11.5 8L8 11.5L4.5 8Z" fill="currentColor" opacity="0.45"/>
          </svg>
          ollie
        </div>
        <button class="btn btn-ghost" style="padding: 5px 10px; font-size: 12px; gap: 4px;" onClick={onNew}>
          <span style="font-size: 14px; line-height: 1; margin-top: -1px;">+</span> new
        </button>
      </div>

      <div class="dir-label">/s/</div>

      <div class="session-list">
        {sessions.length === 0 && (
          <div class="session-empty">no sessions</div>
        )}
        {renderNode(tree, 0)}
      </div>

      {themes.length > 1 && (
        <div class="sidebar-footer">
          <select
            class="theme-select"
            value={currentTheme}
            onChange={e => onThemeChange((e.target as HTMLSelectElement).value)}
          >
            {themes.map(t => <option key={t.name} value={t.name}>{t.label}</option>)}
          </select>
        </div>
      )}
    </aside>
  )
}
