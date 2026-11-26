import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { SAGER, GERNINGSKODER, STATUS } from './caseData'
import { cortiStatus, startCorti, startBrowser, assist, getSettings, saveSettings, testSettings } from './corti'

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

export const THEMES = [
  { id: 'nat', navn: 'Nat', farver: ['#0f2a4e', '#3b7be6'] },
  { id: 'skov', navn: 'Skov', farver: ['#e9e4d8', '#4f7f5d'] },
  { id: 'fjord', navn: 'Fjord', farver: ['#0f3033', '#2fa39a'] },
  { id: 'sten', navn: 'Sten', farver: ['#e4e7ea', '#34506f'] },
  { id: 'sand', navn: 'Sand', farver: ['#f1e7d8', '#b5643c'] },
]

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('sag-theme') || 'nat' } catch { return 'nat' }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('sag-theme', theme) } catch { /* private mode */ }
  }, [theme])
  return [theme, setTheme]
}

function now() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function SagApp() {
  const [sager, setSager] = useState(SAGER)
  const [aktivId, setAktivId] = useState(SAGER[0].id)
  const [filter, setFilter] = useState('')
  const [status, setStatus] = useState({ corti: false, loading: true })
  const [mode, setMode] = useState('afhoering')
  const [recording, setRecording] = useState(false)
  const [partial, setPartial] = useState('')
  const [transcript, setTranscript] = useState([])
  const [forslag, setForslag] = useState(null)
  const [busy, setBusy] = useState(false)
  const [fejl, setFejl] = useState('')
  const [palette, setPalette] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useTheme()
  const stopRef = useRef(null)
  const modeRef = useRef(mode)
  modeRef.current = mode

  const refreshStatus = useCallback(() => cortiStatus().then(setStatus), [])
  useEffect(() => { refreshStatus() }, [refreshStatus])

  const sag = sager.find((s) => s.id === aktivId)
  const update = useCallback(
    (patch) => setSager((all) => all.map((s) => (s.id === aktivId ? { ...s, ...patch } : s))),
    [aktivId]
  )

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setPalette((p) => !p) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') { e.preventDefault(); toggleRec() }
      if (e.key === 'Escape') { setPalette(false); setSettingsOpen(false) }
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

  const onCommand = useCallback(
    (id) => {
      setSager((all) =>
        all.map((s) => {
          if (s.id !== aktivId) return s
          if (id === 'ny_linje') return { ...s, resume: s.resume + '\n' }
          if (id === 'nyt_afsnit') return { ...s, resume: s.resume + '\n\n' }
          if (id === 'slet_sidste') return { ...s, resume: s.resume.replace(/\s*[^.!?\n]*[.!?]?\s*$/, '') }
          return s
        })
      )
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
      const opts = {
        mode,
        onPartial: setPartial,
        onFinal,
        onCommand,
        onError: (e) => setFejl(e.message),
        onState: (st) => st === 'stopped' && setRecording(false),
      }
      setRecording(true)
      stopRef.current = status.corti ? await startCorti(opts) : startBrowser(opts)
    } catch (e) {
      setRecording(false)
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
      setForslag(await assist(tekst, status.corti))
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

  const synlige = sager.filter((s) => !filter || (s.titel + s.id).toLowerCase().includes(filter.toLowerCase()))
  const forslagFelter = forslag ? FELTER.filter(({ key }) => forslag[key] && forslag[key] !== sag[key]) : []

  return (
    <div className="app">
      <Backdrop />

      <header className="topbar glass">
        <div className="brand">
          <img className="logo" src="/logo.png" alt="Politi" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          <div>
            <div className="brand-name">Sagsarbejdsplads</div>
            <div className="brand-sub">Prototype · ikke et officielt system</div>
          </div>
        </div>
        <button className="search" onClick={() => setPalette(true)}>
          <Icon name="search" />
          <span>Søg sag, adresse eller gerningskode</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className="themes" role="radiogroup" aria-label="Farvetema">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={'swatch ' + (theme === t.id ? 'on' : '')}
              title={t.navn}
              aria-label={t.navn}
              onClick={() => setTheme(t.id)}
              style={{ background: `linear-gradient(135deg, ${t.farver[0]} 50%, ${t.farver[1]} 50%)` }}
            />
          ))}
        </div>
        <button className={'conn ' + (status.corti ? 'on' : '')} onClick={() => setSettingsOpen(true)}>
          <span className="conn-dot" />
          {status.loading ? 'Forbinder…' : status.corti ? 'Corti forbundet' : 'Forbind Corti'}
          <Icon name="settings" />
        </button>
      </header>

      <div className="cols">
        {/* ── Sager ── */}
        <aside className="col scroll">
          <div className="field-search">
            <Icon name="filter" />
            <input placeholder="Mine sager" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          {synlige.map((s) => (
            <button
              key={s.id}
              className={'case glass ' + (s.id === aktivId ? 'active' : '')}
              onClick={() => { setAktivId(s.id); setForslag(null); setTranscript([]) }}
            >
              <div className="case-top">
                <span className={'prio ' + s.prioritet} />
                <span className="case-due">{s.frist}</span>
              </div>
              <div className="case-title">{s.titel}</div>
              <div className="case-meta">{s.status}</div>
            </button>
          ))}

          <div className="label">I dag</div>
          {sager.flatMap((s) =>
            s.opgaver.filter((o) => !o.done).map((o, i) => (
              <div key={s.id + i} className="todo">
                <span className={'todo-dot ' + (/Slettes/.test(o.frist) ? 'warn' : '')} />
                <div>
                  <div>{o.tekst}</div>
                  <div className={'muted ' + (/Slettes/.test(o.frist) ? 'warn' : '')}>{o.frist}</div>
                </div>
              </div>
            ))
          )}
        </aside>

        {/* ── Sagen ── */}
        <main className="col scroll mid">
          <section className="hero glass">
            <div className="hero-top">
              <span className="muted mono">J.nr. {sag.id}</span>
              <select className="status-select" value={sag.status} onChange={(e) => update({ status: e.target.value })}>
                {STATUS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <h1>{sag.titel}</h1>
            <div className="progress">
              {STATUS.map((s, i) => (
                <div key={s} className={'pstep ' + (STATUS.indexOf(sag.status) >= i ? 'done' : '')}>
                  <span />
                  <em>{s}</em>
                </div>
              ))}
            </div>
          </section>

          <section className="panel glass">
            <h2>Anmeldelse</h2>
            <div className="grid">
              <Field label="Gerningskode" wide>
                <select value={sag.gerningskode} onChange={(e) => update({ gerningskode: e.target.value })}>
                  {GERNINGSKODER.map((g) => <option key={g.kode} value={g.kode}>{g.tekst} · {g.kode}</option>)}
                </select>
              </Field>
              <Field label="Gerningstid fra"><input value={sag.tidFra} onChange={(e) => update({ tidFra: e.target.value })} /></Field>
              <Field label="Til"><input value={sag.tidTil} onChange={(e) => update({ tidTil: e.target.value })} /></Field>
              <Field label="Adresse" wide><input value={sag.adresse} onChange={(e) => update({ adresse: e.target.value })} /></Field>
              <Field label="Postnr."><input value={sag.postnr} onChange={(e) => update({ postnr: e.target.value })} /></Field>
              <Field label="By"><input value={sag.by} onChange={(e) => update({ by: e.target.value })} /></Field>
              <Field label="Værdi"><input value={sag.vaerdi} onChange={(e) => update({ vaerdi: e.target.value })} /></Field>
              <Field
                wide
                label={<>Resumé {mode === 'diktat' && recording && <span className="chip live">diktat</span>}</>}
              >
                <textarea rows={4} value={sag.resume} onChange={(e) => update({ resume: e.target.value })} />
              </Field>
            </div>
          </section>

          <div className="two">
            <section className="panel glass">
              <h2>Tidslinje</h2>
              <ol className="timeline">
                {sag.tidslinje.map((t, i) => (
                  <li key={i}>
                    <div className="muted">{t.tid} · <b>{t.type}</b> {t.ai && <span className="chip ai">Corti</span>}</div>
                    <div>{t.tekst}</div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="panel glass">
              <h2>Opgaver</h2>
              {sag.opgaver.map((o, i) => (
                <label key={i} className="task">
                  <input
                    type="checkbox"
                    checked={o.done}
                    onChange={() => update({ opgaver: sag.opgaver.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}
                  />
                  <span className="tick" />
                  <span className={o.done ? 'strike' : ''}>{o.tekst}</span>
                  <span className="muted right">{o.frist}</span>
                </label>
              ))}
            </section>
          </div>
        </main>

        {/* ── Assistent ── */}
        <aside className="col scroll">
          <section className="panel glass voice">
            <div className="seg">
              <button className={mode === 'afhoering' ? 'on' : ''} onClick={() => !recording && setMode('afhoering')}>Afhøring</button>
              <button className={mode === 'diktat' ? 'on' : ''} onClick={() => !recording && setMode('diktat')}>Diktat</button>
            </div>

            <button className={'orb ' + (recording ? 'rec' : '')} onClick={toggleRec} aria-label={recording ? 'Stop' : 'Start'}>
              <span className="orb-blob b1" />
              <span className="orb-blob b2" />
              <span className="orb-core"><Icon name={recording ? 'stop' : 'mic'} /></span>
            </button>
            <div className="orb-label">
              {recording ? (mode === 'diktat' ? 'Dikterer til resumé' : 'Transskriberer afhøring') : 'Tryk for at tale'}
              <span className="muted"> · Ctrl D</span>
            </div>
            <div className="muted center small">
              {status.corti ? 'Corti live-transskription' : 'Demo: browserens talegenkendelse'}
              {mode === 'diktat' && status.corti && <><br />"punktum" · "ny linje" · "slet det sidste" · "stop diktat"</>}
            </div>

            {(transcript.length > 0 || partial) && (
              <div className="transcript scroll">
                {transcript.map((t, i) => (
                  <p key={i}><span className="muted mono">{t.tid.slice(-5)}</span> {t.tekst}</p>
                ))}
                {partial && <p className="partial">{partial}</p>}
              </div>
            )}
            {mode === 'afhoering' && transcript.length > 0 && (
              <button className="btn soft" onClick={gemAfhoering}>Gem i tidslinjen</button>
            )}
          </section>

          <section className="panel glass">
            <h2>Assistent {status.corti && <span className="chip ai">Corti</span>}</h2>
            <button className="btn primary" disabled={busy} onClick={analyser}>
              <Icon name="spark" /> {busy ? 'Læser sagen…' : 'Foreslå felter og næste skridt'}
            </button>
            {fejl && <div className="error">{fejl}</div>}
            {forslag && (
              <div className="suggest">
                {forslag._offline && <div className="muted small">Demo-forslag uden AI – forbind Corti for rigtige forslag.</div>}
                {forslagFelter.map(({ key, label }) => (
                  <div key={key} className="sug">
                    <div>
                      <div className="muted small">{label}</div>
                      <div>{key === 'gerningskode' ? `${kodeTekst(forslag[key]) || ''} · ${forslag[key]}` : forslag[key]}</div>
                    </div>
                    <button className="icon-btn" onClick={() => godkend(key)} title="Godkend"><Icon name="check" /></button>
                  </div>
                ))}
                {forslag.resume && forslag.resume !== sag.resume && (
                  <div className="sug">
                    <div><div className="muted small">Resumé</div><div>{forslag.resume}</div></div>
                    <button className="icon-btn" onClick={() => godkend('resume')} title="Godkend"><Icon name="check" /></button>
                  </div>
                )}
                {(forslagFelter.length > 0 || forslag.resume) && <button className="btn soft" onClick={godkendAlle}>Godkend alle</button>}
                {forslag.mangler?.length > 0 && (
                  <>
                    <div className="label">Næste skridt</div>
                    {forslag.mangler.map((m, i) => (
                      <div key={i} className="sug next">
                        <div>{m}</div>
                        <button className="icon-btn" title="Opret opgave" onClick={() => update({ opgaver: [...sag.opgaver, { tekst: m, frist: 'Ny', done: false }] })}><Icon name="plus" /></button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
            <p className="muted small">AI foreslår – efterforskeren godkender.</p>
          </section>

          <section className="panel glass">
            <h2>Til PolSas</h2>
            <pre className="export">{polsasExport(sag)}</pre>
            <button className="btn soft" onClick={() => navigator.clipboard?.writeText(polsasExport(sag))}>Kopiér felter</button>
          </section>
        </aside>
      </div>

      {palette && <Palette sager={sager} onPick={(id) => { setAktivId(id); setPalette(false) }} onClose={() => setPalette(false)} />}
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} onSaved={refreshStatus} />}
    </div>
  )
}

/* ── Corti settings ─────────────────────────────── */
function Settings({ onClose, onSaved }) {
  const [form, setForm] = useState(null)
  const [secret, setSecret] = useState('')
  const [msg, setMsg] = useState(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    getSettings()
      .then(setForm)
      .catch((e) => setMsg({ error: 'Serveren svarer ikke: ' + e.message }))
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(andTest) {
    setWorking(true)
    setMsg(null)
    try {
      const saved = await saveSettings({ ...form, clientSecret: secret })
      setForm(saved)
      setSecret('')
      await onSaved()
      if (andTest) {
        const t = await testSettings()
        setMsg({ steps: t.steps })
      } else setMsg({ steps: ['Gemt'] })
    } catch (e) {
      setMsg({ error: e.message })
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet glass" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Corti-forbindelse</h2>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <p className="muted small">
          Nøglerne gemmes i <code>sagsapp/.env</code> på din egen maskine. Hemmeligheden sendes aldrig tilbage til browseren.
        </p>
        {!form ? (
          <div className="muted">{msg?.error || 'Henter…'}</div>
        ) : (
          <div className="grid">
            <Field label="Miljø">
              <select value={form.environment} onChange={set('environment')}>
                <option value="eu">EU</option>
                <option value="us">US</option>
              </select>
            </Field>
            <Field label="Sprog"><input value={form.language} onChange={set('language')} placeholder="da" /></Field>
            <Field label="Tenant" wide><input value={form.tenantName} onChange={set('tenantName')} placeholder="fx base" /></Field>
            <Field label="Client ID" wide><input value={form.clientId} onChange={set('clientId')} autoComplete="off" /></Field>
            <Field label="Client secret" wide>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={form.hasSecret ? '•••••••• gemt – udfyld kun for at ændre' : 'Indsæt secret'}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Agent-ID (valgfri – oprettes automatisk)" wide>
              <input value={form.agentId} onChange={set('agentId')} />
            </Field>
          </div>
        )}
        {msg?.error && <div className="error">{msg.error}</div>}
        {msg?.steps && (
          <ul className="steps-ok">
            {msg.steps.map((s, i) => <li key={i}><Icon name="check" /> {s}</li>)}
          </ul>
        )}
        <div className="sheet-actions">
          <button className="btn soft" disabled={!form || working} onClick={() => save(false)}>Gem</button>
          <button className="btn primary" disabled={!form || working} onClick={() => save(true)}>
            {working ? 'Tester…' : 'Gem og test forbindelse'}
          </button>
        </div>
      </div>
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
      ...GERNINGSKODER.filter((g) => q && (g.tekst + g.kode).toLowerCase().includes(ql)).map((g) => ({ label: g.tekst, sub: `Gerningskode ${g.kode}` })),
    ]
  }, [q, sager])
  return (
    <div className="overlay" onClick={onClose}>
      <div className="palette glass" onClick={(e) => e.stopPropagation()}>
        <div className="field-search big">
          <Icon name="search" />
          <input autoFocus placeholder="Søg sag, adresse eller gerningskode…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="scroll palette-list">
          {hits.map((h, i) => (
            <button key={i} onClick={() => h.id && onPick(h.id)}>
              <div>{h.label}</div><div className="muted small">{h.sub}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* Layered daylight, organic shapes and film grain. Drop a photo in public/bg.jpg to use it underneath. */
function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <div className="bg-photo" />
      <div className="bg-light" />
      <div className="stripes" />
      <span className="blob a" />
      <span className="blob b" />
      <span className="blob c" />
      <svg className="grain" width="100%" height="100%">
        <filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch" /><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0" /></filter>
        <rect width="100%" height="100%" filter="url(#n)" />
      </svg>
    </div>
  )
}

const PATHS = {
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm9 16-4.3-4.3',
  filter: 'M4 6h16M7 12h10M10 18h4',
  settings: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  stop: 'M7 7h10v10H7z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z',
}
function Icon({ name }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  )
}
