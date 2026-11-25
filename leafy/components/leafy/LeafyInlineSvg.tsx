'use client';
import {useMemo,useState,useSyncExternalStore} from 'react';
import {Download,Maximize2,X} from 'lucide-react';

const tags=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','defs','linearGradient','radialGradient','stop','clipPath']);
const attrs=new Set(['xmlns','viewBox','width','height','preserveAspectRatio','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','d','cx','cy','r','x','y','x1','y1','x2','y2','points','transform','opacity','font-family','font-size','font-weight','text-anchor','dominant-baseline','gradientUnits','gradientTransform','offset','stop-color','stop-opacity','rx','ry','id','fill-rule','clip-rule','clip-path','role','aria-label']);
function safeValue(name:string,value:string){
 const localReference=/^url\(#[\w-]+\)$/i.test(value);
 if((/url\s*\(/i.test(value)&&!localReference)||/javascript:|data:|expression|[<>]/i.test(value))return false;
 if(['transform','gradientTransform'].includes(name))return /^[\d\s.,()a-z-]+$/i.test(value);
 if(['d','points','viewBox','width','height','cx','cy','r','x','y','x1','y1','x2','y2','rx','ry','stroke-width','font-size','opacity','offset','stop-opacity'].includes(name))return /^[\d\s.,%+-]+$/.test(value);
 if(name==='fill'||name==='stroke'||name==='stop-color')return /^(none|currentColor|#[\da-f]{3,8}|[a-z]{1,24}|url\(#[\w-]+\))$/i.test(value);
 if(name==='clip-path')return /^url\(#[\w-]+\)$/i.test(value);
 return value.length<=500;
}
function sanitize(source:string){
 if(typeof DOMParser==='undefined')return '';
 const match=source.match(/<svg\b[\s\S]*?<\/svg>/i);if(!match||match[0].length>180000)return '';
 const doc=new DOMParser().parseFromString(match[0],'image/svg+xml'),root=doc.documentElement;
 if(root.localName!=='svg'||doc.querySelector('parsererror'))return '';
 const clean=(node:Element):Element|null=>{
  if(!tags.has(node.localName))return null;
  const clone=doc.createElementNS('http://www.w3.org/2000/svg',node.localName);
  for(const attr of Array.from(node.attributes))if(attrs.has(attr.name)&&safeValue(attr.name,attr.value))clone.setAttribute(attr.name,attr.value);
  for(const child of Array.from(node.childNodes)){
   if(child.nodeType===Node.TEXT_NODE){clone.appendChild(doc.createTextNode(child.textContent||''));continue;}
   if(child.nodeType===Node.ELEMENT_NODE){const nested=clean(child as Element);if(nested)clone.appendChild(nested);}
  }
  return clone;
 };
 const result=clean(root);if(!result)return '';
 if(!result.hasAttribute('viewBox'))result.setAttribute('viewBox','0 0 640 400');
 result.setAttribute('role','img');result.setAttribute('aria-label','Illustration lavet af Leafy');
 return new XMLSerializer().serializeToString(result);
}
export default function LeafyInlineSvg({source,name='Leafy illustration'}:{source:string;name?:string}){
 const canParse=useSyncExternalStore(()=>()=>{},()=>typeof DOMParser!=='undefined',()=>false);
 const svg=useMemo(()=>canParse?sanitize(source):'',[source,canParse]);
 const [expanded,setExpanded]=useState(false);
 if(!svg)return <p className="leafy-svg-fallback">Illustrationen kunne ikke vises sikkert. Hent eller bed Leafy om at lave den igen.</p>;
 function download(){const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),a=document.createElement('a');a.href=url;a.download=(name.replace(/\.svg$/i,'')||'leafy-illustration')+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <>{expanded&&<button type="button" className="leafy-svg-backdrop" aria-label="Luk stor illustration" onClick={()=>setExpanded(false)}/>}<figure className={`leafy-svg-card ${expanded?'is-expanded':''}`}><div className="leafy-svg-art" dangerouslySetInnerHTML={{__html:svg}}/><figcaption><span>{name.replace(/\.svg$/i,'')}</span><button type="button" onClick={()=>setExpanded(v=>!v)} aria-label={expanded?'Luk stor illustration':'Forstør illustration'}>{expanded?<X size={15}/>:<Maximize2 size={15}/>}</button><button type="button" onClick={download} aria-label="Hent SVG"><Download size={15}/></button></figcaption></figure></>;
}
