'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';

export default function SpeechVoiceSettings({onTest,disabled=false}:{onTest:()=>void;disabled?:boolean}){
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  let active=true;
  const refresh=()=>{fetch('/api/livi/status',{cache:'no-store'}).then(r=>r.ok?r.json() as Promise<{hasSavedElevenLabsKey?:boolean;elevenLabsVoiceId?:string|null}>:null).then(data=>{if(active)setReady(!!data?.hasSavedElevenLabsKey&&!!data?.elevenLabsVoiceId);}).catch(()=>{if(active)setReady(false);});};
  refresh();window.addEventListener('leafy-voice-config-changed',refresh);
  return()=>{active=false;window.removeEventListener('leafy-voice-config-changed',refresh);};
 },[]);
 return <section className="leafy-voice-settings" aria-labelledby="leafy-voice-title">
  <div className="leafy-voice-heading"><div><h3 id="leafy-voice-title">Leafys stemme</h3><p>Samme ElevenLabs-stemme bruges i rummet, samtaler og stemmetest.</p></div></div>
  <div className="leafy-voice-select"><span>Fast stemmeudgang</span><strong>ElevenLabs v4 Turbo</strong></div>
  <div className="leafy-voice-actions"><Button type="button" disabled={disabled||!ready} onClick={onTest}>Afprøv stemmen</Button><span role="status">{ready?'ElevenLabs og Leafys valgte stemme er klar':'Gem ElevenLabs API-nøgle og vælg Leafys stemme nedenfor'}</span></div>
  <p className="leafy-voice-note">Browserens indbyggede tale bruges ikke. Hvis ElevenLabs ikke er tilgængelig, viser Leafy en fejl i stedet for at skifte stemme.</p>
 </section>;
}
