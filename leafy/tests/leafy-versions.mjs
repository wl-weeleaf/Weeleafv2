import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const src=await fs.readFile(new URL('../lib/leafy/versions.ts',import.meta.url),'utf8').then(s=>s.replace("import type {Artifact} from './actions';",''));
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const v=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const art=(id,name,content)=>({id,name,mime:'text/html',content,createdAt:'2026-11-18T00:00:00Z'});
let list=[];
for(let i=1;i<=15;i++)list=v.addArtifact(list,art('a'+i,'app.html','v'+i));
// Updates never overwrite: history per file, capped, newest kept.
assert.equal(v.versionsOf(list,'app.html').length,12);
assert.equal(v.latestOf(list,'app.html').content,'v15');
assert.equal(v.latestOf(list,'app.html').version,12);
// Same id is idempotent.
assert.equal(v.addArtifact(list,art('a15','app.html','x')).length,list.length);
// Other files are untouched by pruning of one file.
list=v.addArtifact(list,art('b1','notes.md','n1'));assert.equal(v.versionsOf(list,'notes.md').length,1);
// Restore appends a copy of an old version as newest, history is not rewritten.
const before=v.versionsOf(list,'app.html').length;
const restored=v.restoreVersion(list,'a10','r1','2026-11-18T12:00:00Z');
assert.equal(v.latestOf(restored,'app.html').content,'v10');
assert.equal(v.latestOf(restored,'app.html').id,'r1');
assert.ok(v.versionsOf(restored,'app.html').length<=Math.max(before,12));
// Total size budget prunes oldest non-latest first and never drops the newest of any file.
let big=[];for(let i=0;i<10;i++)big=v.addArtifact(big,art('x'+i,'big.html','z'.repeat(150000)),12,400000);
assert.ok(big.length<10);assert.equal(v.latestOf(big,'big.html').id,'x9');
const huge=v.addArtifact([],art('h1','huge.html','z'.repeat(170000)),12,1000);assert.equal(huge.length,1,'oversized latest file is kept');
// Change summary.
assert.deepEqual(v.changeSummary('a\nb\nc','a\nc\nd'),{added:1,removed:1,unchanged:2});
// Quota recovery: write fails until data is small enough, then succeeds without losing the newest version.
let limit=300000;const writes=[];
const data={artifacts:Array.from({length:8},(_,i)=>art('q'+i,'q.html','y'.repeat(100000))),media:[1,2,3,4,5,6,7]};
const saved=v.saveWithQuotaRecovery(data,json=>{if(json.length>limit)throw new Error('QuotaExceededError');writes.push(json.length);});
assert.equal(saved.ok,true);assert.ok(saved.data.artifacts.length<8);assert.equal(saved.data.artifacts.at(-1).id,'q7');
const hopeless=v.saveWithQuotaRecovery(data,()=>{throw new Error('QuotaExceededError');});assert.equal(hopeless.ok,false);
console.log('PASS: append-only artifact versions, per-file cap, size budget keeps newest, restore as new version, change summary and localStorage quota recovery.');
