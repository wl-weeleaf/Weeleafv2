import {waitUntil} from 'cloudflare:workers';
import {checkOrigin,visitor,readJson} from '@/lib/leafy/session';
import {database,newTask,rateLimit,tasks,updateTask} from '@/lib/leafy/store';
import {runAgent,type RuntimeInput} from '@/lib/leafy/runtime';
import {decryptCortiCredentials} from '@/lib/livi/credentials';
import {aiConfig} from '@/lib/livi/config';
import type {AgentEvent} from '@/lib/leafy/actions';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const user=await visitor(request);const db=await database();await db.prepare("UPDATE leafy_tasks SET status='failed',error='Opgaven overskred tidsgrænsen. Start en ny, mindre opgave.',updatedAt=? WHERE owner=? AND status IN ('working','queued') AND updatedAt<?").bind(new Date().toISOString(),user.owner,new Date(Date.now()-60000).toISOString()).run();return Response.json({tasks:await tasks(user.owner)},{headers:{'Cache-Control':'no-store',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});}catch(e){return Response.json({error:(e as Error).message},{status:503});}}
export async function POST(request:Request){
 try{
  checkOrigin(request);const body=await readJson(request,100000);const user=await visitor(request);await rateLimit(user.owner,'task',20);
  if(body.cancel){const db=await database();await db.prepare("UPDATE leafy_tasks SET status='cancelled',updatedAt=? WHERE id=? AND owner=? AND status IN ('queued','working')").bind(new Date().toISOString(),String(body.cancel),user.owner).run();return Response.json({cancelled:true});}
  if(typeof body.goal!=='string'||!body.goal.trim()||body.goal.length>4000)throw new Error('Beskriv en opgave på højst 4.000 tegn.');
  const credentials=await decryptCortiCredentials(request);if(!aiConfig(credentials).configured)throw new Error('Corti-forbindelsen mangler opsætning.');
  const goal=body.goal.trim();const id=await newTask(user.owner,goal);
  // Bounded execution survives closing the browser. Status and results persist in D1.
  waitUntil((async()=>{
   try{await updateTask(user.owner,id,'working');const events:AgentEvent[]=[];const result=await runAgent({messages:[{role:'user',content:goal}],leafyCore:body.leafyCore,appContext:'room',workspace:body.workspace as RuntimeInput['workspace']},credentials,user.owner,e=>{if(!('text' in e))events.push(e);},AbortSignal.timeout(24000));await updateTask(user.owner,id,'done',JSON.stringify({answer:result,events}));}
   catch(e){await updateTask(user.owner,id,'failed','',(e as Error).name==='TimeoutError'?'Opgaven tog over 24 sekunder. Del den i mindre trin.':(e as Error).message);}
  })());
  return Response.json({id,status:'queued'},{status:202,headers:{'Cache-Control':'no-store',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});
 }catch(e){return Response.json({error:(e as Error).message},{status:422});}
}
