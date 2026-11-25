import {checkOrigin,readJson,visitor} from '@/lib/leafy/session';
import {claim,control,finish,redactResult} from '@/lib/leafy/remote';
import {safeControl} from '@/lib/leafy/environment';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{checkOrigin(request);const b=await readJson(request,40000),user=await visitor(request);const target=String(b.sessionId);if(!/^[a-f0-9-]{36}$/.test(target))throw new Error('Ugyldigt platformmiljø.');
 if(b.op==='control'){await control(user.owner,target,safeControl(b.control),'platform');return Response.json({ok:true});}
 if(b.op==='result'){await finish(user.owner,target,String(b.id),redactResult(b.result),'platform');return Response.json({ok:true});}
 return Response.json({command:await claim(user.owner,target,'platform')},{headers:{'Cache-Control':'no-store',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});
 }catch(e){return Response.json({error:(e as Error).message},{status:422});}}
