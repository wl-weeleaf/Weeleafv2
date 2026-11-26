// Small backend for the case workspace.
//
// Holds the Corti client credentials (never sent to the browser) and exposes:
//   GET  /api/status            – is Corti configured?
//   GET  /api/corti/transcribe  – short-lived WebSocket URL for live dictation/transcription
//   GET  /api/corti/languages   – languages the tenant supports (check Danish here)
//   POST /api/assist { text }   – Corti agent extracts case fields + next steps
//
// Run: copy .env.example to .env, fill in, then `npm run dev`.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { CortiClient } from '@corti/sdk'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
loadEnv(path.join(root, '.env'))

const PORT = process.env.PORT || 8787
const ENV_FILE = path.join(root, '.env')
const KEYS = ['CORTI_ENVIRONMENT', 'CORTI_TENANT_NAME', 'CORTI_CLIENT_ID', 'CORTI_CLIENT_SECRET', 'CORTI_AGENT_ID', 'CORTI_LANGUAGE']

// Mutable so settings can be changed from the UI without a restart.
let CORTI_ENVIRONMENT, CORTI_TENANT_NAME, CORTI_CLIENT_ID, CORTI_CLIENT_SECRET, CORTI_LANGUAGE, agentId
let configured = false
let corti = null
let cached = { token: '', exp: 0 }

function init() {
  const e = process.env
  CORTI_ENVIRONMENT = e.CORTI_ENVIRONMENT || 'eu'
  CORTI_TENANT_NAME = e.CORTI_TENANT_NAME || ''
  CORTI_CLIENT_ID = e.CORTI_CLIENT_ID || ''
  CORTI_CLIENT_SECRET = e.CORTI_CLIENT_SECRET || ''
  CORTI_LANGUAGE = e.CORTI_LANGUAGE || 'da'
  agentId = e.CORTI_AGENT_ID || ''
  configured = !!(CORTI_TENANT_NAME && CORTI_CLIENT_ID && CORTI_CLIENT_SECRET)
  corti = configured
    ? new CortiClient({
        tenantName: CORTI_TENANT_NAME,
        environment: CORTI_ENVIRONMENT,
        auth: { clientId: CORTI_CLIENT_ID, clientSecret: CORTI_CLIENT_SECRET },
      })
    : null
  cached = { token: '', exp: 0 }
}
init()

function settingsView() {
  return {
    environment: CORTI_ENVIRONMENT,
    tenantName: CORTI_TENANT_NAME,
    clientId: CORTI_CLIENT_ID,
    hasSecret: !!CORTI_CLIENT_SECRET, // the secret itself never leaves the server
    agentId,
    language: CORTI_LANGUAGE,
    configured,
  }
}

function saveSettings(b) {
  const map = {
    CORTI_ENVIRONMENT: b.environment,
    CORTI_TENANT_NAME: b.tenantName,
    CORTI_CLIENT_ID: b.clientId,
    CORTI_CLIENT_SECRET: b.clientSecret || undefined, // blank = keep existing
    CORTI_AGENT_ID: b.agentId,
    CORTI_LANGUAGE: b.language,
  }
  for (const [k, v] of Object.entries(map)) if (v !== undefined) process.env[k] = String(v).trim()
  const lines = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/) : []
  for (const k of KEYS) {
    const val = process.env[k] || ''
    const i = lines.findIndex((l) => l.startsWith(k + '='))
    if (i >= 0) lines[i] = `${k}=${val}`
    else lines.push(`${k}=${val}`)
  }
  fs.writeFileSync(ENV_FILE, lines.join('\n').replace(/\n*$/, '\n'))
  init()
}

// ── Auth: client-credentials token, cached until shortly before expiry ──
async function accessToken() {
  if (cached.token && Date.now() < cached.exp - 30_000) return cached.token
  const url = `https://auth.${CORTI_ENVIRONMENT}.corti.app/realms/${encodeURIComponent(CORTI_TENANT_NAME)}/protocol/openid-connect/token`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CORTI_CLIENT_ID,
      client_secret: CORTI_CLIENT_SECRET,
      scope: 'openid',
    }),
  })
  if (!res.ok) throw new Error(`Corti-login fejlede (${res.status}): ${await res.text()}`)
  const data = await res.json()
  cached = { token: data.access_token, exp: Date.now() + (data.expires_in || 300) * 1000 }
  return cached.token
}

// ── AI helper: one Corti agent with a case-work system prompt ──
const SYSTEM_PROMPT = `Du hjælper en dansk politiefterforsker med at udfylde en anmeldelse.
Udtræk felter fra teksten og svar KUN med gyldig JSON, uden forklaring eller markdown:
{"gerningskode": string|null, "tidFra": string|null, "tidTil": string|null,
 "adresse": string|null, "postnr": string|null, "by": string|null,
 "vaerdi": string|null, "resume": string|null, "mangler": string[]}
gerningskode er en af kodelistens koder, som gives i beskeden.
Tider som "DD-MM-ÅÅÅÅ TT:MM". resume: 1-3 neutrale sætninger på dansk.
mangler: konkrete oplysninger eller efterforskningsskridt der mangler. Opfind aldrig oplysninger.`

async function ensureAgent() {
  if (agentId) return agentId
  const agent = await corti.agents.create({
    name: 'sagsassistent',
    description: 'Udtrækker sagsfelter og næste skridt fra afhøringer og diktat.',
    systemPrompt: SYSTEM_PROMPT,
  })
  agentId = agent.id
  saveSettings({ agentId }) // persist so the agent is reused
  console.log(`[corti] oprettede agent ${agentId}`)
  return agentId
}

function textFrom(resp) {
  const msgs = [resp.message, resp.task?.status?.message, ...(resp.task?.history || []).filter((m) => m.role === 'agent').slice(-1)]
  const artifactParts = (resp.task?.artifacts || []).flatMap((a) => a.parts || [])
  for (const parts of [...msgs.map((m) => m?.parts), artifactParts]) {
    const t = (parts || []).filter((p) => p.kind === 'text').map((p) => p.text).join('\n')
    if (t.trim()) return t
  }
  return ''
}

async function assist(text, koder) {
  const id = await ensureAgent()
  const resp = await corti.agents.messageSend(id, {
    message: {
      role: 'user',
      kind: 'message',
      messageId: randomUUID(),
      parts: [{ kind: 'text', text: `Kodeliste: ${koder}\n\nTekst:\n${text}` }],
    },
  })
  const raw = textFrom(resp)
  const json = raw.match(/\{[\s\S]*\}/)
  if (!json) throw new Error('Corti-agenten returnerede ikke JSON: ' + raw.slice(0, 200))
  return JSON.parse(json[0])
}

// ── HTTP ──
const routes = {
  'GET /api/status': async () => ({ corti: configured, environment: CORTI_ENVIRONMENT, language: CORTI_LANGUAGE }),

  'GET /api/corti/transcribe': async () => {
    const token = await accessToken()
    const q = new URLSearchParams({ 'tenant-name': CORTI_TENANT_NAME, token: `Bearer ${token}` })
    return {
      url: `wss://api.${CORTI_ENVIRONMENT}.corti.app/audio-bridge/v2/transcribe?${q}`,
      language: CORTI_LANGUAGE,
    }
  },

  'GET /api/corti/languages': async () => corti.languages.list(),

  'GET /api/settings': async () => settingsView(),

  'POST /api/settings': async (body) => {
    saveSettings(body || {})
    return settingsView()
  },

  // Checks credentials end to end: token, then the languages endpoint.
  'POST /api/settings/test': async () => {
    if (!configured) throw new Error('Udfyld tenant, client ID og client secret først.')
    const steps = []
    cached = { token: '', exp: 0 }
    try {
      await accessToken()
    } catch (e) {
      const cause = e.cause?.code === 'ENOTFOUND' ? `kan ikke finde auth.${CORTI_ENVIRONMENT}.corti.app – tjek netværk og miljø` : e.message
      throw new Error('Login fejlede: ' + cause)
    }
    steps.push('Login OK')
    try {
      const langs = await corti.languages.list()
      const txt = JSON.stringify(langs)
      steps.push(new RegExp(`"${CORTI_LANGUAGE}(-[A-Z]{2})?"`).test(txt) ? `Sprog "${CORTI_LANGUAGE}" understøttet` : `Sprog "${CORTI_LANGUAGE}" ikke fundet i listen – tjek sprogkoden`)
    } catch (e) {
      steps.push('Sprogliste kunne ikke hentes: ' + e.message)
    }
    return { ok: true, steps }
  },

  'POST /api/assist': async (body) => {
    if (!body?.text?.trim()) throw new Error('Ingen tekst')
    return assist(body.text, body.koder || '')
  },
}

http
  .createServer(async (req, res) => {
    const key = `${req.method} ${req.url.split('?')[0]}`
    const handler = routes[key]
    if (!handler) return send(res, 404, { error: 'Ikke fundet' })
    if (!key.startsWith('GET /api/status') && !key.includes('/api/settings') && !configured) {
      return send(res, 503, { error: 'Corti er ikke sat op. Udfyld .env (se .env.example).' })
    }
    try {
      const body = req.method === 'POST' ? JSON.parse((await readBody(req)) || '{}') : undefined
      send(res, 200, await handler(body))
    } catch (err) {
      console.error(err)
      send(res, 500, { error: err.message })
    }
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`[server] http://localhost:${PORT}  Corti: ${configured ? `${CORTI_TENANT_NAME} (${CORTI_ENVIRONMENT})` : 'IKKE sat op – kører i demo-tilstand'}`)
  })

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = ''
    req.on('data', (c) => (d += c))
    req.on('end', () => resolve(d))
    req.on('error', reject)
  })
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
