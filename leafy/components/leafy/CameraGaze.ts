export type CameraStatus='off'|'starting'|'searching'|'tracking'|'error';
export class CameraGaze{
 point:{x:number;y:number}|null=null;
 private worker:Worker|null=null;private stream:MediaStream|null=null;private video:HTMLVideoElement|null=null;private timer:ReturnType<typeof setInterval>|null=null;private timeout:ReturnType<typeof setTimeout>|null=null;private generation=0;private busy=false;private lastSeen=0;private status:CameraStatus='off';
 constructor(private onStatus:(s:CameraStatus,message?:string)=>void){}
 private set(s:CameraStatus,message?:string){if(s!==this.status||message){this.status=s;this.onStatus(s,message);}}
 async start(){
  this.stop();const generation=this.generation;this.set('starting');
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Kamera kræver en understøttet browser og HTTPS.');
   const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
   if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;const video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;this.video=video;await video.play();
   if(generation!==this.generation)return;
   const worker=new Worker('/camera/face-worker.js');this.worker=worker;
   const fail=()=>{if(generation!==this.generation)return;this.stop();this.set('error','Ansigtsfølgning kunne ikke startes. Leafy ser lige frem. Tjek kameraadgang og internetforbindelse.');};
   this.timeout=setTimeout(fail,25000);worker.onerror=fail;
   worker.onmessage=({data})=>{
    if(generation!==this.generation)return;
    if(data.type==='error'){fail();return;}
    if(data.type==='ready'){if(this.timeout)clearTimeout(this.timeout);this.set('searching');this.timer=setInterval(()=>void this.frame(generation),150);}
    if(data.type==='face'){this.busy=false;if(data.point){this.point=data.point;this.lastSeen=performance.now();this.set('tracking');}else if(performance.now()-this.lastSeen>650){this.point=null;this.set('searching');}}
   };
   stream.getVideoTracks()[0].onended=()=>{if(generation===this.generation)this.stop();};worker.postMessage({type:'init'});
  }catch(e){if(generation!==this.generation)return;this.stop();this.set('error',(e as Error).name==='NotAllowedError'?'Kameraadgang blev ikke givet. Leafy ser lige frem.':'Kameraet kunne ikke åbnes. Leafy ser lige frem.');}
 }
 private async frame(generation:number){if(this.busy||!this.video||this.video.readyState<2||document.hidden)return;this.busy=true;try{const bitmap=await createImageBitmap(this.video);if(generation!==this.generation){bitmap.close();return;}this.worker?.postMessage({type:'frame',bitmap},[bitmap]);}catch{this.busy=false;}}
 stop(){this.generation++;if(this.timer)clearInterval(this.timer);if(this.timeout)clearTimeout(this.timeout);this.timer=this.timeout=null;this.worker?.terminate();this.worker=null;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;if(this.video){this.video.pause();this.video.srcObject=null;}this.video=null;this.point=null;this.busy=false;this.set('off');}
}
