import * as THREE from 'three';
import type {Viseme} from './LeafyNPC';
import {leafySurface} from './LeafyNPC';
import type {SpeechEmotion} from './SpeechEmotion';
import {createLeafDeformationFrame,deformPoint,type LeafDeformationFrame} from './LeafDeformation';

export type MouthRigParameters={width:number;height:number;cornerLeft:number;cornerRight:number;lipThickness:number;jaw:number;roundness:number};
export const DEFAULT_MOUTH_RIG:MouthRigParameters={width:1,height:1,cornerLeft:0,cornerRight:0,lipThickness:1,jaw:1,roundness:1};
// Keep the GLB mouth anchor and apply a small leftward centering correction
// measured against the original face texture.
const glbAnchorX=-.06,anchorX=glbAnchorX-.045,anchorY=-.66,columns=25,rows=9;
type MouthPose={open:number;width:number;round:number;smile:number;press:number;asym:number};
// Broad cartoon key poses: closures, wide vowels, rounded vowels and the
// smaller tongue-to-teeth L pose. These are timing-based estimates, not
// phoneme measurements from ElevenLabs.
const openByViseme:Record<Viseme,MouthPose>={
 rest:{open:.025,width:1,round:0,smile:0,press:0,asym:0},
 MBP:{open:0,width:.82,round:0,smile:0,press:1,asym:0},
 AA:{open:1,width:1,round:.08,smile:0,press:0,asym:.03},
 EE:{open:.64,width:1,round:.03,smile:.78,press:0,asym:.08},
 OH:{open:.94,width:.76,round:.72,smile:0,press:0,asym:-.03},
 OO:{open:.74,width:.62,round:.94,smile:0,press:.08,asym:0},
 FV:{open:.24,width:.9,round:.04,smile:.08,press:.28,asym:-.05},
 L:{open:.43,width:.94,round:.12,smile:.18,press:.08,asym:.16},
};

/** A small 3D mouth rig aligned to Mouth_anchor in the supplied Leafy GLB. */
export class LeafyMouthRig{
 readonly group=new THREE.Group();
 private cavity:THREE.Mesh;
 private upper:THREE.Mesh;
 private lower:THREE.Mesh;
 private upperLight:THREE.Mesh;
 private lowerLight:THREE.Mesh;
 private currentOpen=.035;private currentWidth=1;private currentRound=0;private currentSmile=0;private currentPress=0;private currentAsym=0;
 private desiredOpen=.035;private desiredWidth=1;private desiredRound=0;private desiredSmile=0;private desiredPress=0;private desiredAsym=0;private whistle=0;private speechEnergy=0;
 private parameters={...DEFAULT_MOUTH_RIG};private lastShape='';private visible=true;
 constructor(){
  this.group.name='Mouth_anchor';this.group.position.set(anchorX,anchorY,0);
  const cavityGeometry=new THREE.BufferGeometry();const p=new Float32Array(columns*rows*3),uv=new Float32Array(columns*rows*2),indices:number[]=[];
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const i=y*columns+x;uv[i*2]=x/(columns-1);uv[i*2+1]=y/(rows-1);if(x<columns-1&&y<rows-1){const a=i,b=i+1,c=i+columns,d=c+1;indices.push(a,c,b,b,c,d);}}
  cavityGeometry.setAttribute('position',new THREE.BufferAttribute(p,3));cavityGeometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));cavityGeometry.setIndex(indices);
  this.cavity=new THREE.Mesh(cavityGeometry,new THREE.MeshBasicMaterial({color:'#080c08',side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));this.cavity.name='Mouth_cavity';this.cavity.renderOrder=5;this.group.add(this.cavity);
  const lip=new THREE.MeshStandardMaterial({color:'#23721a',roughness:.56,metalness:0});const glint=new THREE.MeshStandardMaterial({color:'#6aa936',roughness:.68,metalness:0});
  this.upper=new THREE.Mesh(new THREE.BufferGeometry(),lip);this.lower=new THREE.Mesh(new THREE.BufferGeometry(),lip);this.upperLight=new THREE.Mesh(new THREE.BufferGeometry(),glint);this.lowerLight=new THREE.Mesh(new THREE.BufferGeometry(),glint);
  this.upper.name='Mouth_outer_lip_upper';this.lower.name='Mouth_outer_lip_lower';this.upperLight.name='Mouth_lip_highlight_upper';this.lowerLight.name='Mouth_lip_highlight_lower';
  for(const mesh of [this.upper,this.lower,this.upperLight,this.lowerLight]){mesh.renderOrder=6;this.group.add(mesh);}
  this.updateGeometry(0,0,0,.035,0,0,0,0,0);
 }
 setViseme(id:Viseme|'none',energy=0){
  if(id==='none'){this.visible=false;this.group.visible=false;return;}this.visible=true;this.group.visible=true;
  const shape=openByViseme[id],emphasis=THREE.MathUtils.clamp(energy,0,1);this.speechEnergy=emphasis;
  this.desiredOpen=shape.open===0?0:Math.min(1.2,shape.open*(1+emphasis*.3));this.desiredWidth=shape.width;this.desiredRound=shape.round;
  this.desiredSmile=shape.smile;this.desiredPress=shape.press;this.desiredAsym=shape.asym;
 }
 setWhistling(active:boolean){this.whistle=active?1:0;if(active){this.visible=true;this.group.visible=true;}}
 setParameters(next:Partial<MouthRigParameters>){
  const merged={...this.parameters,...next};
  for(const key of Object.keys(DEFAULT_MOUTH_RIG) as (keyof MouthRigParameters)[])merged[key]=THREE.MathUtils.clamp(merged[key],key==='cornerLeft'||key==='cornerRight'?-1:0,key==='cornerLeft'||key==='cornerRight'?1:2);
  if(Object.keys(merged).every(key=>merged[key as keyof MouthRigParameters]===this.parameters[key as keyof MouthRigParameters]))return;
  this.parameters=merged;this.lastShape='';
 }
 getJawMotion(){return this.visible?this.currentOpen*this.parameters.jaw*this.parameters.height:0;}
 update(dt:number,time:number,turn:number,movement:number,emotion:SpeechEmotion='neutral',voiced=false){
  if(!this.visible)return;
  // The playback envelope gently flexes the held pose, so vowels do not look
  // like frozen cards. A tiny independent cheek/corner motion keeps the face
  // alive between syllable cues without making it wobble constantly.
  const speaking=voiced&&this.desiredOpen>.12;
  const pulse=speaking?Math.sin(time*18+this.desiredRound*2.4)*(.012+this.speechEnergy*.045):0;
  const emotionSmile=emotion==='excited'?.14:emotion==='reassuring'?.09:0;
  const curiousAsym=emotion==='curious'?.035:0;
  const targetOpen=THREE.MathUtils.lerp(Math.max(0,this.desiredOpen+pulse),.43,this.whistle),targetWidth=THREE.MathUtils.lerp(this.desiredWidth,.36,this.whistle),targetRound=THREE.MathUtils.lerp(THREE.MathUtils.clamp(this.desiredRound*this.parameters.roundness,0,1),1,this.whistle);
  // Clear key poses close quickly; opening poses ease in with a softer cartoon
  // anticipation, while the timestamped phoneme holds remain easy to read.
  const rate=Math.min(1,1-Math.exp(-Math.max(dt,0)*(targetOpen>this.currentOpen?25:34)));
  this.currentOpen+=(targetOpen-this.currentOpen)*rate;this.currentWidth+=(targetWidth-this.currentWidth)*rate;this.currentRound+=(targetRound-this.currentRound)*rate;
  const expressionRate=1-Math.exp(-Math.max(dt,0)*18);
  this.currentSmile+=(THREE.MathUtils.clamp(this.desiredSmile+emotionSmile,0,1)-this.currentSmile)*expressionRate;
  this.currentPress+=(THREE.MathUtils.lerp(this.desiredPress,0,this.whistle)-this.currentPress)*expressionRate;
  this.currentAsym+=(THREE.MathUtils.clamp(this.desiredAsym+curiousAsym+(speaking?Math.sin(time*7.1)*this.speechEnergy*.035:0),-.35,.35)-this.currentAsym)*expressionRate;
  // Refresh the mouth with the same gentle torso deformation, capped at 30 updates/sec.
  const shape=[this.currentOpen,this.currentWidth,this.currentRound,this.currentSmile,this.currentPress,this.currentAsym,...Object.values(this.parameters),Math.round(time*30)/30,Math.round(turn*100)/100,Math.round(movement*100)/100,emotion,voiced].map(v=>typeof v==='number'?Math.round(v*1000)/1000:v).join(':');
  if(shape===this.lastShape)return;this.lastShape=shape;this.updateGeometry(time,turn,movement,this.currentOpen,this.currentRound,this.whistle,this.currentSmile,this.currentPress,this.currentAsym,emotion,voiced);
 }
 private curveY(x:number,round:number,smile:number,asym:number){
  const t=(x+1)/2,p=this.parameters,corner=THREE.MathUtils.lerp(p.cornerLeft,p.cornerRight,t)*.055;
  const cheekLift=smile*.075*x*x;
  const sideLift=asym*x*.038;
  return (.045*x*x+corner+cheekLift+sideLift)*(1-round);
 }
 private point(x:number,y:number,zOffset:number,frame:LeafDeformationFrame,turn:number,whistleOffset=0){
  const gx=anchorX+x+whistleOffset,gy=anchorY+y,gz=leafySurface(gx,gy)+zOffset;const d=deformPoint(gx,gy,gz,turn,frame);
  return new THREE.Vector3(d[0]-anchorX,d[1]-anchorY,d[2]);
 }
 private updateGeometry(time:number,turn:number,movement:number,open:number,round:number,whistle:number,smile:number,press:number,asym:number,emotion:SpeechEmotion='neutral',voiced=false){
  const opening=.36*this.parameters.height*this.parameters.jaw*open*(1-press*.72),frame=createLeafDeformationFrame(time,movement,emotion,voiced);
  // OO/OH use a deliberately readable held key pose; whistle is a compact circle.
  const naturalWidth=.62*this.parameters.width*this.currentWidth,roundWidth=opening*1.18+.018;
  const width=THREE.MathUtils.lerp(naturalWidth,roundWidth,round)*(1+smile*.1),whistleOffset=whistle*Math.sin(time*5.8)*.022;
  const pos=this.cavity.geometry.getAttribute('position') as THREE.BufferAttribute;
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
   const xn=x/(columns-1)*2-1,edge=Math.sqrt(Math.max(0,1-xn*xn)),center=this.curveY(xn,round,smile,asym);
   const closedGap=.004*(1-press),share=THREE.MathUtils.lerp(.44,.5,round),halfTop=closedGap+opening*share*edge,halfBottom=closedGap+opening*(1-share)*edge,blend=y/(rows-1),localX=xn*width/2;
   const localY=center+halfTop-(halfTop+halfBottom)*blend;
   const point=this.point(localX,localY,.014,frame,turn,whistleOffset);pos.setXYZ(y*columns+x,point.x,point.y,point.z);
  }
  pos.needsUpdate=true;this.cavity.geometry.computeVertexNormals();
  const tube=(mesh:THREE.Mesh,lower:boolean,radius:number)=>{
   const points:THREE.Vector3[]=[];for(let i=0;i<25;i++){const x=i/24*2-1,edge=Math.sqrt(Math.max(0,1-x*x)),center=this.curveY(x,round,smile,asym),closedGap=.004*(1-press),share=THREE.MathUtils.lerp(.44,.5,round),y=lower?center-closedGap-opening*(1-share)*edge:center+closedGap+opening*share*edge;points.push(this.point(x*width/2,y,.022,frame,turn,whistleOffset));}
   const curve=new THREE.CatmullRomCurve3(points);const geometry=new THREE.TubeGeometry(curve,32,Math.max(.002,radius),6,false);mesh.geometry.dispose();mesh.geometry=geometry;
  };
  const lipRadius=.012*this.parameters.lipThickness;tube(this.upper,false,lipRadius);tube(this.lower,true,lipRadius);
  tube(this.upperLight,false,Math.max(.002,lipRadius*.35));tube(this.lowerLight,true,Math.max(.002,lipRadius*.3));
 }
 dispose(){this.group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});}
}
