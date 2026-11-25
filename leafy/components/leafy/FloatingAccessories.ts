import * as THREE from 'three';
import {HandSprites,type HandPose} from './HandSprites';
import type {NpcState} from './LeafyNPC';

/** Independent, detached 3D hands and hemp shoes. No arms, legs or connecting joints. */
export class FloatingAccessories {
 readonly hands=new THREE.Group();readonly shoes=new THREE.Group();
 private sprites:HandSprites[]=[];private palms:THREE.Group[]=[];private feet:THREE.Group[]=[];
 constructor(handAtlas:HTMLImageElement){
  this.hands.name='Leafy_floating_hands';this.shoes.name='Leafy_hemp_shoes';
  const green=new THREE.MeshStandardMaterial({color:'#79c829',roughness:.82});
  const trim=new THREE.MeshStandardMaterial({color:'#315f19',roughness:.9});
  const sole=new THREE.MeshStandardMaterial({color:'#eee5c8',roughness:.96});
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const c=canvas.getContext('2d')!;c.fillStyle='#c1aa7d';c.fillRect(0,0,128,128);
  // Repeating over/under warp and weft, generated in the material's own UV space.
  for(let y=0;y<128;y+=8)for(let x=0;x<128;x+=8){const vertical=((x+y)/8)%2===0;c.fillStyle=vertical?'#ddc99d':'#a18b63';c.fillRect(x+1,y+1,6,6);c.strokeStyle=vertical?'#aa936c':'#decca4';c.lineWidth=.8;for(let j=2;j<=6;j+=2){c.beginPath();if(vertical){c.moveTo(x+j,y);c.lineTo(x+j,y+8);}else{c.moveTo(x,y+j);c.lineTo(x+8,y+j);}c.stroke();}}
  const weave=new THREE.CanvasTexture(canvas);weave.name='Hemp_woven_canvas';weave.colorSpace=THREE.SRGBColorSpace;weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.repeat.set(3,2);weave.anisotropy=4;
  const hemp=new THREE.MeshStandardMaterial({color:'#eee2c6',map:weave,bumpMap:weave,bumpScale:.008,roughness:1});
  const ellipsoid=(parent:THREE.Group,name:string,material:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),material);m.name=name;m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;};
  for(const side of [-1,1]){
   const hand=new THREE.Group();hand.name=side<0?'Left_hand':'Right_hand';this.hands.add(hand);this.palms.push(hand);
   const sprites=new HandSprites(handAtlas,side>0);hand.add(sprites.group);this.sprites.push(sprites);
   const shoe=new THREE.Group();shoe.name=side<0?'Left_hemp_shoe':'Right_hemp_shoe';this.shoes.add(shoe);this.feet.push(shoe);
   ellipsoid(shoe,'Ivory_sole',sole,0,-.12,.06,.40,.13,.54);
   ellipsoid(shoe,'Hemp_upper',hemp,0,.025,.06,.365,.26,.49);
   // A dark inset reads as the opening; no visible ankle or leg above it.
   ellipsoid(shoe,'Green_collar',trim,0,.24,-.17,.225,.045,.235);
   ellipsoid(shoe,'Shoe_opening',new THREE.MeshStandardMaterial({color:'#162d0d',roughness:1}),0,.267,-.17,.165,.019,.175);
   for(const z of [.1,.29]){
    const points=[];for(let j=0;j<=16;j++){const a=Math.PI*j/16;points.push(new THREE.Vector3(Math.cos(a)*.33,.035+Math.sin(a)*.24,z));}
    const curve=new THREE.CatmullRomCurve3(points);
    const edge=new THREE.Mesh(new THREE.TubeGeometry(curve,20,.036,8,false),trim);edge.name='Green_strap_edge';shoe.add(edge);
    const strap=new THREE.Mesh(new THREE.TubeGeometry(curve,20,.025,8,false),hemp);strap.position.y=.022;strap.name='Hemp_strap';shoe.add(strap);
   }
   const accent=ellipsoid(shoe,'Leaf_detail',green,side*.352,.02,-.02,.025,.10,.07);accent.rotation.x=-.3;
  }
  this.update(0,'idle',false,0);
 }
 setVisible(hands:boolean,shoes:boolean){this.hands.visible=hands;this.shoes.visible=shoes;}
 orient(camera:THREE.Vector3){this.hands.updateWorldMatrix(true,false);const local=this.hands.worldToLocal(camera.clone());const yaw=Math.atan2(local.x,local.z);this.sprites.forEach(s=>s.orient(yaw));}
 update(t:number,state:NpcState,moving:boolean,dt:number){
  const a=moving?1:0;
  this.palms.forEach((hand,i)=>{const side=i===0?-1:1;const phase=t*1.3+i*1.7;
   hand.position.set(side*(1.8+Math.sin(t*.65+i)*.035*a),-.72+Math.sin(phase)*.06*a,.12);
   hand.rotation.set(Math.sin(phase)*.08*a,side*.1,side*.12+Math.sin(phase)*.07*a);
   let pose:HandPose='rest';
   if(moving&&state==='speaking'){pose='open';hand.position.y+=.15+Math.sin(t*2+i)*.06;hand.rotation.z+=side*.23;}
   if(moving&&state==='thinking'&&i===1){pose='point';hand.position.set(1.8,-.40,.32);hand.rotation.z=-.35;}
   // A brief occasional greeting during idle, with a visible empty gap from the torso.
   const phaseWave=t%31;if(moving&&state==='idle'&&i===0&&phaseWave>8&&phaseWave<11){pose='open';const blend=Math.sin((phaseWave-8)/3*Math.PI);hand.position.y+=1.2*blend;hand.rotation.z+=Math.sin(t*9)*.25*blend;}
   this.sprites[i].update(pose,dt);
  });
  this.feet.forEach((shoe,i)=>{const side=i===0?-1:1;shoe.position.set(side*.53,-2.23+Math.sin(t*1.2+i*1.8)*.045*a,.08);shoe.rotation.set(Math.sin(t*.9+i)*.08*a,side*.15,Math.sin(t*1.15+i*2)*.035*a);});
 }
}
