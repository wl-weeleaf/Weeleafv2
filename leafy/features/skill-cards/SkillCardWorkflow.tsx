'use client';

import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent, type PointerEvent } from 'react';
import { ArrowDown, Check, CirclePlus, Expand, Hand, LockKeyhole, Maximize, Minimize, Minus, Play, Plus, Redo2, Search, Save, Trash2, Undo2, Workflow, X } from 'lucide-react';
import { LEAFY_CORE_KEY, normalizeLeafyCore, readLeafyCore, type LeafyCore, type LeafySkill } from '@/lib/livi/core';
import { LOCKED_MASTER_SKILLS } from '@/lib/livi/master-skills';
import './skill-cards.css';

type Card = { id: string; name: string; instructions: string; summary: string; category: string; art: number; locked: boolean; alwaysLoaded: boolean; version?: string; status?: string };
type WorkflowNode = { instanceId: string; skillId: string; x: number; y: number };
const WORKFLOW_KEY = 'leafy.skill-cards.workflow.v3';
const columns = [
  { title: 'Fundament', subtitle: 'Forstå og få indsigt', icon: '✦' },
  { title: 'Anvendelse', subtitle: 'Praktiske færdigheder', icon: '⚙' },
  { title: 'Samarbejde', subtitle: 'Sammen skabe værdi', icon: '◉' },
  { title: 'Påvirkning', subtitle: 'Skabe forandring', icon: '◎' },
];
const rows = [
  { title: 'Hamp', subtitle: 'Materialer, dyrkning\nog potentiale', icon: '♣' },
  { title: 'Byggeri', subtitle: 'Design og\nkonstruktion', icon: '⌂' },
  { title: 'Cirkulær økonomi', subtitle: 'Ressourcer i kredsløb', icon: '↻' },
  { title: 'Formidling', subtitle: 'Viden og engagement', icon: '◉' },
];
const categoryFor = (id: string, name: string) => {
  const value = `${id} ${name}`.toLowerCase();
  if (/governance|vedtægt/.test(value)) return ['WL · Styring', 0] as const;
  if (/leafy-core/.test(value)) return ['Leafy · Grundlag', 1] as const;
  if (/wl-knowledge|wl knowledge/.test(value)) return ['WL · Viden', 2] as const;
  if (/hive|life/.test(value)) return ['Hive · Systemer', 3] as const;
  if (/hemp|hamp/.test(value)) return ['Materialer · Hamp', 4] as const;
  if (/circular|cirkul/.test(value)) return ['Systemer · Cirkulært', 5] as const;
  if (/learning|læring/.test(value)) return ['Læring · Formidling', 6] as const;
  if (/local-ai|data/.test(value)) return ['Teknologi · Data', 7] as const;
  if (/community|fællesskab/.test(value)) return ['Fællesskab', 8] as const;
  if (/skill-governance/.test(value)) return ['WL · Kompetencer', 9] as const;
  return ['Personlig · Egen skill', 9] as const;
};
function defaultPosition(index: number) { const cell = index % 16; return { x: 12.5 + (cell % 4) * 25, y: 12.5 + Math.floor(cell / 4) * 25 }; }
function parseSavedNodes(value: unknown): WorkflowNode[] {
  if (Array.isArray(value) && value.every(item => typeof item === 'object' && item && typeof item.skillId === 'string')) return value.filter(item => typeof item.instanceId === 'string').map(item => ({ instanceId: item.instanceId as string, skillId: item.skillId as string, x: Math.max(5, Math.min(95, Number(item.x) || 50)), y: Math.max(5, Math.min(95, Number(item.y) || 50)) }));
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) return value.map((skillId, index) => ({ instanceId: `legacy-${index}-${skillId}`, skillId, ...defaultPosition(index) }));
  return [];
}
function readSavedNodes(): WorkflowNode[] { if (typeof window === 'undefined') return []; try { const current = JSON.parse(localStorage.getItem(WORKFLOW_KEY) || 'null'); if (current) return parseSavedNodes(current); const old = JSON.parse(localStorage.getItem('leafy.skill-cards.workflow.v2') || '[]'); return parseSavedNodes(old); } catch { return []; } }
function saveCore(core: LeafyCore) { localStorage.setItem(LEAFY_CORE_KEY, JSON.stringify(core)); window.dispatchEvent(new Event('leafy-core-updated')); }
function clamp(value: number, min = 5, max = 95) { return Math.min(max, Math.max(min, value)); }

export default function SkillCardWorkflow({ onUse }: { onUse: (prompt: string) => void }) {
  const [core, setCore] = useState<LeafyCore>(() => readLeafyCore());
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [ready, setReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Alle');
  const [notice, setNotice] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Card | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [preview, setPreview] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [pileOffset, setPileOffset] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const board = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const cardDock = useRef<HTMLElement>(null);
  const cardPile = useRef<HTMLButtonElement>(null);
  const returnCardRef = useRef<(instanceId: string) => void>(() => {});
  const workflowRoot = useRef<HTMLElement>(null);
  const movedDuringDrag = useRef(false);
  const suppressCardClick = useRef(false);
  const dragState = useRef<{ instanceId: string; pointerId: number; startX: number; startY: number; moved: boolean } | null>(null);
  const panState = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const undoStack = useRef<WorkflowNode[][]>([]);
  const redoStack = useRef<WorkflowNode[][]>([]);
  const nodesRef = useRef<WorkflowNode[]>([]);

  useEffect(() => {
    let migratedCore = readLeafyCore();
    let initialNodes = readSavedNodes();
    try {
      const legacy = JSON.parse(localStorage.getItem('leafy.skill-cards.workflow.v1') || '{}') as { cards?: Array<{ id?: string; name?: string; instructions?: string; status?: string }>; workflow?: string[] };
      const savedPersonal = (legacy.cards || []).filter(card => card.status === 'draft' && typeof card.name === 'string' && typeof card.instructions === 'string' && !migratedCore.skills.some(skill => skill.name === card.name));
      if (savedPersonal.length) { migratedCore = normalizeLeafyCore({ ...migratedCore, skills: [...migratedCore.skills, ...savedPersonal.map(card => ({ id: `migrated-${card.id || crypto.randomUUID()}`, name: card.name!.slice(0, 80), instructions: card.instructions!.slice(0, 12000) }))] }); saveCore(migratedCore); }
      if (!initialNodes.length && legacy.workflow?.length) {
        const oldIds: Record<string, string> = { research: 'master-02_wl-knowledge', sources: 'master-00_governance', explain: 'master-06_learning' };
        initialNodes = legacy.workflow.map((id, index) => { const skillId = oldIds[id] || id; return { instanceId: `legacy-${index}-${skillId}`, skillId, ...defaultPosition(index) }; });
      }
    } catch { /* ignore incomplete legacy card storage */ }
    const refresh = () => setCore(readLeafyCore());
    window.addEventListener('leafy-core-updated', refresh);
    window.addEventListener('storage', refresh);
    const frame = requestAnimationFrame(() => { setCore(migratedCore); setNodes(initialNodes); setReady(true); });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('leafy-core-updated', refresh); window.removeEventListener('storage', refresh); };
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(WORKFLOW_KEY, JSON.stringify(nodes)); }, [nodes, ready]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => {
    returnCardRef.current = instanceId => {
      const current = nodesRef.current;
      const next = current.filter(node => node.instanceId !== instanceId);
      if (next.length === current.length) return;
      undoStack.current.push(current);
      if (undoStack.current.length > 30) undoStack.current.shift();
      redoStack.current = [];
      nodesRef.current = next;
      setCanUndo(true);
      setCanRedo(false);
      setNodes(next);
    };
  }, []);
  useEffect(() => { const sync = () => setIsFullscreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', sync); return () => document.removeEventListener('fullscreenchange', sync); }, []);
  useEffect(() => {
    const move = (event: globalThis.PointerEvent) => {
      if (panState.current && board.current) { board.current.scrollLeft = panState.current.left - (event.clientX - panState.current.x); board.current.scrollTop = panState.current.top - (event.clientY - panState.current.y); return; }
      if (!dragState.current || !surface.current) return;
      const start = dragState.current;
      if (!start.moved && Math.hypot(event.clientX - start.startX, event.clientY - start.startY) > 4) { start.moved = true; movedDuringDrag.current = true; }
      const rect = surface.current.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / rect.width * 100);
      const y = clamp((event.clientY - rect.top) / rect.height * 100);
      setNodes(current => current.map(node => node.instanceId === dragState.current?.instanceId ? { ...node, x, y } : node));
    };
    const up = (event: globalThis.PointerEvent) => {
      const moving = dragState.current;
      if (moving && moving.moved) {
        const overDock = cardDock.current?.getBoundingClientRect();
        const overPile = cardPile.current?.getBoundingClientRect();
        const inside = (rect?: DOMRect) => !!rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (inside(overDock) || inside(overPile)) returnCardRef.current(moving.instanceId);
      }
      if (movedDuringDrag.current) { suppressCardClick.current = true; window.setTimeout(() => { suppressCardClick.current = false; }, 0); }
      movedDuringDrag.current = false; dragState.current = null; panState.current = null;
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, []);

  const cards = useMemo<Card[]>(() => [
    ...LOCKED_MASTER_SKILLS.map(skill => { const [category, art] = categoryFor(skill.id, skill.name); return { id: skill.id, name: skill.name, instructions: skill.instructions, summary: skill.instructions.replace(/^---[\s\S]*?---\s*/, '').replace(/^#[^\n]*\n+/, '').replace(/\s+/g, ' ').trim().slice(0, 120), category, art, locked: true, alwaysLoaded: skill.alwaysLoaded, version: skill.version, status: skill.status }; }),
    ...core.skills.map((skill: LeafySkill) => { const [category, art] = categoryFor(skill.id, skill.name); return { ...skill, summary: skill.instructions.replace(/\s+/g, ' ').trim().slice(0, 120), category, art, locked: false, alwaysLoaded: false }; }),
  ], [core.skills]);
  const categories = useMemo(() => ['Alle', ...Array.from(new Set(cards.map(card => card.category)))], [cards]);
  const filtered = useMemo(() => cards.filter(card => (filter === 'Alle' || card.category === filter) && `${card.name} ${card.category} ${card.summary}`.toLocaleLowerCase('da').includes(query.toLocaleLowerCase('da'))), [cards, filter, query]);
  const nodesWithCards = useMemo(() => nodes.map(node => ({ node, card: cards.find(card => card.id === node.skillId) })).filter((entry): entry is { node: WorkflowNode; card: Card } => !!entry.card), [nodes, cards]);
  const placedIds = useMemo(() => new Set(nodesWithCards.map(({ card }) => card.id)), [nodesWithCards]);
  const unplacedCards = useMemo(() => cards.filter(card => !placedIds.has(card.id)), [cards, placedIds]);
  const pileCards = useMemo(() => unplacedCards.length ? unplacedCards.map((_, index) => unplacedCards[(index + pileOffset) % unplacedCards.length]) : [], [unplacedCards, pileOffset]);
  const availableCards = useMemo(() => filtered.filter(card => !placedIds.has(card.id)), [filtered, placedIds]);

  function changeNodes(next: WorkflowNode[]) { undoStack.current.push(nodes); if (undoStack.current.length > 30) undoStack.current.shift(); redoStack.current = []; setCanUndo(true); setCanRedo(false); setNodes(next); }
  function addNode(skillId: string, x?: number, y?: number) { if (nodes.some(node => node.skillId === skillId)) return; const position = x === undefined || y === undefined ? defaultPosition(nodes.length) : { x: clamp(x), y: clamp(y) }; changeNodes([...nodes, { instanceId: crypto.randomUUID(), skillId, ...position }]); }
  function removeNode(instanceId: string) { changeNodes(nodes.filter(node => node.instanceId !== instanceId)); }
  function undo() { const previous = undoStack.current.pop(); if (!previous) return; redoStack.current.push(nodes); setCanUndo(undoStack.current.length > 0); setCanRedo(true); setNodes(previous); }
  function redo() { const next = redoStack.current.pop(); if (!next) return; undoStack.current.push(nodes); setCanUndo(true); setCanRedo(redoStack.current.length > 0); setNodes(next); }
  function handleDrop(event: DragEvent) { event.preventDefault(); const skillId = event.dataTransfer.getData('text/skill-card') || dragId; if (!skillId || !surface.current) return; const rect = surface.current.getBoundingClientRect(); addNode(skillId, ((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100); setDragId(null); }
  function startMove(event: PointerEvent<HTMLElement>, instanceId: string) { const target = event.target as HTMLElement; if (panMode || target.closest('.skill-node-remove') || (target.closest('button') && !target.closest('.skill-node-card'))) return; if (!target.closest('.skill-node-card')) event.preventDefault(); movedDuringDrag.current = false; dragState.current = { instanceId, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }
  async function toggleFullscreen() { if (document.fullscreenElement) await document.exitFullscreen(); else await workflowRoot.current?.requestFullscreen?.(); }
  function updateParticlePointer(event: PointerEvent<HTMLDivElement>) { if (!surface.current) return; const rect = surface.current.getBoundingClientRect(); surface.current.style.setProperty('--particle-x', `${event.clientX - rect.left}px`); surface.current.style.setProperty('--particle-y', `${event.clientY - rect.top}px`); surface.current.classList.add('pointer-live'); }
  function startPan(event: PointerEvent<HTMLDivElement>) { if (!panMode || (event.target as HTMLElement).closest('.skill-node')) return; event.preventDefault(); panState.current = { x: event.clientX, y: event.clientY, left: board.current?.scrollLeft || 0, top: board.current?.scrollTop || 0 }; }
  function createCard(event: FormEvent) { event.preventDefault(); const trimmedName = name.trim(), body = instructions.trim(); if (!trimmedName || !body) return; const next = normalizeLeafyCore({ ...core, skills: [...core.skills, { id: `skill-${crypto.randomUUID()}`, name: trimmedName, instructions: body }] }); if (next.skills.length !== core.skills.length + 1) { setNotice('Du har nået grænsen på 20 personlige skills eller 80.000 instruktionstegn.'); return; } saveCore(next); setCore(next); setName(''); setInstructions(''); setCreating(false); setNotice(`“${trimmedName}” er tilføjet til Leafys personlige skills.`); }
  function removePersonal(id: string) { const next = normalizeLeafyCore({ ...core, skills: core.skills.filter(skill => skill.id !== id) }); saveCore(next); setCore(next); changeNodes(nodes.filter(node => node.skillId !== id)); setDetail(null); }
  function useWorkflow() { if (!nodesWithCards.length) { setNotice('Tilføj mindst ét kort til canvas først.'); return; } const sequence = nodesWithCards.map(({ card }, index) => `${index + 1}. ${card.name} (skill-id: ${card.id})`).join('\n'); onUse(`Brug mine valgte Skill Cards i denne rækkefølge. Find originale instruktioner i Leafys skill-katalog via read_leafy_context, og læs kun dem, der er relevante. Bevar Leafys identitet og svar naturligt på dansk. Låste Master Skills er versionsstyrede og må ikke redigeres. Brug kun værktøjer, der faktisk er tilgængelige.\n\n${sequence}\n\nMin opgave: `); }
  function saveWorkflow() { localStorage.setItem(WORKFLOW_KEY, JSON.stringify(nodes)); setNotice('Dit workflow er gemt i denne browser.'); }

  return <main ref={workflowRoot} className={`skill-workflow ${isFullscreen ? 'is-fullscreen' : ''}`} aria-label="Leafys Skill Cards">
    <header className="skill-flow-header"><div className="skill-flow-brand"><span className="skill-coin"><span className="workspace-coin"/></span><div><span className="skill-kicker">LEAFY · WL SKILL CARDS</span><h1>Byg dit læringsforløb</h1><p>Træk Skill Cards ind på canvas for at skabe dit forløb.</p></div></div><div className="skill-flow-toolbar" aria-label="Workflow-værktøjer"><button onClick={undo} disabled={!canUndo} aria-label="Fortryd"><Undo2 size={17}/></button><button onClick={redo} disabled={!canRedo} aria-label="Gentag"><Redo2 size={17}/></button><span className="skill-toolbar-divider"/><button className={panMode ? 'selected' : ''} onClick={() => setPanMode(value => !value)} aria-label="Flyt canvas" title="Flyt canvas"><Hand size={17}/></button><button onClick={() => { setZoom(100); if (board.current) { board.current.scrollTo({ left: 0, top: 0, behavior: 'smooth' }); } }} aria-label="Tilpas visning"><Maximize size={16}/></button><div className="skill-zoom-control"><button onClick={() => setZoom(value => Math.max(60, value - 10))} aria-label="Zoom ud"><Minus size={15}/></button><span>{zoom}%</span><button onClick={() => setZoom(value => Math.min(150, value + 10))} aria-label="Zoom ind"><Plus size={15}/></button></div><button onClick={toggleFullscreen} aria-label={isFullscreen ? 'Afslut fuld skærm' : 'Åbn fuld skærm'} title={isFullscreen ? 'Afslut fuld skærm' : 'Åbn fuld skærm'}>{isFullscreen ? <Minimize size={16}/> : <Expand size={16}/>}</button><button className="skill-toolbar-action" onClick={() => setPreview(true)}><Play size={15}/> Forhåndsvisning</button><button className="skill-toolbar-action save" onClick={saveWorkflow}><Save size={15}/> Gem forløb <ArrowDown size={13}/></button></div></header>
    {notice && <div className="skill-notice" role="status"><Check size={15}/>{notice}<button onClick={() => setNotice('')} aria-label="Luk besked"><X size={15}/></button></div>}
    <div className="skill-workflow-stage">
    <section className="skill-pillar-headings" aria-label="Kompetencetrin"><div className="skill-pillar-spacer"/>{columns.map(item => <div className="skill-pillar" key={item.title}><span className="skill-pillar-icon">{item.icon}</span><span><strong>{item.title}</strong><small>{item.subtitle}</small></span></div>)}</section>
    <div className="skill-board-viewport"><section className="skill-board-shell"><div className="skill-row-headings">{rows.map(item => <div className="skill-row-heading" key={item.title}><span>{item.icon}</span><div><strong>{item.title}</strong><small>{item.subtitle}</small></div></div>)}</div><div className="skill-canvas-scroll" ref={board} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }} onDrop={handleDrop} onPointerDown={startPan} onPointerMove={updateParticlePointer} onPointerLeave={() => surface.current?.classList.remove('pointer-live')}>
      <div ref={surface} className={`skill-canvas-surface ${panMode ? 'pan-mode' : ''}`} style={{ width: `${zoom}%`, minHeight: `${640 * zoom / 100}px` }}>
        <div className="skill-lane-grid" aria-hidden="true">{rows.map((row, ri) => <div className={`skill-lane lane-${ri}`} key={row.title}>{columns.map((column, ci) => <div className={`skill-cell cell-${ci}`} key={column.title}/>)}</div>)}</div>
        <svg className="skill-graph-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{nodesWithCards.slice(0, -1).map((item, index) => { const next = nodesWithCards[index + 1]; const { x: x1, y: y1 } = item.node; const { x: x2, y: y2 } = next.node; const side = x2 >= x1 ? 1 : -1; const startX = x1 + side * 7.5, endX = x2 - side * 7.5, bend = Math.max(4, Math.abs(endX - startX) * .34); const rope = `M ${startX} ${y1} C ${startX + bend * side} ${y1}, ${endX - bend * side} ${y2}, ${endX} ${y2}`; return <g key={`${item.node.instanceId}-${next.node.instanceId}`}><path className="hemp-rope-shadow" d={rope}/><path className="hemp-rope-main" d={rope}/><path className="hemp-rope-fiber" d={rope}/><path className="hemp-rope-loop" d={`M ${startX} ${y1} c ${side * 1.7} -2, ${side * 2.2} 2, 0 2`}/><path className="hemp-rope-loop" d={`M ${endX} ${y2} c ${side * 1.7} -2, ${side * 2.2} 2, 0 2`}/></g>; })}</svg>
        {nodesWithCards.map(({ node, card }, index) => <article key={node.instanceId} className={`skill-node ${card.locked ? 'locked' : ''}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onPointerDown={event => startMove(event, node.instanceId)}><span className="skill-node-hole left" aria-hidden="true"/><span className="skill-node-hole right" aria-hidden="true"/><span className="skill-node-coin"><span className="workspace-coin"/></span><span className="skill-node-order">{String(index + 1).padStart(2, '0')}</span><button className="skill-node-remove" onClick={() => removeNode(node.instanceId)} aria-label={`Fjern ${card.name}`}><X size={14}/></button><button className="skill-node-card" onClick={event => { if (suppressCardClick.current) { event.preventDefault(); return; } setDetail(card); }} aria-label={`Åbn ${card.name}`}><span className="skill-node-art" style={{ backgroundImage: `url('/skill-cards/category-${card.art}.webp')` }}/><span className="skill-node-copy"><small>{card.category}{card.locked ? ' · LÅST' : ''}</small><strong>{card.name}</strong><span>{card.summary}</span></span></button></article>)}
        {!nodesWithCards.length && <div className="skill-canvas-empty"><Workflow size={28}/><strong>Dit læringsforløb starter her</strong><span>Åbn kortområdet nederst, og træk et kort ind på canvas.</span></div>}
        <button className="skill-canvas-add" onClick={() => setNotice('Træk et Skill Card fra bakken ind på canvas for at placere det.')} aria-label="Hjælp til at placere et kort"><Plus size={18}/><span>Slip her for at placere</span></button>
      </div>
    </div></section></div>
    <button ref={cardPile} className={`skill-card-stack ${libraryOpen ? 'is-open' : ''}`} onClick={() => setLibraryOpen(value => !value)} onWheel={event => { if (pileCards.length < 2) return; event.preventDefault(); setPileOffset(value => (value + (event.deltaY > 0 ? 1 : pileCards.length - 1)) % pileCards.length); }} aria-expanded={libraryOpen} aria-label={`${libraryOpen ? 'Luk' : 'Åbn'} kortbunken; ${unplacedCards.length} ikke-placerede kort`} title="Scroll for at bladre mellem kortene; klik for at åbne kortområdet">
      <span className="skill-deck-layers" aria-hidden="true">{pileCards.slice(0, 4).map((card, index) => <span className={`skill-deck-card layer-${index}`} key={card.id} style={{ backgroundImage: `url('/skill-cards/category-${card.art}.webp')`, zIndex: 4 - index }}/>)}</span>
      <span className="skill-deck-count">{unplacedCards.length}</span><span className="skill-deck-label">{libraryOpen ? 'Luk kort' : 'Kort'}</span>
    </button>
    {libraryOpen && <section ref={cardDock} className="skill-card-dock" onDragOver={event => event.preventDefault()} aria-label="Ikke-placerede kort"><div className="skill-dock-head"><div><strong>Ikke placerede kort</strong><span>{availableCards.length} viste · {unplacedCards.length} i alt · {LOCKED_MASTER_SKILLS.length} låste</span></div><label className="skill-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Søg efter skills …" aria-label="Søg Skill Cards"/></label><div className="skill-filter-list">{categories.slice(0, 6).map(category => <button key={category} className={filter === category ? 'active' : ''} onClick={() => setFilter(category)}>{category}</button>)}</div><button className="skill-add-button" onClick={() => setCreating(value => !value)}><CirclePlus size={15}/> Tilføj kort</button><button className="skill-view-toggle" onClick={() => setLibraryOpen(false)} aria-label="Luk kortområde"><X size={17}/></button></div><div className="skill-dock-cards">{availableCards.map(card => <article key={card.id} className={`skill-library-card ${card.locked ? 'locked' : ''}`} draggable onDragStart={event => { setDragId(card.id); event.dataTransfer.setData('text/skill-card', card.id); event.dataTransfer.effectAllowed = 'copy'; }} onDragEnd={() => setDragId(null)}><button className="skill-library-card-face" onClick={() => setDetail(card)} aria-label={`Læs ${card.name}`}><span className="skill-library-art" style={{ backgroundImage: `url('/skill-cards/category-${card.art}.webp')` }}/><span className="skill-library-copy"><strong>{card.name}</strong><small>{card.summary}</small></span><span className="skill-library-status">{card.locked ? <><LockKeyhole size={10}/> Master</> : 'Personlig'}</span></button><button className="skill-library-add" onClick={() => addNode(card.id)}><Plus size={13}/> Tilføj</button></article>)}<button className="skill-library-new" onClick={() => setCreating(true)}><Plus size={24}/><span>Tilføj nyt kort</span></button></div><div className="skill-dock-footer"><span>Træk kort ind i flowet for at placere dem. Træk et flowkort hertil for at lægge det tilbage.</span><button className="skill-use-button" onClick={useWorkflow} disabled={!nodesWithCards.length}><Workflow size={15}/> Brug i samtalen</button></div></section>}
    </div>
    {creating && <div className="skill-detail-backdrop" role="presentation" onClick={() => setCreating(false)}><form className="skill-create-form" onSubmit={createCard} onClick={event => event.stopPropagation()}><header className="skill-form-heading"><div><span className="skill-kicker">PERSONLIG KOMPETENCE</span><h2>Opret et Skill Card</h2></div><button type="button" onClick={() => setCreating(false)} aria-label="Luk"><X size={18}/></button></header><label className="skill-field">Kortets navn<input required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Fx Hamp i byggeriet"/></label><label className="skill-field">Arbejdsmetode<textarea required maxLength={12000} rows={6} value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="Beskriv hvordan Leafy skal arbejde, når kompetencen passer til opgaven."/><small>{instructions.length.toLocaleString('da-DK')} / 12.000 tegn</small></label><footer className="skill-form-footer"><span><LockKeyhole size={14}/> Gemmes i din Leafy-kerne på denne enhed.</span><button type="submit"><Check size={16}/> Gem kort</button></footer></form></div>}
    {detail && <div className="skill-detail-backdrop" role="presentation" onClick={() => setDetail(null)}><section className="skill-detail" role="dialog" aria-modal="true" aria-labelledby="skill-detail-title" onClick={event => event.stopPropagation()}><header><span className="skill-detail-icon" style={{ backgroundImage: `url('/skill-cards/category-${detail.art}.webp')` }}/><div><span className="skill-kicker">{detail.locked ? 'LÅST MASTER SKILL' : 'PERSONLIG SKILL'} · {detail.category}</span><h2 id="skill-detail-title">{detail.name}</h2><p>{detail.locked ? `${detail.alwaysLoaded ? 'Altid aktiv' : 'Emnebaseret'} · version ${detail.version} · ${detail.status === 'draft_for_admin_review' ? 'WL-gennemgang' : detail.status}` : 'Gemmes i Leafys fælles kerne på denne enhed.'}</p></div><button onClick={() => setDetail(null)} aria-label="Luk kort"><X size={19}/></button></header><div className="skill-detail-body">{detail.instructions}</div><footer>{detail.locked ? <span><LockKeyhole size={14}/> Indholdet er låst og versionsstyret af WL.</span> : <button className="skill-delete" onClick={() => removePersonal(detail.id)}><Trash2 size={15}/> Slet personlig skill</button>}<button className="skill-detail-add" onClick={() => { addNode(detail.id); setDetail(null); }}><Plus size={15}/> Tilføj til canvas</button></footer></section></div>}
    {preview && <div className="skill-detail-backdrop" role="presentation" onClick={() => setPreview(false)}><section className="skill-preview" role="dialog" aria-modal="true" aria-labelledby="skill-preview-title" onClick={event => event.stopPropagation()}><header><div><span className="skill-kicker">FORHÅNDSVISNING</span><h2 id="skill-preview-title">Dit læringsforløb</h2></div><button onClick={() => setPreview(false)} aria-label="Luk"><X size={19}/></button></header>{nodesWithCards.length ? nodesWithCards.map(({ card }, index) => <article key={`${card.id}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{card.name}</strong><small>{card.summary}</small></div></article>) : <p>Træk først nogle kort ind på canvas.</p>}<footer><button onClick={useWorkflow} disabled={!nodesWithCards.length}><Play size={15}/> Brug forløbet</button></footer></section></div>}
  </main>;
}
