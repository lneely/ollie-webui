export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
}

// Parse the ollie chat log format (lines returned by the gateway).
// Lines starting with "user: " or "assistant: " begin a new message;
// subsequent lines are appended to the current message content.
export function parseChat(lines: string[]): ChatMessage[] {
  const messages: ChatMessage[] = []
  let cur: ChatMessage | null = null

  for (const line of lines) {
    if (line.startsWith('user: ')) {
      if (cur) messages.push(cur)
      cur = { role: 'user', content: line.slice(6) }
    } else if (line.startsWith('assistant: ')) {
      if (cur) messages.push(cur)
      cur = { role: 'assistant', content: line.slice(11) }
    } else if (line.startsWith('-> ')) {
      if (cur) messages.push(cur)
      cur = { role: 'tool', content: line.slice(3) }
    } else if (cur) {
      cur.content += '\n' + line
    }
  }
  if (cur) messages.push(cur)
  return messages
}

export function shortId(id: string): string {
  return id.length > 12 ? id.slice(0, 12) : id
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}
