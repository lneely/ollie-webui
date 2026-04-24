import { useState, useEffect } from 'preact/hooks'
import { getBackends } from '../lib/api'

interface CreateParams {
  cwd: string
  backend: string
  model: string
  agent: string
}

interface Props {
  onClose: () => void
  onCreate: (p: CreateParams) => Promise<void>
}

const AGENTS = ['default', 'coding', 'devops', 'greybeard', 'qa', 'reviewer', 'writer']

const DEFAULT_MODELS: Record<string, string> = {
  anthropic:       'claude-opus-4-5',
  openai:          'gpt-4o',
  ollama:          'llama3',
  codewhisperer:   'anthropic.claude-3-5-sonnet-20241022-v2:0',
  copilot:         'gpt-4o',
}

export function NewSession({ onClose, onCreate }: Props) {
  const [cwd, setCwd]         = useState('~')
  const [backend, setBackend] = useState('anthropic')
  const [model, setModel]     = useState(DEFAULT_MODELS['anthropic'])
  const [agent, setAgent]     = useState('default')
  const [backends, setBackends] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getBackends().then(bs => {
      if (bs.length > 0) {
        setBackends(bs)
        setBackend(bs[0])
        setModel(DEFAULT_MODELS[bs[0]] ?? '')
      }
    }).catch(() => {})
  }, [])

  const handleBackend = (b: string) => {
    setBackend(b)
    setModel(DEFAULT_MODELS[b] ?? '')
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    if (!cwd.trim() || !model.trim()) return
    setLoading(true)
    try {
      await onCreate({ cwd: cwd.trim(), backend, model: model.trim(), agent })
    } finally {
      setLoading(false)
    }
  }

  const handleOverlay = (e: MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div class="overlay" onClick={handleOverlay}>
      <div class="modal" onClick={e => e.stopPropagation()}>
        <div>
          <div class="modal-eyebrow">POST /s/new</div>
          <div class="modal-title">New session</div>
        </div>

        <form onSubmit={handleSubmit} style="display:flex;flex-direction:column;gap:18px;">
          <div class="field">
            <label>working directory</label>
            <input
              type="text"
              value={cwd}
              onInput={e => setCwd((e.target as HTMLInputElement).value)}
              placeholder="~/src/myproject"
              required
              autofocus
            />
          </div>

          <div class="field-row">
            <div class="field">
              <label>backend</label>
              <select
                value={backend}
                onChange={e => handleBackend((e.target as HTMLSelectElement).value)}
              >
                {(backends.length > 0 ? backends : ['anthropic', 'openai', 'ollama']).map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div class="field">
              <label>agent</label>
              <select
                value={agent}
                onChange={e => setAgent((e.target as HTMLSelectElement).value)}
              >
                {AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div class="field">
            <label>model</label>
            <input
              type="text"
              value={model}
              onInput={e => setModel((e.target as HTMLInputElement).value)}
              placeholder="model name"
              required
            />
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" onClick={onClose}>cancel</button>
            <button
              type="submit"
              class="btn btn-primary"
              disabled={loading || !cwd.trim() || !model.trim()}
            >
              {loading ? 'creating…' : 'create session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
