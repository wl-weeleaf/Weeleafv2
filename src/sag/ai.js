// Turns free text (dictation / interview transcript) into suggested case fields.
// Uses the Leafy OpenAI key when present; otherwise a simple local heuristic so
// the prototype still demonstrates the flow offline.

import { GERNINGSKODER } from './caseData'

const SYSTEM = `Du hjælper en dansk politiefterforsker med at udfylde en anmeldelse.
Udtræk felter fra teksten. Svar KUN med JSON:
{"gerningskode": string|null, "tidFra": string|null, "tidTil": string|null,
 "adresse": string|null, "postnr": string|null, "by": string|null,
 "vaerdi": string|null, "resume": string|null, "mangler": string[]}
gerningskode skal være én af: ${GERNINGSKODER.map((g) => `${g.kode} (${g.tekst})`).join(', ')}.
Tider som "DD-MM-ÅÅÅÅ TT:MM". resume: 1-3 neutrale sætninger.
mangler: konkrete oplysninger/efterforskningsskridt der mangler. Opfind intet.`

export async function extractFields(text, apiKey) {
  if (!apiKey) return heuristic(text)
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: text },
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `HTTP ${res.status}`)
  }
  const data = await res.json()
  return JSON.parse(data.choices?.[0]?.message?.content || '{}')
}

function heuristic(text) {
  const t = text.toLowerCase()
  const out = { mangler: [] }
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
  out._offline = true
  return out
}
