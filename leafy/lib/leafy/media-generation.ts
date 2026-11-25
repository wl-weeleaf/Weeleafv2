import type {CortiCredentials} from '@/lib/livi/credentials';
import {bucket,uploadKey,safeFilename} from './files';
import {database,rateLimit} from './store';
import type {GeneratedMedia} from './actions';
import {elevenLabsCredentials} from '@/lib/livi/elevenlabs';

type Kind='image'|'video'|'sound'|'music';
type Flow={id?:string;status?:string;content_url?:string;content_mime_type?:string;error_message?:string;failure_reason?:string};
const MAX_OUTPUT=45_000_000;
function providerError(status:number,body:string){
 let detail='';try{const data=JSON.parse(body) as {detail?:{message?:string}|string;message?:string};detail=typeof data.detail==='string'?data.detail:data.detail?.message||data.message||'';}catch{}
 if(status===401||status===403)return detail||'ElevenLabs afviste adgang til denne medietype. Leafy vil tilbyde den nærmeste indbyggede løsning.';
 if(status===402)return detail||'ElevenLabs-kontoen mangler adgang eller credits til denne medietype.';
 if(status===429)return 'ElevenLabs har sat en midlertidig grænse. Prøv igen senere.';
 return detail||'ElevenLabs kunne ikke starte medieopgaven.';
}
async function call(url:string,key:string,init:RequestInit,signal?:AbortSignal){
 const response=await fetch(url,{...init,headers:{'xi-api-key':key,...init.headers},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000)});
 if(!response.ok){const body=(await response.text()).slice(0,1600);throw new Error(providerError(response.status,body));}
 return response;
}
function sleep(ms:number,signal?:AbortSignal){return new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Annulleret','AbortError'));},{once:true});});}
async function waitForFlow(kind:'image'|'video',id:string,key:string,signal?:AbortSignal){
 const max=kind==='video'?30:18;
 for(let attempt=0;attempt<max;attempt++){
  await sleep(kind==='video'?5000:2500,signal);
  const response=await call(`https://api.elevenlabs.io/v1/flows/${kind}/${encodeURIComponent(id)}`,key,{method:'GET'},signal);
  const flow=await response.json() as Flow;
  if(flow.status==='failed')throw new Error(flow.error_message||flow.failure_reason||'ElevenLabs kunne ikke færdiggøre mediet.');
  if(flow.status==='completed'&&flow.content_url)return flow;
 }
 throw new Error(`ElevenLabs arbejder stadig på ${kind==='video'?'videoen':'billedet'}. Prøv igen om lidt; der er ikke oprettet en fil endnu.`);
}
function mimeFor(kind:Kind,reported?:string){
 const allowed=kind==='image'?['image/png','image/jpeg','image/webp']:kind==='video'?['video/mp4','video/webm']:['audio/mpeg','audio/mp3','audio/wav','audio/ogg'];
 return reported&&allowed.includes(reported)?reported:(kind==='image'?'image/png':kind==='video'?'video/mp4':'audio/mpeg');
}
function extension(mime:string){return mime==='image/jpeg'?'jpg':mime==='image/webp'?'webp':mime==='video/webm'?'webm':mime==='video/mp4'?'mp4':mime==='audio/wav'?'wav':mime==='audio/ogg'?'ogg':mime.startsWith('image/')?'png':mime.startsWith('video/')?'mp4':'mp3';}

/** Runs only after an explicit in-chat approval; generated files are stored privately in this browser owner's R2 space. */
export async function generateMedia(owner:string,credentials:CortiCredentials|null,args:Record<string,unknown>,signal?:AbortSignal):Promise<GeneratedMedia>{
 const kind=args.kind as Kind;
 if(!['image','video','sound','music'].includes(kind))throw new Error('Vælg billede, video, lydeffekt eller musik.');
 const prompt=typeof args.prompt==='string'?args.prompt.trim():'';const max=kind==='music'?4100:2000;
 if(!prompt||prompt.length>max)throw new Error(`Beskrivelsen skal være mellem 1 og ${max.toLocaleString('da-DK')} tegn.`);
 const key=elevenLabsCredentials(credentials).apiKey;if(!key)throw new Error('ElevenLabs er ikke sat op på serveren endnu.');
 await rateLimit(owner,`assistant-media-${kind}`,kind==='video'?5:12);
 let bytes:Uint8Array,mime:string;
 if(kind==='image'||kind==='video'){
  const model=kind==='image'?'gpt-image-2':'veo-3.1-fast-generate-001';
  const payload=kind==='image'?{model_id:model,prompt}:{model_id:model,prompt,duration_secs:8,aspect_ratio:'16:9',resolution:'720p',generate_audio:true};
  const started=await call(`https://api.elevenlabs.io/v1/flows/${kind}`,key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},signal);
  const job=await started.json() as Flow;if(!job.id)throw new Error('ElevenLabs startede ikke mediejobbet.');
  const done=job.status==='completed'&&job.content_url?job:await waitForFlow(kind,job.id,key,signal);
  const source=new URL(done.content_url!);if(source.protocol!=='https:'||source.hostname!=='storage.googleapis.com')throw new Error('ElevenLabs returnerede en ukendt medieadresse.');
  const download=await fetch(source,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000)});
  if(!download.ok)throw new Error('Den færdige mediefil kunne ikke hentes.');
  const buffer=await download.arrayBuffer();if(!buffer.byteLength||buffer.byteLength>MAX_OUTPUT)throw new Error('Den genererede fil er tom eller overstiger 45 MB.');
  bytes=new Uint8Array(buffer);mime=mimeFor(kind,done.content_mime_type||download.headers.get('content-type')||undefined);
 }else{
  const endpoint=kind==='sound'?'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128':'https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128';
  const payload=kind==='sound'?{text:prompt,model_id:'eleven_text_to_sound_v2',duration_seconds:Math.max(.5,Math.min(30,Number(args.durationSeconds)||6))}:{prompt,model_id:'music_v2_5',music_length_ms:Math.max(3000,Math.min(600000,Number(args.lengthMs)||30000)),force_instrumental:args.instrumental!==false};
  const response=await call(endpoint,key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},signal);const buffer=await response.arrayBuffer();
  if(!buffer.byteLength||buffer.byteLength>MAX_OUTPUT)throw new Error('ElevenLabs returnerede en tom eller for stor lydfil.');bytes=new Uint8Array(buffer);mime='audio/mpeg';
 }
 const id=crypto.randomUUID(),name=safeFilename(`${String(args.name||`leafy-${kind}`).replace(/\.[^.]+$/,'')}.${extension(mime)}`),keyName=uploadKey(owner,id),db=await database();
 const totals=await db.prepare('SELECT COUNT(*) AS count,COALESCE(SUM(size),0) AS total FROM leafy_uploads WHERE owner=?').bind(owner).first<{count:number;total:number}>();
 if((totals?.count||0)>=100||(totals?.total||0)+bytes.byteLength>100_000_000)throw new Error('Leafys filplads er fuld. Slet en fil under Filer, og prøv igen.');
 await bucket().put(keyName,bytes,{httpMetadata:{contentType:mime}});
 try{await db.prepare('INSERT INTO leafy_uploads(id,owner,name,mime,size,excerpt,visions,createdAt) VALUES (?,?,?,?,?,?,0,?)').bind(id,owner,name,mime,bytes.byteLength,`Genereret af Leafy (${kind}). ${prompt.slice(0,1200)}`,Date.now()).run();}
 catch(error){await bucket().delete(keyName);throw error;}
 return {id,name,mime,size:bytes.byteLength,kind,url:`/api/leafy/files/${id}?inline=1`,downloadUrl:`/api/leafy/files/${id}`,createdAt:new Date().toISOString()};
}
