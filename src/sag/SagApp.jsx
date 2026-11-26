import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { SAGER, GERNINGSKODER, STATUS } from './caseData'
import { ENGINES, startTranscription, browserSupported } from './speech'
import { extractFields } from './ai'

const FELTER = [
  { key: 'gerningskode', label: 'Gerningskode' },
  { key: 'tidFra', label: 'Gerningstid fra' },
  { key: 'tidTil', label: 'Gerningstid til' },
  { key: 'adresse', label: 'Adresse' },
  { key: 'postnr', label: 'Postnr.' },
  { key: 'by', label: 'By' },
  { key: 'vaerdi', label: 'Værdi' },
]

const kodeTekst = (k) => GERNINGSKODER.find((g) => g.kode === k)?.tekst

function now() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function SagApp() {
  const [sager, setSager] = useState(SAGER)
  const [aktivId, setAktivId] = useState(SAGER[0].id)
  const [filter, setFilter] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [engine, setEngine] = useState(browserSupported() ? 'browser' : 'openai')
  const [mode, setMode] = useState('afhoering') // 'afhoering' | 'diktat'
  const [recording, setRecording] = useState(false)
  const [partial, setPartial] = useState('')
  const [transcript, setTranscript] = useState([])
  const [forslag, setForslag] = useState(null)
  const [busy, setBusy] = useState(false)
  const [fejl, setFejl] = useState('')
  const [palette, setPalette] = useState(false)
  const stopRef = useRef(null)
  const modeRef = useRef(mode)
  modeRef.current = mode

  const sag = sager.find((s) => s.id === aktivId)
  const update = useCallback(
    (patch) => setSager((all) => all.map((s) => (s.id === aktivId ? { ...s, ...patch } : s))),
    [aktivId]
  )

  // Keyboard: Ctrl/Cmd+K palette, Ctrl/Cmd+D dictate toggle.
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setPalette((p) => !p) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') { e.preventDefault(); toggleRec() }
      if (e.key === 'Escape') setPalette(false)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const onFinal = useCallback(
    (text) => {
      if (modeRef.current === 'diktat') {
        setSager((all) =>
          all.map((s) => (s.id === aktivId ? { ...s, resume: (s.resume ? s.resume + ' ' : '') + text } : s))
        )
      }
      setTranscript((t) => [...t, { tid: now(), tekst: text }])
    },
    [aktivId]
  )

  async function toggleRec() {
    if (recording) {
      stopRef.current?.()
      stopRef.current = null
      setRecording(false)
      return
    }
    setFejl('')
    try {
      stopRef.current = await startTranscription(engine, {
        apiKey,
        onPartial: setPartial,
        onFinal,
        onError: (e) => setFejl(e.message),
      })
      setRecording(true)
    } catch (e) {
      setFejl(e.message)
    }
  }

  useEffect(() => () => stopRef.current?.(), [])

  async function analyser() {
    const tekst = [sag.resume, ...transcript.map((t) => t.tekst)].join('\n')
    if (!tekst.trim()) return
    setBusy(true)
    setFejl('')
    try {
      setForslag(await extractFields(tekst, apiKey))
    } catch (e) {
      setFejl(e.message)
    } finally {
      setBusy(false)
    }
  }

  function godkend(key) {
    update({ [key]: forslag[key] })
    setForslag((f) => ({ ...f, [key]: undefined }))
  }

  function godkendAlle() {
    const patch = {}
    FELTER.forEach(({ key }) => forslag?.[key] && (patch[key] = forslag[key]))
    if (forslag?.resume) patch.resume = forslag.resume
    update(patch)
    setForslag((f) => ({ mangler: f.mangler }))
  }

  function gemAfhoering() {
    if (!transcript.length) return
    const tekst = transcript.map((t) => t.tekst).join(' ')
    update({ tidslinje: [...sag.tidslinje, { tid: now(), type: 'Afhøring', tekst, ai: true }] })
    setTranscript([])
  }

  function tilfoejOpgave(tekst) {
    update({ opgaver: [...sag.opgaver, { tekst, frist: 'Ny', done: false }] })
  }

  const synlige = sager.filter(
    (s) => !filter || (s.titel + s.id).toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="sag-app">
      <header className="topbar">
        <div className="brand">
          <img src="/leafy.gif" alt="" width="28" height="28" />
          <span>Sagsarbejdsplads</span>
          <span className="pill muted">Prototype · lag over PolSas</span>
        </div>
        <button className="search-btn" onClick={() => setPalette(true)}>
          Søg sag, person, kode… <kbd>⌘K</kbd>
        </button>
        <div className="key-box">
          <input
            type="password"
            placeholder="OpenAI-nøgle (som Leafy)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            title="Holdes kun i hukommelsen, gemmes aldrig"
          />
          <span className={'dot ' + (apiKey ? 'on' : '')} />
        </div>
      </header>

      <div className="cols">
        {/* ── Venstre: sager ─────────────────────── */}
        <aside className="col-left">
          <input className="filter" placeholder="Filtrér mine sager" value={filter} onChange={(e) => setFilter(e.target.value)} />
          {synlige.map((s) => (
            <button key={s.id} className={'case-card ' + (s.id === aktivId ? 'active' : '')} onClick={() => { setAktivId(s.id); setForslag(null); setTranscript([]) }}>
              <div className="row">
                <span className={'prio ' + s.prioritet} />
                <strong>{s.titel}</strong>
              </div>
              <div className="meta">{s.id}</div>
              <div className="row gap">
                <span className="pill">{s.status}</span>
                <span className="meta">{s.frist}</span>
              </div>
            </button>
          ))}

          <h4>Opgaver i dag</h4>
          {sager.flatMap((s) => s.opgaver.filter((o) => !o.done).map((o, i) => (
            <div key={s.id + i} className="todo">
              <div>{o.tekst}</div>
              <div className="meta">{s.titel} · <span className={/Slettes/.test(o.frist) ? 'warn' : ''}>{o.frist}</span></div>
            </div>
          )))}
        </aside>

        {/* ── Midte: sagen ───────────────────────── */}
        <main className="col-mid">
          <div className="case-head">
            <div>
              <div className="meta">J.nr. {sag.id}</div>
              <h1>{sag.titel}</h1>
            </div>
            <select value={sag.status} onChange={(e) => update({ status: e.target.value })}>
              {STATUS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="steps">
            {STATUS.map((s, i) => (
              <div key={s} className={'step ' + (STATUS.indexOf(sag.status) >= i ? 'done' : '')}>{s}</div>
            ))}
          </div>

          <section className="card">
            <h3>Anmeldelse</h3>
            <div className="grid">
              <Field label="Gerningskode">
                <select value={sag.gerningskode} onChange={(e) => update({ gerningskode: e.target.value })}>
                  {GERNINGSKODER.map((g) => <option key={g.kode} value={g.kode}>{g.tekst} ({g.kode})</option>)}
                </select>
              </Field>
              <Field label="Værdi"><input value={sag.vaerdi} onChange={(e) => update({ vaerdi: e.target.value })} /></Field>
              <Field label="Gerningstid fra"><input value={sag.tidFra} onChange={(e) => update({ tidFra: e.target.value })} /></Field>
              <Field label="Til"><input value={sag.tidTil} onChange={(e) => update({ tidTil: e.target.value })} /></Field>
              <Field label="Adresse" wide><input value={sag.adresse} onChange={(e) => update({ adresse: e.target.value })} /></Field>
              <Field label="Postnr."><input value={sag.postnr} onChange={(e) => update({ postnr: e.target.value })} /></Field>
              <Field label="By"><input value={sag.by} onChange={(e) => update({ by: e.target.value })} /></Field>
            </div>
            <Field label={<>Resumé {mode === 'diktat' && recording && <span className="pill live">diktat aktiv</span>}</>} wide>
              <textarea rows={4} value={sag.resume} onChange={(e) => update({ resume: e.target.value })} />
            </Field>
          </section>

          <section className="card">
            <h3>Tidslinje</h3>
            <ol className="timeline">
              {sag.tidslinje.map((t, i) => (
                <li key={i}>
                  <div className="meta">{t.tid} · <strong>{t.type}</strong> {t.ai && <span className="pill ai">transskriberet</span>}</div>
                  <div>{t.tekst}</div>
                </li>
              ))}
            </ol>
          </section>

          <section className="card">
            <h3>Opgaver</h3>
            {sag.opgaver.map((o, i) => (
              <label key={i} className="check">
                <input type="checkbox" checked={o.done} onChange={() => update({ opgaver: sag.opgaver.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })} />
                <span className={o.done ? 'strike' : ''}>{o.tekst}</span>
                <span className="meta">{o.frist}</span>
              </label>
            ))}
          </section>
        </main>

        {/* ── Højre: assistent ───────────────────── */}
        <aside className="col-right">
          <div className="card">
            <h3>Tale</h3>
            <div className="seg">
              <button className={mode === 'afhoering' ? 'on' : ''} onClick={() => setMode('afhoering')}>Afhøring</button>
              <button className={mode === 'diktat' ? 'on' : ''} onClick={() => setMode('diktat')}>Diktat → resumé</button>
            </div>
            <select value={engine} onChange={(e) => setEngine(e.target.value)} disabled={recording}>
              {Object.entries(ENGINES).map(([k, v]) => (
                <option key={k} value={k} disabled={v.disabled}>{v.label}</option>
              ))}
            </select>
            <button className={'rec ' + (recording ? 'on' : '')} onClick={toggleRec}>
              {recording ? '■ Stop' : '● Start'} <kbd>⌘D</kbd>
            </button>
            <div className="transcript">
              {transcript.length === 0 && !partial && <div className="meta">Transskription vises her live.</div>}
              {transcript.map((t, i) => (
                <p key={i}><span className="meta">{t.tid.slice(-5)}</span> {t.tekst}</p>
              ))}
              {partial && <p className="partial">{partial}</p>}
            </div>
            {mode === 'afhoering' && (
              <button className="ghost" disabled={!transcript.length} onClick={gemAfhoering}>Gem som afhøring i tidslinjen</button>
            )}
          </div>

          <div className="card">
            <h3>Leafy-assistent</h3>
            <button className="primary" disabled={busy} onClick={analyser}>
              {busy ? 'Analyserer…' : 'Foreslå felter ud fra tekst'}
            </button>
            {fejl && <div className="error">{fejl}</div>}
            {forslag && (
              <div className="suggest">
                {forslag._offline && <div className="meta">Offline-forslag (ingen nøgle). Tilføj nøgle for AI.</div>}
                {FELTER.filter(({ key }) => forslag[key] && forslag[key] !== sag[key]).map(({ key, label }) => (
                  <div key={key} className="sug-row">
                    <div>
                      <div className="meta">{label}</div>
                      <div>{key === 'gerningskode' ? `${kodeTekst(forslag[key]) || ''} (${forslag[key]})` : forslag[key]}</div>
                    </div>
                    <button onClick={() => godkend(key)}>✓</button>
                  </div>
                ))}
                {forslag.resume && forslag.resume !== sag.resume && (
                  <div className="sug-row">
                    <div><div className="meta">Resumé</div><div>{forslag.resume}</div></div>
                    <button onClick={() => godkend('resume')}>✓</button>
                  </div>
                )}
                <button className="ghost" onClick={godkendAlle}>Godkend alle</button>
                {forslag.mangler?.length > 0 && (
                  <>
                    <div className="meta" style={{ marginTop: 12 }}>Mangler / næste skridt</div>
                    {forslag.mangler.map((m, i) => (
                      <div key={i} className="sug-row">
                        <div>{m}</div>
                        <button title="Opret opgave" onClick={() => tilfoejOpgave(m)}>+</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
            <p className="meta small">AI foreslår, efterforskeren godkender. Alle forslag logges med kilde.</p>
          </div>

          <div className="card">
            <h3>Eksport til PolSas</h3>
            <pre className="export">{polsasExport(sag)}</pre>
            <button className="ghost" onClick={() => navigator.clipboard?.writeText(polsasExport(sag))}>Kopiér felter</button>
          </div>
        </aside>
      </div>

      {palette && <Palette sager={sager} onPick={(id) => { setAktivId(id); setPalette(false) }} onClose={() => setPalette(false)} />}
    </div>
  )
}

function Field({ label, wide, children }) {
  return (
    <label className={'field ' + (wide ? 'wide' : '')}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function polsasExport(s) {
  return [
    `J.nr.........: ${s.id}`,
    `Gerningskode.: ${s.gerningskode}`,
    `Fra dato/kl..: ${s.tidFra}`,
    `..til........: ${s.tidTil}`,
    `Vej/Adr......: ${s.adresse}`,
    `Postnr./By...: ${s.postnr} ${s.by}`,
    `Værdi........: ${s.vaerdi}`,
    `RESUME.......: ${s.resume}`,
  ].join('\n')
}

function Palette({ sager, onPick, onClose }) {
  const [q, setQ] = useState('')
  const hits = useMemo(() => {
    const ql = q.toLowerCase()
    return [
      ...sager.filter((s) => (s.titel + s.id + s.adresse).toLowerCase().includes(ql)).map((s) => ({ id: s.id, label: s.titel, sub: s.id })),
      ...GERNINGSKODER.filter((g) => q && (g.tekst + g.kode).toLowerCase().includes(ql)).map((g) => ({ label: `${g.tekst}`, sub: `Gerningskode ${g.kode}` })),
    ]
  }, [q, sager])
  return (
    <div className="overlay" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input autoFocus placeholder="Søg sag, adresse eller gerningskode…" value={q} onChange={(e) => setQ(e.target.value)} />
        {hits.map((h, i) => (
          <button key={i} onClick={() => h.id && onPick(h.id)}>
            <div>{h.label}</div><div className="meta">{h.sub}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
