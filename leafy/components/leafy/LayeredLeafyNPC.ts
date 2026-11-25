import * as THREE from 'three';
import {disposeLeafy} from './createLeafy';
import {referenceGeometry} from './ReferenceGeometry';
import {createLeafDeformationFrame,deformPoint} from './LeafDeformation';
import {FloatingAccessories} from './FloatingAccessories';
import {FaceSpriteLayers} from './FaceSpriteLayers';
import {LeafyMouthRig,type MouthRigParameters} from './LeafyMouthRig';
import type {NpcState,Viseme} from './LeafyNPC';
import type {Expression} from './AnimatedFace';
import {faceEmotion,type FaceEmotion,type SpeechEmotion} from './SpeechEmotion';
import {LeafyGestures} from './LeafyGestures';
/** Torso-only 3D surface. UVs sample the supplied full character without editing it. */
export class LayeredLeafyNPC {
 readonly model:THREE.Group;
 private accessories:FloatingAccessories;
 private gaze=new THREE.Vector2();private head=new THREE.Vector2();private elapsed=0;private blinkAt=2.2;private blinkTime=-1;private faceFrom:FaceEmotion='idle';private faceTo:FaceEmotion='idle';private faceBlend=1;
 private surfaces:{mesh:THREE.Mesh;base:Float32Array;front:boolean}[]=[];private tipTurn=0;private movement=0;
 private eyes!:THREE.Mesh;private brows!:THREE.Mesh;private mouth!:THREE.Mesh;
 private mouthRig:LeafyMouthRig;private gestures=new LeafyGestures();
 private constructor(private face:FaceSpriteLayers,back:THREE.Texture,handAtlas:HTMLImageElement){
  const front=face.base;
  this.model=new THREE.Group();this.model.name='Leafy_torso';
  for(const isFront of [true,false]){
   const geo=referenceGeometry(isFront);
   const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:isFront?front:back}));mesh.name=isFront?'Leafy_torso_front':'Leafy_torso_back';this.model.add(mesh);
   if(isFront){
    for(const [name,map,offset] of [['Eyes_sprite',face.eyes,.003],['Brows_sprite',face.brows,.004],['Mouth_sprite',face.mouth,.005]] as const){
     const layerGeometry=geo.clone();const p=layerGeometry.getAttribute('position');for(let i=0;i<p.count;i++)p.setZ(i,p.getZ(i)+offset);
     const layer=new THREE.Mesh(layerGeometry,new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,alphaTest:.015,toneMapped:false}));layer.name=name;layer.renderOrder=1;this.model.add(layer);
     if(name==='Eyes_sprite')this.eyes=layer;else if(name==='Brows_sprite')this.brows=layer;else this.mouth=layer;
    }
   }
  }
  this.mouthRig=new LeafyMouthRig();this.model.add(this.mouthRig.group);this.mouth.visible=false;
  this.model.traverse(o=>{if(o instanceof THREE.Mesh){o.frustumCulled=false;o.geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);if(!o.name.startsWith('Mouth_'))this.surfaces.push({mesh:o,base:new Float32Array(o.geometry.getAttribute('position').array),front:o.name==='Leafy_torso_front'});}});
  this.accessories=new FloatingAccessories(handAtlas);this.model.add(this.accessories.hands,this.accessories.shoes);
 }

 static async load(assetBase='/leafy'){
  const base=assetBase.replace(/\/$/,'');const loader=new THREE.ImageLoader();
  const [original,clean,backImage,handAtlas]=await Promise.all(['original-torso.png','npc-base.png','back.png','hands-atlas.png'].map(p=>loader.loadAsync(`${base}/${p}`)));
  const back=new THREE.Texture(backImage);back.colorSpace=THREE.SRGBColorSpace;back.needsUpdate=true;
  return new LayeredLeafyNPC(new FaceSpriteLayers(original,clean),back,handAtlas);
 }
 setLayers(eyes:boolean,mouth:boolean){this.eyes.visible=eyes;this.brows.visible=eyes;this.mouth.visible=false;this.mouthRig.group.visible=mouth;}
 orientAccessories(camera:THREE.Vector3){this.accessories.orient(camera);}
 setAccessories(hands:boolean,shoes:boolean){this.accessories.setVisible(hands,shoes);}
 setMouth(id:Viseme|'none',energy=0){this.mouthRig.setViseme(id,energy);}
 setWhistling(active:boolean){this.mouthRig.setWhistling(active);}
 setMouthRig(parameters:Partial<MouthRigParameters>){this.mouthRig.setParameters(parameters);}
 update(dt:number,target:THREE.Vector2,active:boolean,expression:Expression,state:NpcState,animate=true,track=true,motion:'idle'|'hop'|'still'='idle',speechEmotion:SpeechEmotion='neutral',speechActive=false){
  this.elapsed+=dt;const t=this.elapsed;this.accessories.update(t,state,animate&&motion!=='still',dt);const gesture=this.gestures.update(dt,state,speechEmotion,animate&&motion!=='still',speechActive);
  const desired=active&&track?target:new THREE.Vector2(animate&&state==='idle'?Math.sin(t*.47)*.17:0,animate&&state==='idle'?Math.sin(t*.31)*.09:0);
  this.gaze.lerp(desired,1-Math.exp(-dt*12));this.head.lerp(desired,1-Math.exp(-dt*3));
  this.model.rotation.set(-this.head.y*.10+gesture.pitch,this.head.x*.22+gesture.yaw,(animate?(state==='thinking'?Math.sin(t*.5)*.045:Math.sin(t*.8)*.015):0)+gesture.roll);
  this.model.position.y=(animate&&motion!=='still'?(motion==='hop'?Math.max(0,Math.sin(t*3))*.17:Math.sin(t*1.35)*.035):0)+gesture.bounce;
  this.model.scale.set(1+gesture.squash*.35,1-gesture.squash,1);this.tipTurn=THREE.MathUtils.damp(this.tipTurn,this.head.x,1.8,dt);
  this.movement=THREE.MathUtils.damp(this.movement,animate&&motion!=='still'?(state==='idle'?1:.7):0,5,dt);
  this.mouthRig.update(dt,t,this.tipTurn,this.movement,speechEmotion,speechActive);const jaw=this.mouthRig.getJawMotion();const deformation=createLeafDeformationFrame(t,this.movement,speechEmotion,speechActive);for(const {mesh,base,front} of this.surfaces){const p=mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i++){const x=base[i*3],y=base[i*3+1],v=deformPoint(x,y,base[i*3+2],this.tipTurn,deformation);const belowMouth=Math.max(0,Math.min(1,(-y-.76)/.22)),chinFalloff=Math.exp(-(((y+1.02)/.19)**2)),centerFalloff=Math.exp(-(((x+.105)/.39)**2)),chinWeight=belowMouth*chinFalloff*centerFalloff;v[1]-=.05*jaw*chinWeight;if(front)v[2]+=.01*jaw*chinWeight;p.setXYZ(i,v[0],v[1],v[2]);}p.needsUpdate=true;}
  if(animate&&motion==='idle'&&state==='idle'){const phase=t%19;this.model.position.y+=phase<1.3?Math.sin(phase/1.3*Math.PI)*.075:0;}
  if(animate&&state==='idle'&&motion!=='still'){const stretch=t%47;if(stretch>36&&stretch<39){const a=Math.sin((stretch-36)/3*Math.PI)*.018;this.model.scale.x-=a*.35;this.model.scale.y+=a;}}
  if(animate&&state==='attentive')this.model.rotation.x+=Math.sin(t*1.5)*.012;
  if(animate&&t>this.blinkAt&&this.blinkTime<0){this.blinkTime=0;this.blinkAt=t+(Math.random()<.16?.34:2.7+Math.random()*3);}
  let openness=1;if(this.blinkTime>=0){this.blinkTime+=dt;openness=1-Math.sin(Math.min(1,this.blinkTime/.19)*Math.PI);if(this.blinkTime>.19)this.blinkTime=-1;}
  if(!animate){openness=1;this.blinkTime=-1;}
  const nextFace=speechEmotion==='neutral'?expression:faceEmotion(speechEmotion);if(nextFace!==this.faceTo){this.faceFrom=this.faceTo;this.faceTo=nextFace;this.faceBlend=0;}this.faceBlend+=(1-this.faceBlend)*(1-Math.exp(-Math.max(dt,0)*9));
  this.face.setEyes(this.gaze.x,this.gaze.y,openness,this.faceFrom,this.faceTo,this.faceBlend);this.face.setBrows(this.faceFrom,this.faceTo,state==='thinking',this.faceBlend);
 }
 dispose(){disposeLeafy(this.model);this.face.dispose();}
}
