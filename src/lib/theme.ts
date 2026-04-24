export interface Theme {
  name: string
  label: string
  vars: Record<string, string>
}

const midnight: Theme = {
  name: 'midnight',
  label: 'Midnight',
  vars: {},  // default — uses :root values from CSS
}

const acme: Theme = {
  name: 'acme',
  label: 'Acme',
  vars: {
    '--bg':           '#ffffea',       // acme yellow body
    '--bg-elevated':  '#eaffff',       // acme blue tag bar

    '--mono': "'Go Mono', monospace",
    '--sans': "'Go', system-ui, sans-serif",
    '--bg-soft':      '#ffffff',       // white inputs
    '--bg-card':      '#eaffea',       // rio pale green window body
    '--border':       '#888888',
    '--border-focus':  '#444444',

    '--text':         '#000000',
    '--text-dim':     '#333333',
    '--text-faint':   '#777777',

    '--accent':       '#268bd2',
    '--accent-soft':  'rgba(38, 139, 210, 0.1)',
    '--accent-glow':  'rgba(38, 139, 210, 0.2)',
    '--accent-fg':    '#ffffea',
    '--accent-border': 'rgba(38, 139, 210, 0.3)',
    '--accent-focus':  'rgba(38, 139, 210, 0.5)',

    '--running':      '#859900',
    '--running-glow': 'rgba(133, 153, 0, 0.35)',
    '--idle':         '#888888',
    '--stopped':      '#aaaaaa',
    '--danger':       '#dc322f',
    '--warning':      '#b58900',

    '--hover':        'rgba(0, 0, 0, 0.05)',
    '--hover-strong': 'rgba(0, 0, 0, 0.08)',
    '--code-bg':      '#ffffff',       // white inner code box
    '--overlay-bg':   'rgba(0, 0, 0, 0.3)',

    '--user-bubble-bg':     'transparent',
    '--user-bubble-border': 'transparent',
    '--asst-bubble-bg':     'transparent',
    '--asst-bubble-border': 'transparent',

    '--tool-bubble-bg':     '#ffffff',
    '--tool-bubble-accent': '#b58900',
    '--tool-text':          '#000000',
    '--tool-arrow-color':   '#000000',
    '--tool-header-bg':     'transparent',
  },
}

const themes: Theme[] = [midnight, acme]

export function getThemes(): Theme[] {
  return themes
}

export function getTheme(name: string): Theme {
  return themes.find(t => t.name === name) ?? midnight
}

const STORAGE_KEY = 'ollie-theme'

export function loadThemeName(): string {
  return localStorage.getItem(STORAGE_KEY) ?? 'acme'
}

export function saveThemeName(name: string) {
  localStorage.setItem(STORAGE_KEY, name)
}

export function applyTheme(theme: Theme) {
  const el = document.documentElement
  // Clear any previously applied theme vars
  el.removeAttribute('style')
  for (const [k, v] of Object.entries(theme.vars)) {
    el.style.setProperty(k, v)
  }
  el.dataset.theme = theme.name
}
