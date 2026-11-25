import {wakeCommand} from '../leafy-live/services/sceneDirector.mjs';
import {collapseRepeatedVoicePhrases,mergeVoiceText,normalizeVoiceText,voiceQueryTerms} from './text';

export type VoiceMode='conversation'|'ambient';
export type VoiceEntry={id:string;time:number;kind:'heard'|'leafy'|'gap';text:string};

const TRAILING_WORDS=/\b(og|men|fordi|at|som|hvis|når|eller|til|med|for|om|så|hvor|hvordan|hvad|det|den|de|jeg|vi|du|kan|skal|vil)\s*[,.;:!?…]*$/iu;
const SILENCE_MS=1350,INCOMPLETE_SILENCE_MS=1900,INTERIM_SILENCE_MS=1800;
const waitForTurn=(text:string)=>/[.!?…][\])}"'»]*$/u.test(text.trim())?SILENCE_MS:TRAILING_WORDS.test(text.trim())?INCOMPLETE_SILENCE_MS:SILENCE_MS;

export class VoiceSession{
 private echoUntil=0;private spoken:{text:string;at:number}[]=[];
 private timer:ReturnType<typeof setTimeout>|undefined;private draftTimer:ReturnType<typeof setTimeout>|undefined;private bargeTimer:ReturnType<typeof setTimeout>|undefined;
 private finalText='';private draft='';private command='';private fallbackDraft='';private fallbackAt=0;
 private lastSent='';private sentAt=0;private lastCommitted='';private committedAt=0;private followUntil=0;private interruptedThisTurn=false;
 private busy=false;private talking=false;private own='';private disposed=false;private arm=false;private armUntil=0;
 constructor(private handlers:{log:(kind:VoiceEntry['kind'],text:string)=>void;ask:(text:string)=>void;interrupt:()=>void;addressed?:(text:string)=>void;transcript?:(text:string,final:boolean)=>void},private now=()=>Date.now(),private mode:VoiceMode='ambient'){}
 setMode(mode:VoiceMode){if(this.mode!==mode){this.reset();this.mode=mode;this.handlers.addressed?.('');}}
 noteSpeech(text:string){this.spoken=[...this.spoken.filter(s=>this.now()-s.at<120000),{text:normalizeVoiceText(text).replace(/ /g,''),at:this.now()}].slice(-24);}
 private isEcho(text:string){const normalized=normalizeVoiceText(text).replace(/ /g,'');if(normalized.length<5)return false;return [this.own,...this.spoken.map(s=>s.text)].some(s=>s.includes(normalized));}
 setOwn(text:string){this.own=normalizeVoiceText(text).replace(/ /g,'');}
 remember(text:string){this.setOwn(text);this.handlers.log('leafy',text);}
 output(talking:boolean,pending:boolean){const was=this.busy,wasTalking=this.talking;if(wasTalking&&!talking)this.echoUntil=this.now()+1800;this.talking=talking;this.busy=pending||talking;if(was&&!this.busy)this.followUntil=this.now()+8000;}

 heard(text:string,final:boolean,speakerId?:number){
  if(this.disposed||!text.trim())return;
  const clean=collapseRepeatedVoicePhrases(text.trim()),normal=normalizeVoiceText(clean).replace(/ /g,''),wake=wakeCommand(clean);
  if(this.isEcho(clean)&&((this.talking||this.busy||this.now()<this.echoUntil)||this.spoken.some(s=>this.now()-s.at<15000)))return;

  // A repeated final often arrives after silence fallback. Consume it rather
  // than interrupting Leafy or logging/answering the same utterance twice.
  if(final&&normal&&this.lastCommitted&&normal===this.lastCommitted&&this.now()-this.committedAt<5000){
   if(this.fallbackDraft===normal){this.fallbackDraft='';this.draft='';clearTimeout(this.draftTimer);return;}
   if(this.busy||this.now()-this.sentAt<1500)return;
  }
  this.handlers.transcript?.(clean,final);
  const addressedText=wake===null?clean:wake;
  const addressedNormal=normalizeVoiceText(addressedText).replace(/ /g,'');
  if(addressedNormal&&addressedNormal===this.lastSent&&this.now()-this.sentAt<5000&&(this.busy||this.now()-this.sentAt<1500))return;
  if(this.arm&&this.now()>=this.armUntil){this.arm=false;this.armUntil=0;this.command='';this.finalText='';this.draft='';}

  // A real, non-echo interruption cancels the current answer before the new
  // utterance is assembled. Short interim fragments are too noisy to barge in.
  if(this.busy){
   if(!final){if(normal.length<12)return;clearTimeout(this.bargeTimer);this.bargeTimer=setTimeout(()=>{if(!this.disposed&&this.busy){this.interruptForUser();this.capture(clean,false);}},240);return;}
   this.interruptForUser();
  }
  this.capture(clean,final,speakerId);
 }

 private capture(text:string,final:boolean,speakerId?:number){
  // Corti finalizes ambient meeting speech sentence by sentence. Keep clauses
  // together, but close a finished sentence before the next one so a later
  // wake phrase is not hidden behind the entire meeting transcript.
  const incomingWake=final?wakeCommand(text):null;
  if(final&&this.mode==='ambient'&&this.finalText&&(
   (incomingWake!==null&&wakeCommand(this.finalText)===null)||
   (/[.!?…][\])}"'»]*$/u.test(this.finalText.trim())&&normalizeVoiceText(mergeVoiceText(this.finalText,text))!==normalizeVoiceText(this.finalText))
  )){
   clearTimeout(this.timer);clearTimeout(this.draftTimer);this.finishTurn();
  }
  if(final){this.finalText=mergeVoiceText(this.finalText,text);this.draft='';}
  else{
   this.draft=mergeVoiceText(this.finalText,this.draft?mergeVoiceText(this.draft,text):text);
  }

  const utterance=this.draft||this.finalText;
  this.handlers.transcript?.(utterance,final);
  if(!utterance)return;
  this.planCommand(utterance);
  const silence=final?waitForTurn(utterance):INTERIM_SILENCE_MS;
  clearTimeout(this.timer);clearTimeout(this.draftTimer);
  if(final)this.timer=setTimeout(()=>this.finishTurn(speakerId),silence);
  else this.draftTimer=setTimeout(()=>this.finishTurn(speakerId,true),silence);
 }

 private planCommand(utterance:string){
  const wake=wakeCommand(utterance);
  if(wake!==null){
   this.arm=true;this.armUntil=this.now()+8000;
   if(wake)this.command=mergeVoiceText(this.command,wake);
   this.handlers.addressed?.(utterance);
   return;
  }
  if(this.mode==='conversation'||this.command||(this.arm&&this.now()<this.armUntil)||this.now()<this.followUntil){
   this.command=mergeVoiceText(this.command,utterance);this.arm=false;this.handlers.addressed?.(this.command);
  }else this.handlers.addressed?.('');
 }

 private finishTurn(speakerId?:number,fallback=false){
  clearTimeout(this.timer);clearTimeout(this.draftTimer);clearTimeout(this.bargeTimer);this.bargeTimer=undefined;
  if(fallback&&this.draft){this.finalText=mergeVoiceText(this.finalText,this.draft);this.draft='';}
  const utterance=this.finalText.trim();if(!utterance){this.resetTurn();return;}
  const wake=wakeCommand(utterance);
  if(wake!==null){this.arm=true;if(!this.armUntil)this.armUntil=this.now()+8000;if(wake)this.command=mergeVoiceText(this.command,wake);}
  const command=this.command.trim();
  if(!command){
   this.logHeard(utterance);
   if(this.arm&&this.now()<this.armUntil){this.finalText='';this.draft='';this.command='';return;}
   this.resetTurn();return;
  }
  if(this.mode==='ambient'&&this.now()>this.followUntil&&!this.arm&&!this.command){this.logHeard(utterance);this.resetTurn();return;}
  const normalized=normalizeVoiceText(command).replace(/ /g,'');
  if(/^(?:stop|vent(?: lige)?|pause|hold op|ti stille)[.!?…]*$/iu.test(command.trim())){
   this.logHeard(utterance,speakerId);if(!this.interruptedThisTurn)this.handlers.interrupt();this.interruptedThisTurn=false;this.resetTurn();return;
  }
  if(!normalized||normalized===this.lastSent&&this.now()-this.sentAt<5000){this.resetTurn();return;}
  this.logHeard(utterance,speakerId);this.lastCommitted=normalizeVoiceText(utterance).replace(/ /g,'');this.committedAt=this.now();
  this.command='';this.arm=false;this.followUntil=0;
  this.lastSent=normalized;this.sentAt=this.now();this.busy=true;this.handlers.addressed?.('');this.handlers.ask(command);
  this.finalText='';this.draft='';
 }

 private logHeard(text:string,speakerId?:number){
  const normalized=normalizeVoiceText(text).replace(/ /g,'');if(!normalized)return;
  if(normalized===this.lastCommitted&&this.now()-this.committedAt<5000)return;
  this.handlers.log('heard',speakerId===undefined?text:`Taler ${speakerId+1}: ${text}`);this.lastCommitted=normalized;this.committedAt=this.now();
 }
 private interruptForUser(){clearTimeout(this.bargeTimer);clearTimeout(this.timer);clearTimeout(this.draftTimer);this.bargeTimer=undefined;this.handlers.interrupt();this.interruptedThisTurn=true;this.busy=false;this.talking=false;this.followUntil=this.now()+8000;this.command='';this.finalText='';this.draft='';this.arm=false;}
 private resetTurn(){this.finalText='';this.draft='';this.command='';this.arm=false;this.armUntil=0;this.interruptedThisTurn=false;this.handlers.addressed?.('');}
 reset(){clearTimeout(this.timer);clearTimeout(this.draftTimer);clearTimeout(this.bargeTimer);this.timer=this.draftTimer=this.bargeTimer=undefined;this.finalText='';this.draft='';this.command='';this.arm=false;this.armUntil=0;this.followUntil=0;}
 stop(){this.disposed=true;this.reset();}
}

export function voiceContext(entries:VoiceEntry[],query:string,analyses:{date:string;summary:string}[]=[]){
 const terms=voiceQueryTerms(query),seen=new Set<string>();
 const deduplicated=entries.filter(entry=>{
  const key=`${entry.kind}:${normalizeVoiceText(entry.text)}`;if(!key.endsWith(':')&&seen.has(key))return false;seen.add(key);return true;
 });
 const recent=deduplicated.slice(-22),recentIds=new Set(recent.map(e=>e.id));
 const older=deduplicated.slice(0,-22).filter(e=>e.kind!=='gap').map((e,index)=>{
  const text=normalizeVoiceText(e.text),matches=terms.reduce((count,term)=>count+(text.includes(term)?1:0),0);
  const recency=index/Math.max(1,deduplicated.length);
  return{e,score:matches/Math.max(1,terms.length)+recency*.08};
 }).filter(x=>x.score>.05).sort((a,b)=>b.score-a.score||b.e.time-a.e.time).slice(0,6).map(x=>x.e).filter(e=>!recentIds.has(e.id));
 const daily=analyses.map(a=>{const text=normalizeVoiceText(a.summary),matches=terms.reduce((count,term)=>count+(text.includes(term)?1:0),0);return{a,score:matches/Math.max(1,terms.length)};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||b.a.date.localeCompare(a.a.date)).slice(0,3).map(({a})=>`Dagsanalyse ${a.date}: ${a.summary}`);
 const messages=[...daily,...[...older,...recent].map(e=>`${new Date(e.time).toISOString()} · ${e.kind}: ${e.text}`)];
 let context='';for(const message of messages){const next=`${context}${context?'\n':''}${message}`;if(next.length>7500){const remaining=7500-context.length-(context?1:0);if(remaining>120)context+=`${context?'\n':''}${message.slice(0,remaining)}…`;break;}context=next;}
 return context;
}
