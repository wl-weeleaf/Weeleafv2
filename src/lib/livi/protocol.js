export function validateMessages(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 40 &&
    value.every(
      (m) =>
        m &&
        ['user', 'assistant'].includes(m.role) &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0 &&
        m.content.length <= 6000
    ) &&
    value.reduce((n, m) => n + m.content.length, 0) <= 40000 &&
    value.at(-1).role === 'user'
  )
}

export class ChatStreamParser {
  buffer = ''
  data = []
  push(chunk) {
    this.buffer += chunk
    const events = []
    let index
    while ((index = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, index).replace(/\r$/, '')
      this.buffer = this.buffer.slice(index + 1)
      if (line === '') {
        if (this.data.length) events.push(this.data.join('\n'))
        this.data = []
      } else if (line.startsWith('data:')) this.data.push(line.slice(5).trimStart())
    }
    return events
  }
}
