import {checkOrigin,readJson,visitor} from '@/lib/leafy/session';
import {rateLimit} from '@/lib/leafy/store';
import {pairing,exchange,extensionSession,sessions,control,heartbeat,claim,finish,commandResult,redactResult} from '@/lib/leafy/remote';
import {settings} from '@/lib/leafy/settings';
import {safeControl} from '@/lib/leafy/environment';
import {guardedAction} from '@/lib/leafy/runtime';
import type {AgentEvent} from '@/lib/leafy/actions';
export const dynamic='force-dynamic';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'no-store'};
export function OPTIONS(){return new Response(null,{status:204,headers:cors});}
export async function GET(request:Request){try{const user=await visitor(request);const params=new URL(request.url).searchParams;const id=params.get('command');return Response.json(id?await commandResult(user.owner,id):{sessions:await sessions(user.owner)},{headers:{'Cache-Control':'no-store',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});}catch(e){return Response.json({error:(e as Error).message},{status:503});}}
export async function POST(request:Request){
 try{const body=await readJson(request,40000);
  if(body.op==='exchange'){const origin=request.headers.get('origin');if(origin&&!origin.startsWith('chrome-extension://'))throw new Error('Parring skal udføres fra Leafy Chrome-udvidelsen.');return Response.json(await exchange(String(body.code||''),String(body.device||'Min Chrome')),{headers:cors});}
  if(['poll','result','device-control','check'].includes(String(body.op))){
   const s=await extensionSession(request);if(s.kind!=='chrome')throw new Error('Denne enhed er ikke en Chrome-forbindelse.');
   if(body.op==='check'){const row=await commandResult(s.owner,String(body.id));return Response.json({allowed:s.control==='AGENT_CONTROL'&&row?.status==='working'&&row.expiresAt>Date.now()&&row.target===s.id&&row.kind==='chrome'},{headers:cors});}
   if(body.op==='device-control'){await control(s.owner,s.id,safeControl(body.control),'chrome');return Response.json({ok:true},{headers:cors});}
   if(body.op==='result'){await finish(s.owner,s.id,String(body.id),redactResult(body.result),'chrome');return Response.json({ok:true},{headers:cors});}
   const mode=await heartbeat(s,body.environment);return Response.json({control:mode,settings:await settings(s.owner),command:mode==='AGENT_CONTROL'&&!body.peek?await claim(s.owner,s.id,'chrome'):null},{headers:cors});
  }
  checkOrigin(request);const user=await visitor(request);const headers={'Cache-Control':'no-store',...(user.cookie?{'Set-Cookie':user.cookie}:{})};await rateLimit(user.owner,'remote',120);
  if(body.op==='pair')return Response.json(await pairing(user.owner),{headers});
  if(body.op==='control'){await control(user.owner,String(body.sessionId),safeControl(body.control),'chrome');return Response.json({ok:true},{headers});}
  if(body.op==='action'){const events:AgentEvent[]=[];const result=await guardedAction(user.owner,'remote_computer',{...(body.args as object),sessionId:body.sessionId}, {permissions:body.permissions as {id:string;mode:string}[]},e=>events.push(e as AgentEvent));return Response.json({result,events},{headers});}
  throw new Error('Ukendt fjernadgangshandling.');
 }catch(e){return Response.json({error:(e as Error).message},{status:422,headers:cors});}
}
