import * as THREE from 'three';
import sequence from './sequence.json';
export type Expression='idle'|'happy'|'curious'|'sleepy';
export const expressions: {id:Expression;label:string}[]=[{id:'idle',label:'Rolig'},{id:'happy',label:'Glad'},{id:'curious',label:'Nysgerrig'},{id:'sleepy',label:'Søvnig'}];
/** Uses the exact frames and millisecond timing exported to the four GIF files. */
export class AnimatedFace {
 readonly texture:THREE.CanvasTexture;
 private canvas:HTMLCanvasElement;
 private ctx:CanvasRenderingContext2D;
 private expression:Expression='idle';
 private elapsed=0;
 private lastFrame=-1;
 private constructor(private atlas:HTMLImageElement){
  this.canvas=document.createElement('canvas');this.canvas.width=this.canvas.height=512;
  const ctx=this.canvas.getContext('2d');if(!ctx)throw new Error('Canvas er ikke tilgængelig.');this.ctx=ctx;
  this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.anisotropy=4;
  this.texture.name='Leafy_animated_face';this.draw(0);
 }
 static async load(url='/leafy/expressions/atlas.png'){
  const image=await new THREE.ImageLoader().loadAsync(url);return new AnimatedFace(image);
 }
 setExpression(expression:Expression){if(expression===this.expression)return;this.expression=expression;this.elapsed=0;this.lastFrame=-1;this.draw(0);}
 update(dt:number,playing=true){
  if(!playing)return;
  const duration=sequence.duration.reduce((a,b)=>a+b,0);this.elapsed=(this.elapsed+dt*1000)%duration;
  let time=0,index=0;for(let i=0;i<sequence.duration.length;i++){time+=sequence.duration[i];if(this.elapsed<time){index=i;break;}}
  this.draw(sequence.order[index]);
 }
 private draw(frame:number){
  if(frame===this.lastFrame)return;this.lastFrame=frame;
  const row=sequence.names.indexOf(this.expression);this.ctx.clearRect(0,0,512,512);
  this.ctx.drawImage(this.atlas,frame*512,row*512,512,512,0,0,512,512);this.texture.needsUpdate=true;
 }
 dispose(){this.texture.dispose();this.canvas.width=this.canvas.height=1;}
}
