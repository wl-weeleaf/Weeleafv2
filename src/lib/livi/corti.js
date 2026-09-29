const STORAGE = 'leafy_corti_config'
const AGENT_KEY = 'leafy_corti_agent'
const PERSONA =
  'Du er Leafy, WeeLeafs venlige guide. Svar kort og varmt på dansk, medmindre brugeren skriver engelsk. Du kender Hemptation, WL Hive, shoppen, donationer og community.'

export function getCortiConfig() {
  let stored = {}
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE) || '{}')
  } catch {}
  return {
    clientId: import.meta.env.VITE_CORTI_CLIENT_ID || stored.clientId || 'weeleaf-leafy',
    clientSecret: import.meta.env.VITE_CORTI_CLIENT_SECRET || stored.clientSecret || '',
    tenant: import.meta.env.VITE_CORTI_TENANT || stored.tenant || 'base',
    environment: import.meta.env.VITE_CORTI_ENV || stored.environment || 'eu',
    model: import.meta.env.VITE_CORTI_MODEL || stored.model || 'corti-s1-instant',
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
    throw new Error('Corti client_secret mangler.')
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: 'openid',
  })
  const realms = [...new Set([cfg.tenant, 'base'])]
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
      tokenCache = { value: data.access_token, exp: Date.now() + (Number(data.expires_in) || 300) * 1000 }
      return data.access_token
    }
    lastErr = data.error_description || data.error || data.raw || `Corti auth ${res.status}`
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

function collectText(node, out = []) {
  if (!node) return out
  if (typeof node === 'string') {
    if (node.trim()) out.push(node.trim())
    return out
  }
  if (Array.isArray(node)) {
    node.forEach((n) => collectText(n, out))
    return out
  }
  if (typeof node !== 'object') return out
  for (const key of ['text', 'content', 'output', 'answer', 'reply']) {
    if (typeof node[key] === 'string' && node[key].trim()) out.push(node[key].trim())
  }
  if (Array.isArray(node.parts)) collectText(node.parts, out)
  if (Array.isArray(node.artifacts)) collectText(node.artifacts, out)
  if (Array.isArray(node.messages)) collectText(node.messages, out)
  if (node.result) collectText(node.result, out)
  if (node.message) collectText(node.message, out)
  if (node.status) collectText(node.status, out)
  if (node.data) collectText(node.data, out)
  if (node.choices) collectText(node.choices, out)
  if (node.delta) collectText(node.delta, out)
  return out
}

function pickText(data) {
  const bits = collectText(data).filter((t) => t !== '[DONE]' && !t.startsWith('{'))
  return [...new Set(bits)].join('\n').trim()
}

async function ensureAgent(token, cfg, signal) {
  const existing = sessionStorage.getItem(AGENT_KEY)
  if (existing) return existing
  const res = await fetch('/corti-api/agents?ephemeral=true', {
    method: 'POST',
    signal,
    headers: headers(token, cfg.tenant),
    body: JSON.stringify({ name: 'Leafy', description: 'WeeLeaf guide', systemPrompt: PERSONA }),
  })
  const data = await readJson(res)
  if (!res.ok || !data.id) throw new Error(data.error?.message || data.message || data.raw || `Corti agent ${res.status}`)
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
  const answer = pickText(data)
  if (!answer) {
    console.warn('[corti raw]', data)
    throw new Error('Corti svarede uden tekst. Se konsollen for råt svar.')
  }
  onDelta?.(answer)
  return answer
}
