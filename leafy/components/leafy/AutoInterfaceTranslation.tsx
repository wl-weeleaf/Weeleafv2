'use client';
import {useEffect} from 'react';

type TextRecord={node:Text;source:string};
type AttributeRecord={element:Element;name:'placeholder'|'title'|'aria-label';source:string};
const EVENT='leafy:detected-language';
const SET_EVENT='leafy:set-interface-language';
const MANUAL_KEY='leafy-interface-language-manual';
const LAST_DETECTED_KEY='leafy-interface-language-last-detected';
const SKIP='.room-chat-message,.room-floating-feed,.room-feed-stack,.room-live-transcript,.room-chat-live-transcript,.message,.skill-card,.skill-content,.skill-editor,.skill-detail-body,.workspace-file-preview,.live-history-entry,[role="log"],article,pre,code,script,style,svg,canvas,[contenteditable="true"],[data-user-content],[data-leafy-private],[data-no-auto-translate]';

export default function AutoInterfaceTranslation(){
 useEffect(()=>{
  const originals=new Map<Text,string>(),attributeOriginals=new Map<Element,Map<AttributeRecord['name'],string>>(),cacheByLanguage=new Map<string,Record<string,string>>(),inflight=new Map<string,AbortController>();
  let language='',revision=0,disposed=false,manual=false,timer:ReturnType<typeof setTimeout>|undefined,writing=false,lastAutoCandidate='',autoCandidateCount=0;
  const cacheKey=(code:string)=>`leafy-ui-translation-v2-${code}`;
  const loadCache=(code:string)=>{if(cacheByLanguage.has(code))return cacheByLanguage.get(code)!;let value:Record<string,string>={};try{const parsed=JSON.parse(localStorage.getItem(cacheKey(code))||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))value=parsed;}catch{}cacheByLanguage.set(code,value);return value;};
  const connectObserver=()=>{if(document.body&&observer)observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});};
  const eligible=(node:Text)=>{const parent=node.parentElement;if(!parent||!node.isConnected||parent.closest(SKIP))return false;const text=node.data.trim();return !!text&&text.length<=320&&!/^https?:\/\//i.test(text);};
  const collect=(cache:Record<string,string>)=>{const out:TextRecord[]=[];if(!document.body)return out;for(const node of originals.keys())if(!node.isConnected)originals.delete(node);const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node:Node|null;while((node=walker.nextNode())){const text=node as Text;if(!eligible(text))continue;const previous=originals.get(text);if(!previous)originals.set(text,text.data);else{const leading=previous.match(/^\s*/)?.[0]||'',trailing=previous.match(/\s*$/)?.[0]||'',expected=cache[previous.trim()]?leading+cache[previous.trim()]+trailing:'';if(text.data!==previous&&text.data!==expected)originals.set(text,text.data);}out.push({node:text,source:originals.get(text)!});}return out;};
  const collectAttributes=(cache:Record<string,string>)=>{const out:AttributeRecord[]=[];if(!document.body)return out;for(const element of document.querySelectorAll('[placeholder],[title],[aria-label]')){if(element.closest(SKIP))continue;const values=attributeOriginals.get(element)||new Map<AttributeRecord['name'],string>();for(const name of ['placeholder','title','aria-label'] as const){const current=element.getAttribute(name);if(!current||current.length>320)continue;const previous=values.get(name);if(!previous)values.set(name,current);else if(current!==previous&&current!==cache[previous])values.set(name,current);out.push({element,name,source:values.get(name)!});}if(values.size)attributeOriginals.set(element,values);}for(const element of attributeOriginals.keys())if(!element.isConnected)attributeOriginals.delete(element);return out;};
  const translate=async()=>{
   if(disposed||!language||language==='da'||inflight.has(language))return;
   const requestedLanguage=language,requestedRevision=revision,controller=new AbortController();
   const current=()=>!disposed&&!controller.signal.aborted&&language===requestedLanguage&&revision===requestedRevision;
   const cache=loadCache(requestedLanguage),records=collect(cache),attributes=collectAttributes(cache),unknown=[...new Set([...records.map(record=>record.source.trim()),...attributes.map(record=>record.source.trim())].filter(text=>text&&!cache[text]))];
   inflight.set(requestedLanguage,controller);
   try{
    for(let offset=0;offset<unknown.length;offset+=55){
     if(!current())return;const batch=unknown.slice(offset,offset+55);
     const response=await fetch('/api/livi/translate-interface',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:requestedLanguage,strings:batch}),cache:'no-store',signal:controller.signal});
     if(!current())return;if(!response.ok)continue;
     const data=await response.json() as {translations?:unknown};if(!current())return;
     const translations=Array.isArray(data.translations)?data.translations as unknown[]:null;if(!translations||translations.length!==batch.length)continue;
     batch.forEach((text,index)=>{const translated=translations[index];if(typeof translated==='string'&&translated.trim())cache[text]=translated;});
    }
    if(!current())return;
    try{localStorage.setItem(cacheKey(requestedLanguage),JSON.stringify(cache));}catch{}
    writing=true;observer?.disconnect();
    for(const {node,source} of records){if(!node.isConnected||!cache[source.trim()])continue;const leading=source.match(/^\s*/)?.[0]||'',trailing=source.match(/\s*$/)?.[0]||'',translated=leading+cache[source.trim()]+trailing;if(node.data!==translated)node.data=translated;}
    for(const {element,name,source} of attributes)if(element.isConnected&&cache[source])element.setAttribute(name,cache[source]);
    connectObserver();writing=false;
   }catch{ /* Keep the original labels when translation is unavailable. */ }
   finally{if(inflight.get(requestedLanguage)===controller)inflight.delete(requestedLanguage);}
  };
  const schedule=()=>{if(writing)return;if(timer)clearTimeout(timer);timer=setTimeout(()=>void translate(),450);};
  const changeLanguage=(raw:string,explicit=false)=>{const next=raw.toLowerCase().split('-')[0];if(!/^[a-z]{2,3}$/.test(next))return;if(explicit){manual=true;try{localStorage.setItem(MANUAL_KEY,'true');}catch{}}if(next===language)return;revision++;for(const controller of inflight.values())controller.abort();inflight.clear();language=next;document.documentElement.lang=next;try{localStorage.setItem('leafy-interface-language',next);}catch{}writing=true;observer?.disconnect();for(const [node,source] of originals)if(node.isConnected)node.data=source;for(const [element,values] of attributeOriginals)if(element.isConnected)for(const [name,source] of values)element.setAttribute(name,source);connectObserver();writing=false;schedule();};
  const observer=new MutationObserver(schedule);connectObserver();
  const handleDetected=(event:Event)=>{const detail=(event as CustomEvent<{language?:string}>).detail;if(detail?.language){const detected=detail.language.toLowerCase().split('-')[0];if(!/^(da|en|pt|de|fr|es|it|nl|sv|no|fi|uk|pl)$/.test(detected))return;if(detected===lastAutoCandidate)autoCandidateCount++;else{lastAutoCandidate=detected;autoCandidateCount=1;}if(autoCandidateCount<2)return;try{localStorage.setItem(LAST_DETECTED_KEY,detected);}catch{}if(!manual)changeLanguage(detected);}};
  const handleSet=(event:Event)=>{const detail=(event as CustomEvent<{language?:string;manual?:boolean}>).detail;if(detail?.language==='auto'){manual=false;lastAutoCandidate='';autoCandidateCount=0;try{localStorage.removeItem(MANUAL_KEY);}catch{}changeLanguage('da');return;}if(detail?.language)changeLanguage(detail.language,detail.manual!==false);};
  window.addEventListener(EVENT,handleDetected);window.addEventListener(SET_EVENT,handleSet);
  try{manual=localStorage.getItem(MANUAL_KEY)==='true';const saved=manual?localStorage.getItem('leafy-interface-language'):null;changeLanguage(saved||'da');}catch{changeLanguage('da');}
  return()=>{disposed=true;revision++;for(const controller of inflight.values())controller.abort();inflight.clear();window.removeEventListener(EVENT,handleDetected);window.removeEventListener(SET_EVENT,handleSet);observer?.disconnect();if(timer)clearTimeout(timer);};
 },[]);
 return null;
}
