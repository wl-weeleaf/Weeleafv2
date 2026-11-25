'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {LeafyHandle} from '@/components/leafy/LeafyCanvas';
import {readLeafyCore} from '@/lib/livi/core';
import {workspaceContext} from '@/lib/leafy/client';
import {ChatStreamParser} from '@/lib/livi/protocol';
import type {AgentEvent,Artifact,Approval} from '@/lib/leafy/actions';
import type {LiveEntry,LiveMode} from '../types';
import {addEntry,livePrompt} from '../services/liveContext';
import {speechChunks} from '../services/speech.mjs';
import {thinkingPhrase} from '@/features/voice/thinking';
import {VoiceSession} from '@/features/voice/session';
import {wakeCommand} from '../services/sceneDirector.mjs';
export function useLeafyLive(actor:React.RefObject<LeafyHandle|null>,presenterSpeaking=false){
 const [mode,setMode]=useState<LiveMode>('lecture'),[entries,setEntries]=useState<LiveEntry[]>([]),[status,setStatus]=useState('Lytter'),[pending,setPending]=useState(false),[speaking,setSpeaking]=useState(false),[muted,setMuted]=useState(false),[caption,setCaption]=useState(''),[error,setError]=useState(''),[activities,setActivities]=useState<string[]>([]),[artifacts,setArtifacts]=useState<Artifact[]>([]),[approvals,setApprovals]=useState<Approval[]>([]);
 const data=useRef({entries,mode,muted,pending,speaking,presenterSpeaking}),actorRef=useRef(actor),callbacks=useRef<{add:(kind:LiveEntry['kind'],text:string)=>void;ask:(question:string,override?:LiveMode)=>Promise<void>;cancel:()=>void}>({add:()=>{},ask:async()=>{},cancel:()=>{}}),voiceSessionRef=useRef<VoiceSession|null>(null);const abort=useRef<AbortController|null>(null),silentUntil=useRef(0),wakeUntil=useRef(0),thinkingTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),thinkingIndex=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),lastAuto=useRef(0);
 const add=useCallback((kind:LiveEntry['kind'],text:string)=>{setEntries(e=>{const next=addEntry(e,kind,text);data.current.entries=next;return next;});},[]);
 const cancel=useCallback(()=>{clearTimeout(thinkingTimer.current);voiceSessionRef.current?.reset();abort.current?.abort();abort.current=null;clearTimeout(timer.current);data.current.pending=false;data.current.speaking=false;actorRef.current.current?.stop();setPending(false);setSpeaking(false);setStatus('Lytter');setMode(m=>m==='takeover'?'lecture':m);wakeUntil.current=0;},[]);
 const ask=useCallback(async(question:string,override?:LiveMode)=>{
  if(data.current.pending||data.current.speaking||!question.trim())return;clearTimeout(timer.current);setError('');setPending(true);data.current.pending=true;setStatus('Tænker');const controller=new AbortController();abort.current=controller;
  thinkingTimer.current=setTimeout(()=>{if(abort.current===controller&&!data.current.muted){const phrase=thinkingPhrase(question,thinkingIndex.current++);voiceSessionRef.current?.noteSpeech(phrase);actorRef.current.current?.enqueueSpeech(phrase);}},3000);
  const chosen=override||data.current.mode;if(chosen==='takeover')setMode(chosen);let answer='',done=false;
  try{const workspace=workspaceContext();const r=await fetch('/api/livi/chat',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:livePrompt(data.current.entries,question,chosen)}],leafyCore:readLeafyCore(),appContext:'live',workspace:{...workspace,environment:null,browser:undefined}})});
   if(!r.ok)throw Error(((await r.json()) as {error?:string}).error||'Leafy kunne ikke svare.');if(!r.body)throw Error('Svaret mangler.');const reader=r.body.getReader(),parser=new ChatStreamParser(),decoder=new TextDecoder();
   try{while(true){const chunk=await reader.read();if(controller.signal.aborted||abort.current!==controller)return;if(chunk.done)break;for(const event of parser.push(decoder.decode(chunk.value,{stream:true}))){if(event==='[DONE]'){done=true;continue;}const d=JSON.parse(event);if(d.error)throw Error(d.error.message);if(d.leafy){const e=d.leafy as AgentEvent;if(e.activity){setActivities(a=>[...a.slice(-14),e.activity!.label]);setStatus(e.activity.status==='working'?'Finder information':'Genererer svar');}if(e.artifact)setArtifacts(a=>[...a.slice(-7),e.artifact!]);if(e.approval)setApprovals(a=>[...a,e.approval!]);}const delta=d.choices?.[0]?.delta?.content;if(typeof delta==='string'){clearTimeout(thinkingTimer.current);answer+=delta;voiceSessionRef.current?.setOwn(answer);setCaption(answer);setStatus('Genererer svar');}if(d.choices?.[0]?.finish_reason)done=true;}}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   if(controller.signal.aborted)return;if(!done||!answer.trim())throw Error('Svaret blev afbrudt. Prøv igen.');add('leafy',answer);setCaption(answer);
   if(!data.current.muted){setStatus('Taler');for(const chunk of speechChunks(answer)){voiceSessionRef.current?.noteSpeech(chunk);actorRef.current.current?.enqueueSpeech(chunk);}}else{setStatus('Lytter');if(chosen==='takeover')setMode('lecture');}
  }catch(e){if(abort.current===controller&&!controller.signal.aborted&&(e as Error).name!=='AbortError'){setError((e as Error).message);setStatus('Lytter');setMode(m=>m==='takeover'?'lecture':m);}}finally{if(abort.current===controller){clearTimeout(thinkingTimer.current);setPending(false);data.current.pending=false;abort.current=null;}}
 },[add]);
 useLayoutEffect(()=>{data.current={entries,mode,muted,pending,speaking,presenterSpeaking};actorRef.current=actor;callbacks.current={add,ask,cancel};},[entries,mode,muted,pending,speaking,presenterSpeaking,actor,add,ask,cancel]);
 useEffect(()=>{const voiceSession=new VoiceSession({log:(kind,text)=>callbacks.current.add(kind==='leafy'?'leafy':'presenter',text),ask:text=>void callbacks.current.ask(text,/tag (?:den|det)|overtag|forklar dem/i.test(text)?'takeover':undefined),interrupt:()=>callbacks.current.cancel()});voiceSessionRef.current=voiceSession;return()=>{voiceSession.stop();voiceSessionRef.current=null;};},[]);
 useEffect(()=>{voiceSessionRef.current?.output(speaking,pending);voiceSessionRef.current?.setOwn(entries.findLast(e=>e.kind==='leafy')?.text||'');},[speaking,pending,entries]);
 const onSpeaking=useCallback((value:boolean)=>{if(!value&&actorRef.current.current?.isSpeechPending())return;setSpeaking(value);data.current.speaking=value;if(value){silentUntil.current=Infinity;setStatus('Taler');}else{silentUntil.current=Date.now()+1200;if(!data.current.pending){setStatus('Lytter');setMode(m=>m==='takeover'?'lecture':m);}}},[]);
 const heard=useCallback((text:string,final:boolean,speakerId?:number)=>{
  voiceSessionRef.current?.heard(text,final,speakerId);const shown=speakerId===undefined?text:`Taler ${speakerId+1}: ${text}`;if(!final){setCaption(shown);return;}setCaption(shown);
 },[]);
 const onActorError=useCallback((message:string)=>{clearTimeout(thinkingTimer.current);abort.current?.abort();abort.current=null;data.current.pending=false;data.current.speaking=false;setPending(false);setSpeaking(false);silentUntil.current=Date.now()+1200;actorRef.current.current?.stop();setError(message);setStatus('Lytter');setMode(m=>m==='takeover'?'lecture':m);},[]);
 function mute(){setMuted(v=>{if(!v)actorRef.current.current?.stop();return !v;});}
 async function approve(approval:Approval){try{const r=await fetch('/api/leafy/approval',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:approval.id,permissions:workspaceContext().permissions})});const result=await r.json() as {error?:string;result?:unknown};if(!r.ok)throw Error(result.error||'Godkendelsen fejlede.');setApprovals(a=>a.filter(x=>x.id!==approval.id));add('content',`Godkendt handling: ${approval.label}. Resultat: ${JSON.stringify(result).slice(0,3000)}`);void ask('Brug det netop godkendte resultat til at fuldføre det tidligere svar.');}catch(e){setError((e as Error).message);}}
 useEffect(()=>()=>{clearTimeout(thinkingTimer.current);abort.current?.abort();clearTimeout(timer.current);actorRef.current.current?.stop();},[]);
 return {mode,setMode,entries,setEntries,add,status,pending,speaking,muted,mute,caption,error,setError,activities,artifacts,approvals,approve,ask,cancel,heard,onSpeaking,onActorError};
}
