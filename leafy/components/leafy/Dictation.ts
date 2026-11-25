import {VoiceActivity} from '@/lib/leafy/voice-turn';
import {transcribe} from '@/features/leafy-live/services/transcription';
// Optional browser speech recognition; the browser/provider may process microphone audio remotely.
export function startDictation(onText:(text:string)=>void,onEnd:()=>void,onError:(message:string)=>void){
 const api=window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};const Constructor=api.SpeechRecognition??api.webkitSpeechRecognition;
 if(!Constructor)throw Error('Diktering er ikke understøttet i denne browser. Skriv din besked i feltet.');
 const recognition=new Constructor();recognition.lang='da-DK';recognition.continuous=false;recognition.interimResults=true;
 recognition.onresult=e=>{let text='';for(let i=0;i<e.results.length;i++)text+=e.results[i][0].transcript;onText(text);};recognition.onend=onEnd;recognition.onerror=e=>{if(e.error!=='aborted')onError('Diktering stoppede: '+(e.error==='not-allowed'?'mikrofonadgang blev ikke givet.':'prøv igen eller skriv din besked.'));onEnd();};recognition.start();return ()=>{recognition.onresult=null;recognition.onend=null;recognition.onerror=null;recognition.abort();onEnd();};
}

/** Dictation for the chat field: one mic stream, Danish recognition, final text only commits to the field. */
export async function startAutoDictation(onText:(text:string)=>void,onEnd:()=>void,onError:(message:string)=>void,signal?:AbortSignal):Promise<()=>void>{
 if(!navigator.mediaDevices?.getUserMedia)throw Error('Denne browser kan ikke åbne mikrofonen. Skriv din besked i feltet.');
 const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
 if(signal?.aborted){stream.getTracks().forEach(track=>track.stop());throw new DOMException('Afbrudt','AbortError');}
 let closed=false,cancelRecognition:(()=>void)|undefined,quiet:ReturnType<typeof setTimeout>|undefined,committed='',partial='';
 const finish=()=>{if(closed)return;closed=true;if(quiet)clearTimeout(quiet);signal?.removeEventListener('abort',finish);cancelRecognition?.();stream.getTracks().forEach(track=>track.stop());onEnd();};
 signal?.addEventListener('abort',finish,{once:true});
 try{
  const cancel=await transcribe(stream,(text,final)=>{if(closed)return;if(final){committed=[committed,text].filter(Boolean).join(' ');partial='';if(quiet)clearTimeout(quiet);quiet=setTimeout(finish,1800);}else partial=text;onText([committed,partial].filter(Boolean).join(' '));},()=>{},message=>{if(!closed)onError(message);finish();},signal,{engine:'transcribe'});
  if(closed)cancel();else cancelRecognition=cancel;
  return finish;
 }catch(error){finish();if((error as Error).name!=='AbortError')throw error;return finish;}
}
type Recognition={lang:string;continuous:boolean;interimResults:boolean;onresult:((e:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;onend:(()=>void)|null;onerror:((e:{error:string})=>void)|null;start:()=>void;abort:()=>void};

// Corti's /transcribe WebSocket delivers interim and final Danish transcript segments.
// The OAuth client secret never enters this module; the server issues a short-lived session.
export async function startCortiDictation(onText:(text:string)=>void,onEnd:()=>void,onError:(message:string)=>void,signal?:AbortSignal):Promise<()=>void>{
 if(!navigator.mediaDevices?.getUserMedia||!('MediaRecorder' in window))throw Error('Denne browser kan ikke optage lyd til Corti. Skriv din besked i feltet.');
 const mimeType=['audio/webm;codecs=opus','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
 if(!mimeType)throw Error('Denne browser har ikke et lydformat, som Corti kan modtage.');
 const response=await fetch('/api/livi/corti-transcribe',{cache:'no-store',signal});
 if(!response.ok)throw Error(((await response.json()) as {error?:string}).error||'Corti talegenkendelse er ikke tilgængelig.');
 const {url}=await response.json() as {url:string};
 const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
 if(signal?.aborted){stream.getTracks().forEach(track=>track.stop());throw new DOMException('Afbrudt','AbortError');}
 const recorder=new MediaRecorder(stream,{mimeType,audioBitsPerSecond:32000});
 return new Promise<()=>void>((resolve,reject)=>{
  let socket:WebSocket;
  try{socket=new WebSocket(url);}catch{stream.getTracks().forEach(track=>track.stop());reject(Error('Corti forbindelsen kunne ikke åbnes.'));return;}
  let ready=false,finished=false,stopping=false,finalText='',endingTimer:ReturnType<typeof setTimeout>|null=null,finalTimer:ReturnType<typeof setTimeout>|null=null,vadTimer:ReturnType<typeof setInterval>|null=null;
  let audioContext:AudioContext|null=null,vadActive=false;
  const startVad=async()=>{
   try{const Context=window.AudioContext;if(!Context)return;audioContext=new Context();await audioContext.resume();if(finished||stopping){void audioContext.close();return;}if(audioContext.state!=='running')return;
    const source=audioContext.createMediaStreamSource(stream),analyser=audioContext.createAnalyser();analyser.fftSize=1024;source.connect(analyser);const samples=new Float32Array(analyser.fftSize),activity=new VoiceActivity();vadActive=true;
    vadTimer=setInterval(()=>{if(finished||stopping)return;analyser.getFloatTimeDomainData(samples);const rms=Math.sqrt(samples.reduce((sum,value)=>sum+value*value,0)/samples.length);if(activity.sample(rms,performance.now()))stop();},80);
   }catch{vadActive=false;}
  };
  const startupTimer=setTimeout(()=>fail('Corti svarede ikke på mikrofonforbindelsen.'),10000);
  let pendingAudio=Promise.resolve();
  const onAbort=()=>{if(!ready){reject(new DOMException('Afbrudt','AbortError'));cleanup();}else stop();};
  const cleanup=()=>{if(finished)return;finished=true;clearTimeout(startupTimer);if(endingTimer)clearTimeout(endingTimer);if(finalTimer)clearTimeout(finalTimer);if(vadTimer)clearInterval(vadTimer);void audioContext?.close().catch(()=>{});signal?.removeEventListener('abort',onAbort);recorder.onstop=null;if(recorder.state!=='inactive')recorder.stop();stream.getTracks().forEach(track=>track.stop());socket.close();onEnd();};
  const fail=(message:string)=>{if(finished)return;if(!ready)reject(Error(message));else onError(message);cleanup();};
  const stop=()=>{if(stopping||finished)return;stopping=true;if(recorder.state==='recording')recorder.stop();else cleanup();endingTimer=setTimeout(cleanup,6000);};
  signal?.addEventListener('abort',onAbort,{once:true});
  socket.onopen=()=>socket.send(JSON.stringify({type:'config',configuration:{primaryLanguage:'da',interimResults:true,automaticPunctuation:true,audioFormat:mimeType,keyterms:{terms:[{term:'Leafy'},{term:'WeeLeaf'}]}}}));
  socket.onmessage=event=>{
   if(finished)return;
   let data:{type?:string;data?:{text?:string;isFinal?:boolean}};
   try{data=JSON.parse(event.data);}catch{return;}
   if(data.type==='CONFIG_ACCEPTED'){
    clearTimeout(startupTimer);
    if(stopping)return;try{recorder.start(350);ready=true;void startVad();resolve(stop);}catch{fail('Mikrofonen kunne ikke optage lyd til Corti.');}
   }else if(data.type==='CONFIG_DENIED'||data.type==='CONFIG_REJECTED'||data.type==='CONFIG_TIMEOUT'||data.type==='error')fail('Corti afviste talegenkendelsen. Tjek sprog, adgang og lydformat.');
   else if(data.type==='transcript'&&typeof data.data?.text==='string'){
    const segment=data.data.text.trim();if(!segment)return;if(finalTimer)clearTimeout(finalTimer);if(!vadActive&&data.data.isFinal)finalTimer=setTimeout(stop,1800);
    if(data.data.isFinal)finalText=[finalText,segment].filter(Boolean).join(' ');
    onText([finalText,...(data.data.isFinal?[]:[segment])].filter(Boolean).join(' ').slice(0,6000));
   }else if(data.type==='ended')cleanup();
  };
  socket.onerror=()=>fail('Forbindelsen til Cortis talegenkendelse blev afbrudt.');
  socket.onclose=()=>{if(!finished)fail('Forbindelsen til Cortis talegenkendelse blev lukket.');};
  recorder.ondataavailable=event=>{if(!event.data.size)return;pendingAudio=pendingAudio.then(()=>event.data.arrayBuffer()).then(bytes=>{if(bytes.byteLength>64000)throw Error('Lydpakken er for stor.');if(socket.readyState===WebSocket.OPEN)socket.send(bytes);}).catch(()=>fail('Lyden kunne ikke sendes til Corti.'));};
  recorder.onstop=()=>{void pendingAudio.then(()=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'end'}));else cleanup();});};
 });
}
