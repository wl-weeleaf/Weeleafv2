import {decryptCortiCredentials} from '@/lib/livi/credentials';
import {elevenLabsCredentials} from '@/lib/livi/elevenlabs';
import {checkOrigin,visitor} from '@/lib/leafy/session';
import {rateLimit} from '@/lib/leafy/store';

export const dynamic='force-dynamic';

/** Mint a one-use Scribe token server-side. The long-lived ElevenLabs key never leaves this route. */
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const user=await visitor(request);
  await rateLimit(user.owner,'elevenlabs-scribe-token',80);
  const credentials=elevenLabsCredentials(await decryptCortiCredentials(request));
  const headers=new Headers({'Cache-Control':'no-store, private','Pragma':'no-cache'});
  if(user.cookie)headers.set('Set-Cookie',user.cookie);
  if(!credentials.apiKey)return Response.json({configured:false,error:'ElevenLabs Scribe er ikke tilsluttet. Tilføj ElevenLabs-nøglen i Indstillinger → AI og tale.'},{status:200,headers});
  const response=await fetch('https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',{method:'POST',headers:{'xi-api-key':credentials.apiKey},signal:AbortSignal.timeout(12000)});
  if(!response.ok){await response.body?.cancel();return Response.json({configured:true,error:response.status===401||response.status===403?'ElevenLabs afviste adgang til Scribe. Kontrollér API-nøglens talegenkendelsesadgang.':'ElevenLabs kunne ikke oprette en Scribe-session.'},{status:502,headers});}
  const data=await response.json() as {token?:unknown};
  if(typeof data.token!=='string'||!data.token)return Response.json({configured:true,error:'ElevenLabs returnerede ikke en sessionstoken.'},{status:502,headers});
  return Response.json({configured:true,token:data.token},{headers});
 }catch(error){
  const message=(error as Error).message||'Sproggenkendelsen kunne ikke startes.';
  const status=message.includes('timegrænse')?429:message==='Ugyldig oprindelse.'?403:502;
  return Response.json({error:message},{status,headers:{'Cache-Control':'no-store','Pragma':'no-cache'}});
 }
}
