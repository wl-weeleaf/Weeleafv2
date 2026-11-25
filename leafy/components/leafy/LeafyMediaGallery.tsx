'use client';
import {useEffect,useState} from 'react';
import {Download,Image as ImageIcon,Music2,Video,Volume2} from 'lucide-react';
import {results} from '@/lib/leafy/client';
import type {GeneratedMedia} from '@/lib/leafy/actions';

export default function LeafyMediaGallery({className=''}:{className?:string}){
 const [items,setItems]=useState<GeneratedMedia[]>([]);
 useEffect(()=>{const refresh=()=>setItems(results().media.slice(-3).reverse());refresh();window.addEventListener('leafy-event',refresh);return()=>window.removeEventListener('leafy-event',refresh);},[]);
 if(!items.length)return null;
 return <section className={`leafy-media-gallery ${className}`} aria-label="Medier Leafy har skabt">{items.map(item=><article key={item.id} className="leafy-media-card"><header><span>{item.kind==='image'?<ImageIcon size={15}/>:item.kind==='video'?<Video size={15}/>:item.kind==='music'?<Music2 size={15}/>:<Volume2 size={15}/>} {item.name}</span><a href={item.downloadUrl} download aria-label={`Hent ${item.name}`}><Download size={15}/></a></header>{item.kind==='image'?<a href={item.url} target="_blank" rel="noreferrer"><img src={item.url} alt={item.name}/></a>:item.kind==='video'?<video src={item.url} controls playsInline preload="metadata"/>:<audio src={item.url} controls preload="metadata"/>}</article>)}</section>;
}
