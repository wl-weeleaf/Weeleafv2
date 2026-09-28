import { ChatStreamParser } from './protocol'

export async function streamGrok({ messages, signal, onDelta }) {
  const res = await fetch('/api/leafy-chat.php', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stream: true,
      messages,
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error?.message || data.error || `Leafy svarede ${res.status}`)
  }
  if (!res.body) throw new Error('Svaret mangler.')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const parser = new ChatStreamParser()
  let answer = ''
  let complete = false
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const event of parser.push(decoder.decode(value, { stream: true }))) {
        if (event === '[DONE]') {
          complete = true
          continue
        }
        const data = JSON.parse(event)
        if (data.error) throw new Error(data.error.message || 'Svaret blev afbrudt.')
        const delta = data.choices?.[0]?.delta?.content
        if (typeof delta === 'string') {
          answer += delta
          onDelta?.(answer)
        }
        if (data.choices?.[0]?.finish_reason) complete = true
      }
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
  if (!complete && !answer.trim()) throw new Error('Svaret er ufuldstændigt. Prøv igen.')
  return answer
}
