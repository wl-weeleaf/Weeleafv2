import type {LiveSession} from '../types';
import type {Question} from '../types';
type Signal={id:number;viewer:string;payload:{type:'offer'|'answer'|'candidate';sdp?:string;candidate?:RTCIceCandidateInit}};
type LiveRpcData={error?:string;active?:boolean;signals?:Signal[];questions?:Question[];[key:string]:unknown};
export async function liveRPC(body:Record<string,unknown>,signal?:AbortSignal){const r=await fetch('/api/leafy-live',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal});const data=await r.json() as LiveRpcData;signal?.throwIfAborted();if(!r.ok)throw Object.assign(Error(data.error||'Live-forbindelsen fejlede.'),{status:r.status});return data;}
const config:RTCConfiguration={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
function closePeer(pc:RTCPeerConnection){pc.onicecandidate=pc.onconnectionstatechange=pc.ontrack=null;pc.close();}
export function hostOutput(session:LiveSession,stream:MediaStream,onStatus:(s:string)=>void){
 const peers=new Map<string,RTCPeerConnection>(),pending=new Map<string,RTCIceCandidateInit[]>(),controller=new AbortController();let stopped=false,cursor=0,busy=false;
 const send=(viewer:string,payload:unknown)=>liveRPC({op:'signal',session:session.id,host:true,viewer,payload},controller.signal);
 async function poll(){if(stopped||busy)return;busy=true;try{
  const data=await liveRPC({op:'poll',session:session.id,host:true,cursor},controller.signal);if(stopped)return;if(!data.active){onStatus('Præsentationen er stoppet.');stop();return;}
  for(const signal of data.signals as Signal[]){if(stopped)return;cursor=Math.max(cursor,signal.id);const {viewer,payload}=signal;let pc=peers.get(viewer);
   if(payload.type==='offer'){
    if(pc)closePeer(pc);pc=new RTCPeerConnection(config);peers.set(viewer,pc);const connection=pc;
    stream.getTracks().forEach(t=>connection.addTrack(t,stream));connection.onicecandidate=e=>{if(!stopped&&e.candidate)void send(viewer,{type:'candidate',candidate:e.candidate.toJSON()}).catch(()=>{});};
    connection.onconnectionstatechange=()=>{if(stopped||peers.get(viewer)!==connection)return;if(['failed','closed'].includes(connection.connectionState)){peers.delete(viewer);closePeer(connection);}const connected=[...peers.values()].filter(p=>p.connectionState==='connected').length;onStatus(connected?`Streaming aktiv · ${connected} scene-modtager${connected>1?'e':''}`:'Scenen er startet · venter på modtager');};
    await connection.setRemoteDescription({type:'offer',sdp:payload.sdp});if(stopped)return;for(const candidate of pending.get(viewer)||[])await connection.addIceCandidate(candidate);pending.delete(viewer);await connection.setLocalDescription(await connection.createAnswer());if(stopped)return;await send(viewer,{type:'answer',sdp:connection.localDescription!.sdp});
   }else if(payload.type==='candidate'&&payload.candidate){if(pc?.remoteDescription)await pc.addIceCandidate(payload.candidate);else pending.set(viewer,[...(pending.get(viewer)||[]),payload.candidate].slice(-60));}
  }
 }catch(e){if(!stopped){onStatus(`Scene-forbindelse: ${(e as Error).message}`);if([403,404].includes((e as Error&{status?:number}).status||0))stop();}}finally{busy=false;}}
 const timer=setInterval(()=>void poll(),1000);
 function stop(){if(stopped)return;stopped=true;controller.abort();clearInterval(timer);peers.forEach(closePeer);peers.clear();pending.clear();stream.getTracks().forEach(t=>t.stop());}
 void poll();return {stop,replaceAudio(track:MediaStreamTrack|null){for(const pc of peers.values()){const sender=pc.getSenders().find(s=>s.track?.kind==='audio');if(sender)void sender.replaceTrack(track);}}};
}
export async function receiveOutput(session:string,key:string,onStream:(s:MediaStream)=>void,onStatus:(s:string)=>void,signal?:AbortSignal){
 const controller=new AbortController();let stopped=false,cursor=0,busy=false,pending:RTCIceCandidateInit[]=[],pc:RTCPeerConnection|null=null,viewer:{id:string;key:string}|null=null,timer:ReturnType<typeof setInterval>|undefined;
 function stop(){if(stopped)return;stopped=true;controller.abort();clearInterval(timer);signal?.removeEventListener('abort',stop);if(pc)closePeer(pc);pending=[];if(viewer)void liveRPC({op:'leave',session,viewer:viewer.id,key:viewer.key}).catch(()=>{});}
 signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted){stop();return stop;}
 const send=(payload:unknown)=>liveRPC({op:'signal',session,viewer:viewer!.id,key:viewer!.key,payload},controller.signal);
 try{
  // Don't abort the join RPC: if the server creates a slot, retain its ID so cleanup can release it.
  viewer=await liveRPC({op:'join',session,key}) as {id:string;key:string};if(stopped){void liveRPC({op:'leave',session,viewer:viewer.id,key:viewer.key}).catch(()=>{});return stop;}
  pc=new RTCPeerConnection(config);const connection=pc;
  connection.addTransceiver('video',{direction:'recvonly'});connection.addTransceiver('audio',{direction:'recvonly'});
  connection.ontrack=e=>{if(!stopped)onStream(e.streams[0]||new MediaStream([e.track]));};connection.onicecandidate=e=>{if(!stopped&&e.candidate)void send({type:'candidate',candidate:e.candidate.toJSON()}).catch(e=>{if(!stopped)onStatus(e.message);});};
  connection.onconnectionstatechange=()=>{if(!stopped)onStatus(connection.connectionState==='connected'?'':connection.connectionState==='failed'?'Forbindelsen fejlede. Brug samme netværk eller del scenen via OBS.':'Forbinder til Leafy-scenen…');};
  await connection.setLocalDescription(await connection.createOffer());if(stopped)return stop;await send({type:'offer',sdp:connection.localDescription!.sdp});if(stopped)return stop;
  async function poll(){if(stopped||busy)return;busy=true;try{const data=await liveRPC({op:'poll',session,viewer:viewer!.id,key:viewer!.key,cursor},controller.signal);if(stopped)return;if(!data.active){onStatus('Præsentationen er stoppet.');stop();return;}
   for(const item of data.signals as Signal[]){if(stopped)return;cursor=Math.max(cursor,item.id);const p=item.payload;if(p.type==='answer'){await connection.setRemoteDescription({type:'answer',sdp:p.sdp});for(const c of pending)await connection.addIceCandidate(c);pending=[];}else if(p.type==='candidate'&&p.candidate){if(connection.remoteDescription)await connection.addIceCandidate(p.candidate);else pending=[...pending,p.candidate].slice(-60);}}
  }catch(e){if(!stopped){onStatus((e as Error).message);if([403,404].includes((e as Error&{status?:number}).status||0))stop();}}finally{busy=false;}}
  timer=setInterval(()=>void poll(),1000);void poll();return stop;
 }catch(e){const cancelled=stopped||signal?.aborted;stop();if(cancelled)return stop;throw e;}
}
