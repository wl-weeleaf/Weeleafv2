'use client';
/* ElevenLabs returns short-lived signed image URLs; render the original asset directly. */
/* eslint-disable @next/next/no-img-element */

import {useEffect,useState} from 'react';
import {AudioLines,CheckCircle2,Download,Image as ImageIcon,LoaderCircle,Music2,RefreshCw,Sparkles,Video,Volume2,XCircle} from 'lucide-react';
import './media-creator.css';

type Kind='image'|'video'|'sound'|'voice'|'music';
type Flow={kind:'image'|'video';id:string;status:string;contentUrl?:string;mimeType?:string;error?:string};
type Output={kind:'sound'|'voice'|'music';url:string;filename:string};
type AccessResult={configured:boolean;image?:{available:boolean;error?:string};video?:{available:boolean;error?:string};error?:string};
const tabs=[{id:'image',label:'Billede',Icon:ImageIcon},{id:'video',label:'Video',Icon:Video},{id:'sound',label:'Lyd',Icon:AudioLines},{id:'music',label:'Musik',Icon:Music2}] as const;
const sample:Record<Kind,string>={image:'En illustration af et selvforsynende hus bygget af hampematerialer i dansk natur, blødt morgenlys',video:'Et roligt filmisk klip af en grøn spirende plante, der vokser i et lyst drivhus',sound:'Blid vind gennem hampeplanter med fuglesang i baggrunden',voice:'Skriv eller indsæt teksten, Leafy skal læse op med sin valgte stemme',music:'Instrumental baggrundsmusik til en rolig og håbefuld præsentation om bæredygtighed'};

async function readError(response:Response){try{const data=await response.json() as {error?:string};return data.error||'Genereringen kunne ikke startes.';}catch{return 'Genereringen kunne ikke startes. Kontrollér ElevenLabs-adgangen.';}}
function wait(ms:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{const timer=window.setTimeout(resolve,ms);signal.addEventListener('abort',()=>{window.clearTimeout(timer);reject(new DOMException('Annulleret','AbortError'));},{once:true});});}

export default function ElevenLabsCreate(){
 const [kind,setKind]=useState<Kind>('image'),[audioMode,setAudioMode]=useState<'sound'|'voice'>('sound'),[prompt,setPrompt]=useState(''),[length,setLength]=useState('30000'),[instrumental,setInstrumental]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[flow,setFlow]=useState<Flow|null>(null),[output,setOutput]=useState<Output|null>(null),[created,setCreated]=useState(false),[access,setAccess]=useState<AccessResult|null>(null),[checkingAccess,setCheckingAccess]=useState(false);
 const activeKind=kind==='sound'&&audioMode==='voice'?'voice':kind;
 const needsEleven=kind!=='image'&&kind!=='video';

 useEffect(()=>{
  if(!flow||flow.status==='completed'||flow.status==='failed')return;
  const controller=new AbortController();let attempts=0;
  const poll=async()=>{
   while(!controller.signal.aborted&&attempts<36){
    const delay=flow.kind==='video'?Math.min(10000*Math.pow(1.35,attempts),30000):Math.min(2000*Math.pow(1.35,attempts),15000);
    try{await wait(delay,controller.signal);}catch{return;}
    attempts++;
    try{const response=await fetch(`/api/leafy/elevenlabs/media?kind=${flow.kind}&id=${encodeURIComponent(flow.id)}`,{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error(await readError(response));const data=await response.json() as Flow;setFlow(data);if(data.status==='completed'||data.status==='failed')return;}
    catch(e){if(controller.signal.aborted)return;if(attempts>=4){setFlow(current=>current?{...current,status:'failed',error:(e as Error).message}:current);return;}}
   }
   if(!controller.signal.aborted)setFlow(current=>current?{...current,status:'failed',error:'Genereringen tager længere end forventet. Start et nyt statusopslag om lidt.'}:current);
  };
  void poll();return()=>controller.abort();
 // Keep one polling loop alive for the lifetime of a job; including its changing status would restart the backoff timer.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[flow?.id]);

 useEffect(()=>{return()=>{if(output?.url)URL.revokeObjectURL(output.url);};},[output?.url]);

 async function checkAccess(){
  setCheckingAccess(true);
  try{
   const response=await fetch('/api/leafy/elevenlabs/media?check=1',{cache:'no-store'});
   const data=await response.json() as AccessResult;
   if(!response.ok)throw new Error(data.error||'ElevenLabs-forbindelsen kunne ikke kontrolleres.');
   setAccess(data);
  }catch(e){setAccess({configured:false,error:(e as Error).message||'Forbindelsen kunne ikke kontrolleres.'});}
  finally{setCheckingAccess(false);}
 }

 useEffect(()=>{void checkAccess();},[]);

 async function generate(event:React.FormEvent){
  event.preventDefault();const text=prompt.trim();if(!text)return;setBusy(true);setError('');setFlow(null);if(output){URL.revokeObjectURL(output.url);setOutput(null);}setCreated(false);
  try{
   const response=await fetch('/api/leafy/elevenlabs/media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:activeKind,prompt:text,lengthMs:Number(length),instrumental,durationSeconds:6})});
   if(!response.ok)throw new Error(await readError(response));
   if(activeKind==='image'||activeKind==='video'){
    const data=await response.json() as Flow;setFlow({...data,kind:activeKind});setCreated(true);
   }else{
    const blob=await response.blob();if(!blob.size)throw new Error('ElevenLabs returnerede en tom lydfil.');const url=URL.createObjectURL(blob);const filename=`leafy-${activeKind}-${new Date().toISOString().slice(0,10)}.mp3`;setOutput({kind:activeKind,url,filename});setCreated(true);
   }
  }catch(e){setError((e as Error).message||'Genereringen kunne ikke startes.');}finally{setBusy(false);}
 }

 const label=kind==='image'?'Beskriv billedet':kind==='video'?'Beskriv videoklippet':kind==='music'?'Beskriv musikken':audioMode==='voice'?'Tekst til oplæsning':'Beskriv lyden';
 const currentFlow=flow&&flow.kind===kind?flow:null;
 return <div className="media-create-page">
  <header className="media-create-heading"><span><Sparkles size={16}/> LEAFY · SKAB</span><h1>Giv idéen lyd og billede.</h1><p>Lav billeder, korte videoklip, lyd og musik med ElevenLabs direkte i Leafy.</p></header>
  <div className="media-create-grid">
   <section className="media-create-form-card">
    <div className="media-create-tabs" role="tablist" aria-label="Vælg hvad du vil skabe">{tabs.map(({id,label:tab,Icon})=><button key={id} type="button" role="tab" aria-selected={kind===id} onClick={()=>{setKind(id);setError('');}}><Icon size={17}/>{tab}</button>)}</div>
    <form onSubmit={generate}>
     {kind==='sound'&&<div className="media-create-subtabs" role="group" aria-label="Lydtype"><button type="button" aria-pressed={audioMode==='sound'} onClick={()=>setAudioMode('sound')}><AudioLines size={15}/> Lydeffekt</button><button type="button" aria-pressed={audioMode==='voice'} onClick={()=>setAudioMode('voice')}><Volume2 size={15}/> Tale med Leafys stemme</button></div>}
     <label className="media-create-label" htmlFor="media-prompt">{label}<span>{prompt.length.toLocaleString('da-DK')} tegn</span></label>
     <textarea id="media-prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={activeKind==='music'?4100:2000} rows={5} placeholder={sample[activeKind]}/>
     <div className="media-create-options">
      {kind==='video'&&<label>Varighed<select value="8" disabled><option value="8">8 sekunder · 16:9 · 720p</option></select></label>}
      {kind==='sound'&&audioMode==='sound'&&<p>ElevenLabs genererer en lydeffekt på cirka 6 sekunder.</p>}
      {kind==='music'&&<><label>Varighed<select value={length} onChange={e=>setLength(e.target.value)}><option value="15000">15 sekunder</option><option value="30000">30 sekunder</option><option value="60000">1 minut</option></select></label><label className="media-create-check"><input type="checkbox" checked={instrumental} onChange={e=>setInstrumental(e.target.checked)}/> Kun instrumental</label></>}
      {kind==='image'&&<p>Billedmodel: GPT Image 2 · automatisk størrelse</p>}
      {kind==='sound'&&audioMode==='voice'&&<p>Eleven v4 · bruger Leafys valgte stemme · maks. 2.000 tegn pr. generering.</p>}
     </div>
     <button className="media-create-submit" type="submit" disabled={busy||!prompt.trim()}>{busy?<><LoaderCircle className="media-spin" size={18}/> Sender til ElevenLabs…</>:<><Sparkles size={17}/> Generér {kind==='image'?'billede':kind==='video'?'video':activeKind==='voice'?'tale':activeKind==='music'?'musik':'lyd'}</>}</button>
    </form>
    {error&&<p className="media-create-error" role="alert">{error}</p>}
    {needsEleven&&<p className="media-create-note">Bruger din krypteret gemte ElevenLabs-nøgle. Generering kan bruge credits.</p>}
   </section>
   <section className="media-create-result" aria-live="polite">
    <div className="media-create-result-head"><span>RESULTAT</span>{created&&<small>Klar eller i gang</small>}</div>
    {currentFlow&&currentFlow.status!=='completed'&&currentFlow.status!=='failed'&&<div className="media-create-wait"><LoaderCircle className="media-spin" size={25}/><strong>{currentFlow.status==='pending'?'Venter i kø':'Leafy skaber dit '+(kind==='image'?'billede':'videoklip')}</strong><p>{kind==='video'?'Videoklip kan tage et par minutter.':'Billedet bliver normalt klar på kort tid.'}</p></div>}
    {currentFlow?.status==='failed'&&<div className="media-create-empty"><strong>Genereringen blev ikke færdig.</strong><p>{currentFlow.error||'Kontrollér prompt, plan og adgang til ElevenLabs Image & Video.'}</p></div>}
    {currentFlow?.status==='completed'&&currentFlow.contentUrl&&<div className="media-create-preview">{kind==='image'?<img src={currentFlow.contentUrl} alt={prompt||'Genereret billede fra ElevenLabs'}/>:<video src={currentFlow.contentUrl} controls playsInline/>}<a href={`/api/leafy/elevenlabs/media?kind=${kind}&id=${encodeURIComponent(currentFlow.id)}&download=1`}><Download size={16}/> Hent {kind==='image'?'billedet':'videoen'}</a></div>}
    {output&&<div className="media-create-preview media-create-audio"><div className="media-audio-icon">{output.kind==='music'?<Music2 size={28}/>:output.kind==='voice'?<Volume2 size={28}/>:<AudioLines size={28}/>}</div><strong>{output.kind==='music'?'Din musik er klar':output.kind==='voice'?'Leafys oplæste lyd er klar':'Lydeffekten er klar'}</strong><audio controls src={output.url}/><a href={output.url} download={output.filename}><Download size={16}/> Hent lydfilen</a></div>}
    {!currentFlow&&!output&&<div className="media-create-empty"><div className="media-create-art"><ImageIcon/><AudioLines/><Music2/></div><strong>Dit næste udkast starter her.</strong><p>Vælg en type, skriv en beskrivelse, og generér et resultat.</p></div>}
   </section>
  </div>
  <div className="media-create-plan" role="status" aria-live="polite">
   <div className="media-access-copy">
    {checkingAccess?<><LoaderCircle className="media-spin" size={15}/><span>Kontrollerer den gemte ElevenLabs-forbindelse…</span></>:access?.configured? <>
     {access.image?.available?<CheckCircle2 size={15} className="media-access-ok"/>:<XCircle size={15} className="media-access-no"/>}<span><b>Billede:</b> {access.image?.available?'tilsluttet':access.image?.error||'adgang blev afvist'}.</span>
     {access.video?.available?<CheckCircle2 size={15} className="media-access-ok"/>:<XCircle size={15} className="media-access-no"/>}<span><b>Video:</b> {access.video?.available?'tilsluttet':access.video?.error||'adgang blev afvist'}.</span>
    </>:<><XCircle size={15} className="media-access-no"/><span>{access?.error||'Forbindelsen er ikke kontrolleret endnu.'}</span></>}
   </div>
   <button type="button" className="media-access-refresh" onClick={()=>void checkAccess()} disabled={checkingAccess}><RefreshCw size={14}/><span>Kontrollér igen</span></button>
   {access?.configured&&(!access.image?.available||!access.video?.available)&&<p className="media-access-detail">Nøglen er gemt i denne browser. {access.image?.error&&!access.image.available&&<span>Billede: {access.image.error} </span>}{access.video?.error&&!access.video.available&&<span>Video: {access.video.error}</span>}</p>}
  </div>
 </div>;
}
