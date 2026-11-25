'use client';
import LeafyServerNotes from './LeafyServerNotes';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Download, FileUp, Plus, Trash2, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EMPTY_LEAFY_CORE, LEAFY_CORE_KEY, normalizeLeafyCore, readLeafyCore, type LeafyCore } from '@/lib/livi/core';

function saveCore(value: LeafyCore) { localStorage.setItem(LEAFY_CORE_KEY, JSON.stringify(value)); window.dispatchEvent(new Event('leafy-core-updated')); }
export default function LeafyCoreSettings() {
  const [core, setCore] = useState<LeafyCore>(EMPTY_LEAFY_CORE);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { queueMicrotask(() => setCore(readLeafyCore())); }, []);
  function update(next: LeafyCore) { setCore(next); try { saveCore(next); setError(''); } catch { setError('Leafys kerne kunne ikke gemmes i denne browser.'); } }
  function addNote() { const value = note.trim(); if (!value) return; if (value.length > 240) { setError('En huskenote må højst være 240 tegn.'); return; } if (core.profileNotes.length >= 20) { setError('Leafy kan gemme op til 20 huskenoter.'); return; } update({ ...core, profileNotes: [...core.profileNotes, value] }); setNote(''); setMessage('Leafy har fået en ny huskenote.'); }
  function exportCore() { const blob = new Blob([JSON.stringify(core, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'leafy-core.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  async function importCore(selected?: File) { if (!selected) return; setError(''); try { if (selected.size > 500000) throw Error('Filen må højst være 500 KB.'); const parsed = JSON.parse(await selected.text()); if (parsed?.format !== 'leafy-core' || parsed?.version !== 1 || !Array.isArray(parsed.profileNotes) || !Array.isArray(parsed.skills)) throw Error('Det er ikke en understøttet Leafy Core-fil.'); const next = normalizeLeafyCore(parsed); if (next.profileNotes.length !== parsed.profileNotes.length || next.skills.length !== parsed.skills.length) throw Error('Filen indeholder for mange eller ugyldige noter eller skills.'); update(next); setMessage(`Leafy Core indlæst med ${next.profileNotes.length} huskenoter og ${next.skills.length} personlige skills.`); } catch (e) { setError((e as Error).message || 'Filen kunne ikke indlæses.'); } finally { if (file.current) file.current.value = ''; } }
  return <section className="leafy-core-settings" aria-label="Leafys fælles kerne">
    <div className="leafy-core-heading"><div><h3>Leafys fælles kerne</h3><p>Samme Leafy på tværs af rum, spil, hjemmeside og andre apps.</p></div><div className="leafy-core-actions"><Button type="button" variant="outline" size="sm" onClick={exportCore}><Download size={14}/>Eksportér</Button><Button type="button" variant="outline" size="sm" onClick={() => file.current?.click()}><FileUp size={14}/>Importér</Button><input ref={file} hidden type="file" accept="application/json,.json" onChange={e => void importCore(e.target.files?.[0])}/></div></div>
    <p className="leafy-core-explainer">Her kan du lære Leafy dine præferencer og gemme genbrugelige kompetencer. Kernen gemmes lokalt i denne browser. Eksportér den som <strong>leafy-core.json</strong>, og importér den i en anden Leafy-app.</p>
    <div className="leafy-core-list"><h4>Kompetencekort</h4><p className="leafy-core-empty">Alle personlige skills og de låste WL Master Skills ligger samlet i kortbiblioteket. Her kan du oprette kort, vælge kompetencer og sammensætte workflows.</p><Button type="button" variant="secondary" size="sm" onClick={() => window.dispatchEvent(new Event('leafy-open-skills'))}><Workflow size={15}/>Åbn Skill Cards<ArrowRight size={15}/></Button></div>
    <div className="leafy-core-list"><h4>Det Leafy skal huske om brugeren</h4>{core.profileNotes.length ? core.profileNotes.map((item, index) => <div className="leafy-core-item" key={`${index}-${item}`}><span>{item}</span><Button type="button" variant="ghost" size="icon-sm" aria-label="Fjern huskenote" onClick={() => update({ ...core, profileNotes: core.profileNotes.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={14}/></Button></div>) : <p className="leafy-core-empty">Ingen noter endnu. Tilføj kun det, Leafy skal bruge for at hjælpe dig bedre.</p>}<div className="leafy-core-entry"><Input aria-label="Ny huskenote" value={note} maxLength={240} onChange={e => setNote(e.target.value)} placeholder="Fx: Foretrækker korte svar og konkrete næste skridt"/><Button type="button" variant="secondary" size="sm" disabled={!note.trim()} onClick={addNote}><Plus size={15}/>Husk</Button></div></div>
    <LeafyServerNotes/>
    {error && <p className="leafy-core-error" role="alert">{error}</p>}{message && <p className="leafy-core-message" role="status">{message}</p>}
  </section>;
}
