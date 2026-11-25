'use client';
import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import * as THREE from 'three';
import {createRoom} from './RoomScene';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {type NpcState,type Viseme} from './LeafyNPC';
import {SoundAttention,type SoundStatus} from './SoundAttention';
import {CameraGaze,type CameraStatus} from './CameraGaze';
import {conversationPose,type ConversationPose} from './ConversationPose';
import {speechChunks} from '@/features/leafy-live/services/speech.mjs';
import {IdleLife,IdleWhistle} from './IdleLife';
import {LayeredLeafyNPC} from './LayeredLeafyNPC';
import {LeafySpeech,type SpeechPacket} from './LeafySpeech';
import type {Expression} from './AnimatedFace';
import {emotionForSpeech,type SpeechEmotion} from './SpeechEmotion';
import {DEFAULT_MOUTH_RIG,type MouthRigParameters} from './LeafyMouthRig';
export type LeafyHandle={isSpeechPending:()=>boolean;soundTracking:(enabled:boolean)=>Promise<void>;cameraTracking:(enabled:boolean)=>Promise<void>;idleAudio:(enabled:boolean)=>Promise<void>;captureAudioTrack:()=>MediaStreamTrack|null;view:(side:'front'|'side'|'back')=>void;exportGLB:()=>Promise<void>;speak:(text:string)=>void;enqueueSpeech:(text:string)=>void;backchannel:(text:string)=>void;stop:()=>void;playSpeech:(packet:SpeechPacket)=>Promise<void>};
export type LeafyCanvasProps={onSpeechText?:(text:string,kind:'answer'|'backchannel')=>void;onSpeechProgress?:(text:string,kind:'answer'|'backchannel')=>void;onSpeechBackchannel?:(active:boolean)=>void;onSpeechDiagnostics?:(value:{lipsyncMode:string;emotion:SpeechEmotion})=>void;onSpeechError?:(message:string,kind?:'answer'|'backchannel')=>void;onError?:(message:string)=>void;onFrame?:(canvas:HTMLCanvasElement)=>void;gazeTarget?:{x:number;y:number}|null;live?:boolean;roomPlacement?:{x:number;scale:number}|null;room?:boolean;roomBackground?:boolean;handsVisible?:boolean;shoesVisible?:boolean;compact?:boolean;lowPower?:boolean;expression?:Expression;facePlaying?:boolean;motion?:'idle'|'hop'|'still';rotate?:boolean;wireframe?:boolean;followPointer?:boolean;eyesVisible?:boolean;mouthVisible?:boolean;thinking?:boolean;engaged?:boolean;listening?:boolean;questioning?:boolean;onPose?:(p:ConversationPose)=>void;onCamera?:(s:CameraStatus,message?:string)=>void;onSound?:(s:SoundStatus,message?:string)=>void;mouthPreview?:Viseme|'none'|null;mouthRig?:MouthRigParameters;whistlePreview?:boolean;onReady?:()=>void;onSpeaking?:(value:boolean)=>void};
const LeafyCanvas=forwardRef<LeafyHandle,LeafyCanvasProps>(function LeafyCanvas({onFrame,gazeTarget=null,live=false,roomPlacement=null,room=false,roomBackground=true,handsVisible=false,shoesVisible=false,compact=false,lowPower=false,expression='idle',facePlaying=true,motion='idle',rotate=false,wireframe=false,followPointer=true,eyesVisible=true,mouthVisible=true,thinking=false,engaged=false,listening=false,questioning=false,mouthPreview=null,mouthRig=DEFAULT_MOUTH_RIG,whistlePreview=false,onReady,onSpeaking,onPose,onCamera,onSound,onSpeechError,onSpeechText,onSpeechProgress,onSpeechBackchannel,onSpeechDiagnostics,onError},ref){
 const host=useRef<HTMLDivElement>(null),runtime=useRef<{camera:THREE.PerspectiveCamera;controls:OrbitControls;npc:LayeredLeafyNPC;speech:LeafySpeech;whistle:IdleWhistle;quietUntil:number;idleSound:boolean;cameraGaze:CameraGaze;sound:SoundAttention}|null>(null);
 type SpeechJob={text:string;kind:'answer'|'backchannel';bufferedFallback?:boolean;retry?:number};
 const remoteSpeech=useRef<{queue:SpeechJob[];busy:boolean;generation:number;abort:AbortController|null;pumpTimer:ReturnType<typeof setTimeout>|null}>({queue:[],busy:false,generation:0,abort:null,pumpTimer:null});
 const idleVoice=useRef(false);
 const activeSpeechKind=useRef<'answer'|'backchannel'>('answer');
 const options=useRef({roomPlacement,roomBackground,handsVisible,shoesVisible,compact,lowPower,expression,facePlaying,motion,rotate,wireframe,followPointer,eyesVisible,mouthVisible,thinking,engaged,listening,questioning,mouthPreview,mouthRig,whistlePreview});options.current={roomPlacement,roomBackground,handsVisible,shoesVisible,compact,lowPower,expression,facePlaying,motion,rotate,wireframe,followPointer,eyesVisible,mouthVisible,thinking,engaged,listening,questioning,mouthPreview,mouthRig,whistlePreview};
 const callbacks=useRef({onReady,onSpeaking,onPose,onCamera,onSound,onFrame,gazeTarget,live,onSpeechError,onSpeechText,onSpeechProgress,onSpeechBackchannel,onSpeechDiagnostics});callbacks.current={onReady,onSpeaking,onPose,onCamera,onSound,onFrame,gazeTarget,live,onSpeechError,onSpeechText,onSpeechProgress,onSpeechBackchannel,onSpeechDiagnostics};const [error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 function retry(){setError('');setAttempt(n=>n+1);}
 function scheduleElevenLabs(delay=90){const q=remoteSpeech.current;if(q.pumpTimer)clearTimeout(q.pumpTimer);q.pumpTimer=setTimeout(()=>{q.pumpTimer=null;pumpElevenLabs();},delay);}
 function pumpElevenLabs(){const q=remoteSpeech.current,runtimeNow=runtime.current;if(q.busy||!q.queue.length||!runtimeNow)return;const first=q.queue.shift()!,batch=[first];let length=first.text.length;while(q.queue.length&&length+q.queue[0].text.length+1<=1500&&q.queue[0].kind===first.kind){const next=q.queue.shift()!;batch.push(next);length+=next.text.length+1;}const job:SpeechJob={...first,text:batch.map(x=>x.text).join(' ')};q.busy=true;const generation=q.generation,controller=new AbortController();q.abort=controller;
  void (async()=>{let socket:WebSocket|undefined,streaming=false,receivedAudio=false,streamPlaybackFailed=false;const setBackchannel=(active:boolean)=>{if(job.kind==='backchannel')callbacks.current.onSpeechBackchannel?.(active);};activeSpeechKind.current=job.kind;try{
   const text=job.text,emotion=emotionForSpeech(text);let spoken=false,providerFinal=false;const chunks:Uint8Array[]=[],visemes:SpeechPacket['visemes']=[],textCues:NonNullable<SpeechPacket['textCues']>=[];
   const release=()=>{if(q.generation!==generation)return;setBackchannel(false);q.busy=false;q.abort=null;if(q.queue.length)scheduleElevenLabs(100);};
   streaming=job.bufferedFallback?false:await runtimeNow.speech.beginStream(emotion,()=>{spoken=true;setBackchannel(true);},completed=>{if(!completed){streamPlaybackFailed=true;controller.abort();return;}if(spoken)callbacks.current.onSpeechText?.(text,job.kind);release();},text);callbacks.current.onSpeechDiagnostics?.({lipsyncMode:streaming?'Lydanalyse under ElevenLabs-afspilning':'Lydanalyse · ElevenLabs-timing som fallback',emotion});
   if(q.generation!==generation)return;
   await new Promise<void>((resolve,reject)=>{
    const scheme=location.protocol==='https:'?'wss:':'ws:';socket=new WebSocket(`${scheme}//${location.host}/api/leafy/elevenlabs/speech`);let settled=false;
    const fail=(error:Error)=>{if(settled)return;settled=true;try{socket?.close();}catch{}reject(error);};
    controller.signal.addEventListener('abort',()=>fail(new DOMException('Cancelled','AbortError')),{once:true});
    socket.onopen=()=>{if(controller.signal.aborted)return;socket?.send(JSON.stringify({text}));};
    socket.onmessage=event=>{try{const data=JSON.parse(String(event.data)) as {audio?:string;visemes?:SpeechPacket['visemes'];textCues?:SpeechPacket['textCues'];emotion?:string;is_final?:boolean;error?:string};if(data.error){fail(Error(data.error));return;}
     if(['neutral','curious','excited','reassuring','concerned'].includes(data.emotion??''))runtimeNow.speech.emotion=data.emotion as SpeechEmotion;
     if(data.audio){receivedAudio=true;const raw=atob(data.audio),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);const cues=Array.isArray(data.visemes)?data.visemes:[],spokenCues=Array.isArray(data.textCues)?data.textCues:[];if(streaming)void runtimeNow.speech.appendStream(bytes,cues,spokenCues).catch(error=>fail(error as Error));else{chunks.push(bytes);visemes.push(...cues);textCues.push(...spokenCues);}}
     if(data.is_final){providerFinal=true;if(streaming){if(!receivedAudio){fail(Error('ElevenLabs v4 Turbo returnerede ingen lyd.'));return;}void runtimeNow.speech.finishStream().then(()=>{if(!settled){settled=true;resolve();}}).catch(error=>fail(error as Error));}else if(!chunks.length)fail(Error('ElevenLabs v4 Turbo returnerede ingen lyd.'));else{settled=true;resolve();}}
    }catch{fail(Error('Leafy modtog et ugyldigt talesvar.'));}};
    socket.onerror=()=>{if(!providerFinal)fail(Error('Leafy kunne ikke oprette forbindelse til ElevenLabs v4 Turbo. Kontrollér API-adgang og prøv igen.'));};
    // The server sends the final marker and then closes its half of the socket.
    // SourceBuffer can still be draining the last audio packet at that point;
    // wait for finishStream instead of treating the expected close as a cutoff.
    socket.onclose=()=>{if(!settled&&!providerFinal)fail(Error('Forbindelsen til ElevenLabs blev afbrudt, før Leafy var færdig med at tale.'));};
   });
   if(q.generation!==generation)return;
   if(!streaming){callbacks.current.onSpeechDiagnostics?.({lipsyncMode:'Lydanalyse · ElevenLabs-timing som fallback',emotion});const blob=new Blob(chunks as BlobPart[],{type:'audio/mpeg'}),audioUrl=URL.createObjectURL(blob);try{await runtimeNow.speech.play({audioUrl,visemes,textCues,text,emotion},completed=>{URL.revokeObjectURL(audioUrl);if(completed&&spoken)callbacks.current.onSpeechText?.(text,job.kind);setBackchannel(false);release();},()=>{spoken=true;setBackchannel(true);});}catch(error){URL.revokeObjectURL(audioUrl);throw error;}}
  }catch(e){if(q.generation===generation){runtimeNow.speech.cancel();setBackchannel(false);q.busy=false;q.abort=null;const message=(e as Error).message||'Talestrømmen blev afbrudt.',retryable=/forbindelse|afbrudt|timeout|for lang tid|network/i.test(message)&&!/afviste|API-nøgle|voice|model|tekst/i.test(message);if(streamPlaybackFailed&&streaming&&!job.bufferedFallback){q.queue.unshift({...job,bufferedFallback:true});scheduleElevenLabs(0);}else if(retryable&&job.retry!==1&&(e as Error).name!=='AbortError'){q.queue.unshift({...job,retry:1,bufferedFallback:streaming||job.bufferedFallback});scheduleElevenLabs(350);}else{callbacks.current.onSpeechError?.((e as Error).name==='AbortError'?'Leafys lydstream blev afbrudt. Prøv igen.':message,job.kind);if(q.queue.length)scheduleElevenLabs(100);}}}finally{socket?.close();}})();
 }
 function cancelRemoteSpeech(){const q=remoteSpeech.current;q.generation++;q.queue=[];q.busy=false;if(q.pumpTimer)clearTimeout(q.pumpTimer);q.pumpTimer=null;q.abort?.abort();q.abort=null;callbacks.current.onSpeechBackchannel?.(false);}
 useEffect(()=>{if(error)onError?.(error);},[error,onError]);
 useImperativeHandle(ref,()=>({
  isSpeechPending(){return runtime.current?.speech.pending??false;},
  async soundTracking(enabled){const r=runtime.current;if(!r)return;if(enabled)await r.sound.start();else r.sound.stop();},
  async cameraTracking(enabled){const r=runtime.current;if(!r)return;if(enabled)await r.cameraGaze.start();else r.cameraGaze.stop();},
  async idleAudio(enabled){const r=runtime.current;if(!r)return;r.idleSound=enabled;if(enabled)await r.whistle.enable();else {r.whistle.stop();if(idleVoice.current){cancelRemoteSpeech();r.speech.cancel();idleVoice.current=false;}}},
  captureAudioTrack(){return runtime.current?.speech.captureAudioTrack()??null;},
  view(side){const r=runtime.current;if(!r)return;const a=side==='front'?0:side==='side'?Math.PI/2:Math.PI;r.camera.position.set(Math.sin(a)*6.5,0,Math.cos(a)*6.5);r.controls.target.set(0,0,0);r.controls.update();},
  speak(text){setError('');const r=runtime.current;if(!r){callbacks.current.onSpeechError?.('Leafys ElevenLabs-stemme er ikke klar endnu.');return;}r.whistle.stop();r.quietUntil=performance.now()+20000;cancelRemoteSpeech();r.speech.cancel();remoteSpeech.current.queue=speechChunks(text,1600).map(text=>({text,kind:'answer'}));scheduleElevenLabs(0);},enqueueSpeech(text){const r=runtime.current;if(!r){callbacks.current.onSpeechError?.('Leafys ElevenLabs-stemme er ikke klar endnu.');return;}r.whistle.stop();r.quietUntil=performance.now()+20000;remoteSpeech.current.queue.push(...speechChunks(text,1600).map(text=>({text,kind:'answer' as const})));if(!remoteSpeech.current.busy)scheduleElevenLabs();},backchannel(text){const r=runtime.current;if(!r||!text.trim())return;r.whistle.stop();r.quietUntil=performance.now()+20000;remoteSpeech.current.queue.push(...speechChunks(text,360).map(text=>({text,kind:'backchannel' as const})));if(!remoteSpeech.current.busy)scheduleElevenLabs();},stop(){cancelRemoteSpeech();const r=runtime.current;if(r){r.whistle.stop();r.quietUntil=performance.now()+20000;r.speech.cancel();}},
  async playSpeech(packet){if(!runtime.current)throw Error('Leafy er ikke klar.');runtime.current.whistle.stop();runtime.current.quietUntil=performance.now()+20000;await runtime.current.speech.play(packet);},
  async exportGLB(){
   const r=runtime.current;if(!r)throw Error('Leafy er ikke klar.');const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');const model=r.npc.model.clone(true);model.position.set(0,0,0);model.quaternion.identity();model.scale.setScalar(1);const snapshotTextures:THREE.CanvasTexture[]=[];
   model.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry=o.geometry.clone();o.material=o.material.clone();o.material.wireframe=false;if(o.material.map?.isCanvasTexture){const canvas=document.createElement('canvas');canvas.width=o.material.map.image.width;canvas.height=o.material.map.image.height;canvas.getContext('2d')!.drawImage(o.material.map.image,0,0);const snapshot=new THREE.CanvasTexture(canvas);snapshot.colorSpace=THREE.SRGBColorSpace;snapshotTextures.push(snapshot);o.material.map=snapshot;}}});
   try{const data=await new GLTFExporter().parseAsync(model,{binary:true,animations:model.animations});if(!(data instanceof ArrayBuffer))throw Error('GLB-eksport mislykkedes.');const url=URL.createObjectURL(new Blob([data],{type:'model/gltf-binary'}));const a=document.createElement('a');a.href=url;a.download='leafy-npc.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}finally{snapshotTextures.forEach(t=>t.dispose());model.traverse(o=>{if(o instanceof THREE.Mesh){o.material.dispose();o.geometry.dispose();}});}
  }
 }),[]);
 useEffect(()=>{
   const el=host.current;if(!el)return;let disposed=false,renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:!lowPower,alpha:true,powerPreference:'default'});}catch{try{renderer=new THREE.WebGLRenderer({antialias:false,alpha:true,powerPreference:'low-power'});}catch{setError('Browseren kunne ikke starte WebGL. Prøv 3D igen eller åbn i en browser med hardwareacceleration.');return;}}
  renderer.shadowMap.enabled=room;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;el.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label',room?'Leafy i sit rum følger markøren.':'Leafy følger markøren. Træk for at dreje modellen.');renderer.domElement.setAttribute('role','img');
  const scene=new THREE.Scene(),displayRoot=new THREE.Group(),camera=new THREE.PerspectiveCamera(38,1,.1,50);camera.position.set(0,0,6.5);scene.add(displayRoot);scene.add(new THREE.HemisphereLight(0xffffff,0x547332,2));const key=new THREE.DirectionalLight(0xfff5e5,2);key.position.set(-3,5,6);scene.add(key);const rim=new THREE.DirectionalLight(0xd8ffac,3);rim.position.set(3,2,-4);scene.add(rim);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=4.1;controls.maxDistance=10;controls.autoRotateSpeed=.8;
  const roomScene=room?createRoom(scene,camera):null;
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();roomScene?.resize();};const observer=new ResizeObserver(resize);observer.observe(el);resize();
  const sound=new SoundAttention((status,message)=>{if(!disposed)callbacks.current.onSound?.(status,message);});
  const cameraGaze=new CameraGaze((status,message)=>{if(!disposed)callbacks.current.onCamera?.(status,message);});
  let lastPose:ConversationPose|undefined;
  const life=new IdleLife(),whistle=new IdleWhistle();let lastRemark=-Infinity,whistleUntil=0;
  let npc:LayeredLeafyNPC|undefined,last=0,lastDraw=0,quality=2,pointerAt=-Infinity,dragging=false,wire=false;
  const pointer=new THREE.Vector2(),ndc=new THREE.Vector2(),ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),-.55),hit=new THREE.Vector3(),local=new THREE.Vector3();
  const move=(e:PointerEvent)=>{const rect=el.getBoundingClientRect();ndc.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);pointerAt=performance.now();whistleUntil=0;whistle.stop();if(idleVoice.current){cancelRemoteSpeech();speech.cancel();idleVoice.current=false;}};
  const leave=()=>{pointerAt=-Infinity;};const blur=()=>{pointerAt=-Infinity;};const start=()=>{dragging=true;whistle.stop();if(idleVoice.current){cancelRemoteSpeech();speech.cancel();idleVoice.current=false;}};const end=()=>{dragging=false;};
  window.addEventListener('pointermove',move);document.documentElement.addEventListener('pointerleave',leave);window.addEventListener('blur',blur);controls.addEventListener('start',start);controls.addEventListener('end',end);
  const speech=new LeafySpeech(value=>{if(!value)idleVoice.current=false;if(!disposed)callbacks.current.onSpeaking?.(value);},message=>{if(!disposed)callbacks.current.onSpeechError?.(message,activeSpeechKind.current);},text=>{if(!disposed)callbacks.current.onSpeechProgress?.(text,activeSpeechKind.current);});
  const quiet=()=>{if((document.hidden&&!callbacks.current.live)){cameraGaze.stop();sound.stop();}whistle.stop();if(idleVoice.current){cancelRemoteSpeech();speech.cancel();idleVoice.current=false;}if(runtime.current)runtime.current.quietUntil=performance.now()+15000;};
  document.addEventListener('visibilitychange',quiet);window.addEventListener('keydown',quiet);
  LayeredLeafyNPC.load().then(n=>{if(disposed){n.dispose();return;}npc=n;if(room){n.model.traverse(o=>{if(o instanceof THREE.Mesh&&!o.name.endsWith('_sprite'))o.castShadow=true;});}displayRoot.add(n.model);runtime.current={camera,controls,npc:n,speech,whistle,quietUntil:0,idleSound:false,cameraGaze,sound};setError('');callbacks.current.onReady?.();}).catch(()=>{if(!disposed)setError('Leafy kunne ikke indlæses. Prøv at genindlæse.');});
  let roomVisible=true;
  renderer.setAnimationLoop(time=>{
   const current=options.current;
   if(roomVisible!==current.roomBackground){roomVisible=current.roomBackground;roomScene?.setVisible(roomVisible);}
   if(document.hidden&&!callbacks.current.live||!el.clientWidth||!el.clientHeight){last=time;return;}
   if(current.lowPower&&time-lastDraw<50)return;
   lastDraw=time;
   const nextQuality=callbacks.current.live||current.lowPower?1:Math.min(window.devicePixelRatio,2);
   if(quality!==nextQuality){quality=nextQuality;renderer.setPixelRatio(quality);resize();}
   controls.enabled=!room&&!callbacks.current.live;
   const dt=last?Math.min((time-last)/1000,.05):0;last=time;const o=options.current;speech.getSpokenText();
   if(npc){
    npc.setAccessories(o.handsVisible,o.shoesVisible);
    const attentionPulse=o.listening?1+.025*Math.sin(time*.008):1;
    const accessoryScale=room?.62*(o.roomPlacement?Math.min(o.roomPlacement.scale,camera.aspect*.8):1):o.shoesVisible?.76:o.handsVisible?.84:1;
    displayRoot.scale.setScalar(THREE.MathUtils.damp(displayRoot.scale.x,accessoryScale*attentionPulse,8,dt));
    const roomX=room&&o.roomPlacement?(o.roomPlacement.x*2-1)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*6.5*camera.aspect:0;
    displayRoot.position.x=THREE.MathUtils.damp(displayRoot.position.x,roomX,6,dt);
    displayRoot.position.y=THREE.MathUtils.damp(displayRoot.position.y,room?.48:o.shoesVisible?.28:0,8,dt);
    const pose=conversationPose(o.listening,speech.state==='speaking',o.thinking,o.questioning,o.engaged);
    if(pose!==lastPose){lastPose=pose;callbacks.current.onPose?.(pose);}
    const conversing=pose!=='idle';
    if(conversing&&!dragging){const radius=camera.position.length(),yaw=Math.atan2(camera.position.x,camera.position.z)*Math.exp(-dt*4),height=THREE.MathUtils.damp(camera.position.y,0,4,dt);camera.position.set(Math.sin(yaw)*Math.sqrt(radius*radius-height*height),height,Math.cos(yaw)*Math.sqrt(radius*radius-height*height));}
    const active=o.followPointer&&!conversing&&performance.now()-pointerAt<5000&&!dragging&&!o.rotate&&camera.position.z>1.5;
    if(active){ray.setFromCamera(ndc,camera);if(ray.ray.intersectPlane(plane,hit)){npc.model.updateMatrixWorld(true);local.copy(hit);npc.model.worldToLocal(local);pointer.set(THREE.MathUtils.clamp(local.x/1.6,-1,1),THREE.MathUtils.clamp((local.y+.16)/1.8,-1,1));}}
    const cameraTarget=cameraGaze.point;
    const soundTarget=speech.state!=='speaking'&&!o.listening&&!conversing&&!dragging&&!o.rotate?sound.sample():null;
    const sensory=!conversing&&!active&&!dragging&&!o.rotate?(cameraTarget??soundTarget):null;
    const blocked=!!callbacks.current.gazeTarget||conversing||active||!!sensory||dragging||o.rotate||o.thinking||speech.state==='speaking'||!o.facePlaying||o.motion==='still'||(document.hidden&&!callbacks.current.live)||performance.now()<(runtime.current?.quietUntil??0);
    const idle=life.update((document.hidden&&!callbacks.current.live)?0:dt,blocked);
    if(conversing||o.thinking||(document.hidden&&!callbacks.current.live)||!o.facePlaying||o.motion==='still'||dragging||o.rotate||speech.state==='speaking'){whistleUntil=0;whistle.stop();if(idleVoice.current){speech.cancel();idleVoice.current=false;}}
    if(idle.event){
     if(idle.event==='whistle'){whistleUntil=time+850;if(runtime.current?.idleSound)whistle.play();}
     if(idle.event==='wonder'&&runtime.current?.idleSound&&performance.now()-lastRemark>60000){lastRemark=performance.now();const remark=['Hmm… hvad mon det er?','Der er noget at undersøge.','Jeg fik lige en idé.'][Math.floor(Math.random()*3)];remoteSpeech.current.queue.push(...speechChunks(remark,360).map(text=>({text,kind:'backchannel' as const})));scheduleElevenLabs(0);idleVoice.current=true;}
    }
    if(!active&&!blocked)pointer.set(idle.x,idle.y);
    if(sensory)pointer.set(sensory.x,sensory.y);
    if(conversing){
     const face=cameraGaze.point;pointer.set(face?.x??0,face?.y??0);
     if(pose==='thinking'&&!face){pointer.x=Math.sin(time*.00045)*.2;pointer.y=.18;}
    }
    if(callbacks.current.gazeTarget)pointer.set(callbacks.current.gazeTarget.x,callbacks.current.gazeTarget.y);
    const state:NpcState=pose==='speaking'?'speaking':pose==='thinking'?'thinking':conversing||active||sensory?'attentive':'idle';
    const expression=pose==='questioning'?'curious':o.expression;
    const mouthState=speech.getMouthState();npc.setMouth(o.mouthPreview??mouthState.viseme,mouthState.energy);npc.setMouthRig(o.mouthRig);npc.setWhistling((o.whistlePreview||time<whistleUntil)&&!conversing&&!o.thinking&&speech.state!=='speaking');npc.update((document.hidden&&!callbacks.current.live)?0:dt,pointer,!!callbacks.current.gazeTarget||conversing||active||!!sensory||(!blocked&&Math.abs(idle.x)>0),expression,state,o.facePlaying,!!callbacks.current.gazeTarget||conversing||!!sensory||o.followPointer,o.motion,speech.state==='speaking'?speech.emotion:'neutral',speech.state==='speaking'&&mouthState.viseme!=='rest');npc.setLayers(o.eyesVisible,o.mouthVisible);if(!blocked)npc.model.rotation.y+=idle.turn;
    if(wire!==o.wireframe){npc.model.traverse(n=>{if(n instanceof THREE.Mesh)n.material.wireframe=o.wireframe&&!n.name.endsWith('_sprite')&&!n.name.startsWith('Hand_');});wire=o.wireframe;}
   }
   controls.autoRotate=!room&&o.rotate&&!o.engaged&&!o.thinking&&!o.listening&&speech.state!=='speaking'&&!(document.hidden&&!callbacks.current.live);controls.update();npc?.orientAccessories(camera.position);if(room&&npc&&o.rotate)displayRoot.rotation.y+=dt*.6;else if(room)displayRoot.rotation.y=THREE.MathUtils.damp(displayRoot.rotation.y,0,4,dt);if(callbacks.current.live)displayRoot.rotation.y=THREE.MathUtils.damp(displayRoot.rotation.y,(callbacks.current.gazeTarget?.x??0)*.32,3,dt);renderer.render(scene,camera);callbacks.current.onFrame?.(renderer.domElement);
  });
  const lost=(e:Event)=>{e.preventDefault();speech.cancel();setError('Grafikforbindelsen blev afbrudt. Prøv 3D igen.');};renderer.domElement.addEventListener('webglcontextlost',lost);const restored=()=>{if(!disposed)retry();};renderer.domElement.addEventListener('webglcontextrestored',restored);
  return()=>{disposed=true;runtime.current=null;cameraGaze.stop();sound.stop();document.removeEventListener('visibilitychange',quiet);window.removeEventListener('keydown',quiet);whistle.dispose();speech.dispose();window.removeEventListener('pointermove',move);document.documentElement.removeEventListener('pointerleave',leave);window.removeEventListener('blur',blur);controls.removeEventListener('start',start);controls.removeEventListener('end',end);observer.disconnect();renderer.setAnimationLoop(null);controls.dispose();roomScene?.dispose();npc?.dispose();renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.domElement.removeEventListener('webglcontextrestored',restored);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
 },[attempt]);
 return <div className="leafy-canvas" ref={host}>{error&&<p role="alert" className="canvas-error">{error}<button type="button" onClick={retry}>Prøv 3D igen</button></p>}</div>;
});export default LeafyCanvas;
