import * as THREE from 'three';
import {LeafyNPC,type Viseme} from './LeafyNPC';
import {GifLeafyNPC} from './GifLeafyNPC';
import {OrbitGesture} from './OrbitGesture';
export type OrbActorOptions={assetBase?:string;gifWireframe?:boolean;scale?:number;nodeTop?:number;clearance?:number;turns?:number;reducedMotion?:boolean};
export type OrbFrame={pointer:THREE.Vector2;pointerActive:boolean;azimuth:number;dragging:boolean;viseme?:Viseme;};
/** Mount in the platform's EXISTING scene. Owns no renderer, camera or event listeners. */
export class LeafyOrbActor {
 readonly root=new THREE.Group();readonly gesture:OrbitGesture;
 private spinTime=-1;private cooldown=0;private yaw=0;private baseY=0;private size:number;private localMin:number;private reduced:boolean;
 private constructor(readonly npc:LeafyNPC|GifLeafyNPC,options:OrbActorOptions){
  this.root.name='Leafy_Orb_Anchor';this.size=options.scale??.43;this.reduced=options.reducedMotion??false;
  this.localMin=new THREE.Box3().setFromObject(npc.model).min.y;this.gesture=new OrbitGesture(options.turns??2);const holder=new THREE.Group();holder.scale.setScalar(this.size);holder.add(npc.model);this.root.add(holder);
  this.setPlacement(options.nodeTop??0,options.clearance??.24);
 }
 static async load(options:OrbActorOptions={}){return new LeafyOrbActor(await (options.gifWireframe?GifLeafyNPC:LeafyNPC).load(options.assetBase),options);}
 /** Highest node surface in the same coordinate system as root.parent. */
 setPlacement(nodeTop:number,clearance=.24){this.baseY=nodeTop+clearance-this.localMin*this.size;this.root.position.y=this.baseY;}
 setReducedMotion(value:boolean){this.reduced=value;if(value){this.spinTime=-1;this.root.position.y=this.baseY;this.gesture.reset();}}
 get celebrating(){return this.spinTime>=0;}
 celebrate(){if(this.reduced||this.cooldown>0||this.celebrating)return false;this.spinTime=0;this.cooldown=2.5;return true;}
 update(delta:number,frame:OrbFrame){
  const dt=Math.max(0,Math.min(delta,.05));this.cooldown=Math.max(0,this.cooldown-dt);
  if(this.gesture.update(frame.azimuth,frame.dragging,dt))this.celebrate();
  this.yaw+=Math.atan2(Math.sin(frame.azimuth-this.yaw),Math.cos(frame.azimuth-this.yaw))*(1-Math.exp(-dt*4));
  let lift=0,spin=0;
  if(this.spinTime>=0){this.spinTime+=dt;const p=Math.min(1,this.spinTime/1.35);lift=Math.sin(Math.PI*p)*.75;spin=Math.PI*2*(p*p*(3-2*p));if(p===1)this.spinTime=-1;}
  this.root.position.y=this.baseY+lift;this.root.rotation.y=this.yaw+spin;
  this.npc.update(dt,frame.pointer,frame.pointerActive,'idle','attentive',!this.reduced,true,'idle');this.npc.setMouth(frame.viseme??'rest');
 }
 dispose(){this.root.removeFromParent();this.npc.dispose();}
}
