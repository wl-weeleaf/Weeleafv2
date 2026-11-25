// Offline GLB exporter. Original image bytes are embedded unchanged.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
const dir=process.cwd();fs.mkdirSync('.sites-runtime',{recursive:true});
const source=fs.readFileSync('components/leafy/createLeafy.ts','utf8').replace("import outline from './outline.json';",`const outline=${fs.readFileSync('components/leafy/outline.json','utf8')};`);
fs.writeFileSync('.sites-runtime/leafy-model.mjs',ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
let npcSource=fs.readFileSync('components/leafy/LeafyNPC.ts','utf8').replace("import outline from './outline.json';",`const outline=${fs.readFileSync('components/leafy/outline.json','utf8')};`).replace("from './createLeafy'","from './leafy-model.mjs'");
fs.writeFileSync('.sites-runtime/leafy-npc.mjs',ts.transpileModule(npcSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
THREE.TextureLoader.prototype.loadAsync=async url=>{const t=new THREE.Texture();t.name=url;return t;};
THREE.ImageLoader.prototype.loadAsync=async()=>({});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({clearRect(){},drawImage(){}})})};
const {LeafyNPC}=await import(path.join(dir,'.sites-runtime/leafy-npc.mjs'));
const npc=await LeafyNPC.load(),model=npc.model;
const chunks=[];let byteLength=0;
const gltf={asset:{version:'2.0',generator:'Leafy rounded mesh exporter'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'Leafy',children:[]}],meshes:[],materials:[],textures:[],samplers:[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}],images:[],accessors:[],bufferViews:[],buffers:[],animations:[],extensionsUsed:['KHR_materials_unlit']};
function view(bytes,target){const data=Buffer.from(bytes.buffer??bytes,bytes.byteOffset??0,bytes.byteLength??bytes.length);const index=gltf.bufferViews.length;gltf.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:data.length,...(target?{target}:{})});chunks.push(data);const pad=(4-data.length%4)%4;if(pad)chunks.push(Buffer.alloc(pad));byteLength+=data.length+pad;return index;}
function accessor(array,size,target,bounds=false){const bufferView=view(array,target),count=array.length/size;const a={bufferView,componentType:array instanceof Float32Array?5126:array instanceof Uint16Array?5123:5125,count,type:{1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'}[size]};if(bounds){a.min=Array.from({length:size},(_,j)=>{let v=Infinity;for(let i=j;i<array.length;i+=size)v=Math.min(v,array[i]);return v;});a.max=Array.from({length:size},(_,j)=>{let v=-Infinity;for(let i=j;i<array.length;i+=size)v=Math.max(v,array[i]);return v;});}gltf.accessors.push(a);return gltf.accessors.length-1;}
const materialIds=new Map(),textureIds=new Map();
function materialId(material){
 if(materialIds.has(material))return materialIds.get(material);
 const value={name:material.name||material.type,pbrMetallicRoughness:{baseColorFactor:[...material.color.toArray(),material.opacity],metallicFactor:material.metalness??0,roughnessFactor:material.roughness??1}};
 if(material.map){
  const name=material.map.name,file=name==='Mouth_sequence'?'public/leafy/mouths/rest.png':'public'+name;
  let index=textureIds.get(file);if(index===undefined){index=gltf.textures.length;textureIds.set(file,index);gltf.textures.push({source:gltf.images.length,sampler:0});gltf.images.push({bufferView:view(fs.readFileSync(file)),mimeType:'image/png'});}
  value.pbrMetallicRoughness.baseColorTexture={index};
  if(material.emissiveMap){value.emissiveTexture={index};value.emissiveFactor=[.18,.18,.18];}
 }
 if(material.isMeshBasicMaterial)value.extensions={KHR_materials_unlit:{}};
 if(material.transparent){value.alphaMode='BLEND';}else if(material.alphaTest){value.alphaMode='MASK';value.alphaCutoff=material.alphaTest;}
 const id=gltf.materials.length;gltf.materials.push(value);materialIds.set(material,id);return id;
}
gltf.nodes=[];
function visit(object){
 if(!object.visible)return null;
 const id=gltf.nodes.length,node={name:object.name||object.type,translation:object.position.toArray(),rotation:object.quaternion.toArray(),scale:object.scale.toArray()};gltf.nodes.push(node);
 if(object.isMesh){
  const g=object.geometry.clone(),uv=g.attributes.uv;if(uv)for(let j=0;j<uv.count;j++)uv.setY(j,1-uv.getY(j));
  for(const attribute of Object.values(g.attributes))if(!Array.from(attribute.array).every(Number.isFinite))throw new Error('Non-finite geometry');
  const attributes={POSITION:accessor(g.attributes.position.array,3,34962,true),NORMAL:accessor(g.attributes.normal.array,3,34962),TEXCOORD_0:accessor(g.attributes.uv.array,2,34962)};
  node.mesh=gltf.meshes.length;gltf.meshes.push({name:object.name,primitives:[{attributes,indices:accessor(g.index.array,1,34963),material:materialId(object.material)}]});
 }
 const children=object.children.map(visit).filter(i=>i!==null);if(children.length)node.children=children;return id;
}
visit(model);gltf.nodes[0].extras={behavior:'Use LeafyNPC.ts for gaze and LeafySpeech.ts for timed lipsync. GLB is a snapshot.'};
for(const clip of model.animations){const animation={name:clip.name,channels:[],samplers:[]};for(const track of clip.tracks){const prop=track.name.split('.').pop(),targetPath={position:'translation',quaternion:'rotation',scale:'scale'}[prop];animation.channels.push({sampler:animation.samplers.length,target:{node:0,path:targetPath}});animation.samplers.push({input:accessor(track.times,1,undefined,true),output:accessor(track.values,track.getValueSize()),interpolation:'LINEAR'});}gltf.animations.push(animation);}
gltf.buffers.push({byteLength});let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=Buffer.concat(chunks),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync('public/leafy/leafy.glb',Buffer.concat([header,jh,json,bh,bin]));
console.log(JSON.stringify({meshes:gltf.meshes.length,triangles:gltf.meshes.reduce((n,m)=>n+gltf.accessors[m.primitives[0].indices].count/3,0),animations:gltf.animations.map(a=>a.name),bytes:fs.statSync('public/leafy/leafy.glb').size}));
