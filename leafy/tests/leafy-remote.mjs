import ts from 'typescript';import fs from 'node:fs';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import vm from 'node:vm';
const sqlite=new DatabaseSync(':memory:');for(const name of fs.readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+name,'utf8'));
globalThis.leafyTestDB = {
 prepare(sql) {
  return {
   bind(...params) {
    const statement = sqlite.prepare(sql);
    return {
     async run() { return statement.run(...params); },
     async first() { return statement.get(...params) || null; },
     async all() { return {results: statement.all(...params)}; }
    };
   }
  };
 }
};
const compile=s=>ts.transpile(s,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const url=s=>'data:text/javascript;base64,'+Buffer.from(compile(s)).toString('base64');
const envUrl=url(fs.readFileSync('lib/leafy/environment.ts','utf8')),actionUrl=url(fs.readFileSync('lib/leafy/actions.ts','utf8'));
const pcUrl=url(fs.readFileSync('lib/leafy/pc-action.ts','utf8'));
const source=fs.readFileSync('lib/leafy/remote.ts','utf8').replace("import {database} from './store';","const database=async()=>globalThis.leafyTestDB;").replace("from './environment'",`from '${envUrl}'`).replace("from './actions'",`from '${actionUrl}'`).replace("from './pc-action'",`from '${pcUrl}'`);
const remote=await import(url(source)),env=await import(envUrl);
const p=await remote.pairing('owner-a'),paired=await remote.exchange(p.code,'Chrome test');
assert(!JSON.stringify(sqlite.prepare('SELECT * FROM leafy_remote_sessions').get()).includes(paired.token),'raw token must not be stored');
await assert.rejects(()=>remote.exchange(p.code,'replay'));
const auth=new Request('https://leafy.test/api',{headers:{Authorization:'Bearer '+paired.token}}),s=await remote.extensionSession(auth);
const observation={type:'chrome',sessionId:s.id,control:'AGENT_CONTROL',page:'https://example.com',title:'Example',text:'Public text',elements:[{id:'el_1',role:'button',label:'Læs mere'}]};
await remote.heartbeat(s,observation);assert.equal((await remote.sessions('owner-a'))[0].environment.title,'Example');assert.deepEqual(await remote.sessions('owner-b'),[]);
await assert.rejects(()=>remote.queueAction('owner-b',s.id,'chrome',{action:'observe'}));
const id=await remote.queueAction('owner-a',s.id,'chrome',{action:'observe'});const cmd=await remote.claim('owner-a',s.id,'chrome');assert.equal(cmd.id,id);assert.equal(await remote.claim('owner-a',s.id,'chrome'),null);
assert.equal(await remote.commandResult('owner-b',id),null);
await remote.finish('owner-a',s.id,id,{ok:true,environment:observation},'chrome');assert.equal((await remote.commandResult('owner-a',id)).status,'done');
const pending=await remote.queueAction('owner-a',s.id,'chrome',{action:'click',elementId:'el_1'});
await remote.control('owner-a',s.id,'PROTECTED_HUMAN_CONTROL','chrome');assert.equal((await remote.commandResult('owner-a',pending)).status,'cancelled');
assert.equal((await remote.sessions('owner-a'))[0].environment,null);await assert.rejects(()=>remote.claim('owner-a',s.id,'chrome'));await assert.rejects(()=>remote.finish('owner-a',s.id,pending,{ok:true},'chrome'));
assert.equal(await remote.heartbeat(s,observation),'PROTECTED_HUMAN_CONTROL','client must not silently restore authority');
await remote.control('owner-a',s.id,'AGENT_CONTROL','chrome');assert.equal(await remote.heartbeat(s,{...observation,control:'PROTECTED_HUMAN_CONTROL',text:'SECRET',elements:[{id:'x',label:'SECRET'}]}),'PROTECTED_HUMAN_CONTROL');
assert.equal(sqlite.prepare('SELECT snapshot FROM leafy_remote_sessions').get().snapshot,'{}');
await remote.control('owner-a',s.id,'DISCONNECTED','chrome');await assert.rejects(()=>remote.extensionSession(auth));
const p2=await remote.pairing('owner-a');sqlite.prepare('UPDATE leafy_remote_sessions SET expiresAt=0 WHERE id=?').run(p2.id);await assert.rejects(()=>remote.exchange(p2.code,'expired'));
const clean=env.cleanEnvironment({...observation,control:'HUMAN_CONTROL',text:'SECRET',page:'https://bank.example.com',elements:[{id:'secret',label:'password'}]});assert.equal(clean.text,'');assert.equal(clean.page,'');assert.deepEqual(clean.elements,[]);
assert.throws(()=>env.validateAction({action:'launchApp'}));assert.throws(()=>env.validateAction({action:'type',elementId:'x',text:'a'.repeat(6001)}));
// Actual extension observation code must stop before reading page text on a protected input.
let reads=0;const password={type:'password',hidden:false,getClientRects:()=>[{}],getAttribute:()=>null};
const body={get innerText(){reads++;return 'SECRET PASSWORD'}};
const context=vm.createContext({location:{hostname:'example.com',pathname:'/'},document:{body,querySelectorAll:()=>[password]},getComputedStyle:()=>({visibility:'visible'}),crypto});
vm.runInContext(fs.readFileSync('integration/chrome-extension/dom.js','utf8'),context);
assert.equal(vm.runInContext('globalThis.__leafyDOM.observe().protected',context),true);assert.equal(reads,0);
console.log('PASS: real SQLite pairing, owner isolation, token hashing, single command claim, protected takeover, cancelled queue, revoked/expired access and extension privacy gate.');

const pcPair=await remote.pairing('owner-pc','pc');await assert.rejects(()=>remote.exchange(pcPair.code,'wrong kind','chrome'));
const pcToken=await remote.exchange(pcPair.code,'PC test','pc'),pcSession=await remote.extensionSession(new Request('https://leafy.test',{headers:{Authorization:'Bearer '+pcToken.token}}));
assert.equal(pcSession.kind,'pc');assert.equal((await remote.sessions('owner-pc','pc')).length,1);assert.equal((await remote.sessions('owner-pc','chrome')).length,0);
sqlite.prepare('UPDATE leafy_remote_sessions SET expiresAt=? WHERE id=?').run(Date.now()+1000,pcSession.id);await remote.heartbeat(pcSession,null);assert(sqlite.prepare('SELECT expiresAt FROM leafy_remote_sessions WHERE id=?').get(pcSession.id).expiresAt>Date.now()+29*86400000,'active PC heartbeats should slide the session expiry forward');
await assert.rejects(()=>remote.queueAction('owner-pc',pcSession.id,'chrome',{action:'observe'}));
await assert.rejects(()=>remote.queueAction('other',pcSession.id,'pc',{action:'list',path:'.'}));
const pcCmd=await remote.queueAction('owner-pc',pcSession.id,'pc',{action:'list',path:'.'});
assert.equal((await remote.claim('owner-pc',pcSession.id,'pc')).id,pcCmd);assert.equal(await remote.claim('owner-pc',pcSession.id,'pc'),null);
await remote.finish('owner-pc',pcSession.id,pcCmd,{entries:[{name:'dokument.txt'}]},'pc');assert.equal((await remote.commandResult('owner-pc',pcCmd)).status,'done');
const pcPending=await remote.queueAction('owner-pc',pcSession.id,'pc',{action:'write',path:'new.md',content:'Hej'});await remote.control('owner-pc',pcSession.id,'PAUSED','pc');assert.equal((await remote.commandResult('owner-pc',pcPending)).status,'cancelled');
console.log('PASS: PC/Chrome pairing isolation, owned PC queue, single claim, completion and pause cancellation.');
// Status and automatic selection remain strictly inside the pairing owner's scope.
assert.equal((await remote.pcConnectionStatus('unknown-owner')).connected,false);
assert.deepEqual((await remote.pcConnectionStatus('unknown-owner')).devices,[]);
await assert.rejects(()=>remote.resolvePCSession('other',pcSession.id),/tilhører ikke/);
await assert.rejects(()=>remote.resolvePCSession('owner-pc',pcSession.id),/pause/);
await remote.control('owner-pc',pcSession.id,'AGENT_CONTROL','pc');
assert.equal((await remote.resolvePCSession('owner-pc')).id,pcSession.id);
assert.equal((await remote.pcConnectionStatus('owner-pc')).connected,true);
const offlineCmd=await remote.queueAction('owner-pc',pcSession.id,'pc',{action:'list'});
await remote.deviceOffline(pcSession);
assert.equal((await remote.pcConnectionStatus('owner-pc')).connected,false);
assert.equal((await remote.commandResult('owner-pc',offlineCmd)).status,'cancelled');
// Exiting locally preserves the bearer; restart heartbeat restores availability.
assert.equal((await remote.extensionSession(new Request('https://leafy.test',{headers:{Authorization:'Bearer '+pcToken.token}}))).id,pcSession.id);
await remote.heartbeat(pcSession,null);
assert.equal((await remote.resolvePCSession('owner-pc')).id,pcSession.id);
// A remote pause survives restart; explicit disconnect invalidates the bearer.
await remote.control('owner-pc',pcSession.id,'PAUSED','pc');
await remote.deviceOffline(pcSession);await remote.heartbeat(pcSession,null);
assert.equal((await remote.pcConnectionStatus('owner-pc')).control,'PAUSED');
await remote.control('owner-pc',pcSession.id,'AGENT_CONTROL','pc');
const secondPair=await remote.pairing('owner-pc','pc');await remote.exchange(secondPair.code,'Other PC','pc');
await assert.rejects(()=>remote.resolvePCSession('owner-pc'),/Flere PC/);
assert.equal((await remote.resolvePCSession('owner-pc',pcSession.id)).id,pcSession.id);
await remote.control('owner-pc',pcSession.id,'DISCONNECTED','pc');
await assert.rejects(()=>remote.extensionSession(new Request('https://leafy.test',{headers:{Authorization:'Bearer '+pcToken.token}})));
console.log('PASS: scoped PC selection, paused/ambiguous devices, persistent pairing across restart, offline cancellation, and explicit revocation.');
