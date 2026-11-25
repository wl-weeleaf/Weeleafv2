import {database} from './store';
import migration from '../../drizzle/0002_leafy_core.sql?raw';
let ready: Promise<unknown> | undefined;
export async function notesDatabase() {
 const db = await database();
 ready ??= db.batch(migration.split('--> statement-breakpoint').map(sql => sql.trim()).filter(Boolean)
   .map(sql => db.prepare(sql.replace(/^CREATE (TABLE|INDEX) /,'CREATE $1 IF NOT EXISTS '))))
   .catch(error => { ready = undefined; throw error; });
 await ready;
 return db;
}
export async function activeNotes(owner:string) {
 const db = await notesDatabase();
 return (await db.prepare("SELECT id,text FROM leafy_core_notes WHERE profileId=? AND status='active' AND deletedAt IS NULL ORDER BY createdAt,id").bind(owner).all<{id:string;text:string}>()).results;
}
