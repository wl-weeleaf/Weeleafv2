import * as THREE from 'three';
/** Two real perpendicular surfaces; reference-camera projection preserves the supplied room. */
export function createRoom(scene:THREE.Scene,camera:THREE.PerspectiveCamera){
 const loader=new THREE.TextureLoader();const wallTexture=loader.load('/room/wall.jpg'),floorTexture=loader.load('/room/floor.jpg');
 for(const t of [wallTexture,floorTexture]){t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;}
 const floorY=-1.281,back=-2.8;
 const wallGeo=new THREE.PlaneGeometry(40,16,1,1);wallGeo.translate(0,floorY+8,back);
 const floorGeo=new THREE.PlaneGeometry(40,9,96,96);floorGeo.rotateX(-Math.PI/2);floorGeo.translate(0,floorY,back+4.5);
 const surfaces=[new THREE.Mesh(wallGeo,new THREE.MeshBasicMaterial({map:wallTexture,toneMapped:false})),new THREE.Mesh(floorGeo,new THREE.MeshBasicMaterial({map:floorTexture,toneMapped:false}))];
 surfaces.forEach(m=>{m.name='Room_texture_surface';scene.add(m);});
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(40,9),new THREE.ShadowMaterial({opacity:.24,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.set(0,floorY+.004,back+4.5);shadow.receiveShadow=true;scene.add(shadow);
 const light=new THREE.DirectionalLight(0xfff6da,2);light.position.set(-3,7,4);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:25});light.shadow.normalBias=.025;light.shadow.bias=-.0002;light.shadow.radius=4;scene.add(light);
 const projection=camera.clone();projection.position.set(0,0,6.5);projection.lookAt(0,0,0);
 function resize(){projection.aspect=camera.aspect;projection.updateProjectionMatrix();projection.updateMatrixWorld();const v=new THREE.Vector3();for(let index=0;index<2;index++){const g=surfaces[index].geometry,p=g.getAttribute('position'),uv=g.getAttribute('uv');for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).project(projection);const u=v.x*.5+.5,y=v.y*.5+.5;uv.setXY(i,u,index===0?(y-.3)/.7:y/.3);}uv.needsUpdate=true;}}
 resize();return {resize,setVisible(visible:boolean){surfaces.forEach(m=>{m.visible=visible;});shadow.visible=visible;light.visible=visible;},dispose(){surfaces.forEach(m=>{scene.remove(m);m.geometry.dispose();m.material.dispose();});scene.remove(shadow,light);shadow.geometry.dispose();shadow.material.dispose();light.shadow.map?.dispose();wallTexture.dispose();floorTexture.dispose();}};
}
