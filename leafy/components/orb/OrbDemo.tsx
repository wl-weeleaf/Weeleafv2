'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {LeafyOrbActor} from '../leafy/LeafyOrbActor';
import {Button} from '@/components/ui/button';
import {Switch} from '@/components/ui/switch';
import {ArrowDownToLine,Leaf,RotateCcw,Sparkles} from 'lucide-react';
export default function OrbDemo(){
 const host=useRef<HTMLDivElement>(null),actor=useRef<LeafyOrbActor|null>(null),reset=useRef<()=>void>(()=>{});
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState(0),[jump,setJump]=useState(false),[reduced,setReduced]=useState(false);
 useEffect(()=>{actor.current?.setReducedMotion(reduced);},[reduced]);
 useEffect(()=>{
  const el=host.current!;let disposed=false,renderer:THREE.WebGLRenderer;
  const media=matchMedia('(prefers-reduced-motion: reduce)');setReduced(media.matches);
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{setError('3D kræver WebGL. Prøv en anden browser.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;el.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Leafy over orbens noder. Træk sidelæns for at dreje.');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.1,80);camera.position.set(0,3.7,7.8);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.75,0);controls.enablePan=false;controls.enableDamping=true;controls.minDistance=5;controls.maxDistance=12;controls.minPolarAngle=.45;controls.maxPolarAngle=Math.PI*.48;controls.rotateSpeed=1.1;
  reset.current=()=>{camera.position.set(0,3.7,7.8);controls.target.set(0,.75,0);controls.update();actor.current?.gesture.reset();};
  scene.add(new THREE.HemisphereLight(0xe8ffe2,0x334429,2.6));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-3,6,5);scene.add(light);const rim=new THREE.DirectionalLight(0xc2ec8d,2);rim.position.set(2,3,-5);scene.add(rim);
  const decor=new THREE.Group();scene.add(decor);
  const ring=(radius:number,y:number,color:number,opacity:number)=>{const m=new THREE.Mesh(new THREE.TorusGeometry(radius,.012,8,150),new THREE.MeshBasicMaterial({color,transparent:true,opacity}));m.rotation.x=Math.PI/2;m.position.y=y;decor.add(m);};
  ring(2.7,-.15,0xc6a765,.65);ring(2.35,-.15,0x8dbd65,.3);ring(.75,-.13,0xc6a765,.4);
  const sphere=new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(2.8,24,12)),new THREE.LineBasicMaterial({color:0xa9c484,transparent:true,opacity:.055}));sphere.scale.y=.7;sphere.position.y=.5;decor.add(sphere);
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2,x=Math.sin(a)*2.35,z=Math.cos(a)*2.35;const node=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.09,40),new THREE.MeshStandardMaterial({color:0xa28b4e,metalness:.65,roughness:.32}));node.position.set(x,-.055,z);decor.add(node);const dot=new THREE.Mesh(new THREE.SphereGeometry(.055,14,10),new THREE.MeshBasicMaterial({color:0xc4ed7c}));dot.position.set(x,.04,z);decor.add(dot);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-.13,0),new THREE.Vector3(x,-.13,z)]),new THREE.LineBasicMaterial({color:0x9ebd6c,transparent:true,opacity:.16}));decor.add(line);}
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}};const observer=new ResizeObserver(resize);observer.observe(el);resize();
  let dragging=false,active=false,last=0,lastUI=0;const pointer=new THREE.Vector2();
  const move=(e:PointerEvent)=>{const r=el.getBoundingClientRect();pointer.set(THREE.MathUtils.clamp((e.clientX-r.left)/r.width*2-1,-1,1),THREE.MathUtils.clamp(1-(e.clientY-r.top)/r.height*2,-1,1));active=true;};const leave=()=>{active=false;};const start=()=>{dragging=true;};const end=()=>{dragging=false;};
  window.addEventListener('pointermove',move);window.addEventListener('blur',leave);document.documentElement.addEventListener('pointerleave',leave);controls.addEventListener('start',start);controls.addEventListener('end',end);
  LeafyOrbActor.load({nodeTop:.1,clearance:.28,scale:.44,reducedMotion:media.matches}).then(a=>{if(disposed){a.dispose();return;}actor.current=a;scene.add(a.root);setReady(true);}).catch(()=>setError('Leafy kunne ikke indlæses. Genindlæs siden.'));
  renderer.setAnimationLoop(time=>{const dt=last?Math.min((time-last)/1000,.05):0;last=time;controls.update();const a=actor.current;if(a){a.update(document.hidden?0:dt,{pointer,pointerActive:active,azimuth:controls.getAzimuthalAngle(),dragging});if(time-lastUI>100){setProgress(a.gesture.progress);setJump(a.celebrating);lastUI=time;}}renderer.render(scene,camera);});
  return()=>{disposed=true;renderer.setAnimationLoop(null);observer.disconnect();window.removeEventListener('pointermove',move);window.removeEventListener('blur',leave);document.documentElement.removeEventListener('pointerleave',leave);controls.dispose();actor.current?.dispose();actor.current=null;decor.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();o.material.dispose();}});renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <main className="orb-app"><header className="orb-header"><Link href="/" className="orb-brand"><Leaf size={24}/>Leafy <span>· Orb</span></Link><nav><a href="/studio">Åbn studiet</a><Button asChild><a href="/downloads/leafy-orb-integration.zip" download><ArrowDownToLine size={17}/>Integration til Filip</a></Button></nav></header><section className="orb-surface"><div className="orb-intro"><span>LEAFY 3D</span><h1>Lige midt i det hele.</h1><p>Flyt musen — Leafy følger dig.<br/>Træk to omgange samme vej rundt om orben, og se hvad der sker.</p></div><div className="orb-render" ref={host}/>{!ready&&!error&&<p className="orb-loading">Leafy vågner…</p>}{error&&<p className="orb-loading" role="alert">{error}</p>}<div className="orb-bottom"><div className="orbit-meter"><span>{jump?'Et hop og en piruet!':reduced?'Rolig visning':'To omgange → hop & piruet'}</span><progress max={1} value={progress} aria-label="Omgange mod næste piruet"/></div><div className="orb-actions"><Button variant="outline" disabled={!ready||reduced} onClick={()=>actor.current?.celebrate()}><Sparkles size={16}/>Prøv et hop</Button><Button variant="ghost" onClick={()=>reset.current()} aria-label="Nulstil kamera"><RotateCcw size={18}/></Button><label><Switch checked={reduced} onCheckedChange={setReduced}/>Rolig visning</label></div></div></section><footer className="orb-footer"><span>Samme Leafy. Klar til platformen.</span><p>Orben og noderne her er en demonstration. Integrationen kan monteres i platformens eksisterende 3D-scene.</p></footer></main>;
}
