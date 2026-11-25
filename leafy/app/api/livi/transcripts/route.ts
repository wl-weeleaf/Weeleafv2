import {cortiAccessToken,cortiClientCredentials,cortiRegion} from '@/lib/livi/config';
import {decryptCortiCredentials} from '@/lib/livi/credentials';
import {checkOrigin,visitor} from '@/lib/leafy/session';
import {database,rateLimit} from '@/lib/leafy/store';
import {bucket} from '@/lib/leafy/files';
import type {R2UploadedPart} from '@cloudflare/workers-types';

export const dynamic='force-dynamic';
// Corti's recordings API accepts up to 150 MB and two hours per recording.
// Keep each browser request small and assemble the unchanged bytes in R2.
const MAX_AUDIO=150_000_000;
const CHUNK_SIZE=8_000_000;
const MAX_DURATION_SECONDS=120*60;
type Upload={id:string;owner:string;interactionId:string;objectKey:string;multipartId:string;name:string;size:number;createdAt:string};

function apiBase(){return `https://api.${cortiRegion()}.corti.app/v2`;}
function isAudioName(name:string){return /\.(mp3|wav|ogg|webm|m4a|mp4|aac|flac|3gp|3g2)$/i.test(name);}
async function deleteInteraction(token:string,tenant:string,id:string){
 try{await fetch(`${apiBase()}/interactions/${encodeURIComponent(id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`,'Tenant-Name':tenant},signal:AbortSignal.timeout(8000)});}catch{}
}
async function cortiError(response:Response,action:string){
 let detail='',requestId='';
 try{const body=await response.json() as {detail?:string;title?:string;requestid?:string;requestId?:string};detail=(body.detail||body.title||'').replace(/[\r\n<>]/g,' ').trim().slice(0,260);requestId=body.requestid||body.requestId||'';}catch{await response.body?.cancel().catch(()=>{});}
 return `${action} (HTTP ${response.status})${detail?`: ${detail}`:''}${requestId?` · reference ${requestId}`:''}.`;
}
async function getUpload(id:string,owner:string){
 const db=await database();
 const row=await db.prepare('SELECT id,owner,interactionId,objectKey,multipartId,name,size,createdAt FROM leafy_transcript_uploads WHERE id=? AND owner=?').bind(id,owner).first<Upload>();
 if(!row)throw Error('Lydfilens upload-session er udløbet. Vælg filen igen.');
 return row;
}
async function forgetUpload(upload:Upload,abort=true){
 try{const multipart=bucket().resumeMultipartUpload(upload.objectKey,upload.multipartId);if(abort)await multipart.abort();}catch{}
 try{await bucket().delete(upload.objectKey);}catch{}
 try{const db=await database();await db.prepare('DELETE FROM leafy_transcript_uploads WHERE id=?').bind(upload.id).run();}catch{}
}

async function start(request:Request,user:{owner:string;cookie?:string}){
 const owner=user.owner;
 const data=await request.json() as {name?:string;size?:number;duration?:number};
 const name=typeof data.name==='string'?data.name.slice(0,180):'',size=Number(data.size),duration=Number(data.duration);
 if(!isAudioName(name))throw Error('Vælg en lydfil i MP3, WAV, M4A, MP4, OGG, WebM, AAC eller FLAC-format.');
 if(!Number.isSafeInteger(size)||size<1||size>MAX_AUDIO)throw Error('Corti accepterer højst 150 MB pr. lydfil.');
 if(!Number.isFinite(duration)||duration<=0||duration>MAX_DURATION_SECONDS)throw Error('Corti accepterer højst 120 minutters lyd pr. optagelse.');
 await rateLimit(owner,'transcript-upload',10);
 const saved=await decryptCortiCredentials(request),credentials=cortiClientCredentials(saved);
 if(!(credentials.clientId&&credentials.clientSecret&&credentials.tenant))throw Error('Filtransskription kræver Corti Client ID, Client Secret og Tenant. Åbn Indstillinger → AI og tale, udfyld felterne under Corti dansk diktering, og vælg Gem og kontrollér.');
 const tenant=credentials.tenant,token=await cortiAccessToken(saved),headers={Authorization:`Bearer ${token}`,'Tenant-Name':tenant};
 const root=apiBase();
 const created=await fetch(`${root}/interactions/`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({encounter:{identifier:crypto.randomUUID(),title:'Leafy lydtransskription',status:'planned',type:'first_consultation'}}),signal:AbortSignal.timeout(15000)});
 if(!created.ok)throw Error(await cortiError(created,'Corti kunne ikke oprette en transskriptionssession'));
 const interaction=await created.json() as {id?:string;interactionId?:string;interaction_id?:string};
 const interactionId=interaction.id||interaction.interactionId||interaction.interaction_id||'';
 if(!/^[a-f0-9-]{36}$/i.test(interactionId))throw Error('Corti returnerede ikke et gyldigt interaktions-id.');
 const id=crypto.randomUUID(),objectKey=`transcript-uploads/${crypto.randomUUID()}`;
 try{
  const multipart=await bucket().createMultipartUpload(objectKey,{httpMetadata:{contentType:'application/octet-stream'}}),now=new Date().toISOString(),db=await database();
  const upload:Upload={id,owner,interactionId,objectKey,multipartId:multipart.uploadId,name,size,createdAt:now};
  await db.prepare('INSERT INTO leafy_transcript_uploads(id,owner,interactionId,objectKey,multipartId,name,size,createdAt) VALUES (?,?,?,?,?,?,?,?)').bind(id,owner,interactionId,objectKey,multipart.uploadId,name,size,now).run();
  return Response.json({uploadId:id,chunkSize:CHUNK_SIZE},{headers:{'Cache-Control':'no-store, private',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});
 }catch(error){await deleteInteraction(token,tenant,interactionId);throw error;}
}

async function uploadPart(request:Request,owner:string){
 if(Number(request.headers.get('content-length')||0)>CHUNK_SIZE+100_000)throw Error('Upload-bid er for stor. Prøv igen.');
 const form=await request.formData(),id=String(form.get('uploadId')||''),partNumber=Number(form.get('partNumber')),chunk=form.get('chunk');
 if(!/^[a-f0-9-]{36}$/i.test(id)||!Number.isSafeInteger(partNumber)||partNumber<1||!(chunk instanceof File))throw Error('Ugyldigt upload-bid.');
 const upload=await getUpload(id,owner),count=Math.ceil(upload.size/CHUNK_SIZE),expectedSize=Math.min(CHUNK_SIZE,upload.size-(partNumber-1)*CHUNK_SIZE);
 if(partNumber>count||chunk.size!==expectedSize)throw Error('Upload-biddet passer ikke til lydfilen.');
 const part=await bucket().resumeMultipartUpload(upload.objectKey,upload.multipartId).uploadPart(partNumber,await chunk.arrayBuffer());
 return Response.json({partNumber:part.partNumber,etag:part.etag},{headers:{'Cache-Control':'no-store, private'}});
}

async function complete(request:Request,owner:string){
 const data=await request.json() as {uploadId?:string;parts?:{partNumber:number;etag:string}[]};
 const id=typeof data.uploadId==='string'?data.uploadId:'',parts=data.parts;
 if(!/^[a-f0-9-]{36}$/i.test(id)||!Array.isArray(parts))throw Error('Ugyldig upload-session.');
 const upload=await getUpload(id,owner),count=Math.ceil(upload.size/CHUNK_SIZE);
 if(parts.length!==count||parts.some((part,index)=>part.partNumber!==index+1||typeof part.etag!=='string'||part.etag.length>200))throw Error('Ikke alle lydfilens dele blev modtaget. Prøv uploaden igen.');
 let token='',tenant='';
 try{
  const object=await bucket().resumeMultipartUpload(upload.objectKey,upload.multipartId).complete(parts as R2UploadedPart[]);
  if(object.size!==upload.size)throw Error('Den samlede lydfil har en uventet størrelse.');
  const saved=await decryptCortiCredentials(request),credentials=cortiClientCredentials(saved);
  if(!(credentials.clientId&&credentials.clientSecret&&credentials.tenant))throw Error('Corti-indstillingerne mangler.');
  tenant=credentials.tenant;token=await cortiAccessToken(saved);
  const audio=await bucket().get(upload.objectKey);
  if(!audio?.body||audio.size!==upload.size)throw Error('Den samlede lydfil kunne ikke læses fra midlertidig lagring.');
  const uploaded=await fetch(`${apiBase()}/interactions/${upload.interactionId}/recordings/`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Tenant-Name':tenant,'Content-Type':'application/octet-stream','Content-Length':String(upload.size)},body:audio.body as unknown as BodyInit,signal:AbortSignal.timeout(300000)});
  if(!uploaded.ok)throw Error(await cortiError(uploaded,'Corti kunne ikke modtage lydfilen'));
  const recording=await uploaded.json() as {recordingId?:string;id?:string},recordingId=recording.recordingId||recording.id;
  if(!recordingId)throw Error('Corti returnerede ikke et recording-id.');
  const started=await fetch(`${apiBase()}/interactions/${upload.interactionId}/transcripts/`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Tenant-Name':tenant,'Content-Type':'application/json'},body:JSON.stringify({recordingId,primaryLanguage:'da',automaticPunctuation:true,isDictation:true,async:true}),signal:AbortSignal.timeout(20000)});
  if(!started.ok)throw Error(await cortiError(started,'Corti kunne ikke starte filtransskriptionen'));
  const location=started.headers.get('location');let transcriptId='';
  if(location){try{transcriptId=new URL(location,apiBase()).pathname.match(/\/transcripts\/([a-f0-9-]{36})(?:\/|$)/i)?.[1]||'';}catch{}}
  const body=await started.json().catch(()=>null) as {id?:string;transcriptId?:string;transcript_id?:string}|null;
  transcriptId=transcriptId||body?.id||body?.transcriptId||body?.transcript_id||'';
  if(!/^[a-f0-9-]{36}$/i.test(transcriptId))throw Error('Corti startede ikke et gyldigt transskriptionsjob.');
  const transcriptJob=crypto.randomUUID(),now=new Date().toISOString(),db=await database();
  await db.prepare('DELETE FROM leafy_transcripts WHERE owner=? AND createdAt<?').bind(owner,new Date(Date.now()-2*60*60*1000).toISOString()).run();
  await db.prepare('INSERT INTO leafy_transcripts(id,owner,interactionId,transcriptId,status,createdAt,updatedAt) VALUES (?,?,?,?,\'processing\',?,?)').bind(transcriptJob,owner,upload.interactionId,transcriptId,now,now).run();
  await forgetUpload(upload,false);
  return Response.json({id:transcriptJob,status:'processing'},{status:202,headers:{'Cache-Control':'no-store, private'}});
 }catch(error){
  if(token&&tenant)await deleteInteraction(token,tenant,upload.interactionId);
  await forgetUpload(upload,true);
  throw error;
 }
}

export async function POST(request:Request){
 try{
  checkOrigin(request);
  const user=await visitor(request),contentType=request.headers.get('content-type')||'';
  let action='';
  if(contentType.includes('multipart/form-data'))action='part';
  else if(contentType.includes('application/json'))action=(await request.clone().json() as {action?:string}).action||'';
  if(action==='start')return await start(request,user);
  if(action==='part')return await uploadPart(request,user.owner);
  if(action==='complete')return await complete(request,user.owner);
  if(action==='abort'){
   const data=await request.json() as {uploadId?:string};
   if(typeof data.uploadId==='string'&&/^[a-f0-9-]{36}$/i.test(data.uploadId)){const upload=await getUpload(data.uploadId,user.owner);await forgetUpload(upload,true);}
   return Response.json({ok:true},{headers:{'Cache-Control':'no-store, private'}});
  }
  throw Error('Ugyldig transskriptionshandling.');
 }catch(error){
  return Response.json({error:(error as Error).message||'Filtransskriptionen kunne ikke startes.'},{status:422,headers:{'Cache-Control':'no-store, private'}});
 }
}
