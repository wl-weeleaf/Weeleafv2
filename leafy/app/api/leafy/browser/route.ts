import {checkOrigin,visitor,readJson} from '@/lib/leafy/session';
import {rateLimit} from '@/lib/leafy/store';
import {guardedAction} from '@/lib/leafy/runtime';
import type {RuntimeInput} from '@/lib/leafy/runtime';
import type {AgentEvent} from '@/lib/leafy/actions';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{checkOrigin(request);const body=await readJson(request,100000);const user=await visitor(request);await rateLimit(user.owner,'browser');const events:AgentEvent[]=[];
 const name=body.action==='read'?'read_page':body.action==='search'?'web_search':'browser_action';
 const args=body.action==='read'?{url:body.url}:body.action==='search'?{query:body.query}:body.args;
 const result=await guardedAction(user.owner,name,args as Record<string,unknown>,{permissions:body.permissions as NonNullable<RuntimeInput['workspace']>['permissions']},e=>events.push(e as AgentEvent));
 return Response.json({result,events},{headers:{'Cache-Control':'no-store',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});
 }catch(e){return Response.json({error:(e as Error).message},{status:422});}
}
