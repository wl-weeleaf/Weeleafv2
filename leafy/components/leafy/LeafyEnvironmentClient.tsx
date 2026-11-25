'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter,usePathname} from 'next/navigation';
import {protectedLabel,type Environment,type ControlState,type UIAction} from '@/lib/leafy/environment';
import {recordEvent} from '@/lib/leafy/client';
import './remote.css';
export default function LeafyEnvironmentClient(){
 const pathname=usePathname(),isLive=pathname.startsWith('/leafy-live'),router=useRouter(),[mode,setMode]=useState<ControlState>('AGENT_CONTROL'),modeRef=useRef<ControlState>('AGENT_CONTROL'),session=useRef('');
 useEffect(()=>{
  if(isLive)return;
  const key='leafy-platform-session';session.current=sessionStorage.getItem(key)||crypto.randomUUID();sessionStorage.setItem(key,session.current);
  let stopped=false,busy=false,timer:ReturnType<typeof setTimeout>|undefined;const ids=new WeakMap<Element,string>(),elements=new Map<string,HTMLElement>();
  const excluded=(el:Element)=>!!el.closest('[data-leafy-private],[data-leafy-no-control],[aria-hidden="true"],[hidden]')||protectedLabel((el.getAttribute('aria-label')||'')+' '+(el.getAttribute('name')||'')+' '+(el.getAttribute('type')||''));
  const visible=(el:HTMLElement)=>el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden'&&!el.hasAttribute('disabled');
  function snapshot():Environment{
   elements.clear();const env:Environment={type:'leafy-platform',sessionId:session.current,page:location.href,title:document.title,control:modeRef.current,elements:[],text:'',observedAt:new Date().toISOString()};
   if(modeRef.current==='AGENT_CONTROL'){
    for(const node of document.querySelectorAll<HTMLElement>('button,a[href],input:not([type=password]):not([type=hidden]),textarea,select,[role=button]')){
     if(excluded(node)||!visible(node))continue;
     const label=(node.getAttribute('aria-label')||node.getAttribute('placeholder')||node.innerText||node.getAttribute('title')||node.getAttribute('name')||'').trim().slice(0,160);
     if(!label||protectedLabel(label)||/godkend|approve|tillad|permission|slet|delete|køb|purchase|send besked|mikrofon|kamera|camera|tal med leafy|diktér|stop diktering/i.test(label))continue;
     let id=ids.get(node);if(!id){id='el_'+crypto.randomUUID().replaceAll('-','');ids.set(node,id);}elements.set(id,node);
     env.elements.push({id,role:node.getAttribute('role')||node.tagName.toLowerCase(),label,...(node instanceof HTMLAnchorElement?{href:node.href}:{}),...(node instanceof HTMLInputElement?{type:node.type}:{})});if(env.elements.length>=100)break;
    }
    env.text=Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,[data-leafy-context]')).filter(e=>!excluded(e)&&visible(e)).map(e=>e.innerText.slice(0,300)).join('\n').slice(0,5000);
   }else{env.page='';env.title='';}
   (window as unknown as {leafyEnvironment:Environment}).leafyEnvironment=env;window.dispatchEvent(new CustomEvent('leafy-environment',{detail:env}));return env;
  }
  async function rpc(body:unknown){const r=await fetch('/api/leafy/environment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json() as {error?:string;command?:{id:string;payload:UIAction}};if(!r.ok)throw new Error(data.error);return data;}
  async function execute(a:UIAction){
   if(modeRef.current!=='AGENT_CONTROL')throw new Error('Brugeren har overtaget kontrollen.');snapshot();
   if(a.action==='navigate'){
    const url=new URL(a.url||'',location.href);if(url.origin!==location.origin||!['/','/studio','/orb','/watch'].includes(url.pathname))throw new Error('Denne side er ikke en del af Leafys platform.');router.push(url.pathname+url.search);
   }else if(['click','type','select'].includes(a.action)){
    const el=elements.get(a.elementId||'');if(!el||excluded(el)||!visible(el)||(a.expectedLabel&&a.expectedLabel!==(el.getAttribute('aria-label')||el.getAttribute('placeholder')||el.innerText||el.getAttribute('title')||el.getAttribute('name')||'').trim().slice(0,160)))throw new Error('Elementet er ændret eller utilgængeligt. Observer igen.');
    if(el instanceof HTMLAnchorElement&&new URL(el.href).origin!==location.origin)throw new Error('Eksterne links åbnes via browserfunktionen.');
    if(a.action==='click')el.click();
    else if(a.action==='select'&&el instanceof HTMLSelectElement){if(!Array.from(el.options).some(o=>o.value===a.text))throw new Error('Valget findes ikke.');el.value=a.text||'';el.dispatchEvent(new Event('change',{bubbles:true}));}
    else if(a.action==='type'&&(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)){
     const proto=el instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLTextAreaElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')?.set?.call(el,a.text||'');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
    }else throw new Error('Handlingen passer ikke til elementet.');
   }else if(a.action==='scroll')window.scrollBy({top:a.direction==='up'?-400:400,behavior:'instant'});
   else if(a.action==='back')router.back();else if(a.action==='forward')router.forward();
   await new Promise(r=>setTimeout(r,350));return {ok:true,environment:snapshot()};
  }
  const update=()=>{if(timer)clearTimeout(timer);timer=setTimeout(snapshot,200);};const observer=new MutationObserver(update);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','aria-hidden','disabled']});snapshot();
  async function poll(){if(stopped||busy||document.hidden||modeRef.current!=='AGENT_CONTROL')return;busy=true;try{const data=await rpc({sessionId:session.current,op:'poll'});if(data.command){let result;try{result=await execute(data.command.payload);recordEvent({state:'acting',activity:{label:'Platformhandling udført',detail:data.command.payload.action,status:'done'}});}catch(e){result={error:(e as Error).message};}await rpc({sessionId:session.current,op:'result',id:data.command.id,result});}}catch{}finally{busy=false;}}
  const interval=setInterval(()=>void poll(),1000);
  const events=(e:Event)=>{const item=(e as CustomEvent).detail;if(item?.control&&item.control!=='AGENT_CONTROL'){modeRef.current=item.control;setMode(item.control);snapshot();}};window.addEventListener('leafy-event',events);
  return()=>{stopped=true;clearInterval(interval);if(timer)clearTimeout(timer);observer.disconnect();window.removeEventListener('leafy-event',events);};
 },[router,isLive]);
 async function toggle(){const next=modeRef.current==='AGENT_CONTROL'?'PROTECTED_HUMAN_CONTROL':'AGENT_CONTROL';try{const r=await fetch('/api/leafy/environment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'control',sessionId:session.current,control:next})});if(!r.ok)throw new Error();modeRef.current=next;setMode(next);const env=(window as unknown as {leafyEnvironment?:Environment}).leafyEnvironment;if(env){env.control=next;env.elements=[];env.text='';env.page='';env.title='';}recordEvent({activity:{label:next==='AGENT_CONTROL'?'Leafy fortsætter':'Du har overtaget platformen',status:next==='AGENT_CONTROL'?'done':'waiting'}});}catch{recordEvent({activity:{label:'Kontrollen kunne ikke ændres',status:'blocked'}});}}
 if(isLive)return null;
 return <button data-leafy-private className={`leafy-takeover ${mode!=='AGENT_CONTROL'?'paused':''}`} onClick={()=>void toggle()} aria-pressed={mode!=='AGENT_CONTROL'}>{mode==='AGENT_CONTROL'?'Overtag kontrollen':'Fortsæt Leafy'}</button>;
}
