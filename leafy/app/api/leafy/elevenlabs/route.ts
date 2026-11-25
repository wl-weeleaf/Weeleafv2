import {decryptCortiCredentials,encryptCortiCredentials,cortiCookie,clearCortiCookie} from '@/lib/livi/credentials';
import {checkOrigin,visitor,readJson} from '@/lib/leafy/session';
import {rateLimit} from '@/lib/leafy/store';
import {elevenLabsCredentials} from '@/lib/livi/elevenlabs';
export const dynamic='force-dynamic';

type Voice={voice_id:string;name:string;labels?:Record<string,string>;category?:string};
async function voices(key:string){
 const response=await fetch('https://api.elevenlabs.io/v1/voices',{headers:{'xi-api-key':key},signal:AbortSignal.timeout(12000)});
 if(!response.ok){await response.body?.cancel();throw new Error(response.status===401?'ElevenLabs afviste API-nøglen. Kontrollér nøglen og dens adgang.':'ElevenLabs kunne ikke hente stemmelisten. Kontrollér API-adgang.');}
 const data=await response.json() as {voices?:Voice[]};return (data.voices||[]).filter(v=>typeof v.voice_id==='string'&&typeof v.name==='string').slice(0,100).map(v=>({id:v.voice_id,name:v.name,language:v.labels?.language||'',accent:v.labels?.accent||'',category:v.category||''}));
}
export async function GET(request:Request){
 try{checkOrigin(request);const user=await visitor(request);await rateLimit(user.owner,'elevenlabs-voices',20);const current=await decryptCortiCredentials(request),shared=elevenLabsCredentials(current);if(!shared.apiKey)return Response.json({configured:false,voices:[]},{headers:{'Cache-Control':'no-store',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});const list=await voices(shared.apiKey);return Response.json({configured:true,voiceId:shared.voiceId,voices:list},{headers:{'Cache-Control':'no-store, private',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});}
 catch(e){return Response.json({error:(e as Error).message},{status:422,headers:{'Cache-Control':'no-store'}});}
}
export async function POST(request:Request){
 try{
  checkOrigin(request);const user=await visitor(request);await rateLimit(user.owner,'elevenlabs-config',8);const body=await readJson(request,6000);const current=await decryptCortiCredentials(request);
  if(body.clear===true){if(current?.modelsApiKey||current?.sttClientId||current?.sttClientSecret||current?.tenantName){const cookie=await encryptCortiCredentials({modelsApiKey:current.modelsApiKey,sttClientId:current.sttClientId,sttClientSecret:current.sttClientSecret,tenantName:current.tenantName});return Response.json({configured:false},{headers:{'Cache-Control':'no-store','Set-Cookie':cortiCookie(cookie)}});}return Response.json({configured:false},{headers:{'Cache-Control':'no-store','Set-Cookie':clearCortiCookie()}});}
  const shared=elevenLabsCredentials(current);
  const key=typeof body.apiKey==='string'&&body.apiKey.trim()?body.apiKey.trim():shared.apiKey;
  if(!key||key.length>256||/[\u0000-\u0020]/.test(key))throw new Error('Indsæt en gyldig ElevenLabs API-nøgle.');
  const list=await voices(key);const chosen=typeof body.voiceId==='string'&&body.voiceId?body.voiceId:shared.voiceId;
  if(chosen&&!list.some(v=>v.id===chosen))throw new Error('Den valgte stemme findes ikke på denne ElevenLabs-konto. Opdatér stemmelisten.');
  const credentials={modelsApiKey:current?.modelsApiKey,sttClientId:current?.sttClientId,sttClientSecret:current?.sttClientSecret,tenantName:current?.tenantName,elevenLabsApiKey:key,elevenLabsVoiceId:chosen};const encrypted=await encryptCortiCredentials(credentials);if(encrypted.length>3800)throw new Error('API-oplysningerne er for store til sikker browserlagring.');
  const headers=new Headers({'Cache-Control':'no-store, private','Set-Cookie':cortiCookie(encrypted)});if(user.cookie)headers.append('Set-Cookie',user.cookie);
  return Response.json({configured:true,voiceId:chosen||'',voices:list},{headers});
 }catch(e){return Response.json({error:(e as Error).message},{status:422,headers:{'Cache-Control':'no-store'}});}
}
