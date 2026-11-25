export type CortiEngine='auto'|'transcribe'|'streams';
export type TranscriptEngine=CortiEngine|'scribe';
export type VoiceTelemetry={event:'connecting'|'connected'|'interim'|'final'|'audio'|'language'|'warning'|'error'|'ended';engine:TranscriptEngine;at:number;latencyMs?:number;text?:string;language?:string;packets?:number;bufferedBytes?:number;error?:string;speakerId?:number};
type TranscriptOptions={engine?:CortiEngine|'auto';diarize?:boolean;onTelemetry?:(event:VoiceTelemetry)=>void;onLanguage?:(language:string)=>void};
type TranscriptSegment={text?:string;transcript?:string;isFinal?:boolean;is_final?:boolean;final?:boolean;speakerId?:number;speaker_id?:number;time?:{start?:number}};
type CortiTranscriptEvent={type?:string;data?:TranscriptSegment|TranscriptSegment[]|string|{segments?:TranscriptSegment[];text?:string;isFinal?:boolean;is_final?:boolean};error?:string|{details?:string};reason?:string};

/** One live recognition connection per active mic stream. The caller owns the mic. */
export async function transcribe(stream:MediaStream,onText:(text:string,final:boolean,speakerId?:number)=>void,onStatus:(s:string)=>void,onError:(s:string)=>void,signal?:AbortSignal,options:TranscriptOptions={}){
 const selected=options.engine??'auto';
 if(selected==='auto'){
  try{
   const response=await fetch('/api/leafy/elevenlabs/scribe-token',{method:'POST',cache:'no-store',signal});
   const session=await response.json() as {configured?:boolean;token?:string;error?:string};
   if(signal?.aborted)return()=>{};
   if(!response.ok)throw Error(session.error||'ElevenLabs kunne ikke oprette en sproggenkendelsessession.');
   if(response.ok&&session.configured&&session.token)return startScribe(stream,session.token,onText,onStatus,onError,signal,options);
   if(session.configured)throw Error(session.error||'ElevenLabs Scribe kunne ikke startes.');
   // Corti remains a Danish fallback when this browser has no ElevenLabs key.
   return startCorti(stream,'transcribe',onText,onStatus,onError,signal,options);
  }catch(error){
   if(signal?.aborted)return()=>{};
   onError((error as Error).message||'Automatisk sproggenkendelse kunne ikke startes.');return()=>{};
  }
 }
 return startCorti(stream,selected,onText,onStatus,onError,signal,options);
}

async function startScribe(stream:MediaStream,token:string,onText:(text:string,final:boolean,speakerId?:number)=>void,onStatus:(s:string)=>void,onError:(s:string)=>void,signal:AbortSignal|undefined,options:TranscriptOptions){
 const startedAt=performance.now();let closed=false,configured=false,socket:WebSocket|null=null,context:AudioContext|null=null,source:MediaStreamAudioSourceNode|null=null,node:AudioWorkletNode|null=null,gain:GainNode|null=null,timer:ReturnType<typeof setTimeout>|undefined,packets=0,firstText=false;
 const report=(event:VoiceTelemetry['event'],values:Partial<VoiceTelemetry>={})=>options.onTelemetry?.({event,engine:'scribe',at:Date.now(),...values});
 const dispose=()=>{if(timer)clearTimeout(timer);if(node){node.port.onmessage=null;try{node.disconnect();}catch{}node=null;}if(source){try{source.disconnect();}catch{}source=null;}if(gain){try{gain.disconnect();}catch{}gain=null;}if(context){void context.close().catch(()=>{});context=null;}if(socket){socket.onopen=socket.onmessage=socket.onerror=socket.onclose=null;try{socket.close();}catch{}socket=null;}};
 const stop=()=>{if(closed)return;closed=true;signal?.removeEventListener('abort',stop);dispose();};
 const fail=(message:string)=>{if(closed)return;report('error',{error:message});stop();onError(message);};
 signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted){stop();return stop;}
 try{
  const url=new URL('wss://api.elevenlabs.io/v1/speech-to-text/realtime');
  // Scribe's browser WebSocket must receive the one-use token minted by our
  // server. Without it the handshake is unauthenticated, closes immediately,
  // and the voice controller keeps minting fresh tokens on every retry.
  url.searchParams.set('token',token);url.searchParams.set('model_id','scribe_v2_realtime');url.searchParams.set('audio_format','pcm_16000');url.searchParams.set('sample_rate','16000');
  // Omitting language_code requests automatic language identification. Detection metadata
  // arrives with the timestamp event after each committed segment.
  url.searchParams.set('commit_strategy','vad');url.searchParams.set('vad_silence_threshold_secs','1.0');url.searchParams.set('include_timestamps','true');url.searchParams.set('include_language_detection','true');url.searchParams.set('enable_logging','false');url.searchParams.set('keepalive_interval_ms','3000');
  report('connecting');socket=new WebSocket(url.toString());const ws=socket;
  const startup=setTimeout(()=>{if(!configured)fail('ElevenLabs Scribe svarede ikke ved opstart.');},12000);timer=startup;
  ws.onopen=()=>{if(closed)return;report('connected',{latencyMs:Math.round(performance.now()-startedAt)});};
  ws.onmessage=event=>{if(closed||typeof event.data!=='string')return;let message:{message_type?:string;text?:string;language_code?:string;error?:string;warning?:string};try{message=JSON.parse(event.data) as typeof message;}catch{return;}
   if(message.message_type==='session_started'){
    if(configured)return;configured=true;clearTimeout(startup);void beginAudio();onStatus('ElevenLabs Scribe · automatisk sproggenkendelse');return;
   }
   if(message.message_type==='warning'){report('warning',{error:(message.warning||'ElevenLabs sendte en advarsel.').slice(0,240)});return;}
   if(message.message_type==='rate_limited'||message.message_type==='error'){fail(message.error||'ElevenLabs Scribe afviste lydsessionen. Kontrollér API-adgang og credits.');return;}
   if(message.message_type==='partial_transcript'||message.message_type==='committed_transcript'){
    const text=(message.text||'').trim();if(!text)return;const final=message.message_type==='committed_transcript';
    report(final?'final':'interim',{latencyMs:!firstText?Math.round(performance.now()-startedAt):undefined,text:text.slice(0,240)});firstText=true;onText(text,final);return;
   }
   if(message.message_type==='committed_transcript_with_timestamps'&&message.language_code){
    const language=message.language_code.toLowerCase();report('language',{language});options.onLanguage?.(language);
   }
  };
  ws.onerror=()=>fail('Forbindelsen til ElevenLabs sproggenkendelse blev afbrudt.');ws.onclose=()=>{if(!closed)fail('ElevenLabs lukkede sproggenkendelsen. Lytningen prøver at genoprette forbindelsen.');};
  function beginAudio(){
   if(closed||!ws||ws.readyState!==WebSocket.OPEN)return;
   void (async()=>{
    try{
     const AudioContextConstructor=window.AudioContext;if(!AudioContextConstructor)throw Error('Denne browser understøtter ikke realtime-lyd.');
     context=new AudioContextConstructor();await context.audioWorklet.addModule('/leafy/scribe-audio-worklet.js');if(closed)return;
     source=context.createMediaStreamSource(stream);node=new AudioWorkletNode(context,'leafy-scribe-pcm',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});gain=context.createGain();gain.gain.value=0;
      node.port.onmessage=event=>{if(closed||ws.readyState!==WebSocket.OPEN||!configured)return;const samples=event.data instanceof ArrayBuffer?new Float32Array(event.data):event.data as Float32Array;if(!(samples instanceof Float32Array)||!samples.length)return;
      const pcm=toPcm16k(samples,context?.sampleRate||48000);if(!pcm.length)return;const bytes=new Uint8Array(pcm.buffer,pcm.byteOffset,pcm.byteLength);let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));
      ws.send(JSON.stringify({message_type:'input_audio_chunk',audio_base_64:btoa(binary)}));packets++;if(packets%12===0)report('audio',{packets,bufferedBytes:ws.bufferedAmount});
     };
     source.connect(node);node.connect(gain);gain.connect(context.destination);await context.resume();
    }catch(error){fail((error as Error).message||'Mikrofonlyden kunne ikke sendes til ElevenLabs.');}
   })();
  }
  return stop;
 }catch(error){if(!closed&&!signal?.aborted)fail((error as Error).message||'ElevenLabs Scribe kunne ikke startes.');stop();return stop;}
}

function toPcm16k(input:Float32Array,inputRate:number){
 const ratio=inputRate/16000,length=Math.floor(input.length/ratio);if(length<1)return new Int16Array();const output=new Int16Array(length);
 for(let i=0;i<length;i++){const start=Math.floor(i*ratio),end=Math.min(input.length,Math.max(start+1,Math.floor((i+1)*ratio)));let sum=0;for(let j=start;j<end;j++)sum+=input[j];const sample=Math.max(-1,Math.min(1,sum/(end-start)));output[i]=sample<0?sample*32768:sample*32767;}
 return output;
}

async function startCorti(stream:MediaStream,engine:CortiEngine,onText:(text:string,final:boolean,speakerId?:number)=>void,onStatus:(s:string)=>void,onError:(s:string)=>void,signal?:AbortSignal,options:TranscriptOptions={}){
 let closed=false,socket:WebSocket|null=null,recorder:MediaRecorder|null=null,timer:ReturnType<typeof setTimeout>|undefined,packets=0,startedAt=0,firstText=false;
 const report=(event:VoiceTelemetry['event'],values:Partial<VoiceTelemetry>={})=>options.onTelemetry?.({event,engine,at:Date.now(),...values});
 const dispose=()=>{if(recorder){recorder.ondataavailable=null;recorder.onstop=null;if(recorder.state!=='inactive')try{recorder.stop();}catch{}recorder=null;}if(socket){socket.onopen=socket.onmessage=socket.onerror=socket.onclose=null;try{socket.close();}catch{}socket=null;}};
 const stop=()=>{if(closed)return;closed=true;clearTimeout(timer);signal?.removeEventListener('abort',stop);dispose();};
 const fail=(message:string)=>{if(closed)return;report('error',{error:message});stop();onError(message);};
 signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted){stop();return stop;}
 try{
  report('connecting');startedAt=performance.now();
  const endpoint=engine==='streams'?'/api/livi/corti-stream':'/api/livi/corti-transcribe';
  const response=await fetch(endpoint,{method:engine==='streams'?'POST':'GET',cache:'no-store',signal});
  const session=await response.json() as {url?:string;error?:string};if(!response.ok||!session.url)throw Error(session.error||'Corti kunne ikke starte talegenkendelsen.');
  if(closed||signal?.aborted){stop();return stop;}
  const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw Error('Denne browser har ikke et lydformat, som Corti kan modtage.');
  socket=new WebSocket(session.url);const ws=socket;recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:32000});const rec=recorder;
  let configured=false,sendQueue=Promise.resolve();
  rec.ondataavailable=e=>{if(!e.data.size||closed)return;sendQueue=sendQueue.then(async()=>{const data=await e.data.arrayBuffer();if(closed)return;if(data.byteLength>64000){fail('En lydpakke blev større end Cortis grænse. Prøv igen med en stabil forbindelse.');return;}if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>1000000){fail('Lydforbindelsen er overbelastet. Prøv igen, når forbindelsen er stabil.');return;}ws.send(data);packets++;if(packets%10===0)report('audio',{packets,bufferedBytes:ws.bufferedAmount});}}).catch(()=>fail('Lydpakken kunne ikke sendes til Corti.'));};
  ws.onopen=()=>{if(closed)return;const configuration=engine==='streams'?{transcription:{primaryLanguage:'da',diarize:!!options.diarize,isMultichannel:false},mode:{type:'transcription',outputLocale:'da'},retentionPolicy:'none',audioFormat:mime,keyterms:{terms:[{term:'Leafy'},{term:'Hej Leafy'},{term:'WeeLeaf'}]}}:{primaryLanguage:'da',interimResults:true,automaticPunctuation:true,audioFormat:mime,keyterms:{terms:[{term:'Leafy'},{term:'Hej Leafy'},{term:'WeeLeaf'}]}};ws.send(JSON.stringify({type:'config',configuration}));};
  timer=setTimeout(()=>{if(!configured)fail('Corti svarede ikke på opsætningen inden for 15 sekunder.');},15000);
  ws.onmessage=e=>{if(closed)return;let message:CortiTranscriptEvent;try{message=JSON.parse(typeof e.data==='string'?e.data:String(e.data)) as CortiTranscriptEvent;}catch{return;}
   if(message.type==='CONFIG_ACCEPTED'&&!configured){configured=true;clearTimeout(timer);try{rec.start(350);report('connected',{latencyMs:Math.round(performance.now()-startedAt)});onStatus(engine==='streams'?'Corti Streams · dansk samtale':'Corti Transcribe · dansk live-transskription');}catch{fail('Mikrofonen kunne ikke starte.');}return;}
   if(message.type==='CONFIG_DENIED'||message.type==='CONFIG_REJECTED'||message.type==='CONFIG_TIMEOUT'||message.type==='CONFIG_NOT_PROVIDED'||message.type==='error'){const detail=typeof message.error==='string'?message.error:typeof message.error==='object'?message.error.details??'':message.reason??'';fail(detail?`Corti afviste forbindelsen: ${detail}`:'Corti afviste talegenkendelsen. Kontrollér sprog, rettigheder og lydformat.');return;}
   if(message.type?.toLowerCase()==='transcript'){
    const payload=message.data;const raw:TranscriptSegment[]=typeof payload==='string'?[{text:payload}]:Array.isArray(payload)?payload:payload&&typeof payload==='object'&&'segments'in payload?(payload.segments??[]):payload&&typeof payload==='object'?[payload]:[];
    const segments=raw.filter((segment):segment is TranscriptSegment=>!!segment).slice().sort((a,b)=>(a.time?.start??0)-(b.time?.start??0));
    for(const segment of segments){const text=(segment?.text??segment?.transcript??'').trim();if(!text)continue;const final=!!(segment.isFinal??segment.is_final??segment.final),speakerId=segment.speakerId??segment.speaker_id;report(final?'final':'interim',{latencyMs:!firstText?Math.round(performance.now()-startedAt):undefined,text:text.slice(0,240),speakerId});firstText=true;onText(text,final,speakerId);}
   }
   if(message.type==='ENDED'){report('ended',{packets});if(!closed)fail('Corti Streams nåede slutningen af sessionen. Forbindelsen forsøger at starte igen.');}
  };
  ws.onerror=()=>fail('Corti-forbindelsen fejlede. Kontrollér internet og Corti-adgang.');ws.onclose=()=>{if(!closed)fail('Corti lukkede forbindelsen. Den prøver at genoprette lytningen.');};
  return stop;
 }catch(error){if(!closed&&!signal?.aborted)fail((error as Error).message||'Corti kunne ikke starte.');stop();return stop;}
}
