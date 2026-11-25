import {database,rateLimit} from '@/lib/leafy/store';
import {visitor,checkOrigin,readJson} from '@/lib/leafy/session';
export const dynamic='force-dynamic';
let ready:Promise<unknown>|undefined;
async function db(){const d=await database();if(!ready)ready=d.batch([
 d.prepare('CREATE TABLE IF NOT EXISTS leafy_live_rooms(id TEXT PRIMARY KEY,owner TEXT NOT NULL,viewKey TEXT NOT NULL,audienceKey TEXT NOT NULL,expires INTEGER NOT NULL,active INTEGER DEFAULT 0)'),
 d.prepare('CREATE TABLE IF NOT EXISTS leafy_live_questions(id TEXT PRIMARY KEY,room TEXT NOT NULL,name TEXT NOT NULL,text TEXT NOT NULL,status TEXT NOT NULL,created INTEGER NOT NULL)'),
 d.prepare('CREATE TABLE IF NOT EXISTS leafy_live_signals(id INTEGER PRIMARY KEY AUTOINCREMENT,room TEXT NOT NULL,viewer TEXT NOT NULL,direction TEXT NOT NULL,payload TEXT NOT NULL,created INTEGER NOT NULL)'),
 d.prepare('CREATE INDEX IF NOT EXISTS leafy_live_signal_room ON leafy_live_signals(room,viewer,id)'),
 d.prepare('CREATE TABLE IF NOT EXISTS leafy_live_viewers(id TEXT PRIMARY KEY,room TEXT NOT NULL,key TEXT NOT NULL,created INTEGER NOT NULL)')
 ]).catch(e=>{ready=undefined;throw e;});await ready;return d;}
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
type Room={id:string;owner:string;viewKey:string;audienceKey:string;expires:number;active:number};
export async function POST(request:Request){try{
 checkOrigin(request);const b=await readJson(request,50000),user=await visitor(request),d=await db();
 const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});
 if(b.op==='create'){
  await rateLimit(user.owner,'live-create',12);const now=Date.now();await d.batch([d.prepare('DELETE FROM leafy_live_questions WHERE room IN (SELECT id FROM leafy_live_rooms WHERE expires<?)').bind(now),d.prepare('DELETE FROM leafy_live_signals WHERE created<?').bind(now-600000),d.prepare('DELETE FROM leafy_live_viewers WHERE created<?').bind(now-43200000),d.prepare('DELETE FROM leafy_live_rooms WHERE expires<?').bind(now)]);
  const session={id:crypto.randomUUID(),viewKey:token(),audienceKey:token(),expires:now+43200000};await d.prepare('INSERT INTO leafy_live_rooms(id,owner,viewKey,audienceKey,expires) VALUES (?,?,?,?,?)').bind(session.id,user.owner,session.viewKey,session.audienceKey,session.expires).run();return reply(session);
 }
 const room=await d.prepare('SELECT * FROM leafy_live_rooms WHERE id=? AND expires>?').bind(String(b.session||''),Date.now()).first<Room>();if(!room)return reply({error:'Live-sessionen er udløbet eller findes ikke.'},404);
 const host=room.owner===user.owner;
 if(b.op==='question'){
  if(b.key!==room.audienceKey)return reply({error:'Ugyldigt publikumslink.'},403);
  await rateLimit(user.owner,`live-question:${room.id}`,10);
  const text=typeof b.text==='string'?b.text.trim():'';if(!text||text.length>800)return reply({error:'Skriv et spørgsmål på højst 800 tegn.'},400);
  const count=await d.prepare('SELECT COUNT(*) as n FROM leafy_live_questions WHERE room=?').bind(room.id).first<{n:number}>();if((count?.n||0)>=200)return reply({error:'Spørgsmålskøen er fuld.'},429);
  await d.prepare('INSERT INTO leafy_live_questions VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),room.id,String(b.name||'Publikum').slice(0,60),text,'queued',Date.now()).run();return reply({ok:true});
 }
 if(b.op==='audience-check'){if(b.key!==room.audienceKey)return reply({error:'Ugyldigt link.'},403);return reply({active:!!room.active});}
 if(b.op==='questions'){if(!host)return reply({error:'Kun foredragsholderen kan se køen.'},403);const rows=await d.prepare('SELECT id,name,text,status,created FROM leafy_live_questions WHERE room=? ORDER BY created DESC LIMIT 200').bind(room.id).all();return reply({questions:rows.results});}
 if(b.op==='moderate'){if(!host)return reply({error:'Kun foredragsholderen kan godkende.'},403);if(!['approved','ignored'].includes(String(b.status)))return reply({error:'Ugyldig status.'},400);await d.prepare('UPDATE leafy_live_questions SET status=? WHERE room=? AND id=?').bind(b.status,room.id,String(b.id)).run();return reply({ok:true});}
 if(b.op==='active'){if(!host)return reply({error:'Kun foredragsholderen kan starte scenen.'},403);await d.prepare('UPDATE leafy_live_rooms SET active=? WHERE id=?').bind(b.active===true?1:0,room.id).run();if(b.active!==true)await d.prepare('DELETE FROM leafy_live_signals WHERE room=?').bind(room.id).run();return reply({ok:true});}
 if(b.op==='join'){
  if(b.key!==room.viewKey)return reply({error:'Ugyldigt scenelink.'},403);if(!room.active)return reply({error:'Scenen er ikke startet.'},409);
  await rateLimit(user.owner,'live-join',30);await d.prepare('DELETE FROM leafy_live_viewers WHERE room=? AND created<?').bind(room.id,Date.now()-300000).run();
  const count=await d.prepare('SELECT COUNT(*) as n FROM leafy_live_viewers WHERE room=?').bind(room.id).first<{n:number}>();if((count?.n||0)>=4)return reply({error:'Der er allerede fire scene-modtagere. Luk en anden scene og prøv igen.'},429);
  const viewer={id:crypto.randomUUID(),key:token()};await d.prepare('INSERT INTO leafy_live_viewers VALUES (?,?,?,?)').bind(viewer.id,room.id,viewer.key,Date.now()).run();return reply(viewer);
 }
 if(b.op==='leave'){await d.prepare('DELETE FROM leafy_live_viewers WHERE id=? AND room=? AND key=?').bind(String(b.viewer),room.id,String(b.key)).run();return reply({ok:true});}
 if(b.op==='signal'||b.op==='poll'){
  const direction=host&&b.host===true?'host':'viewer';
  if(direction==='viewer'){
   const v=await d.prepare('SELECT id FROM leafy_live_viewers WHERE id=? AND room=? AND key=?').bind(String(b.viewer),room.id,String(b.key)).first();if(!v)return reply({error:'Sceneforbindelsen er udløbet.'},403);await d.prepare('UPDATE leafy_live_viewers SET created=? WHERE id=?').bind(Date.now(),String(b.viewer)).run();
  }
  if(!room.active)return reply({active:false,signals:[]});
  if(b.op==='signal'){
   const payload=JSON.stringify(b.payload);if(!payload||payload.length>35000||!['offer','answer','candidate'].includes(String((b.payload as Record<string,unknown>)?.type)))return reply({error:'Ugyldigt signal.'},400);
   const v=await d.prepare('SELECT id FROM leafy_live_viewers WHERE id=? AND room=?').bind(String(b.viewer),room.id).first();if(!v)return reply({error:'Modtageren er væk.'},404);
   await rateLimit(user.owner,'live-signal',6000);
   await d.prepare('INSERT INTO leafy_live_signals(room,viewer,direction,payload,created) VALUES (?,?,?,?,?)').bind(room.id,String(b.viewer),direction,payload,Date.now()).run();return reply({ok:true});
  }
  const cursor=Number(b.cursor)||0;
  const query=direction==='host'?d.prepare("SELECT id,viewer,payload FROM leafy_live_signals WHERE room=? AND direction='viewer' AND id>? AND created>? ORDER BY id LIMIT 100").bind(room.id,cursor,Date.now()-120000):d.prepare("SELECT id,viewer,payload FROM leafy_live_signals WHERE room=? AND viewer=? AND direction='host' AND id>? AND created>? ORDER BY id LIMIT 100").bind(room.id,String(b.viewer),cursor,Date.now()-120000);
  const rows=await query.all<{id:number;viewer:string;payload:string}>();return reply({active:true,signals:rows.results.map(x=>({...x,payload:JSON.parse(x.payload)}))});
 }
 return reply({error:'Ukendt handling.'},400);
 }catch(e){return Response.json({error:(e as Error).message},{status:400,headers:{'Cache-Control':'no-store'}});}}
