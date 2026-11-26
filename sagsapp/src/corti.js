// Browser side of the Corti integration.
//
// Live transcription/dictation: the server hands out a short-lived WebSocket URL
// (token included), the browser streams microphone audio (webm/opus) to Corti's
// /transcribe endpoint and receives transcript messages back.
//
// Speech only ever goes to Corti. Without Corti, transcription is unavailable and
// field suggestions use a local rule set.

import { GERNINGSKODER } from './caseData'

export async function cortiStatus() {
  try {
    const r = await fetch('/api/status')
    return r.ok ? await r.json() : { corti: false }
  } catch {
    return { corti: false, offline: true }
  }
}

async function api(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined)
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
  return data
}

// Spoken commands for dictation (Corti returns them as "command" messages).
const COMMANDS = [
  { id: 'ny_linje', phrases: ['ny linje'] },
  { id: 'nyt_afsnit', phrases: ['nyt afsnit'] },
  { id: 'slet_sidste', phrases: ['slet det sidste', 'slet sidste'] },
  { id: 'stop', phrases: ['stop diktat'] },
]

// opts: { mode: 'diktat'|'afhoering', onPartial, onFinal, onCommand, onError, onState }
export async function startCorti({ mode, onPartial, onFinal, onCommand, onError, onState }) {
  const { url, language } = await api('/api/corti/transcribe')
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  })
  const ws = new WebSocket(url)
  ws.binaryType = 'arraybuffer'
  let recorder = null
  let closed = false

  const stopAll = () => {
    if (closed) return
    closed = true
    if (recorder?.state === 'recording') recorder.stop()
    stream.getTracks().forEach((t) => t.stop())
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'end' }))
      setTimeout(() => ws.close(), 1500) // let final transcripts arrive
    }
    onPartial('')
    onState?.('stopped')
  }

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        type: 'config',
        configuration: {
          primaryLanguage: language || 'da',
          interimResults: true,
          automaticPunctuation: true,
          // Dictation: punctuation and commands are spoken. Interview: automatic.
          spokenPunctuation: mode === 'diktat',
          ...(mode === 'diktat' ? { commands: COMMANDS } : {}),
        },
      })
    )
  }

  ws.onmessage = (e) => {
    if (typeof e.data !== 'string') return
    let msg
    try { msg = JSON.parse(e.data) } catch { return }
    switch (msg.type) {
      case 'CONFIG_ACCEPTED': {
        onState?.('live')
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
        recorder = new MediaRecorder(stream, { mimeType: mime })
        recorder.ondataavailable = async (ev) => {
          if (ev.data.size && ws.readyState === WebSocket.OPEN) ws.send(await ev.data.arrayBuffer())
        }
        recorder.start(250)
        break
      }
      case 'CONFIG_DENIED':
      case 'CONFIG_TIMEOUT':
      case 'CONFIG_MISSING':
        onError(new Error(`Corti afviste opsætningen (${msg.type}). Tjek sprog "${language}" via /api/corti/languages.`))
        stopAll()
        break
      case 'transcript': {
        const items = Array.isArray(msg.data) ? msg.data : [msg.data]
        for (const t of items) {
          if (t.isFinal) { onFinal(t.text.trim()); onPartial('') }
          else onPartial(t.text)
        }
        break
      }
      case 'command':
        if (msg.data.id === 'stop') stopAll()
        else onCommand?.(msg.data.id)
        break
      case 'error':
        onError(new Error(msg.error?.title || msg.error?.details || 'Fejl fra Corti'))
        break
      case 'ended':
        stopAll()
        break
    }
  }
  ws.onerror = () => onError(new Error('Forbindelsen til Corti fejlede.'))
  ws.onclose = () => stopAll()

  return stopAll
}

// ── AI helper ──
// Without Corti the suggestions are made locally (simple rules, nothing leaves the machine).
export async function assist(text, useCorti, navne = []) {
  if (!useCorti) return heuristic(text)
  const koder = GERNINGSKODER.map(({ kode, tekst }) => ({ kode, tekst }))
  return api('/api/assist', { text, koder, navne })
}

function heuristic(text) {
  const t = text.toLowerCase()
  const out = { mangler: [], _offline: true }
  const kode = GERNINGSKODER.find((g) => g.ord.some((o) => t.includes(o)))
  if (kode) out.gerningskode = kode.kode
  const adr = text.match(/([A-ZÆØÅ][a-zæøå]+(?:vej|gade|allé|alle|stræde|plads|boulevard|vænget))\s+(\d+\w?)/)
  if (adr) out.adresse = `${adr[1]} ${adr[2]}`
  const pn = text.match(/\b(\d{4})\s+([A-ZÆØÅ][a-zæøå]+)/)
  if (pn) { out.postnr = pn[1]; out.by = pn[2] }
  const kr = text.match(/(\d[\d.]*)\s*(kr|kroner)/i)
  if (kr) out.vaerdi = `${kr[1]} kr.`
  if (!/vidne/.test(t)) out.mangler.push('Ingen vidner nævnt – foretag dør-til-dør')
  if (!/kamera|video|overvåg/.test(t)) out.mangler.push('Undersøg videoovervågning i området')
  out.resume = text.split(/(?<=\.)\s/).slice(0, 2).join(' ')
  return out
}

// ── Settings (stored in sagsapp/.env by the local server) ──
export const getSettings = () => api('/api/settings')
export const saveSettings = (s) => api('/api/settings', s)
export const testSettings = () => api('/api/settings/test', {})
