import {env} from 'cloudflare:workers';
export type Task={id:string;title:string;status:'queued'|'working'|'done'|'failed'|'cancelled';result:string;error:string;createdAt:string;updatedAt:string};
let ready:Promise<void>|undefined;
export async function database(){
 if(!env.DB)throw new Error('Opgavedatabasen er ikke tilkoblet.');
 const db=env.DB;
 if(!ready)ready=db.batch([
  db.prepare('CREATE TABLE IF NOT EXISTS leafy_tasks (id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL, result TEXT NOT NULL DEFAULT \'\', error TEXT NOT NULL DEFAULT \'\', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)'),
  db.prepare('CREATE INDEX IF NOT EXISTS leafy_tasks_owner ON leafy_tasks(owner, createdAt)'),
  db.prepare('CREATE TABLE IF NOT EXISTS leafy_approvals (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL, createdAt TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0)'),
  db.prepare('CREATE TABLE IF NOT EXISTS leafy_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL)'),
  db.prepare('CREATE TABLE IF NOT EXISTS leafy_transcripts (id TEXT PRIMARY KEY, owner TEXT NOT NULL, interactionId TEXT NOT NULL, transcriptId TEXT NOT NULL, status TEXT NOT NULL, result TEXT NOT NULL DEFAULT \'\', error TEXT NOT NULL DEFAULT \'\', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)'),
  db.prepare('CREATE INDEX IF NOT EXISTS leafy_transcripts_owner ON leafy_transcripts(owner, createdAt)'),
  db.prepare('CREATE TABLE IF NOT EXISTS leafy_transcript_uploads (id TEXT PRIMARY KEY, owner TEXT NOT NULL, interactionId TEXT NOT NULL, objectKey TEXT NOT NULL, multipartId TEXT NOT NULL, name TEXT NOT NULL, size INTEGER NOT NULL, createdAt TEXT NOT NULL)'),
  db.prepare('CREATE INDEX IF NOT EXISTS leafy_transcript_uploads_owner ON leafy_transcript_uploads(owner, createdAt)'),
  db.prepare('CREATE TABLE IF NOT EXISTS leafy_file_uploads (id TEXT PRIMARY KEY, owner TEXT NOT NULL, objectKey TEXT NOT NULL, multipartId TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, excerpt TEXT NOT NULL DEFAULT \'\', visions INTEGER NOT NULL DEFAULT 0, createdAt INTEGER NOT NULL)'),
  db.prepare('CREATE INDEX IF NOT EXISTS leafy_file_uploads_owner ON leafy_file_uploads(owner, createdAt)')
 ]).then(()=>{}).catch(e=>{ready=undefined;throw e;});
 await ready;return db;
}
export async function rateLimit(owner:string,scope:string,max=60){
 const db=await database(),bucket=`${owner}:${scope}:${new Date().toISOString().slice(0,13)}`;
 const row=await db.prepare('INSERT INTO leafy_limits(bucket,count) VALUES (?,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket).first<{count:number}>();
 if(row&&row.count>max)throw new Error('Denne browsers timegrænse er nået. Prøv igen senere.');
}
export async function saveApproval(owner:string,id:string,payload:unknown){
 const db=await database();await db.prepare('INSERT INTO leafy_approvals(id,owner,payload,createdAt) VALUES (?,?,?,?)').bind(id,owner,JSON.stringify(payload),new Date().toISOString()).run();
}
export async function takeApproval(owner:string,id:string){
 const db=await database();
 const row=await db.prepare('UPDATE leafy_approvals SET used=1 WHERE id=? AND owner=? AND used=0 AND createdAt>? RETURNING payload').bind(id,owner,new Date(Date.now()-30*60000).toISOString()).first<{payload:string}>();
 if(!row)throw new Error('Godkendelsen er udløbet eller allerede brugt.');return JSON.parse(row.payload);
}
export async function tasks(owner:string){const db=await database();const rows=await db.prepare('SELECT id,title,status,result,error,createdAt,updatedAt FROM leafy_tasks WHERE owner=? ORDER BY createdAt DESC LIMIT 30').bind(owner).all<Task>();return rows.results;}
export async function newTask(owner:string,title:string){const db=await database(),id=crypto.randomUUID(),time=new Date().toISOString();await db.prepare('INSERT INTO leafy_tasks(id,owner,title,status,createdAt,updatedAt) VALUES (?,?,?,\'queued\',?,?)').bind(id,owner,title,time,time).run();return id;}
export async function updateTask(owner:string,id:string,status:Task['status'],result='',error=''){
 const db=await database();await db.prepare('UPDATE leafy_tasks SET status=?,result=?,error=?,updatedAt=? WHERE id=? AND owner=? AND status!=\'cancelled\'').bind(status,result,error,new Date().toISOString(),id,owner).run();
}
