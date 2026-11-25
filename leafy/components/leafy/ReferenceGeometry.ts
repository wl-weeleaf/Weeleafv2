import * as THREE from 'three';
import reference from './reference-geometry.json';
/** Exact approved GLB geometry and its original 512px texture coordinates. */
export function referenceGeometry(front:boolean){const d=front?reference.front:reference.back,g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(d.POSITION,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(d.NORMAL,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(d.TEXCOORD_0,2));g.setIndex(d.indices);return g;}
