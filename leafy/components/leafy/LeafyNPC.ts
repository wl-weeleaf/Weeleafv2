import * as THREE from 'three';
import {createLeafy,disposeLeafy} from './createLeafy';
import outline from './outline.json';
import type {Expression} from './AnimatedFace';
export const mouthIds=['rest','MBP','AA','EE','OH','OO','FV','L'] as const;
export type Viseme=typeof mouthIds[number];
export type NpcState='idle'|'attentive'|'thinking'|'speaking';
function surface(x:number,y:number){
 const px=x/(3.4/486)+256,py=254-y/(3.4/486),angle=(Math.atan2(290-py,px-256)+Math.PI*2)%(Math.PI*2),i=Math.round(angle/(2*Math.PI)*outline.length)%outline.length;
 const r=Math.min(.99,Math.hypot(px-256,py-290)/Math.hypot(outline[i][0]-256,outline[i][1]-290)),base=Math.sqrt(1-r*r);
 const eye=Math.exp(-((px-175)**2/800+(py-277)**2/1250))+Math.exp(-((px-307)**2/800+(py-277)**2/1250));return .47*base+.07*eye*base;
}
/** Depth of the front skin surface at a face-local point, shared with mouth overlays. */
export const leafySurface=surface;
export class LeafyNPC {
 readonly model:THREE.Group;
 private eyes:THREE.Group[]=[];private pupils:THREE.Group[]=[];private brows:THREE.Mesh[]=[];private closed:THREE.Mesh[]=[];
 private mouth:THREE.Mesh;private canvas:HTMLCanvasElement;private ctx:CanvasRenderingContext2D;private texture:THREE.CanvasTexture;private lastMouth:Viseme|'none'='none';
 private elapsed=0;private blinkAt=2.2;private blinkTime=-1;private gaze=new THREE.Vector2();private head=new THREE.Vector2();
 private constructor(model:THREE.Group,private atlas:HTMLImageElement){
  this.model=model;model.name='Leafy';
  const white=new THREE.MeshStandardMaterial({color:'#f3ffe0',roughness:.28}),iris=new THREE.MeshStandardMaterial({color:'#145719',roughness:.3}),pupil=new THREE.MeshStandardMaterial({color:'#020e03',roughness:.12}),shine=new THREE.MeshBasicMaterial({color:'white'}),green=new THREE.MeshStandardMaterial({color:'#248012',roughness:.8});
  const sphere=new THREE.SphereGeometry(1,32,24);
  const ball=(mat:THREE.Material,x:number,y:number,z:number)=>{const m=new THREE.Mesh(sphere.clone(),mat);m.scale.set(x,y,z);return m;};
  [-1,1].forEach((side,i)=>{
   const eye=new THREE.Group();eye.name=i?'Eye_R':'Eye_L';eye.position.set(side*.48,-.16,surface(side*.48,-.16)+.012);eye.add(ball(white,.245,.3,.105));
   const look=new THREE.Group();look.name=i?'Pupil_R':'Pupil_L';const ir=ball(iris,.178,.229,.064);ir.position.z=.092;look.add(ir);const p=ball(pupil,.137,.181,.035);p.position.z=.144;look.add(p);
   const h=ball(shine,.042,.042,.019);h.position.set(-.054,.098,.176);look.add(h);const h2=ball(shine,.017,.017,.012);h2.position.set(.055,-.083,.173);look.add(h2);eye.add(look);model.add(eye);this.eyes.push(eye);this.pupils.push(look);
   const browCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.155,0,0),new THREE.Vector3(0,.058,0),new THREE.Vector3(.155,0,0)]);const brow=new THREE.Mesh(new THREE.TubeGeometry(browCurve,18,.034,8,false),green);brow.name=i?'Brow_R':'Brow_L';brow.position.set(side*.48,.4,surface(side*.48,.4)+.035);model.add(brow);this.brows.push(brow);
   const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.18,.025,0),new THREE.Vector3(0,-.015,0),new THREE.Vector3(.18,.025,0)]);const lid=new THREE.Mesh(new THREE.TubeGeometry(curve,18,.017,8,false),green);lid.position.copy(eye.position);lid.position.z+=.025;lid.visible=false;model.add(lid);this.closed.push(lid);
  });sphere.dispose();
  this.canvas=document.createElement('canvas');this.canvas.width=this.canvas.height=256;const ctx=this.canvas.getContext('2d');if(!ctx)throw Error('Canvas unavailable');this.ctx=ctx;
  this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.name='Mouth_sequence';
  const geo=new THREE.PlaneGeometry(.76,.76,16,16),pos=geo.getAttribute('position');for(let i=0;i<pos.count;i++)pos.setZ(i,surface(pos.getX(i)-.06,pos.getY(i)-.66)+.009);geo.computeVertexNormals();
  const material=new THREE.MeshBasicMaterial({map:this.texture,transparent:true,depthWrite:false,alphaTest:.03,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1});
  this.mouth=new THREE.Mesh(geo,material);this.mouth.name='Mouth_sprite';
  const anchor=new THREE.Group();anchor.name='Mouth_anchor';anchor.position.set(-.06,-.66,0);anchor.add(this.mouth);model.add(anchor);this.setMouth('rest');
 }
 static async load(assetBase='/leafy'){
  assetBase=assetBase.replace(/\/$/,'');
  const results=await Promise.allSettled([createLeafy(`${assetBase}/npc-base.png`,`${assetBase}/back.png`),new THREE.ImageLoader().loadAsync(`${assetBase}/mouths/atlas.png`)]);
  if(results[0].status==='rejected'||results[1].status==='rejected'){if(results[0].status==='fulfilled')disposeLeafy(results[0].value);throw Error('Leafy kunne ikke indlæses.');}
  return new LeafyNPC(results[0].value,results[1].value);
 }
 setMouth(id:Viseme|'none'){
  if(this.lastMouth===id)return;this.lastMouth=id;this.mouth.visible=id!=='none';if(id==='none')return;
  const i=mouthIds.indexOf(id);this.ctx.clearRect(0,0,256,256);this.ctx.drawImage(this.atlas,(i%4)*256,Math.floor(i/4)*256,256,256,0,0,256,256);this.texture.needsUpdate=true;
 }
 update(dt:number,target:THREE.Vector2,active:boolean,expression:Expression,state:NpcState,animate=true,track=true,motion:'idle'|'hop'|'still'='idle'){
  this.elapsed+=dt;const t=this.elapsed;
  const desired=active&&track?target:new THREE.Vector2(animate&&state==='idle'?Math.sin(t*.47)*.17:0,animate&&state==='idle'?Math.sin(t*.31)*.09:0);
  this.gaze.lerp(desired,1-Math.exp(-dt*12));this.head.lerp(desired,1-Math.exp(-dt*3));
  this.model.rotation.y=this.head.x*.22;this.model.rotation.x=-this.head.y*.10;
  this.model.rotation.z=animate?(state==='thinking'?Math.sin(t*.5)*.045:Math.sin(t*.8)*.015):0;
  this.model.position.y=animate&&motion!=='still'?(motion==='hop'?Math.max(0,Math.sin(t*3))*.17:Math.sin(t*1.35)*.035):0;
  const breath=animate&&motion!=='still'?Math.sin(t*1.3)*.006:0;this.model.scale.set(1-breath*.4,1+breath,1);
  if(animate&&t>this.blinkAt&&this.blinkTime<0){this.blinkTime=0;this.blinkAt=t+2.7+Math.random()*3;}
  let openness=1;if(this.blinkTime>=0){this.blinkTime+=dt;openness=1-Math.sin(Math.min(1,this.blinkTime/.19)*Math.PI);if(this.blinkTime>.19)this.blinkTime=-1;}
  if(!animate){openness=1;this.blinkTime=-1;}
  const sleepy=expression==='sleepy'?.55:1;
  for(let i=0;i<2;i++){
   this.eyes[i].scale.y=Math.max(.035,openness*sleepy);this.closed[i].visible=openness<.16;this.eyes[i].visible=openness>=.16;
   this.pupils[i].position.x=this.gaze.x*.072;this.pupils[i].position.y=this.gaze.y*.077;
   this.brows[i].position.y=.4+(expression==='happy'?.075:expression==='curious'&&i===1?.11:state==='thinking'&&i===0?.065:0);
   this.brows[i].rotation.z=expression==='curious'?(i===0?-.15:.1):expression==='sleepy'?(i===0?-.07:.07):0;
  }
 }
 dispose(){disposeLeafy(this.model);this.canvas.width=this.canvas.height=1;}
}
