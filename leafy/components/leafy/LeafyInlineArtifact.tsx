'use client';
import {useMemo,useState} from 'react';
import {Download,FolderOpen,Maximize2,X} from 'lucide-react';
import LeafyMessage from './LeafyMessage';
import {downloadArtifact,recordEvent} from '@/lib/leafy/client';
import {uploadFile} from '@/lib/leafy/upload-client';

type InlineArtifact={id:string;name:string;mime:string;content:string};
function isolatedDocument(source:string){
 const policy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
 const meta=`<meta http-equiv="Content-Security-Policy" content="${policy}">`;
 const baseStyle='<style>:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-synthesis:none;font-variant-numeric:tabular-nums}body{margin:0;font-family:inherit;line-height:1.5}*,*::before,*::after{box-sizing:border-box}button,input,select,textarea{font:inherit}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #b99846;outline-offset:2px}</style>';
 const doc=/<head(?:\s[^>]*)?>/i;
 return doc.test(source)?source.replace(doc,match=>`${match}<meta charset="utf-8">${meta}${baseStyle}`):`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${meta}${baseStyle}</head><body>${source}</body></html>`;
}
export default function LeafyInlineArtifact({artifact}:{artifact:InlineArtifact}){
 const [expanded,setExpanded]=useState(false),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState('');
 const srcDoc=useMemo(()=>isolatedDocument(artifact.content),[artifact.content]);
 const isHtml=artifact.mime==='text/html';
 async function save(){if(saving||saved)return;setSaving(true);setError('');try{const file=await uploadFile(new File([artifact.content],artifact.name,{type:artifact.mime}));setSaved(true);window.dispatchEvent(new CustomEvent('leafy-files-changed',{detail:{file}}));recordEvent({activity:{label:'Gemt i Filer',detail:artifact.name,status:'done'}});}catch(e){setError((e as Error).message||'Filen kunne ikke gemmes.');}finally{setSaving(false);}}
 return <section className={`leafy-inline-artifact${expanded?' is-expanded':''}`} aria-label={artifact.name}>
  <header><strong>{artifact.name.replace(/\.(html|md|markdown)$/i,'')}</strong><div>{saved?<span className="leafy-artifact-saved" role="status">Gemt i Filer</span>:<button type="button" disabled={saving} onClick={()=>void save()} aria-label={saving?'Gemmer fil':'Gem i Filer'} title={saving?'Gemmer…':'Gem i Filer'}>{saving?'…':<FolderOpen size={15}/>}</button>}{isHtml&&<button type="button" onClick={()=>setExpanded(v=>!v)} aria-label={expanded?'Luk stor forhåndsvisning':'Forstør forhåndsvisning'}>{expanded?<X size={15}/>:<Maximize2 size={15}/>}</button>}<button type="button" onClick={()=>downloadArtifact({id:artifact.id,name:artifact.name,mime:artifact.mime,content:artifact.content,createdAt:new Date().toISOString()})} aria-label="Hent fil"><Download size={15}/></button></div></header>
  {isHtml?<iframe title={artifact.name} sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" srcDoc={srcDoc}/>:<div className="leafy-inline-document"><LeafyMessage text={artifact.content}/></div>}
  {error&&<p className="leafy-artifact-error" role="alert">{error}</p>}
 </section>;
}
