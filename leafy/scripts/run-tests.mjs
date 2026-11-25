// Runs every tests/*.mjs in its own process. Tests that need packages that are not installed
// (run `pnpm install` first) are reported as SKIP, never as PASS.
import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=readdirSync(new URL('../tests/',import.meta.url)).filter(f=>f.endsWith('.mjs')).sort();
let pass=0,fail=0,skip=0;
for(const f of files){
 const r=spawnSync(process.execPath,[new URL('../tests/'+f,import.meta.url).pathname],{encoding:'utf8',timeout:120000});
 const out=(r.stdout||'')+(r.stderr||'');
 if(r.status===0){pass++;console.log('PASS',f);}
 else if(/ERR_MODULE_NOT_FOUND[^\n]*Cannot find package '(?:react|fflate|typescript)'/.test(out)||/Cannot find package '(?:react|fflate|typescript)'/.test(out)){skip++;console.log('SKIP',f,'(mangler installeret pakke)');}
 else{fail++;console.log('FAIL',f);console.log(out.split('\n').slice(-12).join('\n'));}
}
console.log(`\n${pass} bestået, ${fail} fejlet, ${skip} sprunget over`);
process.exit(fail?1:0);
