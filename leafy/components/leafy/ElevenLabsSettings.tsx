'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {KeyRound,LoaderCircle,ShieldCheck,Trash2,Volume2} from 'lucide-react';

type Voice={id:string;name:string;language:string;accent:string;category:string};
type Result={configured:boolean;voiceId?:string;voices?:Voice[];error?:string};
function announce(){window.dispatchEvent(new Event('leafy-voice-config-changed'));}
export default function ElevenLabsSettings({onTest,disabled=false,onSaved}:{onTest:()=>void;disabled?:boolean;onSaved?:()=>void}){
 const [apiKey,setApiKey]=useState(''),[voices,setVoices]=useState<Voice[]>([]),[voiceId,setVoiceId]=useState(''),[configured,setConfigured]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function refresh(){try{const r=await fetch('/api/leafy/elevenlabs',{cache:'no-store'});const data=await r.json() as Result;if(r.ok){setConfigured(data.configured);setVoices(data.voices||[]);setVoiceId(data.voiceId||'');}}catch{}}
 useEffect(()=>{const id=requestAnimationFrame(()=>void refresh());return()=>cancelAnimationFrame(id);},[]);
 async function save(e:React.FormEvent){e.preventDefault();setPending(true);setError('');setMessage('');try{const r=await fetch('/api/leafy/elevenlabs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey,voiceId})});const data=await r.json() as Result;if(!r.ok)throw Error(data.error||'ElevenLabs kunne ikke gemmes.');setApiKey('');setConfigured(true);setVoices(data.voices||[]);setVoiceId(data.voiceId||'');setMessage(data.voiceId?'ElevenLabs er forbundet, og stemmen er gemt.':'Nøglen er godkendt. Vælg en stemme og gem igen.');announce();await refresh();onSaved?.();}catch(e){setError((e as Error).message);}finally{setPending(false);}}
 async function choose(value:string){setVoiceId(value);if(!configured)return;setPending(true);setError('');setMessage('');try{const r=await fetch('/api/leafy/elevenlabs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({voiceId:value})});const data=await r.json() as Result;if(!r.ok)throw Error(data.error||'Stemmen kunne ikke gemmes.');setVoices(data.voices||[]);setMessage('ElevenLabs-stemmen er gemt.');announce();onSaved?.();}catch(e){setError((e as Error).message);}finally{setPending(false);}}
 async function remove(){setPending(true);setError('');setMessage('');try{const r=await fetch('/api/leafy/elevenlabs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clear:true})});const data=await r.json() as Result;if(!r.ok)throw Error(data.error||'ElevenLabs kunne ikke fjernes.');setConfigured(false);setVoiceId('');setVoices([]);setMessage('ElevenLabs-nøglen er fjernet fra denne browser.');announce();onSaved?.();}catch(e){setError((e as Error).message);}finally{setPending(false);}}
 return <section data-leafy-private className="corti-settings elevenlabs-settings" aria-label="ElevenLabs-stemme">
  <div className="corti-settings-title"><span><Volume2 size={18}/></span><div><h3>ElevenLabs v4 Turbo · Leafys stemme</h3><p>{configured?'API-nøgle gemt sikkert i denne browser':'Tilslut ElevenLabs v4 Turbo'}</p></div></div>
  <p className="corti-settings-copy">Leafys tale i rummet, samtaler og stemmetest bruger denne Eleven v4 Turbo-stemme med tidsstemplede mundbevægelser. API-nøglen bliver på serveren og gemmes krypteret i en sikker cookie i denne browser; den sendes aldrig til browserens lager eller samtalehistorik.</p>
  <form className="corti-settings-form" onSubmit={save}>
   <label>ElevenLabs API-nøgle<Input type="password" autoComplete="new-password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={configured?'Nøgle gemt · indsæt kun for at erstatte':'Indsæt din ElevenLabs API-nøgle'} spellCheck={false}/></label>
   {configured&&<label>Leafys stemme<select className="elevenlabs-voice-select" value={voiceId} onChange={e=>void choose(e.target.value)} disabled={pending}><option value="">Vælg en stemme…</option>{voices.map(v=><option key={v.id} value={v.id}>{v.name}{v.language?` · ${v.language}`:''}{v.accent?` · ${v.accent}`:''}</option>)}</select></label>}
   {error&&<p className="corti-feedback error" role="alert">{error}</p>}{message&&<p className="corti-feedback" role="status">{message}</p>}
   <div className="corti-settings-actions"><Button type="submit" disabled={pending||(!apiKey.trim()&&!voiceId)}>{pending?<LoaderCircle className="animate-spin"/>:<ShieldCheck size={16}/>}Gem og kontrollér</Button><Button type="button" variant="outline" disabled={!configured||!voiceId||disabled} onClick={onTest}><Volume2 size={15}/>Afprøv Leafys stemme</Button>{configured&&<Button type="button" variant="ghost" disabled={pending} onClick={()=>void remove()}><Trash2 size={15}/>Fjern ElevenLabs</Button>}</div>
  </form>
  <p className="corti-settings-foot">Når nøglen og stemmen er gemt, bruger Leafy denne ElevenLabs-stemme i alle svar. Browserens indbyggede tale er slået fra.</p>
 </section>;
}
