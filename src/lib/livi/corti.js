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
    return { raw: text, status: res.status }
  }
}

export async function getCortiToken(signal) {
  const cfg = getCortiConfig()
  if (tokenCache.value && Date.now() < tokenCache.exp - 15000) return tokenCache.value
  if (!cfg.clientId || !cfg.clientSecret) throw new Error('Corti client_secret mangler.')
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: 'openid',
  })
  const res = await fetch(`/corti-auth/realms/${encodeURIComponent(cfg.tenant || 'base')}/protocol/openid-connect/token`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await readJson(res)
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || data.raw || `Corti auth ${res.status}`)
  }
  tokenCache = { value: data.access_token, exp: Date.now() + (Number(data.expires_in) || 300) * 1000 }
  return data.access_token
}

function apiHeaders(token, tenant) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'Tenant-Name': tenant || 'base',
    'A2A-Version': '1.0',
  }
}

function collectText(node, out = []) {
  if (!node) return out
  if (typeof node === 'string') {
    if (node.trim() && node.length < 8000) out.push(node.trim())
    return out
  }
  if (Array.isArray(node)) {
    node.forEach((n) => collectText(n, out))
    return out
  }
  if (typeof node !== 'object') return out
  if (typeof node.text === 'string') out.push(node.text.trim())
  if (typeof node.content === 'string') out.push(node.content.trim())
  ;['parts', 'artifacts', 'history', 'messages', 'choices'].forEach((k) => {
    if (node[k]) collectText(node[k], out)
  })
  ;['result', 'message', 'status', 'task', 'data', 'delta'].forEach((k) => {
    if (node[k] && typeof node[k] === 'object') collectText(node[k], out)
  })
  return out
}

function pickText(data) {
  const skip = new Set(['user', 'agent', 'assistant', 'message', 'task', 'completed', 'working', 'submitted'])
  const bits = collectText(data).filter((t) => t && !skip.has(t.toLowerCase()) && t !== '[DONE]')
  return [...new Set(bits)].join('\n').trim()
}

async function ensureAgent(token, cfg, signal) {
  const existing = sessionStorage.getItem(AGENT_KEY)
  if (existing) return existing
  const res = await fetch('/corti-api/agents?ephemeral=true', {
    method: 'POST',
    signal,
    headers: apiHeaders(token, cfg.tenant),
    body: JSON.stringify({ name: 'Leafy', description: 'WeeLeaf guide', systemPrompt: PERSONA }),
  })
  const data = await readJson(res)
  const id = data.id || data.agentId || data.agent?.id
  if (!res.ok || !id) throw new Error(data.error?.message || data.message || data.raw || `Corti agent ${res.status}`)
  sessionStorage.setItem(AGENT_KEY, id)
  return id
}

async function pollTask(token, cfg, agentId, taskId, signal) {
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 700))
    const res = await fetch(`/corti-api/v2/agentic/agents/${agentId}/a2a/tasks/${taskId}`, {
      signal,
      headers: apiHeaders(token, cfg.tenant),
    })
    const data = await readJson(res)
    const text = pickText(data)
    const state = data.task?.status?.state || data.status?.state || data.result?.status?.state
    if (text) return text
    if (state && /fail|cancel|reject/i.test(state)) throw new Error(state)
    if (state === 'completed' && !text) break
  }
  return ''
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
  const payload = {
    message: {
      kind: 'message',
      role: 'user',
      messageId: crypto.randomUUID(),
      parts: [{ kind: 'text', text }],
    },
    configuration: { returnImmediately: false },
  }

  let res = await fetch(`/corti-api/v2/agentic/agents/${agentId}/a2a/message:send`, {
    method: 'POST',
    signal,
    headers: apiHeaders(token, cfg.tenant),
    body: JSON.stringify(payload),
  })
  let data = await readJson(res)

  if (res.status === 404 || res.status === 405) {
    res = await fetch(`/corti-api/agents/${agentId}/v1/message:send`, {
      method: 'POST',
      signal,
      headers: apiHeaders(token, cfg.tenant),
      body: JSON.stringify(payload),
    })
    data = await readJson(res)
  }

  if (!res.ok) {
    sessionStorage.removeItem(AGENT_KEY)
    throw new Error(data.error?.message || data.message || data.raw || `Corti message ${res.status}`)
  }

  let answer = pickText(data)
  const taskId = data.task?.id || data.result?.id || data.id
  if (!answer && taskId) answer = await pollTask(token, cfg, agentId, taskId, signal)
  if (!answer) {
    console.warn('[corti raw]', data)
    throw new Error('Corti svarede uden tekst.')
  }
  onDelta?.(answer)
  return answer
}
