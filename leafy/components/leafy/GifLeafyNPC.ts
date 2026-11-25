import * as THREE from 'three';
import {disposeLeafy} from './createLeafy';
import type {Expression} from './AnimatedFace';
/** Torso-only 3D surface. UVs sample the supplied full character without editing it. */
export class GifLeafyNPC {
 readonly model:THREE.Group;
 private gaze=new THREE.Vector2();private elapsed=0;
 private constructor(front:THREE.Texture,back:THREE.Texture){
  this.model=new THREE.Group();this.model.name='Leafy_torso';
  // Inset outline of the supplied torso, in source-image pixels (360 × 640).
  // Arms and legs remain outside the mesh, rather than being painted out.
  const outline=[[191,106],[224,145],[259,189],[288,238],[307,283],[318,323],[317,358],[304,389],[282,413],[248,430],[214,441],[191,448],[169,437],[137,426],[108,407],[84,383],[69,354],[63,323],[66,292],[78,260],[96,224],[121,188],[150,150]].map(([x,y])=>new THREE.Vector3(x,y,0));
  const curve=new THREE.CatmullRomCurve3(outline,true,'centripetal');const points=curve.getPoints(168).slice(0,-1);const columns=points.length,rings=24,cx=191,cy=298,scale=3.4/342;
  for(const isFront of [true,false]){
   const vertices:number[]=[],uv:number[]=[],index:number[]=[];
   const add=(px:number,py:number,r:number)=>{vertices.push((px-cx)*scale,(277-py)*scale,(isFront?.43:-.30)*Math.sqrt(Math.max(0,1-r*r)));if(isFront)uv.push(px/360,1-py/640);else uv.push((70+(1-(px-62)/258)*373)/512,1-(8+(py-106)/342*489)/512);};
   add(cx,cy,0);
   for(let ring=1;ring<=rings;ring++){const r=Math.sin(ring/rings*Math.PI/2);for(const p of points)add(cx+(p.x-cx)*r,cy+(p.y-cy)*r,r);}
   // Pixel Y points downward; this outline becomes clockwise in world XY.
   const tri=(a:number,b:number,c:number)=>index.push(...(isFront?[a,c,b]:[a,b,c]));
   for(let c=0;c<columns;c++)tri(0,1+c,1+(c+1)%columns);
   for(let ring=1;ring<rings;ring++)for(let c=0;c<columns;c++){const a=1+(ring-1)*columns+c,b=1+(ring-1)*columns+(c+1)%columns;tri(a,a+columns,b+columns);tri(a,b+columns,b);}
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(index);geo.computeVertexNormals();
   const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:isFront?front:back,alphaTest:.05}));mesh.name=isFront?'Leafy_torso_front':'Leafy_torso_back';this.model.add(mesh);
  }
 }
 static async load(assetBase='/leafy'){
  const base=assetBase.replace(/\/$/,'');const loader=new THREE.TextureLoader();
  const results=await Promise.allSettled([loader.loadAsync(`${base}/torso-source.png`),loader.loadAsync(`${base}/back.png`)]);
  if(results.some(r=>r.status==='rejected')){for(const r of results)if(r.status==='fulfilled')r.value.dispose();throw Error('Leafys torso kunne ikke indlæses.');}
  const maps=results.map(r=>(r as PromiseFulfilledResult<THREE.Texture>).value);for(const t of maps){t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;}
  return new GifLeafyNPC(maps[0],maps[1]);
 }
 update(dt:number,target:THREE.Vector2,active:boolean,_expression:Expression,_state:string,animate=true,track=true,motion='idle'){
  this.elapsed+=dt;const desired=active&&track?target:new THREE.Vector2();this.gaze.lerp(desired,1-Math.exp(-dt*4));
  this.model.rotation.set(-this.gaze.y*.10,this.gaze.x*.22,animate?Math.sin(this.elapsed*.8)*.015:0);
  this.model.position.y=animate&&motion!=='still'?Math.sin(this.elapsed*1.35)*.035:0;
 }
 setMouth(_id:string){}
 dispose(){disposeLeafy(this.model);}
}
