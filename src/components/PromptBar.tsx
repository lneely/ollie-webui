import { useState, useRef, useEffect } from 'preact/hooks'

interface Props {
  running: boolean
  onSend: (text: string) => void
  onStop: () => void
}

export function PromptBar({ running, onSend, onStop }: Props) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)


  const submit = () => {
    const text = value.trim()
    if (!text || running) return
    onSend(text)
    setValue('')
    if (ref.current) {
      ref.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const handleInput = (e: Event) => {
    const el = e.target as HTMLTextAreaElement
    setValue(el.value)
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  return (
    <div class="prompt-bar">
      <textarea
        ref={ref}
        class="prompt-textarea"
        placeholder={running ? 'ollie is thinking…' : 'message  (enter ↵ · shift+enter for newline)'}
        value={value}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        disabled={running}
        rows={1}
      />
      {running ? (
        <button class="btn btn-danger" onClick={onStop} title="Stop">
          ◼ stop
        </button>
      ) : (
        <button
          class="btn btn-primary"
          onClick={submit}
          disabled={!value.trim()}
          style="padding: 10px 16px; font-size: 16px;"
          title="Send (Enter)"
        >
          ↵
        </button>
      )}
    </div>
  )
}
