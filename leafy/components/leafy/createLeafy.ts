import * as THREE from 'three';
import outline from './outline.json';
const N=outline.length, RINGS=48, SCALE=3.4/486;
/** Closed rounded silhouette. The reference artwork is UV-mapped onto +Z. */
export function createLeafyGeometry(front=true) {
 const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
 const vertex=(px:number,py:number,r:number)=>{
  const base=Math.sqrt(Math.max(0,1-r*r));
  const eyes=Math.exp(-((px-175)**2/800+(py-277)**2/1250))+Math.exp(-((px-307)**2/800+(py-277)**2/1250));
  const z=front?.47*base+.07*eyes*base:-.34*base;
  positions.push((px-256)*SCALE,(254-py)*SCALE,z);uvs.push(px/512,1-py/512);
 };
 vertex(256,290,0);
 for(let ring=1;ring<=RINGS;ring++){
  const r=Math.sin(ring/RINGS*Math.PI/2);
  for(const [x,y] of outline)vertex(256+(x-256)*r,290+(y-290)*r,r);
 }
 const tri=(a:number,b:number,c:number)=>indices.push(...(front?[a,b,c]:[a,c,b]));
 for(let i=0;i<N;i++)tri(0,1+i,1+(i+1)%N);
 for(let ring=1;ring<RINGS;ring++)for(let i=0;i<N;i++){
  const a=1+(ring-1)*N+i,b=1+(ring-1)*N+(i+1)%N,c=a+N,d=b+N;tri(a,c,d);tri(a,d,b);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
 const normals=g.getAttribute('normal');
 for(let i=0;i<N;i++){
  const p=outline[(i+N-1)%N],q=outline[(i+1)%N],n=new THREE.Vector3(p[1]-q[1],p[0]-q[0],0).normalize();normals.setXYZ(1+(RINGS-1)*N+i,n.x,n.y,0);
 }
 return g;
}
/** Call in the browser (Next.js useEffect). No renderer or React dependency. */
export async function createLeafy(textureUrl='/leafy/expressions/idle-0.png', backUrl='/leafy/back.png'){
 const loader=new THREE.TextureLoader();
 const loaded=await Promise.allSettled([loader.loadAsync(textureUrl),loader.loadAsync(backUrl)]);
 if(loaded.some(r=>r.status==='rejected')){loaded.forEach(r=>{if(r.status==='fulfilled')r.value.dispose();});throw new Error('Leafy textures could not load');}
 const [texture,backTexture]=loaded.map(r=>(r as PromiseFulfilledResult<THREE.Texture>).value);
 for(const t of [texture,backTexture]){t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;}
 const root=new THREE.Group();root.name='Leafy';
 const frontMaterial=new THREE.MeshStandardMaterial({map:texture,roughness:.85,emissiveMap:texture,emissive:0xffffff,emissiveIntensity:.18});
 const backMaterial=new THREE.MeshStandardMaterial({map:backTexture,roughness:.85,emissiveMap:backTexture,emissive:0xffffff,emissiveIntensity:.18});
 const front=new THREE.Mesh(createLeafyGeometry(true),frontMaterial);front.name='Leafy_front';
 const backGeometry=createLeafyGeometry(false);const backUV=backGeometry.getAttribute('uv');for(let i=0;i<backUV.count;i++)backUV.setX(i,1-backUV.getX(i));
 const back=new THREE.Mesh(backGeometry,backMaterial);back.name='Leafy_back';root.add(front,back);
 const idle=new THREE.AnimationClip('Idle',4,[
  new THREE.VectorKeyframeTrack('Leafy.position',[0,1,2,3,4],[0,0,0,0,.055,0,0,0,0,0,-.035,0,0,0,0]),
  new THREE.QuaternionKeyframeTrack('Leafy.quaternion',[0,1,2,3,4],[0,0,0,1,0,0,Math.sin(.0125),Math.cos(.0125),0,0,0,1,0,0,-Math.sin(.0125),Math.cos(.0125),0,0,0,1])
 ]);
 const hop=new THREE.AnimationClip('Hop',1,[
  new THREE.VectorKeyframeTrack('Leafy.position',[0,.16,.45,.8,1],[0,0,0,0,-.06,0,0,.38,0,0,0,0,0,0,0]),
  new THREE.VectorKeyframeTrack('Leafy.scale',[0,.16,.45,.8,1],[1,1,1,1.06,.94,1,.97,1.04,1,1.03,.97,1,1,1,1])
 ]);
 root.animations=[idle,hop];return root;
}
export function disposeLeafy(root:THREE.Object3D){
 const mats=new Set<THREE.Material>(),tex=new Set<THREE.Texture>();
 root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);}});
 for(const m of mats){for(const v of Object.values(m))if(v instanceof THREE.Texture)tex.add(v);m.dispose();}tex.forEach(t=>t.dispose());
}
