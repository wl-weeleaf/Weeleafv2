import { ChatStreamParser } from './protocol'

const STORAGE = 'leafy_corti_config'
const PERSONA =
  'Du er Leafy, WeeLeafs venlige guide. Svar kort og varmt på dansk, medmindre brugeren skriver engelsk. Du kender Hemptation, WL Hive, shoppen, donationer og community.'

const DEFAULTS = {
  clientId: 'weeleaf-default_client',
  clientSecret: '',
  tenant: 'weeleaf',
  environment: 'eu',
  model: 'corti-s1-instant',
  apiKey: '',
}

export function getCortiConfig() {
  let stored = {}
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE) || '{}')
  } catch {}
  return {
    clientId: import.meta.env.VITE_CORTI_CLIENT_ID || stored.clientId || DEFAULTS.clientId,
    clientSecret: import.meta.env.VITE_CORTI_CLIENT_SECRET || stored.clientSecret || '',
    tenant: import.meta.env.VITE_CORTI_TENANT || stored.tenant || DEFAULTS.tenant,
    environment: import.meta.env.VITE_CORTI_ENV || stored.environment || DEFAULTS.environment,
    model: import.meta.env.VITE_CORTI_MODEL || stored.model || DEFAULTS.model,
    apiKey: import.meta.env.VITE_CORTI_API_KEY || stored.apiKey || '',
  }
}

export function setCortiConfig(patch) {
  const next = { ...getCortiConfig(), ...patch }
  localStorage.setItem(STORAGE, JSON.stringify(next))
  return next
}

let tokenCache = { value: '', exp: 0 }

export async function getCortiToken(signal) {
  const cfg = getCortiConfig()
  if (cfg.apiKey) return cfg.apiKey
  if (tokenCache.value && Date.now() < tokenCache.exp - 15000) return tokenCache.value
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error('Corti client secret mangler. Dobbeltklik Leafy og udfyld weeleaf-default_client + secret.')
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: 'openid',
  })

  const res = await fetch(`/corti-auth/realms/${encodeURIComponent(cfg.tenant)}/protocol/openid-connect/token`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Corti auth ${res.status}`)
  }
  tokenCache = {
    value: data.access_token,
    exp: Date.now() + (Number(data.expires_in) || 300) * 1000,
  }
  return data.access_token
}

export async function testCortiAuth() {
  tokenCache = { value: '', exp: 0 }
  const token = await getCortiToken()
  return { ok: true, preview: `${token.slice(0, 12)}…` }
}

export async function streamCorti({ messages, signal, onDelta }) {
  const cfg = getCortiConfig()
  const token = await getCortiToken(signal)
  const payload = {
    model: cfg.model || 'corti-s1-instant',
    stream: true,
    max_tokens: 800,
    messages: [{ role: 'system', content: PERSONA }, ...messages],
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'Tenant-Name': cfg.tenant,
  }

  let res = await fetch('/corti-ai/v1/chat/completions', {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify(payload),
  })

  if (res.status === 404 || res.status === 405) {
    res = await fetch('/corti-api/v2/chat/completions', {
      method: 'POST',
      signal,
      headers,
      body: JSON.stringify(payload),
    })
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const msg = data.error?.message || data.error || data.message || `Corti svarede ${res.status}`
    throw new Error(msg)
  }

  if (!res.body) {
    const data = await res.json().catch(() => ({}))
    const answer = data.choices?.[0]?.message?.content
    if (answer) {
      onDelta?.(answer)
      return answer
    }
    throw new Error('Svaret mangler.')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const parser = new ChatStreamParser()
  let answer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      const events = parser.push(chunk)
      if (!events.length && chunk && !chunk.startsWith('data:')) {
        try {
          const data = JSON.parse(parser.buffer + chunk)
          const text = data.choices?.[0]?.message?.content
          if (text) {
            answer = text
            onDelta?.(answer)
          }
        } catch {}
      }
      for (const event of events) {
        if (event === '[DONE]') continue
        const data = JSON.parse(event)
        if (data.error) throw new Error(data.error.message || 'Svaret blev afbrudt.')
        const delta = data.choices?.[0]?.delta?.content || data.choices?.[0]?.message?.content
        if (typeof delta === 'string') {
          answer += data.choices?.[0]?.delta?.content ? delta : ''
          if (!data.choices?.[0]?.delta?.content) answer = delta
          onDelta?.(answer)
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
  if (!answer.trim()) throw new Error('Tomt svar fra Corti. Tjek model og credentials.')
  return answer
}
