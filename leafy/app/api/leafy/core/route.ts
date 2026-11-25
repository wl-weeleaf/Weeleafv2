import {visitor,checkOrigin,readJson} from '@/lib/leafy/session';
import {rateLimit} from '@/lib/leafy/store';
import {memoryRejection} from '@/lib/leafy/core-filters';
import {activeNotes,notesDatabase} from '@/lib/leafy/core-notes';
export const dynamic='force-dynamic';
async function handle(request:Request) {
 const headers=new Headers({'Cache-Control':'no-store'});
 const reply=(data:unknown,status=200)=>Response.json(data,{status,headers});
 try { checkOrigin(request); } catch { return reply({error:'Ugyldig oprindelse.'},403); }
 try {
  const {owner,cookie}=await visitor(request);
  if(cookie) headers.set('Set-Cookie',cookie);
  await rateLimit(owner,'core-notes',240);
  const db=await notesDatabase(),now=Date.now();
  await db.prepare('DELETE FROM leafy_core_notes WHERE deletedAt <= ?').bind(now-30*86400000).run();
  if(request.method!=='GET') {
   let body;
   try {body=await readJson(request,2000);} catch {return reply({error:'Ugyldig anmodning.'},400);}
   if(request.method==='POST') {
    const note=typeof body.text==='string'?body.text.trim():'';
    if(!note||note.length>240)return reply({error:'Skriv en note på 1–240 tegn.'},400);
    const reason=memoryRejection(note,'user');if(reason)return reply({error:reason},400);
    const result=await db.prepare('INSERT INTO leafy_core_notes(id,profileId,text,createdAt,updatedAt) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM leafy_core_notes WHERE profileId=? AND deletedAt IS NULL)<20').bind(crypto.randomUUID(),owner,note,now,now,owner).run();
    if(!result.meta.changes)return reply({error:'Der er plads til 20 noter.'},409);
   } else if(body.confirm==='SLET ALLE SERVERNOTER') {
    await db.prepare('DELETE FROM leafy_core_notes WHERE profileId=?').bind(owner).run();
   } else if(typeof body.id==='string') {
    await db.prepare("UPDATE leafy_core_notes SET text='',status='archived',updatedAt=?,deletedAt=? WHERE profileId=? AND id=? AND deletedAt IS NULL").bind(now,now,owner,body.id).run();
   } else return reply({error:'Bekræft sletningen.'},400);
  }
  return reply({notes:await activeNotes(owner)});
 } catch(error) {
  if(error instanceof Error && error.message.includes('timegrænse')) return reply({error:error.message},429);
  return reply({error:'Kunne ikke hente eller gemme servernoterne.'},503);
 }
}
export const GET=handle,POST=handle,DELETE=handle;
