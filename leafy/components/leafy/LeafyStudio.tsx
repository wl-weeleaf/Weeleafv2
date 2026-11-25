'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowDownToLine,AudioLines,Box,Code2,Leaf,MoveUpRight,Pause,Play,RotateCcw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {mouthIds,type Viseme} from './LeafyNPC';
import {Switch} from '@/components/ui/switch';
import {expressions,type Expression} from './AnimatedFace';
import LeafyCanvas,{type LeafyHandle} from './LeafyCanvas';
import {DEFAULT_MOUTH_RIG,type MouthRigParameters} from './LeafyMouthRig';
export default function LeafyStudio(){
 const ref=useRef<LeafyHandle>(null);
 const [speechText,setSpeechText]=useState('Hej! Jeg er Leafy. Jeg følger med, når du bevæger musen, og min mund følger ordene, når jeg taler.');
 const [speaking,setSpeaking]=useState(false),[follow,setFollow]=useState(true),[mouthPreview,setMouthPreview]=useState<Viseme|'none'|null>(null);
 const [whistlePreview,setWhistlePreview]=useState(false);
 const [expression,setExpression]=useState<Expression>('idle'),[facePlaying,setFacePlaying]=useState(true);
 const [mouthRig,setMouthRig]=useState<MouthRigParameters>(DEFAULT_MOUTH_RIG);
 const [motion,setMotion]=useState<'idle'|'hop'|'still'>('idle'),[rotate,setRotate]=useState(false),[wire,setWire]=useState(false),[ready,setReady]=useState(false),[exporting,setExporting]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){const frame=requestAnimationFrame(()=>{setMotion('still');setFacePlaying(false);});return()=>cancelAnimationFrame(frame);}},[]);
 useEffect(()=>{let frame=0;try{const saved=localStorage.getItem('leafy-mouth-rig-v1');if(saved){const value=JSON.parse(saved) as Partial<MouthRigParameters>,next={...DEFAULT_MOUTH_RIG};for(const key of Object.keys(next) as (keyof MouthRigParameters)[]){if(typeof value[key]==='number'&&Number.isFinite(value[key]))next[key]=value[key]!;}frame=requestAnimationFrame(()=>setMouthRig(next));}}catch{/* Keep safe defaults when storage is unavailable. */}return()=>cancelAnimationFrame(frame);},[]);
 function changeMouth(key:keyof MouthRigParameters,value:number){setMouthRig(current=>{const next={...current,[key]:value};try{localStorage.setItem('leafy-mouth-rig-v1',JSON.stringify(next));}catch{/* The current session still works without storage. */}return next;});}
 async function download(){setExporting(true);setError('');try{await ref.current?.exportGLB();}catch(e){setError(e instanceof Error?e.message:'Eksport mislykkedes.');}finally{setExporting(false);}}
 return <main className="studio">
  <header className="topbar"><Link className="brand" href="/" aria-label="Leafy start"><span className="brand-icon"><Leaf size={21}/></span><strong>Leafy</strong><span className="divider"/><span className="brand-sub">3D studio</span></Link><span className="edition">WeeLeaf <span> / </span> 01</span></header>
  <section className="workspace">
   <div className="stage">
    <div className="stage-heading"><span className="eyebrow">EN LILLE LEAF. EN HEL VERDEN.</span><h1>Hej, jeg er Leafy.</h1><p>Jeg følger med. Prøv at flytte musen.</p></div>
    <div className="viewer"><LeafyCanvas followPointer={follow} mouthPreview={mouthPreview} mouthRig={mouthRig} whistlePreview={whistlePreview} onSpeaking={setSpeaking} expression={expression} facePlaying={facePlaying} ref={ref} motion={motion} rotate={rotate} wireframe={wire} onReady={()=>setReady(true)}/>{!ready&&<span className="loading">Leafy vågner…</span>}</div>
    <div className="floor-shadow" aria-hidden="true"/>
    <div className="view-controls" aria-label="Kameravinkel">{(['front','side','back'] as const).map((v,i)=><Button key={v} variant="ghost" disabled={!ready} onClick={()=>{setRotate(false);ref.current?.view(v);}}>{['Forfra','Fra siden','Bagfra'][i]}</Button>)}</div>
    <span className="drag-hint">Flyt musen · Træk for at dreje · Rul for at zoome</span>
    <span className="stage-index">LEAFY / 001</span>
   </div>
   <aside className="panel">
    <div className="panel-title"><span className="eyebrow">DIN DIGITALE MAKKER</span><h2>Et blad med liv.</h2><p>Et blik, der følger dig. En stemme med sit eget ansigt.</p></div>
    <section className="control-section speech-section"><div className="section-label"><label htmlFor="speech-text">Lad Leafy tale</label><span className="label-note" aria-live="polite">{speaking?'Taler…':'Klar'}</span></div><Textarea id="speech-text" value={speechText} maxLength={2000} onChange={e=>setSpeechText(e.target.value)} rows={3}/><div className="speech-buttons"><Button disabled={!ready||!speechText.trim()} onClick={()=>{setWhistlePreview(false);setMouthPreview(null);ref.current?.speak(speechText);}}><Play size={15}/>{speaking?'Start forfra':'Sig teksten'}</Button><Button variant="outline" disabled={!speaking} onClick={()=>ref.current?.stop()}>Stop</Button></div><p className="speech-note">Taletest med ElevenLabs v4 Turbo og tidsstemplede mundbevægelser.</p></section>
    <section className="control-section expression-section"><div className="section-label"><span>Ansigtsudtryk</span><span className="label-note">01</span></div><div className="expression-grid">{expressions.map(e=><Button key={e.id} variant="ghost" disabled={!ready} aria-pressed={expression===e.id} className={expression===e.id?'expression selected':'expression'} onClick={()=>setExpression(e.id)}><img src={`/leafy/expressions/${e.id}-0.png`} alt="" width="44" height="44"/>{e.label}</Button>)}</div><label className="switch-row" htmlFor="face"><span>Blink og mimik</span><Switch id="face" checked={facePlaying} disabled={!ready} onCheckedChange={setFacePlaying}/></label><label className="switch-row" htmlFor="follow"><span>Følg musen</span><Switch id="follow" checked={follow} disabled={!ready} onCheckedChange={setFollow}/></label></section>
    <section className="control-section"><div className="section-label"><span>Kropsbevægelse</span><span className="label-note">02</span></div><div className="motion-buttons">{(['idle','hop','still'] as const).map((m,i)=><Button disabled={!ready} key={m} variant="ghost" className={motion===m?'selected':''} aria-pressed={motion===m} onClick={()=>setMotion(m)}>{i===2?<Pause size={16}/>:<Play size={16}/>} {['Rolig','Glad','Pause'][i]}</Button>)}</div></section>
    <section className="control-section"><div className="section-label"><span>Udforsk modellen</span><span className="label-note">03</span></div><label className="switch-row" htmlFor="rotate"><span>Drej automatisk</span><Switch id="rotate" disabled={!ready} checked={rotate} onCheckedChange={setRotate}/></label><label className="switch-row" htmlFor="mesh"><span>Vis trådnet</span><Switch id="mesh" disabled={!ready} checked={wire} onCheckedChange={setWire}/></label><Button className="reset" variant="ghost" disabled={!ready} onClick={()=>{setRotate(false);setWire(false);ref.current?.view('front');}}><RotateCcw size={15}/> Nulstil visning</Button></section>
    <details className="mouth-details" open><summary>Form Leafys 3D-mund</summary><p className="mouth-intro">Mundens mesh følger visemerne fra ElevenLabs. O og OO får tydeligere runde keyframes; prøv også den lille fløjtebevægelse.</p><div className="mouth-grid">{mouthIds.map(id=><Button key={id} variant="ghost" aria-pressed={mouthPreview===id} className={mouthPreview===id?'selected':''} onClick={()=>{if(id!=='rest')ref.current?.stop();setWhistlePreview(false);setMouthPreview(id);}}><img src={`/leafy/mouths/${id}.png`} alt="" width="40" height="40"/>{id}</Button>)}</div><div className="mouth-sliders">{([
     ['width','Mundbredde',.55,1.4,.01,'×'],['height','Åbning',.45,1.6,.01,'×'],['roundness','Rund mundform',0,2,.01,'×'],['lipThickness','Læbekant',.35,1.8,.01,'×'],['jaw','Kæbe og hage',.25,1.6,.01,'×'],['cornerLeft','Venstre mundvig',-1,1,.01,''],['cornerRight','Højre mundvig',-1,1,.01,'']
    ] as const).map(([key,label,min,max,step,unit])=><label className="mouth-slider" key={key}><span>{label}<output>{mouthRig[key].toFixed(2)}{unit}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={mouthRig[key]} onChange={e=>changeMouth(key,Number(e.target.value))}/></label>)}</div><div className="speech-buttons"><Button variant="outline" onClick={()=>setMouthPreview(null)}>Automatisk lipsync</Button><Button variant={whistlePreview?'default':'outline'} aria-pressed={whistlePreview} onClick={()=>{if(!whistlePreview){ref.current?.stop();setMouthPreview(null);}setWhistlePreview(!whistlePreview);}}><AudioLines size={15}/>{whistlePreview?'Stop fløjten':'Prøv fløjte'}</Button><Button variant="ghost" onClick={()=>{ref.current?.stop();setWhistlePreview(false);setMouthPreview('none');}}>Skjul mund</Button></div><a className="gif-download" href="/leafy/mouths/sequence.gif" download><ArrowDownToLine size={14}/> Hent reference-GIF</a></details>
    <section className="reference"><img src="/leafy/back.png" alt="Leafys nye bagside" width="64" height="64"/><div><span>Også liv bagpå.</span><p>Ny bladtekstur på bagsiden.</p></div></section>
    <div className="downloads"><Button className="download-main" disabled={!ready||exporting} onClick={download}><Box size={18}/>{exporting?'Klargør model…':'Hent 3D-model'}<ArrowDownToLine size={17}/></Button><Button asChild variant="outline" className="download-code"><a href="/downloads/leafy-nextjs.zip" download><Code2 size={18}/>Hent Next.js-kode<MoveUpRight size={17}/></a></Button><p>GLB: øjne, mund og krop · Interaktivitet i kodepakken</p>{error&&<p role="alert">{error}</p>}</div>
    <p className="model-note">3D-mundens form og visemer styres separat fra kroppen. Live tale bruger ElevenLabs’ tidsstemplede mundsignaler, og dine formjusteringer gemmes lokalt i denne browser.</p>
   </aside>
  </section>
  <footer><span>WeeLeaf</span><span>Nysgerrig af natur.</span><span>Leafy i en ny dimension</span></footer>
 </main>;
}
