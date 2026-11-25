import {decryptCortiCredentials} from '@/lib/livi/credentials';
import {checkOrigin,visitor,readJson} from '@/lib/leafy/session';
import {rateLimit} from '@/lib/leafy/store';
import {elevenLabsCredentials} from '@/lib/livi/elevenlabs';

export const dynamic='force-dynamic';
type Kind='image'|'video'|'sound'|'voice'|'music';
type Generation={id:string;status:'pending'|'generating'|'completed'|'failed';content_url?:string;content_mime_type?:string;error_message?:string;failure_reason?:string};
const validKinds:Kind[]=['image','video','sound','voice','music'];
function errorMessage(status:number,body:string){
 let message='ElevenLabs kunne ikke fuldføre genereringen.';
 try{const data=JSON.parse(body) as {detail?:{message?:string;status?:string}|string;message?:string};const detail=typeof data.detail==='string'?data.detail:data.detail?.message;message=detail||data.message||message;}catch{}
 if(status===401||status===403)return `${message==='ElevenLabs kunne ikke fuldføre genereringen.'?'ElevenLabs afviste adgangen til denne funktion. Kontrollér API-nøglens tilladelser.':message}`.slice(0,420);
 if(status===402)return `${message==='ElevenLabs kunne ikke fuldføre genereringen.'?'ElevenLabs afviste anmodningen på grund af kontoens plan eller credits.':message}`.slice(0,420);
 if(status===429)return 'ElevenLabs har sat en midlertidig grænse. Vent lidt, og prøv igen.';
 return message.slice(0,420);
}
async function providerRequest(url:string,key:string,init:RequestInit){
 const response=await fetch(url,{...init,headers:{'xi-api-key':key,...init.headers},signal:AbortSignal.timeout(120000)});
 if(!response.ok){const body=(await response.text()).slice(0,1800);throw Object.assign(new Error(errorMessage(response.status,body)),{status:response.status});}
 return response;
}
function jsonError(error:unknown){const e=error as Error&{status?:number};return Response.json({error:e.message||'ElevenLabs kunne ikke startes.'},{status:e.status||422,headers:{'Cache-Control':'no-store'}});}

export async function POST(request:Request){
 try{
  checkOrigin(request);const user=await visitor(request);const body=await readJson(request,12000);
  const kind=body.kind as Kind;if(!validKinds.includes(kind))throw new Error('Vælg en understøttet medietype.');
  const prompt=typeof body.prompt==='string'?body.prompt.trim():'';const max=kind==='music'?4100:2000;
  if(!prompt||prompt.length>max)throw new Error(`Beskrivelsen skal være mellem 1 og ${max.toLocaleString('da-DK')} tegn.`);
  const limit=kind==='video'?10:kind==='image'?20:30;await rateLimit(user.owner,`elevenlabs-create-${kind}`,limit);
  const credentials=await decryptCortiCredentials(request);const key=elevenLabsCredentials(credentials).apiKey;
  if(!key)throw Object.assign(new Error('Tilslut ElevenLabs under Indstillinger først.'),{status:401});
  if(kind==='image'||kind==='video'){
   const model=kind==='image'?'gpt-image-2':'veo-3.1-fast-generate-001';
   const payload=kind==='image'?{model_id:model,prompt}:{model_id:model,prompt,duration_secs:8,aspect_ratio:'16:9',resolution:'720p',generate_audio:true};
   const response=await providerRequest(`https://api.elevenlabs.io/v1/flows/${kind}`,key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const generation=await response.json() as Generation;if(!generation.id)throw new Error('ElevenLabs startede ikke mediejobbet.');
   const headers=new Headers({'Cache-Control':'no-store, private'});if(user.cookie)headers.set('Set-Cookie',user.cookie);
   return Response.json({kind,id:generation.id,status:generation.status||'pending'},{headers});
  }
  const headers=new Headers({'Cache-Control':'no-store, private','Content-Type':'audio/mpeg','Content-Disposition':`inline; filename="leafy-${kind}.mp3"`});if(user.cookie)headers.set('Set-Cookie',user.cookie);
  if(kind==='sound'){
   const seconds=Number(body.durationSeconds);const duration=Number.isFinite(seconds)?Math.max(.5,Math.min(30,seconds)):6;
   const response=await providerRequest('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128',key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:prompt,model_id:'eleven_text_to_sound_v2',duration_seconds:duration})});
   return new Response(response.body,{headers});
  }
  if(kind==='voice'){
   const voiceId=elevenLabsCredentials(credentials).voiceId;if(!voiceId)throw new Error('Leafys ElevenLabs-stemme mangler serveropsætning.');
   const response=await providerRequest('https://api.elevenlabs.io/v1/text-to-dialogue?output_format=mp3_44100_128',key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({inputs:[{text:prompt,voice_id:voiceId}],model_id:'eleven_v4'})});
   return new Response(response.body,{headers});
  }
  const length=Number(body.lengthMs);const musicLength=Number.isFinite(length)?Math.max(3000,Math.min(600000,length)):30000;
  const response=await providerRequest('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128',key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,model_id:'music_v2_5',music_length_ms:musicLength,force_instrumental:body.instrumental===true})});
  return new Response(response.body,{headers});
 }catch(error){return jsonError(error);}
}

export async function GET(request:Request){
 try{
  checkOrigin(request);const user=await visitor(request);const url=new URL(request.url);
  if(url.searchParams.get('check')==='1'){
   await rateLimit(user.owner,'elevenlabs-media-check',24);
   const credentials=await decryptCortiCredentials(request),key=elevenLabsCredentials(credentials).apiKey;
   if(!key)throw Object.assign(new Error('ElevenLabs-nøglen er ikke gemt i denne browser. Åbn Indstillinger, og gem nøglen dér.'),{status:401});
   const probe=async(kind:'image'|'video')=>{
    const response=await fetch(`https://api.elevenlabs.io/v1/flows/${kind}?page_size=1`,{headers:{'xi-api-key':key},signal:AbortSignal.timeout(12000)});
    if(response.ok){await response.body?.cancel();return {available:true,error:''};}
    const body=(await response.text()).slice(0,1200);return {available:false,error:errorMessage(response.status,body)};
   };
   const [image,video]=await Promise.all([probe('image'),probe('video')]);
   const headers=new Headers({'Cache-Control':'no-store, private'});if(user.cookie)headers.set('Set-Cookie',user.cookie);
   return Response.json({configured:true,image,video},{headers});
  }
  const kind=url.searchParams.get('kind'),id=url.searchParams.get('id');
  if((kind!=='image'&&kind!=='video')||!id||!/^[A-Za-z0-9_-]{6,80}$/.test(id))throw new Error('Ugyldigt mediejob.');
  await rateLimit(user.owner,`elevenlabs-poll-${kind}`,400);
  const credentials=await decryptCortiCredentials(request);const key=elevenLabsCredentials(credentials).apiKey;if(!key)throw Object.assign(new Error('ElevenLabs er ikke sat op på serveren.'),{status:401});
  const response=await providerRequest(`https://api.elevenlabs.io/v1/flows/${kind}/${encodeURIComponent(id)}`,key,{method:'GET'});
  const generation=await response.json() as Generation;const payload={kind,id:generation.id,status:generation.status,contentUrl:generation.status==='completed'?generation.content_url:undefined,mimeType:generation.status==='completed'?generation.content_mime_type:undefined,error:generation.status==='failed'?generation.error_message||generation.failure_reason:undefined};
  if(url.searchParams.get('download')==='1'){
   if(generation.status!=='completed'||!generation.content_url)throw new Error('Filen er ikke klar til download endnu.');
   const assetUrl=new URL(generation.content_url);if(assetUrl.protocol!=='https:'||assetUrl.hostname!=='storage.googleapis.com')throw new Error('ElevenLabs returnerede en ukendt filadresse.');
   const asset=await fetch(assetUrl,{signal:AbortSignal.timeout(120000)});if(!asset.ok)throw new Error('Den genererede fil kunne ikke hentes.');
   const mime=generation.content_mime_type==='video/mp4'?'video/mp4':'image/png',extension=mime==='video/mp4'?'mp4':'png';
   const headers=new Headers({'Cache-Control':'no-store, private','Content-Type':mime,'Content-Disposition':`attachment; filename="leafy-${kind}-${id}.${extension}"`});if(user.cookie)headers.set('Set-Cookie',user.cookie);
   return new Response(asset.body,{headers});
  }
  const headers=new Headers({'Cache-Control':'no-store, private'});if(user.cookie)headers.set('Set-Cookie',user.cookie);
  return Response.json(payload,{headers});
 }catch(error){return jsonError(error);}
}
