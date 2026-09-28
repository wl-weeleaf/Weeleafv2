import { ChatStreamParser } from './protocol'

const PERSONA =
  'Du er Leafy, WeeLeafs venlige guide. Svar kort og varmt på dansk, medmindre brugeren skriver engelsk. Du kender Hemptation, WL Hive, shoppen, donationer og community.'

export function getGrokKey() {
  return import.meta.env.VITE_XAI_API_KEY || localStorage.getItem('leafy_xai_key') || ''
}

export function setGrokKey(key) {
  if (key) localStorage.setItem('leafy_xai_key', key)
  else localStorage.removeItem('leafy_xai_key')
}

export async function streamGrok({ messages, signal, onDelta }) {
  const key = getGrokKey()
  if (!key) throw new Error('Grok-nøgle mangler. Dobbeltklik Leafy og indsæt din xAI API-nøgle.')

  const res = await fetch('/xai/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: import.meta.env.VITE_XAI_MODEL || 'grok-4',
      stream: true,
      max_tokens: 800,
      messages: [{ role: 'system', content: PERSONA }, ...messages],
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error?.message || data.error || `Grok svarede ${res.status}`)
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
