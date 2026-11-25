import * as THREE from 'three';
export type HandPose='rest'|'open'|'point';
const poses:HandPose[]=['rest','open','point'];
/** Six image cutouts: three gestures, each with a front and a back. */
export class HandSprites{
 readonly group=new THREE.Group();
 private layers:{pose:HandPose;mesh:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>}[]=[];
 constructor(atlas:HTMLImageElement,mirror:boolean){
  this.group.name='Image_hand';this.group.scale.x=mirror?-1:1;
  const size=atlas.width/3,height=atlas.height/2;
  for(let row=0;row<2;row++)poses.forEach((pose,col)=>{
   const canvas=document.createElement('canvas');canvas.width=size;canvas.height=height;
   canvas.getContext('2d')!.drawImage(atlas,col*size,row*height,size,height,0,0,size,height);
   const texture=new THREE.CanvasTexture(canvas);texture.name=`Leafy_hand_${pose}_${row?'back':'front'}`;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
   const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,alphaTest:.02,toneMapped:false,opacity:pose==='rest'?1:0,side:row?THREE.BackSide:THREE.FrontSide});
   const geo=new THREE.PlaneGeometry(.82,.82,8,8);const p=geo.getAttribute('position');
   for(let i=0;i<p.count;i++){const x=p.getX(i);p.setZ(i,(row?-1:1)*(.015+.055*Math.max(0,1-(x/.41)**2)));}geo.computeVertexNormals();
   const mesh=new THREE.Mesh(geo,material);mesh.name=`Hand_${pose}_${row?'back':'front'}`;mesh.visible=pose==='rest';this.group.add(mesh);this.layers.push({pose,mesh});
  });
 }
 update(pose:HandPose,dt:number){for(const layer of this.layers){const goal=layer.pose===pose?1:0;layer.mesh.material.opacity=THREE.MathUtils.damp(layer.mesh.material.opacity,goal,14,dt);layer.mesh.visible=layer.mesh.material.opacity>.005;}}
 orient(yaw:number){
  // Follow some of the viewing angle, but keep a real front/back rather than a full billboard.
  const back=Math.abs(yaw)>Math.PI/2;const delta=yaw-(back?Math.sign(yaw)*Math.PI:0);
  this.group.rotation.y=THREE.MathUtils.clamp(delta,-.68,.68);
 }
}
