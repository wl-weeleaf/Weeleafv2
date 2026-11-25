import {checkOrigin,visitor,readJson} from '@/lib/leafy/session';
import {approveAction,type RuntimeInput} from '@/lib/leafy/runtime';
import {decryptCortiCredentials} from '@/lib/livi/credentials';
import {rateLimit,takeApproval} from '@/lib/leafy/store';
import type {AgentEvent} from '@/lib/leafy/actions';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{checkOrigin(request);const body=await readJson(request,100000);if(typeof body.id!=='string')throw new Error('Ugyldig godkendelse.');const user=await visitor(request);await rateLimit(user.owner,'approval');if(body.reject===true){await takeApproval(user.owner,body.id);return Response.json({rejected:true});}const events:AgentEvent[]=[];const credentials=await decryptCortiCredentials(request);const result=await approveAction(user.owner,body.id,e=>events.push(e as AgentEvent),credentials,{permissions:body.permissions as NonNullable<RuntimeInput['workspace']>['permissions']});return Response.json({result,events},{headers:{'Cache-Control':'no-store',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});}
 catch(e){return Response.json({error:(e as Error).message},{status:422});}
}
