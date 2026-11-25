import {database} from './store';
import {cleanEnvironment,safeControl,validateAction,type ControlState,type Environment,type UIAction} from './environment';
import {publicUrl} from './actions';
import {validatePCAction} from './pc-action';
export type Session={id:string;owner:string;kind:'chrome'|'pc';capabilities:string;pairHash:string;tokenHash:string|null;device:string;control:ControlState;snapshot:string;expiresAt:number;lastSeen:number;revoked:number};
export type Command={id:string;payload:UIAction;status:string};
const SESSION_TTL=30*24*60*60*1000,STALE_AFTER=120_000;
const newSecret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
export async function hash(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
export async function pairing(owner:string,kind:'chrome'|'pc'='chrome'){
 const db=await database(),id=crypto.randomUUID(),code=newSecret();
 await db.prepare('UPDATE leafy_remote_sessions SET revoked=1,snapshot=\'{}\',control=\'DISCONNECTED\' WHERE owner=? AND kind=? AND tokenHash IS NULL').bind(owner,kind).run();
 await db.prepare('DELETE FROM leafy_ui_commands WHERE expiresAt<?').bind(Date.now()-86400000).run();
 await db.prepare('DELETE FROM leafy_remote_sessions WHERE expiresAt<? OR (revoked=1 AND lastSeen<?)').bind(Date.now()-86400000,Date.now()-86400000).run();
 await db.prepare('INSERT INTO leafy_remote_sessions(id,owner,pairHash,expiresAt,kind) VALUES (?,?,?,?,?)').bind(id,owner,await hash(code),Date.now()+600000,kind).run();return {id,code,expiresIn:600};
}
export async function exchange(code:string,device:string,kind:'chrome'|'pc'='chrome'){
 if(!/^[a-f0-9]{64}$/.test(code))throw new Error('Ugyldig parringskode.');const token=newSecret(),db=await database();
 const row=await db.prepare("UPDATE leafy_remote_sessions SET tokenHash=?,pairHash='',device=?,control='AGENT_CONTROL',lastSeen=?,expiresAt=? WHERE pairHash=? AND tokenHash IS NULL AND revoked=0 AND expiresAt>? AND kind=? RETURNING id").bind(await hash(token),device.slice(0,80),Date.now(),Date.now()+SESSION_TTL,await hash(code),Date.now(),kind).first<{id:string}>();
 if(!row)throw new Error('Parringskoden er udløbet eller allerede brugt.');return {id:row.id,token,expiresIn:SESSION_TTL/1000};
}
export async function extensionSession(request:Request){
 const token=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token)throw new Error('Forbindelsen kræver en enhedsnøgle.');
 const db=await database(),session=await db.prepare('SELECT * FROM leafy_remote_sessions WHERE tokenHash=? AND revoked=0 AND expiresAt>?').bind(await hash(token),Date.now()).first<Session>();if(!session)throw new Error('Forbindelsen er udløbet eller afbrudt.');return session;
}
export async function sessions(owner:string,kind:'chrome'|'pc'='chrome'){const db=await database(),rows=await db.prepare('SELECT * FROM leafy_remote_sessions WHERE owner=? AND kind=? AND revoked=0 ORDER BY lastSeen DESC LIMIT 5').bind(owner,kind).all<Session>();return rows.results.map(s=>({id:s.id,device:s.device,capabilities:JSON.parse(s.capabilities||'{}'),control:(!s.tokenHash||s.expiresAt<Date.now()||s.lastSeen<Date.now()-STALE_AFTER)?'DISCONNECTED':s.control,lastSeen:s.lastSeen,environment:s.control==='AGENT_CONTROL'&&s.lastSeen>Date.now()-STALE_AFTER?cleanEnvironment(JSON.parse(s.snapshot)):null}));}
/** Only resolve devices paired by this browser owner. Never fall back to another owner. */
export async function pcConnectionStatus(owner:string,id?:string){
 const devices=await sessions(owner,'pc'),device=id?devices.find(s=>s.id===id):devices.find(s=>s.control==='AGENT_CONTROL')||devices[0];
 return {connected:device?.control==='AGENT_CONTROL',control:device?.control||'DISCONNECTED',device:device||null,devices,scope:'current-browser',
  message:device?.control==='AGENT_CONTROL'?'PC-forbindelsen er aktiv ifølge seneste heartbeat. Brug pc_action til at læse og arbejde i den valgte mappe.':device&&device.control!=='DISCONNECTED'?'PC-forbindelsen er på pause. Brug Fortsæt i Terminal og PC.':device?'PC’en er registreret, men der er ikke et aktuelt heartbeat. Start forbindelsesprogrammet i den samme mappe på din PC; en normal genstart kræver ikke en ny parring.':'Denne browser har ingen aktiv PC-forbindelse. Hvis forbindelsen kører i en anden browser eller desktopwidget, skal denne browser parres under Terminal og PC. Det er ikke en fejl i Corti-opsætningen.'};
}
export async function resolvePCSession(owner:string,id?:string){
 const devices=await sessions(owner,'pc');
 if(id){const device=devices.find(s=>s.id===id);if(!device)throw new Error('PC-forbindelsen tilhører ikke denne browser eller findes ikke længere. Kontrollér pc_action status.');if(device.control!=='AGENT_CONTROL')throw new Error(device.control==='DISCONNECTED'?'PC’en svarer ikke lige nu. Lad forbindelsesprogrammet køre, og kontrollér pc_action status.':'PC-adgangen er på pause. Vælg Fortsæt under Terminal og PC.');return device;}
 const active=devices.filter(s=>s.control==='AGENT_CONTROL');if(active.length===1)return active[0];if(active.length>1)throw new Error('Flere PC’er er forbundet. Brug pc_action status, og vælg den enhed, brugeren vil arbejde på.');throw new Error((await pcConnectionStatus(owner)).message);
}
/** A local process exit is not a revocation of the user's pairing grant. */
export async function deviceOffline(session:Session){
 const db=await database();await db.prepare('UPDATE leafy_remote_sessions SET lastSeen=0 WHERE id=? AND owner=? AND kind=?').bind(session.id,session.owner,session.kind).run();
 await db.prepare("UPDATE leafy_ui_commands SET status='cancelled',result='{\"error\":\"PC-programmet er lukket.\"}' WHERE owner=? AND target=? AND status IN ('queued','working')").bind(session.owner,session.id).run();
}
export async function control(owner:string,id:string,mode:ControlState,kind:'chrome'|'platform'|'pc'){
 const db=await database();
 if(kind!=='platform')await db.prepare('UPDATE leafy_remote_sessions SET control=?,snapshot=\'{}\',revoked=CASE WHEN ?=\'DISCONNECTED\' THEN 1 ELSE revoked END WHERE id=? AND owner=? AND kind=?').bind(mode,mode,id,owner,kind).run();
 else await db.prepare('INSERT INTO leafy_platform_controls(id,owner,control) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET control=excluded.control WHERE owner=excluded.owner').bind(id,owner,mode).run();
 if(mode!=='AGENT_CONTROL')await db.prepare("UPDATE leafy_ui_commands SET status='cancelled',result='{\"error\":\"Brugeren har overtaget kontrollen.\"}' WHERE owner=? AND target=? AND status IN ('queued','working')").bind(owner,id).run();
}
export async function checkControl(owner:string,target:string,kind:'chrome'|'platform'|'pc'){
 const db=await database();
 if(kind!=='platform'){
  const s=await db.prepare('SELECT * FROM leafy_remote_sessions WHERE id=? AND owner=? AND kind=? AND revoked=0 AND expiresAt>? AND lastSeen>?').bind(target,owner,kind,Date.now(),Date.now()-STALE_AFTER).first<Session>();if(!s)throw new Error(kind==='pc'?'PC’en svarer ikke lige nu. Kontrollér at Leafy Desktop Agent stadig kører.':'Chrome svarer ikke lige nu. Kontrollér at Leafy-udvidelsen stadig kører.');if(s.control!=='AGENT_CONTROL')throw new Error('Du har kontrollen. Vælg Fortsæt Leafy før en ny handling.');return s;
 }
 const s=await db.prepare('SELECT control FROM leafy_platform_controls WHERE id=? AND owner=?').bind(target,owner).first<{control:string}>();if(s&&s.control!=='AGENT_CONTROL')throw new Error('Platformens agent er pauset.');return null;
}
export async function queueAction(owner:string,target:string,kind:'chrome'|'platform'|'pc',value:unknown,timeoutMs=20000){
 if(!/^[a-f0-9-]{36}$/.test(target))throw new Error('Et aktuelt miljø mangler.');
 const payload=kind==='pc'?validatePCAction(value):validateAction(value) as unknown as Record<string,unknown>;if(kind!=='pc'&&payload.url){if(kind==='platform'){if(!['/','/studio','/orb','/watch'].includes(String(payload.url)))throw new Error('Vælg en intern Leafy-side.');}else{const url=publicUrl(payload.url);payload.url=url.href;}}
 await checkControl(owner,target,kind);const db=await database(),id=crypto.randomUUID();
 await db.prepare('INSERT INTO leafy_ui_commands(id,owner,target,kind,payload,createdAt,expiresAt) VALUES (?,?,?,?,?,?,?)').bind(id,owner,target,kind,JSON.stringify(payload),Date.now(),Date.now()+Math.max(20000,Math.min(180000,timeoutMs))+10000).run();return id;
}
export async function commandResult(owner:string,id:string){const db=await database();return db.prepare('SELECT id,status,result,expiresAt,target,kind FROM leafy_ui_commands WHERE id=? AND owner=?').bind(id,owner).first<{id:string;status:string;result:string;expiresAt:number;target:string;kind:string}>();}
export async function waitAction(owner:string,target:string,kind:'chrome'|'platform'|'pc',payload:unknown,signal?:AbortSignal,timeoutMs=20000){
 const duration=Math.max(20000,Math.min(180000,timeoutMs)),id=await queueAction(owner,target,kind,payload,duration);
 for(let n=0;n<Math.ceil(duration/400);n++){if(signal?.aborted){const db=await database();await db.prepare("UPDATE leafy_ui_commands SET status='cancelled' WHERE id=? AND status IN ('queued','working')").bind(id).run();throw new DOMException('Afbrudt','AbortError');}await new Promise(r=>setTimeout(r,400));const row=await commandResult(owner,id);if(row&&['done','failed','cancelled'].includes(row.status)){const result=JSON.parse(row.result||'{}');if(result.error)throw new Error(String(result.error));return result;}}
 const db=await database();await db.prepare("UPDATE leafy_ui_commands SET status='cancelled' WHERE id=? AND status IN ('queued','working')").bind(id).run();throw new Error('Enheden svarede ikke. Handlingen er annulleret; start en ny efter genforbindelse.');
}
/** App-only settings flow. Program allowlists are never exposed as an AI pc_action. */
export async function waitProgramChange(owner:string,target:string,value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Ugyldig programændring.');
 const v=value as Record<string,unknown>,action=String(v.action||''),program=String(v.program||'');
 if(!['register_program','unregister_program'].includes(action)||!/^([a-z][a-z0-9-]{0,39})$/.test(program))throw new Error('Ugyldigt programnavn.');
 let payload:Record<string,unknown>={action,program};
 if(action==='register_program'){
  const executable=String(v.executable||''),args=v.args;
  if(!executable||executable.length>500||executable.includes('\0')||!(/^(?:[a-z]:[\\/]|\\\\|\/)/i.test(executable)))throw new Error('Indtast programmets fulde sti på PC’en.');
  if(!Array.isArray(args)||args.length>12||args.some(a=>typeof a!=='string'||a.length>240||a.includes('\0')))throw new Error('Brug højst 12 korte argumenter, ét pr. linje.');
  payload={...payload,executable,args,allowDocument:v.allowDocument===true};
 }
 await checkControl(owner,target,'pc');
 const db=await database(),id=crypto.randomUUID();
 await db.prepare('INSERT INTO leafy_ui_commands(id,owner,target,kind,payload,createdAt,expiresAt) VALUES (?,?,?,?,?,?,?)').bind(id,owner,target,'pc',JSON.stringify(payload),Date.now(),Date.now()+20000).run();
 for(let n=0;n<36;n++){
  await new Promise(r=>setTimeout(r,400));
  const row=await commandResult(owner,id);
  if(row&&['done','failed','cancelled'].includes(row.status)){
   const result=JSON.parse(row.result||'{}') as {error?:string;programs?:unknown};
   if(result.error)throw new Error(String(result.error));
   if(Array.isArray(result.programs)){
    const session=await db.prepare('SELECT capabilities FROM leafy_remote_sessions WHERE id=? AND owner=? AND kind=\'pc\'').bind(target,owner).first<{capabilities:string}>();
    if(session){let capabilities:Record<string,unknown>={};try{capabilities=JSON.parse(session.capabilities||'{}');}catch{}capabilities.programs=result.programs.filter(p=>typeof p==='string'&&/^[a-z][a-z0-9-]{0,39}$/.test(p)).slice(0,30);await db.prepare('UPDATE leafy_remote_sessions SET capabilities=? WHERE id=? AND owner=?').bind(JSON.stringify(capabilities),target,owner).run();}
   }
   return result;
  }
 }
 await db.prepare("UPDATE leafy_ui_commands SET status='cancelled' WHERE id=? AND status IN ('queued','working')").bind(id).run();
 throw new Error('PC’en svarede ikke. Hold Leafy PC-forbindelsen åben, og prøv igen.');
}
export async function claim(owner:string,target:string,kind:'chrome'|'platform'|'pc'){
 await checkControl(owner,target,kind);const db=await database();
 const row=await db.prepare("UPDATE leafy_ui_commands SET status='working' WHERE id=(SELECT id FROM leafy_ui_commands WHERE owner=? AND target=? AND kind=? AND status='queued' AND expiresAt>? ORDER BY createdAt LIMIT 1) AND status='queued' RETURNING id,payload").bind(owner,target,kind,Date.now()).first<{id:string;payload:string}>();return row?{id:row.id,payload:JSON.parse(row.payload)}:null;
}
export async function finish(owner:string,target:string,id:string,result:unknown,kind:'chrome'|'platform'|'pc'){
 await checkControl(owner,target,kind);const db=await database();const json=JSON.stringify(result);if(json.length>24000)throw new Error('Resultatet er for stort.');
 await db.prepare("UPDATE leafy_ui_commands SET status=?,result=? WHERE id=? AND owner=? AND target=? AND kind=? AND status='working' AND expiresAt>?").bind((result as {error?:string})?.error?'failed':'done',json,id,owner,target,kind,Date.now()).run();
}
export async function heartbeat(session:Session,snapshot:unknown){
 const db=await database();const current=await db.prepare('SELECT control FROM leafy_remote_sessions WHERE id=? AND revoked=0').bind(session.id).first<{control:ControlState}>();if(!current)throw new Error('Forbindelsen er afbrudt.');
 const environment=cleanEnvironment(snapshot);
 // A protected client report may only remove authority, never silently restore it.
 if(environment&&environment.control==='PROTECTED_HUMAN_CONTROL')await control(session.owner,session.id,'PROTECTED_HUMAN_CONTROL','chrome');
 const mode=environment?.control==='PROTECTED_HUMAN_CONTROL'?'PROTECTED_HUMAN_CONTROL':current.control;
 if(environment||mode!=='AGENT_CONTROL')await db.prepare('UPDATE leafy_remote_sessions SET lastSeen=?,expiresAt=?,snapshot=? WHERE id=? AND control=? AND revoked=0').bind(Date.now(),Date.now()+SESSION_TTL,mode==='AGENT_CONTROL'&&environment?JSON.stringify({...environment,sessionId:session.id,type:'chrome'}):'{}',session.id,mode).run();else await db.prepare('UPDATE leafy_remote_sessions SET lastSeen=?,expiresAt=? WHERE id=? AND revoked=0').bind(Date.now(),Date.now()+SESSION_TTL,session.id).run();return mode;
}
export function redactResult(value:unknown){const v=value as {error?:unknown;environment?:unknown;ok?:unknown};return {ok:v?.ok===true,...(v?.error?{error:String(v.error).slice(0,240)}:{}),environment:cleanEnvironment(v?.environment)};}
