import {cortiAccessToken,cortiClientCredentials,cortiRegion} from '@/lib/livi/config';
import {decryptCortiCredentials} from '@/lib/livi/credentials';
import {visitor} from '@/lib/leafy/session';
import {database} from '@/lib/leafy/store';

export const dynamic='force-dynamic';
type Job={id:string;owner:string;interactionId:string;transcriptId:string;status:'processing'|'completed'|'failed';result:string;error:string;createdAt:string};
function apiBase(){return `https://api.${cortiRegion()}.corti.app/v2`;}
async function removeInteraction(token:string,tenant:string,id:string){
 try{await fetch(`${apiBase()}/interactions/${encodeURIComponent(id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`,'Tenant-Name':tenant},signal:AbortSignal.timeout(8000)});}catch{}
}
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const user=await visitor(request),{id}=await params;
  if(!/^[a-f0-9-]{36}$/i.test(id))return Response.json({error:'Transskriptionsjobbet blev ikke fundet.'},{status:404});
  const db=await database(),job=await db.prepare('SELECT id,owner,interactionId,transcriptId,status,result,error,createdAt FROM leafy_transcripts WHERE id=? AND owner=?').bind(id,user.owner).first<Job>();
  if(!job)return Response.json({error:'Transskriptionsjobbet blev ikke fundet.'},{status:404});
  if(job.status!=='processing')return Response.json({status:job.status,result:job.result,error:job.error},{headers:{'Cache-Control':'no-store, private',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});
  if(Date.now()-Date.parse(job.createdAt)>2*60*60*1000){
   try{const saved=await decryptCortiCredentials(request),{clientId,clientSecret,tenant}=cortiClientCredentials(saved);if(clientId&&clientSecret&&tenant){const token=await cortiAccessToken(saved);await removeInteraction(token,tenant,job.interactionId);}}catch{}
   await db.prepare('DELETE FROM leafy_transcripts WHERE id=? AND owner=?').bind(id,user.owner).run();
   return Response.json({status:'failed',error:'Transskriptionen tog for lang tid. Start en ny med en kortere lydfil.'},{headers:{'Cache-Control':'no-store, private',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});
  }
  const saved=await decryptCortiCredentials(request),{clientId,clientSecret,tenant}=cortiClientCredentials(saved);
  if(!(clientId&&clientSecret&&tenant))return Response.json({error:'Corti taleopsætningen mangler. Åbn Indstillinger → AI og tale.'},{status:503});
  const token=await cortiAccessToken(saved),headers={Authorization:`Bearer ${token}`,'Tenant-Name':tenant},root=apiBase();
  const statusResponse=await fetch(`${root}/interactions/${job.interactionId}/transcripts/${job.transcriptId}/status`,{headers,signal:AbortSignal.timeout(12000)});
  if(!statusResponse.ok){await statusResponse.body?.cancel();throw Error(`Corti kunne ikke hente transskriptionsstatus (HTTP ${statusResponse.status}).`);}
  const statusData=await statusResponse.json() as {status?:string};
  if(statusData.status==='failed'){
   const error='Corti kunne ikke transskribere lydfilen. Kontrollér filen, og prøv igen.';
   await db.prepare('DELETE FROM leafy_transcripts WHERE id=? AND owner=?').bind(id,user.owner).run();
   await removeInteraction(token,tenant,job.interactionId);
   return Response.json({status:'failed',error},{headers:{'Cache-Control':'no-store, private',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});
  }
  if(statusData.status!=='completed')return Response.json({status:'processing'},{headers:{'Cache-Control':'no-store, private',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});
  const resultResponse=await fetch(`${root}/interactions/${job.interactionId}/transcripts/${job.transcriptId}`,{headers,signal:AbortSignal.timeout(15000)});
  if(!resultResponse.ok){await resultResponse.body?.cancel();throw Error(`Corti kunne ikke hente transskriptionen (HTTP ${resultResponse.status}).`);}
  const transcript=await resultResponse.json() as {transcripts?:{text?:string;start?:number;speakerId?:number}[];text?:string};
  const result=(transcript.transcripts||[]).map(part=>part.text?.trim()||'').filter(Boolean).join('\n').trim()||transcript.text?.trim()||'';
  if(!result)throw Error('Corti afsluttede transskriptionen uden at returnere tekst.');
  await db.prepare('DELETE FROM leafy_transcripts WHERE id=? AND owner=?').bind(id,user.owner).run();
  await removeInteraction(token,tenant,job.interactionId);
  return Response.json({status:'completed',result:result.slice(0,200000)},{headers:{'Cache-Control':'no-store, private',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});
 }catch(e){return Response.json({error:(e as Error).message||'Transskriptionen kunne ikke hentes.'},{status:503,headers:{'Cache-Control':'no-store, private'}});}
}
