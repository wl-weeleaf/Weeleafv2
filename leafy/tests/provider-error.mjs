import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source=fs.readFileSync('lib/livi/provider-error.ts','utf8');
const module=await import('data:text/javascript;base64,'+Buffer.from(ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64'));

test('reads Corti string error/detail format and OpenAI nested error format',()=>{
 assert.equal(module.providerErrorDetail(JSON.stringify({error:'Bad Request',detail:'Tool schema rejected.'})),'Tool schema rejected.');
 assert.equal(module.providerErrorDetail(JSON.stringify({error:{message:'Invalid request payload.'}})),'Invalid request payload.');
 assert.equal(module.providerErrorDetail(JSON.stringify({detail:'Model access is not enabled.'})),'Model access is not enabled.');
});
test('redacts credentials, bounds output, and handles plain text',()=>{
 assert.doesNotMatch(module.providerErrorDetail(JSON.stringify({detail:'Bearer abcsecretvalue'})),/abcsecretvalue/);
 assert.equal(module.providerErrorDetail('x'.repeat(400),120).length,120);
 assert.equal(module.providerErrorDetail('<html>bad</html>'),'bad');
});
