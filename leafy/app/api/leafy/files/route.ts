import type {R2UploadedPart} from '@cloudflare/workers-types';
import {visitor,checkOrigin} from '@/lib/leafy/session';
import {database,rateLimit} from '@/lib/leafy/store';
import {bucket,listFiles,uploadKey,safeFilename,imageMime} from '@/lib/leafy/files';

export const dynamic='force-dynamic';
const MAX_FILE_SIZE=150_000_000;
const CHUNK_SIZE=8_000_000;
const MAX_METADATA=45_000;
type UploadSession={id:string;owner:string;objectKey:string;multipartId:string;name:string;mime:string;size:number;excerpt:string;visions:number;createdAt:number};

async function uploadSession(id:string,owner:string){
 if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Ugyldigt upload-id.');
 const db=await database(),row=await db.prepare('SELECT id,owner,objectKey,multipartId,name,mime,size,excerpt,visions,createdAt FROM leafy_file_uploads WHERE id=? AND owner=?').bind(id,owner).first<UploadSession>();
 if(!row)throw Error('Upload-sessionen er udløbet. Vælg filen igen.');return row;
}

async function abortUpload(id:string,owner:string){
 const row=await uploadSession(id,owner);
 try{await bucket().resumeMultipartUpload(row.objectKey,row.multipartId).abort();}catch{}
 try{await bucket().delete(row.objectKey);}catch{}
 const db=await database();await db.prepare('DELETE FROM leafy_file_uploads WHERE id=? AND owner=?').bind(id,owner).run();
}

async function startUpload(request:Request,user:{owner:string;cookie?:string}){
 const length=Number(request.headers.get('content-length')||0);if(length>MAX_METADATA)throw Error('Filens oplysninger er for store.');
 const data=await request.json() as {name?:string;mime?:string;size?:number;excerpt?:string;vision?:string};
 const size=Number(data.size);if(!Number.isSafeInteger(size)||size<1||size>MAX_FILE_SIZE)throw Error('Leafy kan gemme filer på op til 150 MB ad gangen.');
 const name=safeFilename(typeof data.name==='string'?data.name:'fil');
 if(!name||name==='fil'&&typeof data.name!=='string')throw Error('Filnavnet er ugyldigt.');
 await rateLimit(user.owner,'upload',100);
 const db=await database(),id=crypto.randomUUID(),objectKey=uploadKey(user.owner,id),textType=/\.(txt|md|csv|json|js|ts|tsx|jsx|html|css|xml|svg|log|py|yml|yaml|sql)$/i.test(name);
 const mime=textType?'text/plain':typeof data.mime==='string'&&data.mime.length<=150?data.mime:'application/octet-stream';
 const excerpt=typeof data.excerpt==='string'?data.excerpt.slice(0,40000):'';
 let visionBytes:Uint8Array|undefined;
 if(typeof data.vision==='string'&&data.vision.length<=12000){try{const decoded=Uint8Array.from(atob(data.vision),c=>c.charCodeAt(0));if(imageMime(decoded)==='image/jpeg'&&decoded.length<=9000)visionBytes=decoded;}catch{}}
 const multipart=await bucket().createMultipartUpload(objectKey,{httpMetadata:{contentType:mime}}),now=Date.now();
 try{
  await db.prepare('INSERT INTO leafy_file_uploads(id,owner,objectKey,multipartId,name,mime,size,excerpt,visions,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,user.owner,objectKey,multipart.uploadId,name,mime,size,excerpt,visionBytes?1:0,now).run();
 }catch(error){try{await multipart.abort();}catch{}throw error;}
 if(visionBytes)try{await bucket().put(objectKey+'/vision',visionBytes,{httpMetadata:{contentType:'image/jpeg'}});}catch{await db.prepare('UPDATE leafy_file_uploads SET visions=0 WHERE id=? AND owner=?').bind(id,user.owner).run();}
 return Response.json({uploadId:id,chunkSize:CHUNK_SIZE},{headers:{'Cache-Control':'no-store, private',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});
}

async function uploadPart(request:Request,owner:string){
 if(Number(request.headers.get('content-length')||0)>CHUNK_SIZE+100_000)throw Error('Upload-bid er for stort. Prøv igen.');
 const form=await request.formData(),id=String(form.get('uploadId')||''),partNumber=Number(form.get('partNumber')),chunk=form.get('chunk');
 if(!/^[a-f0-9-]{36}$/i.test(id)||!Number.isSafeInteger(partNumber)||partNumber<1||!(chunk instanceof File))throw Error('Ugyldigt upload-bid.');
 const row=await uploadSession(id,owner),partCount=Math.ceil(row.size/CHUNK_SIZE),expectedSize=Math.min(CHUNK_SIZE,row.size-(partNumber-1)*CHUNK_SIZE);
 if(partNumber>partCount||chunk.size!==expectedSize)throw Error('Upload-biddet passer ikke til den valgte fil.');
 const part=await bucket().resumeMultipartUpload(row.objectKey,row.multipartId).uploadPart(partNumber,await chunk.arrayBuffer());
 return Response.json({partNumber:part.partNumber,etag:part.etag},{headers:{'Cache-Control':'no-store, private'}});
}

async function completeUpload(request:Request,owner:string){
 const data=await request.json() as {uploadId?:string;parts?:{partNumber:number;etag:string}[]},id=typeof data.uploadId==='string'?data.uploadId:'',parts=data.parts;
 if(!Array.isArray(parts))throw Error('Upload-sessionen mangler sine fildele.');
 const row=await uploadSession(id,owner),partCount=Math.ceil(row.size/CHUNK_SIZE);
 if(parts.length!==partCount||parts.some((part,index)=>!part||part.partNumber!==index+1||typeof part.etag!=='string'||part.etag.length>200))throw Error('Ikke alle fildele blev modtaget. Prøv uploaden igen.');
 const db=await database();
 try{
  const object=await bucket().resumeMultipartUpload(row.objectKey,row.multipartId).complete(parts as R2UploadedPart[]);
  if(object.size!==row.size)throw Error('Den samlede fil har en uventet størrelse.');
  await db.prepare('INSERT INTO leafy_uploads(id,owner,name,mime,size,excerpt,visions,createdAt) VALUES (?,?,?,?,?,?,?,?)').bind(row.id,row.owner,row.name,row.mime,row.size,row.excerpt,row.visions,row.createdAt).run();
  await db.prepare('DELETE FROM leafy_file_uploads WHERE id=? AND owner=?').bind(row.id,row.owner).run();
  const file={id:row.id,name:row.name,mime:row.mime,size:row.size,visions:row.visions,createdAt:row.createdAt};return Response.json({file},{headers:{'Cache-Control':'no-store, private'}});
 }catch(error){
  await bucket().delete([row.objectKey,row.objectKey+'/vision']).catch(()=>{});
  await db.prepare('DELETE FROM leafy_uploads WHERE id=? AND owner=?').bind(row.id,row.owner).run().catch(()=>{});
  await db.prepare('DELETE FROM leafy_file_uploads WHERE id=? AND owner=?').bind(row.id,row.owner).run().catch(()=>{});
  throw error;
 }
}

export async function GET(request:Request){
 try{const user=await visitor(request);return Response.json({files:await listFiles(user.owner)},{headers:{'Cache-Control':'no-store, private',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});}
 catch(error){return Response.json({error:(error as Error).message},{status:503,'headers':{'Cache-Control':'no-store, private'}});}
}

export async function POST(request:Request){
 try{
  checkOrigin(request);const user=await visitor(request),contentType=request.headers.get('content-type')||'';
  if(contentType.includes('multipart/form-data'))return await uploadPart(request,user.owner);
  if(!contentType.includes('application/json'))throw Error('Uploaden kræver en understøttet filanmodning.');
  if(Number(request.headers.get('content-length')||0)>MAX_METADATA)throw Error('Filens oplysninger er for store.');
  const {action,uploadId}=await request.clone().json() as {action?:string;uploadId?:string};
  if(action==='start')return await startUpload(request,user);
  if(action==='complete')return await completeUpload(request,user.owner);
  if(action==='abort'){if(typeof uploadId==='string')await abortUpload(uploadId,user.owner);return Response.json({ok:true},{headers:{'Cache-Control':'no-store, private'}});}
  throw Error('Ugyldig filhandling.');
 }catch(error){return Response.json({error:(error as Error).message||'Uploaden mislykkedes.'},{status:422,headers:{'Cache-Control':'no-store, private'}});}
}
