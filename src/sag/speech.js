// Live transcription engines for the case workspace.
//
// All engines share one interface:
//   const stop = await start({ onPartial(text), onFinal(text), onError(err) })
//   stop()
//
// 'browser' – Web Speech API (da-DK). Free, live partial text, Chrome/Edge only.
// 'openai'  – Same setup as Leafy: OpenAI key held in memory, called from the
//             browser. Audio is recorded in short segments and each segment is
//             sent to /v1/audio/transcriptions (Danish).
// 'corti'   – Placeholder. Corti streams over a WebSocket and needs a server-side
//             token, so it goes behind the PHP API when it is connected.

export const ENGINES = {
  browser: { label: 'Browser (gratis)', needsKey: false },
  openai: { label: 'OpenAI via Leafy', needsKey: true },
  corti: { label: 'Corti (kommer)', needsKey: true, disabled: true },
}

export function browserSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

function startBrowser({ onPartial, onFinal, onError }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) throw new Error('Browseren understøtter ikke talegenkendelse. Brug Chrome/Edge eller OpenAI.')
  const rec = new SR()
  rec.lang = 'da-DK'
  rec.continuous = true
  rec.interimResults = true
  let active = true

  rec.onresult = (e) => {
    let partial = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      if (r.isFinal) onFinal(r[0].transcript.trim())
      else partial += r[0].transcript
    }
    onPartial(partial)
  }
  rec.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return
    onError(new Error(`Talegenkendelse: ${e.error}`))
  }
  // Chrome stops after silence – restart while active.
  rec.onend = () => {
    if (active) {
      try { rec.start() } catch { /* already running */ }
    }
  }
  rec.start()
  return () => {
    active = false
    rec.stop()
    onPartial('')
  }
}

async function startOpenAI({ apiKey, onPartial, onFinal, onError, segmentMs = 5000 }) {
  if (!apiKey) throw new Error('Tilføj en OpenAI-nøgle (samme som Leafy) for at bruge denne motor.')
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  let active = true
  let recorder = null
  let prompt = '' // previous text helps the model keep names/spelling consistent

  const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''

  const send = async (blob) => {
    if (blob.size < 2000) return
    onPartial('… transskriberer')
    try {
      const form = new FormData()
      form.append('file', blob, 'segment.webm')
      form.append('model', 'gpt-4o-transcribe')
      form.append('language', 'da')
      if (prompt) form.append('prompt', prompt.slice(-400))
      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message || `HTTP ${res.status}`)
      }
      const data = await res.json()
      const text = (data.text || '').trim()
      if (text) {
        prompt += ' ' + text
        onFinal(text)
      }
    } catch (err) {
      onError(err)
    } finally {
      if (active) onPartial('● lytter')
    }
  }

  // A fresh recorder per segment gives each upload a complete, playable file.
  const next = () => {
    if (!active) return
    const chunks = []
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    recorder.onstop = () => {
      send(new Blob(chunks, { type: mime || 'audio/webm' }))
      next()
    }
    recorder.start()
    setTimeout(() => recorder.state === 'recording' && recorder.stop(), segmentMs)
  }
  onPartial('● lytter')
  next()

  return () => {
    active = false
    if (recorder?.state === 'recording') recorder.stop()
    stream.getTracks().forEach((t) => t.stop())
    onPartial('')
  }
}

export async function startTranscription(engine, opts) {
  if (engine === 'browser') return startBrowser(opts)
  if (engine === 'openai') return startOpenAI(opts)
  throw new Error('Corti-integration er ikke koblet på endnu.')
}
