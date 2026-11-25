import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createOperations} from '../integration/pc-bridge/operations.mjs';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'leafy-pc-'));
try{
 const run=await createOperations({workspace:root,programs:{}});
 await run({action:'mkdir',path:'docs'});
 await run({action:'write',path:'docs/test.md',content:'Hej Leafy'});
 const read=await run({action:'read',path:'docs/test.md'});assert.equal(read.text,'Hej Leafy');assert.equal(read.hash.length,64);
 assert((await run({action:'list',path:'docs'})).entries.some(e=>e.name==='test.md'));
 assert((await run({action:'search',path:'.',query:'test'})).matches.some(e=>e.path==='docs/test.md'));
 await assert.rejects(()=>run({action:'write',path:'docs/test.md',content:'Overskrivning'}));
 await assert.rejects(()=>run({action:'write',path:'docs/test.md',content:'Forkert hash',expectedHash:'0'.repeat(64)}));
 await run({action:'write',path:'docs/test.md',content:'Godkendt',expectedHash:read.hash});
 assert.equal((await run({action:'read',path:'docs/test.md'})).text,'Godkendt');
 await assert.rejects(()=>run({action:'read',path:'../outside'}));await assert.rejects(()=>run({action:'write',path:'.env',content:'secret'}));
 const outside=await fs.mkdtemp(path.join(os.tmpdir(),'leafy-outside-'));try{await fs.writeFile(path.join(outside,'secret.txt'),'private');await fs.symlink(outside,path.join(root,'link'));await assert.rejects(()=>run({action:'read',path:'link/secret.txt'}));}finally{await fs.rm(outside,{recursive:true,force:true});}
 const actual=await run({action:'run_command',path:'.',command:'node-version'});assert.equal(actual.exitCode,0);assert.match(actual.output,/^v\d+/);
 await assert.rejects(()=>run({action:'run_command',path:'.',command:'node-version; echo unsafe'}));
 await fs.writeFile(path.join(root,'package.json'),JSON.stringify({name:'leafy-local-check',packageManager:'npm@10.0.0',scripts:{build:"node -e \"console.log('leafy-script-ok')\""}}));
 const project=await run({action:'project_scripts',path:'.'});assert.equal(project.packageManager,'npm');assert.equal(project.scripts.build,"node -e \"console.log('leafy-script-ok')\"");
 const built=await run({action:'run_script',path:'.',script:'build'});assert.equal(built.exitCode,0);assert.match(built.output,/leafy-script-ok/);assert.equal(built.timedOut,false);
 await assert.rejects(()=>run({action:'run_script',path:'.',script:'missing'}),/Scriptet findes ikke/);
 const externalProject=await fs.mkdtemp(path.join(os.tmpdir(),'leafy-pc-external-project-'));try{await fs.writeFile(path.join(externalProject,'package.json'),JSON.stringify({scripts:{build:'echo external'}}));await fs.mkdir(path.join(root,'linked'));await fs.symlink(path.join(externalProject,'package.json'),path.join(root,'linked','package.json'));await assert.rejects(()=>run({action:'project_scripts',path:'linked'}),/Symbolske links/);}finally{await fs.rm(externalProject,{recursive:true,force:true});}
 await assert.rejects(()=>run({action:'launch_program',program:'unregistered'}));
 await run({action:'import_upload',path:'docs/upload.txt',uploadId:'id'},{download:async()=>Buffer.from('uploaded')});assert.equal((await run({action:'read',path:'docs/upload.txt'})).text,'uploaded');
 await assert.rejects(()=>run({action:'list'},{signal:AbortSignal.abort()}));
 console.log('PASS: actual local file creation/read/hash overwrite, folder search, uploaded-file import, actual Node process, cancellation, path/symlink boundary and no arbitrary shell/program.');
}finally{await fs.rm(root,{recursive:true,force:true});}
