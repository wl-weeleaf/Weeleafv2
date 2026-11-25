import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {speechChunks} from '../features/leafy-live/services/speech.mjs';
const load=async path=>import('data:text/javascript;base64,'+Buffer.from(ts.transpile(fs.readFileSync(path,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64'));
const {transcribe}=await load('features/leafy-live/services/transcription.ts'),{hostOutput,receiveOutput}=await load('features/leafy-live/services/output.ts'),{LeafySpeech}=await load('components/leafy/LeafySpeech.ts');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
const tick=()=>new Promise(r=>setImmediate(r));
test('Interrupted ElevenLabs audio is not committed as fully spoken',async()=>{
 const instances=[];globalThis.Audio=class{constructor(url){this.src=url;this.paused=true;this.ended=false;this.readyState=3;this.currentTime=0;this.duration=1;instances.push(this);}async play(){this.paused=false;this.onplaying?.();}pause(){this.paused=true;}removeAttribute(){}load(){}};
 const completed=[],errors=[],player=new LeafySpeech(()=>{},e=>errors.push(e)),packet={audioUrl:'blob:test',visemes:[],text:'Et helt svar',emotion:'neutral'};
 await player.play(packet,value=>completed.push(value));instances[0].onerror();assert.deepEqual(completed,[false]);assert.match(errors[0],/kunne ikke afspilles/);
 await player.play(packet,value=>completed.push(value));instances[1].ended=true;instances[1].paused=true;instances[1].onended();assert.deepEqual(completed,[false,true]);player.dispose();
 const long=('Det er en lang dansk forklaring om hamp og Hive. 🌱\n').repeat(160),chunks=speechChunks(long);assert.equal(chunks.join(''),long);assert.ok(chunks.every(c=>c.length<=1600&&!/[\uD800-\uDBFF]$/.test(c)));
});
test('ElevenLabs timing chooses the mouth pose while audio energy adds emphasis and the transcript follows playback',async()=>{
 const previous={Audio:globalThis.Audio,window:globalThis.window};let audio;const bins={wave:0,frequency:25};
 globalThis.window={AudioContext:class{sampleRate=48000;destination={};createAnalyser(){return{fftSize:1024,frequencyBinCount:512,smoothingTimeConstant:0,connect(){},disconnect(){},getByteTimeDomainData(out){out.fill(128);out[0]=bins.wave?255:128;},getByteFrequencyData(out){out.fill(0);if(bins.wave)out[bins.frequency]=255;}};}createMediaElementSource(){return{connect(){},disconnect(){}};}async resume(){}async close(){}}};
 globalThis.Audio=class{constructor(){audio=this;this.paused=true;this.ended=false;this.readyState=3;this.currentTime=0;this.duration=2;}async play(){this.paused=false;this.onplaying?.();}pause(){this.paused=true;}removeAttribute(){}load(){}};
 try{const progress=[],player=new LeafySpeech(()=>{},()=>{},value=>progress.push(value));await player.play({audioUrl:'blob:audio',visemes:[{time:0,duration:.5,id:'EE'}],text:'Leafy taler.',textCues:[{index:5,time:.3},{index:12,time:1}]});bins.wave=1;audio.onplaying();const articulated=player.getMouthState();assert.equal(articulated.viseme,'EE','timed alignment wins over a coarse spectrum guess');assert.ok(articulated.energy>0,'audio level adds a small emphasis to the pose');audio.currentTime=.6;assert.equal(player.getViseme(),'rest','aligned pauses return to the relaxed pose');audio.currentTime=.29;assert.equal(player.getSpokenText(),'');audio.currentTime=.31;assert.equal(player.getSpokenText(),'Leafy');audio.currentTime=1.1;assert.equal(player.getSpokenText(),'Leafy taler.');assert.deepEqual(progress,['Leafy','Leafy taler.']);player.dispose();}
 finally{globalThis.Audio=previous.Audio;if(previous.window===undefined)delete globalThis.window;else globalThis.window=previous.window;}
});
test('Streamed ElevenLabs waits for a short audio buffer and follows provider timing on the playback clock when audio analysis is unavailable',async()=>{
 const previous={Audio:globalThis.Audio,MediaSource:globalThis.MediaSource,create:URL.createObjectURL,revoke:URL.revokeObjectURL};let audio,bufferedEnd=0;
 class FakeMediaSource{readyState='open';static isTypeSupported(){return true;}addEventListener(name,fn){if(name==='sourceopen')queueMicrotask(fn);}addSourceBuffer(){const handlers=new Map();return{addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name),appendBuffer:()=>{bufferedEnd+=.4;queueMicrotask(()=>handlers.get('updateend')?.());}};}endOfStream(){this.readyState='ended';}}
 globalThis.MediaSource=FakeMediaSource;globalThis.Audio=class{constructor(){audio=this;this.paused=true;this.ended=false;this.readyState=2;this.currentTime=0;this.duration=Infinity;this.buffered={length:1,start:()=>0,end:()=>bufferedEnd};}async play(){this.paused=false;this.onplaying?.();}pause(){this.paused=true;}removeAttribute(){}load(){}};URL.createObjectURL=()=> 'blob:stream';URL.revokeObjectURL=()=>{};
 try{const player=new LeafySpeech(()=>{},()=>{});assert.equal(await player.beginStream('neutral',undefined,undefined,'Leafy svarer naturligt.'),true);await player.appendStream(new Uint8Array([1,2,3]),[{time:0,duration:.4,id:'AA'}]);assert.equal(audio.paused,true,'do not start on the first tiny chunk');await player.appendStream(new Uint8Array([4,5,6]),[]);assert.equal(audio.paused,false,'start after a short buffer is ready');assert.equal(audio.readyState,2);assert.equal(player.getViseme(),'AA','fallback timing is measured against the real audio clock, not response text');player.dispose();}
 finally{globalThis.Audio=previous.Audio;globalThis.MediaSource=previous.MediaSource;if(previous.create)URL.createObjectURL=previous.create;else delete URL.createObjectURL;if(previous.revoke)URL.revokeObjectURL=previous.revoke;else delete URL.revokeObjectURL;}
});
test('Stop while Corti authentication is pending cannot start any recognizer',async()=>{
 const auth=deferred(),controller=new AbortController();let sockets=0,recognizers=0,statuses=0;
 globalThis.fetch=()=>auth.promise;globalThis.WebSocket=class{constructor(){sockets++;}};globalThis.window={SpeechRecognition:class{constructor(){recognizers++;}}};
 const operation=transcribe({},()=>assert.fail('late transcript'),()=>statuses++,()=>assert.fail('error after stop'),controller.signal);controller.abort();auth.resolve(Response.json({url:'wss://test.invalid'}));const stop=await operation;stop();assert.equal(sockets,0);assert.equal(recognizers,0);assert.equal(statuses,0);
});
test('ElevenLabs Scribe uses the server-minted one-use token in its realtime WebSocket handshake',async()=>{
 const urls=[],sent=[],statuses=[],errors=[];let socket,audioNode,contextClosed=false;
 globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/leafy/elevenlabs/scribe-token');assert.equal(options.method,'POST');return Response.json({configured:true,token:'single-use-test-token'});};
 globalThis.WebSocket=class{static OPEN=1;constructor(url){socket=this;this.url=url;this.readyState=1;this.bufferedAmount=0;urls.push(new URL(url));}send(value){sent.push(value);}close(){this.readyState=3;this.closed=true;}};
 class FakeAudioWorkletNode{constructor(){audioNode=this;this.port={onmessage:null};}connect(){}disconnect(){}}
 globalThis.AudioWorkletNode=FakeAudioWorkletNode;
 globalThis.window={AudioContext:class{sampleRate=48000;destination={};audioWorklet={addModule:async path=>assert.equal(path,'/leafy/scribe-audio-worklet.js')};createMediaStreamSource(){return{connect(){},disconnect(){}};}createGain(){return{gain:{value:1},connect(){},disconnect(){}};}async resume(){}async close(){contextClosed=true;}}};
 const stream={},text=[];const stop=await transcribe(stream,(value,final)=>text.push({value,final}),value=>statuses.push(value),value=>errors.push(value),undefined,{engine:'auto'});
 const query=urls[0].searchParams;assert.equal(query.get('token'),'single-use-test-token');assert.equal(query.get('model_id'),'scribe_v2_realtime');assert.equal(query.get('language_code'),null,'language_code stays unset for automatic detection');
 socket.onopen();socket.onmessage({data:JSON.stringify({message_type:'session_started',session_id:'test'})});await tick();
 audioNode.port.onmessage({data:new Float32Array(480).fill(.1)});assert.equal(sent.length,1);const packet=JSON.parse(sent[0]);assert.equal(packet.message_type,'input_audio_chunk');assert.ok(packet.audio_base_64);
 socket.onmessage({data:JSON.stringify({message_type:'partial_transcript',text:'Hello Leafy'})});socket.onmessage({data:JSON.stringify({message_type:'committed_transcript',text:'Hello Leafy.'})});socket.onmessage({data:JSON.stringify({message_type:'committed_transcript_with_timestamps',text:'Hello Leafy.',language_code:'en'})});
 assert.deepEqual(text,[{value:'Hello Leafy',final:false},{value:'Hello Leafy.',final:true}]);assert.deepEqual(statuses,['ElevenLabs Scribe · automatisk sproggenkendelse']);assert.deepEqual(errors,[]);
 stop();assert.equal(socket.closed,true);assert.equal(contextClosed,true);
});
test('Continuous Corti captures the selected stream, ignores duplicate config, and shuts down on denial',async()=>{
 let socket,recorder;const stream={},texts=[],errors=[];
 globalThis.fetch=async()=>Response.json({url:'wss://test.invalid'});
 globalThis.WebSocket=class{static OPEN=1;constructor(){socket=this;this.readyState=1;this.bufferedAmount=0;this.sent=[];}send(m){this.sent.push(m);}close(){this.closed=true;}};
 globalThis.MediaRecorder=class{static isTypeSupported(){return true;}constructor(selected){assert.equal(selected,stream);recorder=this;this.state='inactive';this.starts=0;}start(){this.starts++;this.state='recording';}stop(){this.state='inactive';this.stopped=true;}};
 const stop=await transcribe(stream,(text,final)=>texts.push({text,final}),()=>{},e=>errors.push(e));socket.onopen();assert.equal(JSON.parse(socket.sent[0]).configuration.primaryLanguage,'da');
 socket.onmessage({data:JSON.stringify({type:'CONFIG_ACCEPTED'})});socket.onmessage({data:JSON.stringify({type:'CONFIG_ACCEPTED'})});assert.equal(recorder.starts,1);
 socket.onmessage({data:JSON.stringify({type:'TRANSCRIPT',data:{segments:[{text:'Jeg spørger om hamp',is_final:false}]}})});assert.deepEqual(texts[0],{text:'Jeg spørger om hamp',final:false},'Corti interim text must reach the live bubble immediately');
 for(const text of ['Dagens emne er hamp.','Hej Leafy, forklar forskellen.'])socket.onmessage({data:JSON.stringify({type:'transcript',data:{text,isFinal:true}})});
 assert.equal(texts.length,3);assert.equal(recorder.state,'recording','A final transcript must not stop whole-lecture listening');
 socket.onmessage({data:JSON.stringify({type:'CONFIG_DENIED'})});assert.equal(errors.length,1);assert.equal(recorder.stopped,true);assert.equal(socket.closed,true);assert.equal(socket.onmessage,null);stop();
});
test('Corti Streams uses its own session config, diarizes and preserves speaker IDs',async()=>{
 let socket,recorder;const chunks=[],statuses=[],stream={};
 globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/livi/corti-stream');assert.equal(options.method,'POST');return Response.json({url:'wss://api.eu.corti.app/v2/interactions/id/streams?tenant-name=base&token=limited'});};
 globalThis.WebSocket=class{static OPEN=1;constructor(url){assert.match(url,/interactions\/id\/streams/);socket=this;this.readyState=1;this.bufferedAmount=0;this.sent=[];}send(value){this.sent.push(value);}close(){this.closed=true;}};
 globalThis.MediaRecorder=class{static isTypeSupported(){return true;}constructor(selected){assert.equal(selected,stream);recorder=this;this.state='inactive';}start(ms){assert.equal(ms,350);this.state='recording';}stop(){this.state='inactive';this.stopped=true;}};
 const stop=await transcribe(stream,(text,final,speakerId)=>chunks.push({text,final,speakerId}),s=>statuses.push(s),message=>assert.fail(message),undefined,{engine:'streams',diarize:true});
 socket.onopen();const config=JSON.parse(socket.sent[0]).configuration;assert.equal(config.transcription.primaryLanguage,'da');assert.equal(config.transcription.diarize,true);assert.deepEqual(config.mode,{type:'transcription',outputLocale:'da'});assert.equal(config.retentionPolicy,'none');assert.equal(config.audioFormat,'audio/webm;codecs=opus');
 socket.onmessage({data:JSON.stringify({type:'CONFIG_ACCEPTED'})});assert.equal(recorder.state,'recording');
 socket.onmessage({data:JSON.stringify({type:'transcript',data:[{transcript:'Hej Leafy',final:true,speakerId:1,time:{start:2}},{transcript:'Godmorgen',final:true,speakerId:0,time:{start:1}}]})});
 assert.deepEqual(chunks,[{text:'Godmorgen',final:true,speakerId:0},{text:'Hej Leafy',final:true,speakerId:1}]);assert.match(statuses[0],/Streams/);stop();assert.equal(socket.closed,true);assert.equal(recorder.stopped,true);
});
function rtcHarness(){const peers=[];globalThis.RTCPeerConnection=class{constructor(){peers.push(this);}addTransceiver(){}addTrack(){}async createOffer(){return {type:'offer',sdp:'offer'};}async createAnswer(){return {type:'answer',sdp:'answer'};}async setLocalDescription(d){this.localDescription=d;}async setRemoteDescription(d){this.remoteDescription=d;}async addIceCandidate(){}close(){this.closed=true;}};return peers;}
test('Closing a scene during join releases the viewer slot and never opens a peer',async()=>{
 const join=deferred(),controller=new AbortController(),calls=[],peers=rtcHarness();globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);return body.op==='join'?join.promise:Response.json({ok:true});};
 const operation=receiveOutput('room','view-key',()=>assert.fail('late stream'),()=>assert.fail('late status'),controller.signal);controller.abort();join.resolve(Response.json({id:'viewer',key:'viewer-key'}));const stop=await operation;await tick();stop();assert.equal(peers.length,0);assert.equal(calls.filter(c=>c.op==='leave').length,1);
});
test('Stopping output while host poll is pending cannot create late peers; all output tracks end',async()=>{
 const poll=deferred(),peers=rtcHarness();let stoppedTracks=0,statuses=0;globalThis.fetch=()=>poll.promise;
 const output=hostOutput({id:'room'}, {getTracks:()=>[{stop(){stoppedTracks++;}},{stop(){stoppedTracks++;}}]},()=>statuses++);output.stop();poll.resolve(Response.json({active:true,signals:[{id:1,viewer:'v',payload:{type:'offer',sdp:'offer'}}]}));await tick();assert.equal(peers.length,0);assert.equal(statuses,0);assert.equal(stoppedTracks,2);output.stop();assert.equal(stoppedTracks,2);
});
test('Failed receiver signaling closes peer and releases its slot instead of polling forever',async()=>{
 const peers=rtcHarness(),calls=[];globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);return body.op==='join'?Response.json({id:'viewer',key:'key'}):body.op==='signal'?Response.json({error:'Signal afvist'},{status:403}):Response.json({ok:true});};
 await assert.rejects(()=>receiveOutput('room','key',()=>{},()=>{}),/Signal afvist/);await tick();assert.equal(peers[0].closed,true);assert.equal(calls.filter(c=>c.op==='leave').length,1);assert.equal(calls.filter(c=>c.op==='poll').length,0);
});
