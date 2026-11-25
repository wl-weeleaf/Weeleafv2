// Applies drizzle/*.sql to the local D1 database used by `pnpm dev`, so API
// routes don't fail with "no such table" on a fresh checkout. Idempotent:
// Wrangler records applied migrations and skips them on later runs.
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const dir='.sites-runtime';mkdirSync(dir,{recursive:true});
const config=`${dir}/wrangler.migrate.json`;
writeFileSync(config,JSON.stringify({name:'leafy-local-migrate',compatibility_date:'2026-05-15',d1_databases:[{binding:'DB',database_name:'site-creator-d1',database_id:'00000000-0000-4000-8000-000000000000',migrations_dir:'../drizzle'}]}));
const r=spawnSync(process.execPath,['./node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','site-creator-d1','--local','--config',config,'--persist-to','.wrangler/state'],{stdio:'inherit',env:{...process.env,CI:'1',WRANGLER_SEND_METRICS:'false'}});
if(r.status!==0){console.warn('Lokal D1-migrering fejlede – API-ruter der bruger databasen virker måske ikke.');}
