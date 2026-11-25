import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const js=ts.transpile(fs.readFileSync('lib/leafy/voice-turn.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});const {VoiceTurn,VoiceActivity}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function test(){const sent=[],drafts=[],errors=[];let active=true,stops=0,ends=0,turn;turn=new VoiceTurn({active:()=>active,draft:t=>drafts.push(t),complete:t=>sent.push(t),stop:()=>{stops++;turn.end()},error:m=>errors.push(m),end:()=>ends++},10);return {turn,sent,drafts,errors,get stops(){return stops},get ends(){return ends},cancel(){active=false}};}
const a=test();a.turn.update('Hej');a.turn.update('Hej Leafy');await sleep(20);a.turn.end();assert.deepEqual(a.sent,['Hej Leafy']);assert.equal(a.stops,1);assert.equal(a.ends,1);
const b=test();b.turn.update('Må ikke sendes');b.turn.error('Mikrofon afbrudt');b.turn.end();assert.deepEqual(b.sent,[]);
const c=test();c.turn.update('Afbrudt af brugeren');c.cancel();await sleep(20);c.turn.end();assert.deepEqual(c.sent,[]);assert.equal(c.stops,0);
const d=test();d.turn.end();assert.deepEqual(d.sent,[]);
const e=test();e.turn.update('Gammel tur');e.turn.cancel();await sleep(20);assert.deepEqual(e.sent,[]);
console.log('PASS: automatic final transcript submission, silence stop, exactly one send, empty/error/cancelled turns never sent.');

const vad=new VoiceActivity(1800,.012);assert.equal(vad.sample(0,10000),false);assert.equal(vad.sample(.04,11000),false);assert.equal(vad.sample(.03,13000),false);assert.equal(vad.sample(0,14799),false);assert.equal(vad.sample(0,14800),true);assert.equal(vad.sample(0,20000),false);
const f=test();const noTimer=new VoiceTurn({active:()=>true,draft:()=>{},complete:t=>f.sent.push(t),stop:()=>{throw new Error('Transcript timing must not interrupt speech')},error:()=>{},end:()=>{}},0);noTimer.update('Tal fortsætter');await sleep(20);assert.deepEqual(f.sent,[]);noTimer.end();assert.deepEqual(f.sent,['Tal fortsætter']);
console.log('PASS: audio silence endpointing ignores quiet before speech, waits after last voiced frame and does not depend on transcript latency.');
