const STORAGE = 'leafy_corti_config'
const AGENT_KEY = 'leafy_corti_agent'
const PERSONA =
  'Du er Leafy, WeeLeafs venlige guide. Svar kort og varmt på dansk, medmindre brugeren skriver engelsk. Du kender Hemptation, WL Hive, shoppen, donationer og community.'

const DEFAULTS = {
  clientId: 'weeleaf-leafy',
  clientSecret: '',
  tenant: 'base',
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

async function readJson(res) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { raw: text }
  }
}

export async function getCortiToken(signal) {
  const cfg = getCortiConfig()
  if (cfg.apiKey) return cfg.apiKey
  if (tokenCache.value && Date.now() < tokenCache.exp - 15000) return tokenCache.value
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error('Corti client_secret mangler. Dobbeltklik Leafy og indsæt secret til weeleaf-leafy.')
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: 'openid',
  })

  const realms = [...new Set([cfg.tenant, 'base'].filter(Boolean))]
  let lastErr = 'Corti auth fejlede'
  for (const realm of realms) {
    const res = await fetch(`/corti-auth/realms/${encodeURIComponent(realm)}/protocol/openid-connect/token`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = await readJson(res)
    if (res.ok && data.access_token) {
      tokenCache = {
        value: data.access_token,
        exp: Date.now() + (Number(data.expires_in) || 300) * 1000,
      }
      return data.access_token
    }
    lastErr = data.error_description || data.error || data.raw || `Corti auth ${res.status} (${realm})`
  }
  throw new Error(lastErr)
}

function headers(token, tenant) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'Tenant-Name': tenant || 'base',
  }
}

function pickText(data) {
  if (!data || typeof data !== 'object') return ''
  if (typeof data.text === 'string') return data.text
  if (typeof data.content === 'string') return data.content
  if (typeof data.message === 'string') return data.message
  const parts = data.message?.parts || data.result?.message?.parts || data.artifact?.parts
  if (Array.isArray(parts)) {
    return parts.map((p) => p.text || p.content || '').join('\n').trim()
  }
  const choice = data.choices?.[0]?.message?.content || data.choices?.[0]?.delta?.content
  if (typeof choice === 'string') return choice
  return ''
}

async function ensureAgent(token, cfg, signal) {
  const existing = sessionStorage.getItem(AGENT_KEY)
  if (existing) return existing
  const res = await fetch('/corti-api/agents?ephemeral=true', {
    method: 'POST',
    signal,
    headers: headers(token, cfg.tenant),
    body: JSON.stringify({
      name: 'Leafy',
      description: 'WeeLeaf guide',
      systemPrompt: PERSONA,
    }),
  })
  const data = await readJson(res)
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || data.message || data.raw || `Corti agent ${res.status}`)
  }
  sessionStorage.setItem(AGENT_KEY, data.id)
  return data.id
}

export async function testCortiAuth() {
  tokenCache = { value: '', exp: 0 }
  sessionStorage.removeItem(AGENT_KEY)
  const token = await getCortiToken()
  const cfg = getCortiConfig()
  const agentId = await ensureAgent(token, cfg)
  return { ok: true, preview: `${token.slice(0, 10)}…`, agentId }
}

export async function streamCorti({ messages, signal, onDelta }) {
  const cfg = getCortiConfig()
  const token = await getCortiToken(signal)
  const last = [...messages].reverse().find((m) => m.role === 'user')
  const text = last?.content || ''
  if (!text) throw new Error('Tom besked.')

  if (cfg.apiKey) {
    const res = await fetch('/corti-ai/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: headers(token, cfg.tenant),
      body: JSON.stringify({
        model: cfg.model || 'corti-s1-instant',
        stream: false,
        messages: [{ role: 'system', content: PERSONA }, ...messages],
      }),
    })
    const data = await readJson(res)
    if (!res.ok) throw new Error(data.error?.message || data.error || `Corti models ${res.status}`)
    const answer = pickText(data)
    if (!answer) throw new Error('Tomt svar fra Corti Models.')
    onDelta?.(answer)
    return answer
  }

  const agentId = await ensureAgent(token, cfg, signal)
  const res = await fetch(`/corti-api/agents/${agentId}/v1/message:send`, {
    method: 'POST',
    signal,
    headers: headers(token, cfg.tenant),
    body: JSON.stringify({
      message: {
        kind: 'message',
        role: 'user',
        messageId: crypto.randomUUID(),
        parts: [{ kind: 'text', text }],
      },
    }),
  })
  const data = await readJson(res)
  if (!res.ok) {
    sessionStorage.removeItem(AGENT_KEY)
    throw new Error(data.error?.message || data.message || data.raw || `Corti message ${res.status}`)
  }
  const answer = pickText(data) || 'Corti svarede, men uden synlig tekst. Token virker.'
  onDelta?.(answer)
  return answer
}
