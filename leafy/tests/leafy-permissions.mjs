import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const source=await fs.readFile(new URL('../lib/leafy/core.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const core=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const {enforcePermissionFloor,stricterMode,LEAFY_PERSONA}=core;
// A tampered browser can never loosen outward-facing permissions below the built-in default.
assert.equal(enforcePermissionFloor('purchase','allow'),'block');
assert.equal(enforcePermissionFloor('purchase','ask'),'block');
assert.equal(enforcePermissionFloor('delete','allow'),'block');
assert.equal(enforcePermissionFloor('send','allow'),'ask');
assert.equal(enforcePermissionFloor('publish','allow'),'ask');
// A user may always tighten.
assert.equal(enforcePermissionFloor('send','block'),'block');
assert.equal(enforcePermissionFloor('publish','block'),'block');
// Non-floored permissions are untouched.
assert.equal(enforcePermissionFloor('web-search','allow'),'allow');
assert.equal(enforcePermissionFloor('read-files','block'),'block');
assert.equal(stricterMode('allow','ask'),'ask');
assert.equal(stricterMode('block','allow'),'block');
// The persona is gender-neutral and must not contradict itself.
assert.ok(/kønsneutral/.test(LEAFY_PERSONA));
assert.ok(!/\bhun\b|\bhende\b|\bhendes\b/i.test(LEAFY_PERSONA),'persona must not use gendered pronouns for Leafy');
console.log('PASS: server-side permission floor (send/publish/purchase/delete cannot be loosened by the client) and gender-neutral persona.');
