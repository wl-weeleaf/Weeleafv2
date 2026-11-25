'use client';

import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {ArrowDownToLine,CheckCircle2,LoaderCircle,ShieldCheck,TriangleAlert} from 'lucide-react';

type Service={configured:boolean;source:'server'|'browser'|null;model?:string|null;speechConfigured?:boolean;speechSource?:'server'|'browser'|null;voiceSelected?:boolean};
type Result={imported?:boolean;services?:{corti:Service;elevenLabs:Service};note?:string;error?:string};
const sourceLabel=(source:Service['source'])=>source==='server'?'fælles server':source==='browser'?'denne browser':'ikke opsat';

export default function SharedSetupImport(){
 const [pending,setPending]=useState(false),[result,setResult]=useState<Result|null>(null),[error,setError]=useState('');
 async function importSetup(){
  setPending(true);setError('');
  try{
   const response=await fetch('/api/livi/setup/import',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});
   const data=await response.json() as Result;
   if(!response.ok||!data.imported)throw new Error(data.error||'Fælles opsætning kunne ikke hentes.');
   setResult(data);
  }catch(e){setError((e as Error).message);}
  finally{setPending(false);}
 }
 return <section className="corti-settings leafy-shared-setup" aria-label="Fælles serveropsætning">
  <div className="corti-settings-title"><span><ShieldCheck size={18}/></span><div><h3>Fælles opsætning til testere</h3><p>Nøgler bliver på serveren</p></div></div>
  <p className="corti-settings-copy">Hent appens fælles Corti- og ElevenLabs-status med ét tryk. Der downloades ingen nøglefil til enheden, og testere skal ikke indtaste hemmeligheder.</p>
  <Button type="button" disabled={pending} onClick={()=>void importSetup()}>{pending?<LoaderCircle className="animate-spin"/>:<ArrowDownToLine size={16}/>}Hent opsætning sikkert</Button>
  {error&&<p className="corti-feedback error" role="alert">{error}</p>}
  {result?.services&&<div className="leafy-shared-setup-status" role="status">
   <p>{result.services.corti.configured?<CheckCircle2 size={16}/>:<TriangleAlert size={16}/>} Corti AI: {result.services.corti.configured?'opsat · '+sourceLabel(result.services.corti.source)+(result.services.corti.model?' · '+result.services.corti.model:''):'mangler serveropsætning'}</p>
   <p>{result.services.corti.speechConfigured?<CheckCircle2 size={16}/>:<TriangleAlert size={16}/>} Corti mikrofon: {result.services.corti.speechConfigured?'opsat · '+sourceLabel(result.services.corti.speechSource||null):'ikke opsat fælles'}</p>
   <p>{result.services.elevenLabs.configured?<CheckCircle2 size={16}/>:<TriangleAlert size={16}/>} ElevenLabs: {result.services.elevenLabs.configured?'nøgle fundet · '+sourceLabel(result.services.elevenLabs.source)+(result.services.elevenLabs.voiceSelected?' · stemme valgt':' · stemme mangler'):'fælles nøgle mangler på serveren'}</p>
   <small>{result.note} · Opsætning er ikke det samme som en live-forbindelsestest.</small>
  </div>}
 </section>;
}
