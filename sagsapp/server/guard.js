// Safety layer between the case workspace and Corti.
//
// 1. redact()   – replaces identifying details with placeholders before text leaves
//                 the machine, so the AI only sees a neutral description.
// 2. restore()  – puts the real values back into the suggestions locally.
// 3. validate() – accepts only the expected fields in the expected format. Anything
//                 else from the model (extra keys, instructions, long text) is dropped.
// 4. egress     – the server may only call Corti hosts.
// 5. audit()    – logs what was sent (counts, never content).

import fs from 'node:fs'
import path from 'node:path'

// Order matters: most specific first.
const PATTERNS = [
  { type: 'CPR', re: /\b\d{6}[-\s]?\d{4}\b/g },
  { type: 'EMAIL', re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  { type: 'TELEFON', re: /(?:\+45[\s-]?)?\b\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}\b/g },
  { type: 'NUMMERPLADE', re: /\b[A-ZÆØÅ]{2}[\s-]?\d{2}[\s-]?\d{3}\b/g },
  { type: 'KONTO', re: /\b\d{4}[\s-]\d{6,10}\b/g },
  // Street + house number (identifies a home); restored locally afterwards.
  { type: 'ADRESSE', re: /\b[A-ZÆØÅ][a-zæøå]+(?:vej|gade|allé|alle|stræde|plads|vænget|boulevard|torv|parken|haven|bakken)\s+\d+[A-Za-z]?(?:,?\s*\d+\.?\s*(?:th|tv|mf)\.?)?/g },
  // Two or more capitalised words not ending in a street/place word = likely a person.
  {
    type: 'PERSON',
    re: /\b([A-ZÆØÅ][a-zæøå]+(?:[\s-](?:[A-ZÆØÅ][a-zæøå]+)){1,3})\b(?<!(?:vej|gade|allé|alle|stræde|plads|vænget|boulevard|torv|park|centret|station|Politi|Rigspolitiet))/g,
  },
]

// Words that start sentences or are common capitalised terms; never treated as names.
const NOT_NAMES = new Set(['Anmelder', 'Vidne', 'Forurettede', 'Sigtede', 'Mistænkte', 'Betjent', 'Naboen', 'Nabo', 'Patrulje', 'Netto', 'Føtex', 'Bilka', 'Aarhus', 'København', 'Odense', 'Aalborg', 'MobilePay', 'Facebook', 'Marketplace'])

export function redact(text, extraNames = []) {
  const map = {}
  const counts = {}
  let out = text

  // Names the user listed on the case (most reliable).
  for (const name of extraNames.filter((n) => n && n.length > 2)) {
    out = out.replaceAll(name, () => placeholder('PERSON', name))
  }

  for (const { type, re } of PATTERNS) {
    out = out.replace(re, (m) => {
      if (type === 'PERSON') {
        // Drop leading role words ("Vidne Hans Jensen" -> keep "Vidne", redact "Hans Jensen").
        const words = m.split(' ')
        let i = 0
        while (i < words.length && NOT_NAMES.has(words[i])) i++
        const name = words.slice(i).join(' ')
        if (name.split(/[\s-]/).length < 2) return m
        return words.slice(0, i).concat(placeholder(type, name)).join(' ')
      }
      return placeholder(type, m)
    })
  }
  return { text: out, map, counts }

  function placeholder(type, value) {
    const existing = Object.entries(map).find(([, v]) => v === value)
    if (existing) return existing[0]
    counts[type] = (counts[type] || 0) + 1
    const key = `[${type} ${counts[type]}]`
    map[key] = value
    return key
  }
}

export function restore(value, map) {
  if (typeof value === 'string') return value.replace(/\[[A-ZÆØÅ]+ \d+\]/g, (k) => map[k] ?? k)
  if (Array.isArray(value)) return value.map((v) => restore(v, map))
  return value
}

const DATE = /^\d{2}-\d{2}-\d{4}( \d{2}:\d{2})?$/
const clean = (v, max) => (typeof v === 'string' && v.trim() ? v.replace(/[<>`]/g, '').trim().slice(0, max) : null)

export function validate(raw, allowedCodes) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const out = {}
  const kode = clean(r.gerningskode, 10)
  if (kode && allowedCodes.includes(kode)) out.gerningskode = kode
  for (const k of ['tidFra', 'tidTil']) {
    const v = clean(r[k], 16)
    if (v && DATE.test(v)) out[k] = v
  }
  const pn = clean(r.postnr, 4)
  if (pn && /^\d{4}$/.test(pn)) out.postnr = pn
  for (const [k, max] of [['adresse', 80], ['by', 40], ['vaerdi', 30]]) {
    const v = clean(r[k], max)
    if (v) out[k] = v
  }
  const resume = clean(r.resume, 600)
  if (resume) out.resume = resume
  out.mangler = (Array.isArray(r.mangler) ? r.mangler : [])
    .map((m) => clean(m, 160))
    .filter(Boolean)
    .slice(0, 6)
  return out
}

// Outbound allow-list for everything the server fetches.
export function lockEgress(extraHosts = []) {
  const original = globalThis.fetch
  globalThis.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    const host = url.hostname
    const ok = host === 'corti.app' || host.endsWith('.corti.app') || host.endsWith('.corti.ai') || extraHosts.includes(host)
    if (!ok) return Promise.reject(new Error(`Blokeret udgående kald til ${host}`))
    return original(input, init)
  }
}

export function audit(root, entry) {
  try {
    const dir = path.join(root, 'logs')
    fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(path.join(dir, 'audit.log'), JSON.stringify({ t: new Date().toISOString(), ...entry }) + '\n')
  } catch (e) {
    console.error('[audit] kunne ikke skrive log:', e.message)
  }
}
