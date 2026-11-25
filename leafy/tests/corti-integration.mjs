import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';

async function moduleAt(path){const voice=ts.transpile(fs.readFileSync('lib/leafy/voice-turn.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});const voiceURL='data:text/javascript;base64,'+Buffer.from(voice).toString('base64');const transcription=ts.transpile(fs.readFileSync('features/leafy-live/services/transcription.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});const transcriptionURL='data:text/javascript;base64,'+Buffer.from(transcription).toString('base64');const js=ts.transpile(fs.readFileSync(path,'utf8').replace('@/'+ 'lib/leafy/voice-turn',voiceURL).replace('@/features/leafy-live/services/transcription',transcriptionURL),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));}

const masterJs=ts.transpile(fs.readFileSync('lib/livi/master-skills.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});const masterUrl='data:text/javascript;base64,'+Buffer.from(masterJs).toString('base64');const coreSource=fs.readFileSync('lib/livi/core.ts','utf8').replace("from './master-skills'",`from '${masterUrl}'`);const coreJs=ts.transpile(coreSource,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});const coreUrl='data:text/javascript;base64,'+Buffer.from(coreJs).toString('base64');const configSource=fs.readFileSync('lib/livi/config.ts','utf8').replace("from './core'",`from '${coreUrl}'`);const configJs=ts.transpile(configSource,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});const {aiConfig,cortiSpeechConfigured}=await import('data:text/javascript;base64,'+Buffer.from(configJs).toString('base64'));
const saved={...process.env};
for(const key of ['LIVI_API_KEY','LIVI_API_BASE_URL','LIVI_MODEL','OPENAI_API_KEY','CORTI_MODELS_API_KEY','CORTI_REGION','CORTI_MODEL','CORTI_STT_CLIENT_ID','CORTI_STT_CLIENT_SECRET','CORTI_TENANT_NAME'])delete process.env[key];
process.env.CORTI_MODELS_API_KEY='test-only';
assert.deepEqual([aiConfig().provider,aiConfig().base,aiConfig().model,aiConfig().configured],['corti','https://ai.eu.corti.app/v1','corti-s1-mini-instant',true]);
process.env.LIVI_API_KEY='explicit';process.env.LIVI_API_BASE_URL='https://other.example/v1';process.env.LIVI_MODEL='other';
assert.deepEqual([aiConfig().provider,aiConfig().base,aiConfig().model],['custom','https://other.example/v1','other']);
assert.equal(cortiSpeechConfigured(),false);
process.env.CORTI_STT_CLIENT_ID='client';process.env.CORTI_STT_CLIENT_SECRET='secret';process.env.CORTI_TENANT_NAME='tenant';
assert.equal(cortiSpeechConfigured(),true);
for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);

const {startCortiDictation}=await moduleAt('components/leafy/Dictation.ts');
const sent=[];let socket,recorder,stoppedTracks=0;
class FakeSocket{
 static OPEN=1;
 readyState=1;
 constructor(url){assert(url.startsWith('wss://api.eu.corti.app/'));socket=this;queueMicrotask(()=>this.onopen());}
 send(payload){sent.push(payload);if(typeof payload==='string'){
  const data=JSON.parse(payload);
  if(data.type==='config'){assert.equal(data.configuration.primaryLanguage,'da');queueMicrotask(()=>this.onmessage({data:JSON.stringify({type:'CONFIG_ACCEPTED'})}));}
  if(data.type==='end')queueMicrotask(()=>{this.onmessage({data:JSON.stringify({type:'transcript',data:{text:'hvad så',isFinal:true}})});this.onmessage({data:JSON.stringify({type:'ended'})});});
 }}
 close(){this.readyState=3;}
 emit(data){this.onmessage({data:JSON.stringify(data)});}
}
class FakeRecorder{
 static isTypeSupported(type){return type==='audio/webm;codecs=opus';}
 state='inactive';
 constructor(){recorder=this;}
 start(){this.state='recording';}
 stop(){this.state='inactive';this.ondataavailable?.({data:new Blob([Uint8Array.of(1,2,3)])});this.onstop?.();}
}
globalThis.WebSocket=FakeSocket;globalThis.MediaRecorder=FakeRecorder;
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stoppedTracks++;}}]})}},configurable:true});
globalThis.window={MediaRecorder:FakeRecorder};
globalThis.fetch=async()=>({ok:true,json:async()=>({url:'wss://api.eu.corti.app/audio-bridge/v2/transcribe?test=1'})});
const texts=[],errors=[];let ended=0;
const stop=await startCortiDictation(t=>texts.push(t),()=>ended++,e=>errors.push(e));
assert.equal(recorder.state,'recording');
socket.emit({type:'transcript',data:{text:'hej',isFinal:false}});
socket.emit({type:'transcript',data:{text:'hej Leafy',isFinal:true}});
stop();
await new Promise(resolve=>setTimeout(resolve,10));
assert.deepEqual(texts,['hej','hej Leafy','hej Leafy hvad så']);
assert.equal(sent.some(x=>x instanceof ArrayBuffer),true);
assert.equal(JSON.parse(sent.at(-1)).type,'end');
assert.equal(ended,1);assert.equal(stoppedTracks,1);assert.deepEqual(errors,[]);
console.log('PASS: Corti model preset, provider precedence and Danish STT handshake/audio/final transcript cleanup.');
