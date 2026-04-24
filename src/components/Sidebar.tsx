import type { IdxEntry } from '../lib/api'
import type { Theme } from '../lib/theme'
import { shortId, truncate } from '../lib/chat'

interface Props {
  sessions: IdxEntry[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onNew: () => void
  onKill: (id: string) => void
  themes: Theme[]
  currentTheme: string
  onThemeChange: (name: string) => void
}

function stateClass(state: string) {
  if (state === 'idle') return 'idle'
  if (state === 'stopped') return 'stopped'
  return 'running' // thinking, calling: <tool>, etc.
}

export function Sidebar({ sessions, selectedId, onSelect, onNew, onKill, themes, currentTheme, onThemeChange }: Props) {
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
        {sessions.map(s => (
          <div
            key={s.id}
            class={`session-card${s.id === selectedId ? ' selected' : ''}`}
            onClick={() => onSelect(s.id === selectedId ? null : s.id)}
          >
            <div class="session-card-row">
              <div class={`state-dot ${stateClass(s.state)}`} />
              <div class="session-id-label">{shortId(s.id)}</div>
              <div class="session-state-label">{s.state}</div>
              <button
                class="btn-kill"
                title="Kill session"
                onClick={(e: MouseEvent) => { e.stopPropagation(); onKill(s.id) }}
              >✕</button>
            </div>
            <div class="session-cwd" title={s.cwd}>{s.cwd}</div>
            <div class="session-badges">
              <span class="badge accent">{s.backend}</span>
              <span class="badge">{truncate(s.model, 22)}</span>
            </div>
          </div>
        ))}
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
