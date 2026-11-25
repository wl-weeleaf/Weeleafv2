import type {Viseme} from './LeafyNPC';
import type {SpeechEmotion} from './SpeechEmotion';
export type MouthCue={time:number;duration:number;id:Viseme};
export type TextCue={index:number;time:number};
export type SpeechPacket={audioUrl:string;visemes:MouthCue[];textCues?:TextCue[];text?:string;emotion?:SpeechEmotion};
const ids=new Set(['rest','MBP','AA','EE','OH','OO','FV','L']);
export function validateCues(cues:MouthCue[]){return cues.every(c=>Number.isFinite(c.time)&&Number.isFinite(c.duration)&&c.time>=0&&c.duration>0&&ids.has(c.id));}
export function visemeAt(cues:MouthCue[],seconds:number):Viseme{
 for(let i=cues.length-1;i>=0;i--){const c=cues[i];if(seconds>=c.time&&seconds<c.time+c.duration)return c.id;}return 'rest';
}
/** Plays ElevenLabs audio; acoustic energy drives the mouth, with provider timing as a fallback. */
export class LeafySpeech{
 state:'idle'|'speaking'='idle';
 emotion:SpeechEmotion='neutral';
private generation=0;private audio:HTMLAudioElement|null=null;private cues:MouthCue[]=[];private textCues:TextCue[]=[];private streamText='';private lastProgress='';private media:MediaSource|null=null;private source:SourceBuffer|null=null;private objectUrl='';private appendQueue=Promise.resolve();private streamStarted=false;private streamPlayRequested=false;private audioContext:AudioContext|null=null;private audioSource:MediaElementAudioSourceNode|null=null;private analyser:AnalyserNode|null=null;private captureDestination:MediaStreamAudioDestinationNode|null=null;private waveform:Uint8Array<ArrayBuffer>|null=null;private frequencies:Uint8Array<ArrayBuffer>|null=null;private audioLevel=0;
 get pending(){return this.state==='speaking'||!!this.audio&&!this.audio.ended;}
 constructor(private onState:(speaking:boolean)=>void,private onError:(message:string)=>void,private onProgress:(text:string)=>void=()=>{}){}
 captureAudioTrack(){try{if(typeof window.AudioContext!=='function')return null;this.audioContext??=new window.AudioContext();this.captureDestination??=this.audioContext.createMediaStreamDestination();if(this.audioSource)this.audioSource.connect(this.captureDestination);return this.captureDestination.stream.getAudioTracks()[0]??null;}catch{return null;}}
 private detachMeter(){try{this.audioSource?.disconnect();this.analyser?.disconnect();}catch{}this.audioSource=null;this.analyser=null;this.waveform=null;this.frequencies=null;}
 private attachMeter(audio:HTMLAudioElement){this.detachMeter();try{if(typeof window.AudioContext!=='function')return;this.audioContext??=new window.AudioContext();const analyser=this.audioContext.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.38;const source=this.audioContext.createMediaElementSource(audio);source.connect(analyser);analyser.connect(this.audioContext.destination);if(this.captureDestination)source.connect(this.captureDestination);this.audioSource=source;this.analyser=analyser;this.waveform=new Uint8Array(analyser.fftSize);this.frequencies=new Uint8Array(analyser.frequencyBinCount);void this.audioContext.resume().catch(()=>{});}catch{/* Alignment timing below remains the fallback if Web Audio is unavailable. */this.detachMeter();}}
 private change(speaking:boolean){this.state=speaking?'speaking':'idle';this.onState(speaking);}
 cancel(){this.generation++;if(this.audio){this.audio.onloadedmetadata=this.audio.onplaying=this.audio.onended=this.audio.onerror=null;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.audio=null;}this.detachMeter();if(this.media?.readyState==='open')try{this.media.endOfStream();}catch{}this.source=null;this.media=null;if(this.objectUrl){URL.revokeObjectURL(this.objectUrl);this.objectUrl='';}this.appendQueue=Promise.resolve();this.streamStarted=false;this.streamPlayRequested=false;this.cues=[];this.textCues=[];this.streamText='';this.lastProgress='';this.audioLevel=0;this.emotion='neutral';this.change(false);}
 async beginStream(emotion:SpeechEmotion,onStarted?:()=>void,onEnded?:(completed:boolean)=>void,text=''):Promise<boolean>{
  this.cancel();if(typeof MediaSource==='undefined'||!MediaSource.isTypeSupported('audio/mpeg'))return false;this.streamText=text;
  const gen=this.generation;this.emotion=emotion;const media=new MediaSource();this.media=media;this.objectUrl=URL.createObjectURL(media);const audio=new Audio(this.objectUrl);audio.preload='auto';this.audio=audio;this.attachMeter(audio);
  audio.onplaying=()=>{if(gen===this.generation){this.streamStarted=true;this.change(true);onStarted?.();}};
  audio.onended=()=>{if(gen===this.generation){this.change(false);onEnded?.(true);this.source=null;this.media=null;if(this.objectUrl){URL.revokeObjectURL(this.objectUrl);this.objectUrl='';}}};
  // Let the queue retry this segment through buffered playback before exposing
  // a fatal speech error to the conversation UI.
  audio.onerror=()=>{if(gen===this.generation){this.change(false);onEnded?.(false);this.source=null;this.media=null;if(this.objectUrl){URL.revokeObjectURL(this.objectUrl);this.objectUrl='';}}};
  try{await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Lydafspilleren startede ikke.')),8000);media.addEventListener('sourceopen',()=>{clearTimeout(timeout);try{this.source=media.addSourceBuffer('audio/mpeg');resolve();}catch(e){reject(e);}}, {once:true});media.addEventListener('error',()=>{clearTimeout(timeout);reject(Error('Browseren understøtter ikke streamet MP3-afspilning.'));},{once:true});});return true;}catch{this.cancel();return false;}
 }
 private async startBufferedStream(force=false){const audio=this.audio;if(!audio||this.streamStarted||this.streamPlayRequested)return;let ahead=0;try{for(let i=audio.buffered.length-1;i>=0;i--){const start=audio.buffered.start(i),end=audio.buffered.end(i);if(audio.currentTime>=start-.05&&audio.currentTime<=end){ahead=end-audio.currentTime;break;}if(audio.currentTime<start){ahead=end-Math.max(audio.currentTime,start);break;}}}catch{/* Some browsers expose buffered ranges only after playback begins. */}if(!force&&ahead<.55)return;this.streamPlayRequested=true;try{await audio.play();}catch{this.streamPlayRequested=false;throw Error('Browseren blokerede ElevenLabs-afspilning. Tryk på lydknappen igen.');}}
 appendStream(bytes:Uint8Array,cues:MouthCue[],textCues:TextCue[]=[]){this.cues.push(...cues);this.textCues.push(...textCues);const source=this.source;if(!source||!this.audio)throw Error('Lydstreamen er ikke klar.');this.appendQueue=this.appendQueue.then(()=>new Promise<void>((resolve,reject)=>{const append=()=>{source.removeEventListener('updateend',done);source.removeEventListener('error',failed);resolve();},done=()=>append(),failed=()=>{source.removeEventListener('updateend',done);source.removeEventListener('error',failed);reject(Error('Lyddata kunne ikke afspilles løbende.'));};source.addEventListener('updateend',done,{once:true});source.addEventListener('error',failed,{once:true});try{const copy=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;source.appendBuffer(copy);}catch(e){source.removeEventListener('updateend',done);source.removeEventListener('error',failed);reject(e);}}));return this.appendQueue.then(()=>this.startBufferedStream());}
 async finishStream(){await this.appendQueue;await this.startBufferedStream(true);if(this.media?.readyState==='open')try{this.media.endOfStream();}catch{}}
 async play(packet:SpeechPacket,onEnded?:(completed:boolean)=>void,onStarted?:()=>void){
  if(!validateCues(packet.visemes))throw new Error('Ugyldige lipsync-tidsstempler fra ElevenLabs.');
  this.cancel();const gen=this.generation;this.cues=[...packet.visemes].sort((a,b)=>a.time-b.time);this.textCues=[...(packet.textCues||[])].sort((a,b)=>a.time-b.time);this.streamText=packet.text||'';this.emotion=packet.emotion??'neutral';const audio=new Audio(packet.audioUrl);this.audio=audio;this.attachMeter(audio);
  audio.onplaying=()=>{if(gen===this.generation){this.change(true);onStarted?.();}};audio.onended=()=>{if(gen===this.generation){this.change(false);onEnded?.(true);}};audio.onerror=()=>{if(gen===this.generation){this.change(false);this.onError('ElevenLabs-lyden kunne ikke afspilles.');onEnded?.(false);}};
  try{await audio.play();}catch(e){if(gen===this.generation){this.cancel();this.onError('Afspilning af ElevenLabs-lyd blev afvist. Tryk på Afspil igen.');}throw e;}
 }
 getMouthState():{viseme:Viseme;energy:number}{
  const audio=this.audio;if(this.state!=='speaking'||!audio||audio.paused||audio.ended)return{viseme:'rest',energy:0};
  const analyser=this.analyser,waveform=this.waveform,frequencies=this.frequencies;let hz=0,rawLevel=0;
  if(analyser&&waveform&&frequencies){analyser.getByteTimeDomainData(waveform);let sum=0;for(const value of waveform){const sample=(value-128)/128;sum+=sample*sample;}const rms=Math.sqrt(sum/waveform.length),target=THREEClamp((rms-.009)*12,0,1);rawLevel=target;this.audioLevel+=(target-this.audioLevel)*(target>this.audioLevel ? .48 : .24);analyser.getByteFrequencyData(frequencies);let weighted=0,total=0;for(let i=1;i<frequencies.length;i++){const amp=frequencies[i];weighted+=i*amp;total+=amp;}hz=(weighted/(total||1))*(this.audioContext?.sampleRate||44100)/analyser.fftSize;}
  // ElevenLabs character timestamps choose the mouth pose. Audio energy only
  // adds natural emphasis; it must never replace the timed articulation with
  // a coarse frequency guess when alignment is available.
  if(this.cues.length)return{viseme:visemeAt(this.cues,audio.currentTime),energy:this.audioLevel};
  if(analyser&&rawLevel>.108){if(hz>3300)return{viseme:'FV',energy:this.audioLevel};if(hz>2450)return{viseme:'EE',energy:this.audioLevel};if(hz<900)return{viseme:'OH',energy:this.audioLevel};if(hz<1450)return{viseme:'OO',energy:this.audioLevel};return{viseme:'AA',energy:this.audioLevel};}
  // When alignment is unavailable, retain the documented audio-analysis
  // fallback and measure timing on the playback clock rather than text speed.
  return{viseme:visemeAt(this.cues,audio.currentTime),energy:this.audioLevel};
 }
 getViseme():Viseme{return this.getMouthState().viseme;}
 getSpokenText(){const audio=this.audio,text=Array.from(this.streamText);if(!text.length||!audio||this.state!=='speaking')return'';let count=0;if(audio.ended)count=text.length;else if(this.textCues.length){for(const cue of this.textCues){if(cue.time>audio.currentTime)break;count=Math.max(count,Math.min(text.length,cue.index));}}else{const duration=Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:Math.max(1.2,text.length/13);count=Math.min(text.length,Math.floor(text.length*audio.currentTime/duration));}const progress=text.slice(0,count).join('');if(progress!==this.lastProgress){this.lastProgress=progress;this.onProgress(progress);}return progress;}
 dispose(){this.cancel();void this.audioContext?.close().catch(()=>{});this.audioContext=null;}
}
function THREEClamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value));}
