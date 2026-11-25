export class PersonSegmentation{
 readonly output=document.createElement('canvas');readonly video=document.createElement('video');
 private crop=document.createElement('canvas');private bounds:{x:number;y:number;right:number;bottom:number}|null=null;private foreground=document.createElement('canvas');private mask=document.createElement('canvas');private sample=document.createElement('canvas');private worker:Worker|null=null;private ready=false;private busy=false;private hasMask=false;private last=0;private rate=15;private width=320;private frame=0;private stopped=false;
 constructor(stream:MediaStream,private onStatus:(status:string)=>void){this.output.width=640;this.output.height=480;this.foreground.width=640;this.foreground.height=480;this.video.srcObject=stream;this.video.muted=true;this.video.playsInline=true;void this.video.play().catch(()=>this.onStatus('Kamerapreview kunne ikke starte.'));}
 init(){if(this.worker||this.stopped)return;try{this.worker=new Worker('/leafy-live/segmentation.worker.mjs');this.onStatus('Indlæser lokal baggrundsfjernelse…');this.worker.onmessage=e=>{
  if(this.stopped)return;const d=e.data;
  if(d.type==='ready'){this.ready=true;this.onStatus('Baggrundsfjernelse klar · lokalt på enheden');}
  if(d.type==='mask'){this.mask.width=d.width;this.mask.height=d.height;this.mask.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(d.alpha),d.width,d.height),0,0);this.hasMask=true;this.busy=false;if(d.bounds){if(!this.bounds)this.bounds=d.bounds;else for(const key of ['x','y','right','bottom'] as const)this.bounds[key]=this.bounds[key]*.8+d.bounds[key]*.2;}else this.bounds=null;if(d.ms>90){this.rate=8;this.width=192;this.onStatus('Baggrundsfjernelse · sparekvalitet');}else if(d.ms>50){this.rate=10;this.width=256;}}
  if(d.type==='error'){this.ready=false;this.busy=false;this.onStatus('Baggrundsfjernelse fejlede. Vælg original baggrund for at fortsætte.');}
 };this.worker.onerror=()=>{this.ready=false;this.busy=false;this.onStatus('Baggrundsfjernelse er ikke understøttet her. Vælg original baggrund.');};this.worker.postMessage({type:'init'});
 }catch{this.onStatus('Baggrundsfjernelse kræver en browser med Web Worker.');}}
 draw(time:number,mode:'transparent'|'blur'|'original'|'none'){
  const v=this.video;if(!v.videoWidth||mode==='none')return null;const ratio=v.videoHeight/v.videoWidth,w=640,h=Math.round(w*ratio);if(this.output.height!==h){this.output.height=h;this.foreground.height=h;}
  if(mode!=='original'){this.init();if(this.ready&&!this.busy&&time-this.last>1000/this.rate){this.busy=true;this.last=time;this.sample.width=this.width;this.sample.height=Math.round(this.width*ratio);this.sample.getContext('2d')!.drawImage(v,0,0,this.sample.width,this.sample.height);void createImageBitmap(this.sample).then(bitmap=>{if(this.stopped){bitmap.close();return;}this.worker?.postMessage({type:'frame',bitmap,timestamp:time},[bitmap]);}).catch(()=>{this.busy=false;});}}
  const ctx=this.output.getContext('2d')!;ctx.clearRect(0,0,w,h);
  if(mode==='original'){ctx.drawImage(v,0,0,w,h);return this.output;}
  // Never leak the raw background while a transparent mask loads or fails.
  if(!this.hasMask)return null;
  const fg=this.foreground.getContext('2d')!;fg.clearRect(0,0,w,h);fg.globalCompositeOperation='source-over';fg.drawImage(v,0,0,w,h);fg.globalCompositeOperation='destination-in';fg.drawImage(this.mask,0,0,w,h);fg.globalCompositeOperation='source-over';
  if(mode==='blur'){ctx.filter='blur(18px)';ctx.drawImage(v,-24,-24,w+48,h+48);ctx.filter='none';}
  ctx.drawImage(this.foreground,0,0,w,h);if(mode==='transparent'&&this.bounds){const b=this.bounds,cw=Math.max(1,Math.round((b.right-b.x)*w)),ch=Math.max(1,Math.round((b.bottom-b.y)*h));this.crop.width=cw;this.crop.height=ch;this.crop.getContext('2d')!.drawImage(this.output,b.x*w,b.y*h,cw,ch,0,0,cw,ch);return this.crop;}return this.output;
 }
 dispose(){this.stopped=true;this.worker?.terminate();this.worker=null;this.video.pause();this.video.srcObject=null;}
}
