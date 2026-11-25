import * as THREE from 'three';
import type {Viseme} from './LeafyNPC';
import type {FaceEmotion} from './SpeechEmotion';
function canvas(w=512,h=512){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function texture(c:HTMLCanvasElement,name:string){const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.name=name;t.anisotropy=4;return t;}
function cutout(image:CanvasImageSource,x:number,y:number,w:number,h:number){const c=canvas(w,h),g=c.getContext('2d')!;g.drawImage(image,x,y,w,h,0,0,w,h);g.globalCompositeOperation='destination-in';g.scale(w/2,h/2);const mask=g.createRadialGradient(1,1,.9,1,1,1);mask.addColorStop(0,'white');mask.addColorStop(1,'transparent');g.fillStyle=mask;g.fillRect(0,0,2,2);return c;}
/** All visible facial parts sampled from the exact original 512px torso, never a generated variant. */
export class FaceSpriteLayers{
 readonly base:THREE.CanvasTexture;readonly eyes:THREE.CanvasTexture;readonly brows:THREE.CanvasTexture;readonly mouth:THREE.CanvasTexture;
 private eyeCanvas=canvas();private browCanvas=canvas();private mouthCanvas=canvas();private baseCanvas=canvas();private scratch=canvas(90,100);
 private eyeParts:HTMLCanvasElement[];private pupils:HTMLCanvasElement[];private browParts:HTMLCanvasElement[];private smile:HTMLCanvasElement;
 private eyeKey='';private browKey='';private mouthKey='';
 constructor(original:HTMLImageElement,clean:HTMLImageElement){
  const b=this.baseCanvas.getContext('2d')!;b.drawImage(original,0,0);
  for(const [x,y,w,h] of [[113,219,106,114],[261,221,106,114],[129,167,75,57],[275,165,86,62],[162,300,158,100]]){const patch=cutout(clean,x,y,w,h);const ctx=patch.getContext('2d')!;const image=ctx.getImageData(0,0,w,h);const old=b.getImageData(x,y,w,h);const sums=[0,0,0],counts=[0,0,0];for(let py=0;py<h;py++)for(let px=0;px<w;px++){const r=Math.hypot((px-w/2)/(w/2),(py-h/2)/(h/2));if(r>.72&&r<.88){const i=(py*w+px)*4;for(let k=0;k<3;k++){sums[k]+=old.data[i+k];counts[k]+=image.data[i+k];}}}for(let i=0;i<image.data.length;i+=4)for(let k=0;k<3;k++)image.data[i+k]*=Math.max(.8,Math.min(1.2,sums[k]/(counts[k]||1)));ctx.resetTransform();ctx.globalCompositeOperation="source-over";ctx.putImageData(image,0,0);b.drawImage(patch,x,y);}
  this.eyeParts=[cutout(original,120,226,92,100),cutout(original,268,228,92,100)];
  this.pupils=[cutout(original,149,247,54,67),cutout(original,277,249,58,65)];
  this.browParts=[cutout(original,136,174,61,43),cutout(original,282,172,72,48)];this.smile=cutout(original,184,325,107,57);const mouthCtx=this.smile.getContext('2d')!,pixels=mouthCtx.getImageData(0,0,107,57);for(let i=0;i<pixels.data.length;i+=4){const [r,g,b]=pixels.data.slice(i,i+3);if(g>r*1.4&&g>b*1.3&&g>55)pixels.data[i+3]=0;}mouthCtx.resetTransform();mouthCtx.globalCompositeOperation="source-over";mouthCtx.putImageData(pixels,0,0);
  this.base=texture(this.baseCanvas,'Original_torso_skin');this.eyes=texture(this.eyeCanvas,'Original_eyes');this.brows=texture(this.browCanvas,'Original_brows');this.mouth=texture(this.mouthCanvas,'Original_mouth');this.setEyes(0,0,1);this.setBrows('idle','idle');this.setMouth('rest');
 }
 setEyes(x:number,y:number,open:number,from:FaceEmotion='idle',to:FaceEmotion=from,blend=1){
  const eyePose=(mood:FaceEmotion):[number,number,number]=>mood==='happy'?[0,-.015,.82]:mood==='curious'?[.025,.1,1.06]:mood==='sleepy'?[0,-.08,.55]:mood==='gentle'?[0,-.025,.92]:mood==='concerned'?[0,.035,1.02]:[0,0,1];
  const a=eyePose(from),b=eyePose(to),t=THREE.MathUtils.clamp(blend,0,1);x=THREE.MathUtils.clamp(x+THREE.MathUtils.lerp(a[0],b[0],t),-1,1);y=THREE.MathUtils.clamp(y+THREE.MathUtils.lerp(a[1],b[1],t),-1,1);open=THREE.MathUtils.clamp(open*THREE.MathUtils.lerp(a[2],b[2],t),.035,1.08);
  x=Math.round(x*20)/20;y=Math.round(y*20)/20;open=Math.max(.035,Math.round(open*20)/20);const key=[x,y,open,from,to,Math.round(t*20)/20].join(',');if(key===this.eyeKey)return;this.eyeKey=key;
  const ctx=this.eyeCanvas.getContext('2d')!;ctx.clearRect(0,0,512,512);
  this.eyeParts.forEach((part,i)=>{
   const g=this.scratch.getContext('2d')!;this.scratch.width=92;this.scratch.height=100;g.drawImage(part,0,0);
   // Retain the original eye rim; slide the original iris over the inner white.
   if(x!==0||y!==0||from!=='idle'||to!=='idle'){g.save();g.beginPath();g.ellipse(46,51,35,40,0,0,Math.PI*2);g.clip();const white=g.createRadialGradient(43,44,7,46,51,44);white.addColorStop(0,'#f9ffe9');white.addColorStop(1,'#c5e1ad');g.fillStyle=white;g.fillRect(5,8,82,87);g.drawImage(this.pupils[i],i===0?29+x*9:9+x*9,21-y*8);g.restore();}
   if(open<.14){ctx.strokeStyle='#123607';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(141+i*148,277);ctx.quadraticCurveTo(167+i*148,289,191+i*148,277);ctx.stroke();return;}
   const h=100*open;ctx.drawImage(this.scratch,120+i*148,277-h/2,92,h);
  });this.eyes.needsUpdate=true;
 }
 setBrows(from:FaceEmotion,to:FaceEmotion,thinking=false,blend=1){const t=THREE.MathUtils.clamp(blend,0,1),key=[from,to,thinking,Math.round(t*20)/20].join(':');if(key===this.browKey)return;this.browKey=key;const c=this.browCanvas.getContext('2d')!;c.clearRect(0,0,512,512);const pose=(mood:FaceEmotion,i:number)=>{if(mood==='happy')return{i:7,r:i===0?-.025:.025};if(mood==='curious')return{i:i===1?9:0,r:i===0?.12:-.1};if(mood==='sleepy')return{i:-3,r:i===0?-.05:.05};if(mood==='gentle')return{i:2,r:i===0?-.02:.02};if(mood==='concerned')return{i:i===0?4:-2,r:i===0?-.09:.09};return{i:0,r:0};};this.browParts.forEach((p,i)=>{const a=pose(from,i),b=pose(to,i),lift=THREE.MathUtils.lerp(a.i,b.i,t)+(thinking?(i===0?5:2):0),rotation=THREE.MathUtils.lerp(a.r,b.r,t)+(thinking&&i===0?.05:0);c.save();c.translate(i?318:166,195-lift);c.rotate(rotation);c.drawImage(p,-p.width/2,-p.height/2);c.restore();});this.brows.needsUpdate=true;}
 setMouth(id:Viseme|'none'){const level={rest:0,MBP:0,FV:1,L:2,EE:2,OO:3,OH:3,AA:4} as const;const key=id==='none'?'none':String(level[id]);if(key===this.mouthKey)return;this.mouthKey=key;const c=this.mouthCanvas.getContext('2d')!;c.clearRect(0,0,512,512);if(id!=='none'){const h=[8,20,33,45,57][level[id]];c.drawImage(this.smile,184,352-h/2,107,h);}this.mouth.needsUpdate=true;}
 dispose(){[this.base,this.eyes,this.brows,this.mouth].forEach(t=>{t.dispose();t.image.width=t.image.height=1;});[...this.eyeParts,...this.pupils,...this.browParts,this.smile,this.scratch].forEach(c=>{c.width=c.height=1;});}
}
