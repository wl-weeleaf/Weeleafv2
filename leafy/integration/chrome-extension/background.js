const ORIGIN='https://leafy-0-1-live.bushy-flame-4467.chatgpt.site',API=ORIGIN+'/api/leafy/remote';
let running=false,timer,attached=null,lastFrame=0;const cookieAttempts=new Map();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function rpc(body,token){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});const data=await r.json();if(!r.ok){const error=new Error(data.error||'Forbindelsen svarede ikke.');error.status=r.status;throw error;}return data;}
async function data(){return (await chrome.storage.session.get('connection')).connection;}
async function save(c){await chrome.storage.session.set({connection:c});}
function urlAllowed(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||!u.hostname.includes('.')||/localhost|\.local$|\.internal$|^[\d.]+$/.test(u.hostname)||u.hostname===new URL(ORIGIN).hostname)throw new Error('Vælg en ekstern offentlig HTTPS-side.');return u;}
async function permission(url){const u=urlAllowed(url),origin=u.origin+'/*';if(!await chrome.permissions.contains({origins:[origin]}))throw new Error('Samlet websiteadgang er fjernet. Forbind udvidelsen igen med adgang til alle HTTPS-sider.');return u;}
async function attach(tabId){if(attached===tabId)return;if(attached!==null)await detach();await chrome.debugger.attach({tabId},'1.3');attached=tabId;}
async function detach(){if(attached!==null){const tabId=attached;attached=null;try{await chrome.debugger.detach({tabId});}catch{}}}
async function clearConnection(c,{closeTab=false}={}){await chrome.storage.session.remove('connection');if(timer)clearInterval(timer);timer=undefined;await chrome.alarms.clear('leafy-poll');await detach();if(closeTab&&Number.isInteger(c?.tabId)){try{await chrome.tabs.remove(c.tabId);}catch{}}}
async function inspect(c,action){
 const tab=await chrome.tabs.get(c.tabId);if(tab.url==='about:blank'&&!action)return {protected:false,page:'',title:'Leafys browser er klar',text:'',elements:[]};await permission(tab.url);await chrome.scripting.executeScript({target:{tabId:c.tabId},files:['dom.js']});
 const [result]=await chrome.scripting.executeScript({target:{tabId:c.tabId},func:(a)=>a?globalThis.__leafyDOM.target(a):globalThis.__leafyDOM.observe(),args:[action||null]});return result.result;
}
async function protectedStop(c){c.control='PROTECTED_HUMAN_CONTROL';await save(c);await detach();await rpc({op:'device-control',control:c.control},c.token);return {type:'chrome',sessionId:c.id,control:c.control};}
async function observe(c){const state=await inspect(c);if(state.protected)return protectedStop(c);return {type:'chrome',sessionId:c.id,control:'AGENT_CONTROL',...state,observedAt:new Date().toISOString()};}
async function perform(c,a,id){
 const verify=async()=>{const r=await rpc({op:'check',id},c.token);if(!r.allowed)throw new Error('Handlingen er annulleret eller pauset.');};await verify();
 const before=await observe(c);if(before.control!=='AGENT_CONTROL')throw new Error('Beskyttet trin. Brugeren skal overtage.');
 if(a.action==='navigate'){const u=await permission(a.url);await chrome.tabs.update(c.tabId,{url:u.href});await waitNavigation(c,id);}
 else if(a.action==='back')await chrome.tabs.goBack(c.tabId);
 else if(a.action==='forward')await chrome.tabs.goForward(c.tabId);
 else if(a.action==='scroll')await chrome.scripting.executeScript({target:{tabId:c.tabId},func:d=>window.scrollBy({top:d==='up'?-400:400,behavior:'instant'}),args:[a.direction]});
 else if(['click','type','select'].includes(a.action)){
  const target=await inspect(c,a);if(target.protected){await protectedStop(c);throw new Error('Beskyttet trin. Brugeren skal overtage.');}
  await attach(c.tabId);
  // Recheck after focusing, and immediately before any input.
  const recheck=await inspect(c);if(recheck.protected){await protectedStop(c);throw new Error('Beskyttet trin.');}
  await verify();
  if(a.action==='click'){
   await chrome.debugger.sendCommand({tabId:c.tabId},'Input.dispatchMouseEvent',{type:'mousePressed',x:target.x,y:target.y,button:'left',clickCount:1});
   await chrome.debugger.sendCommand({tabId:c.tabId},'Input.dispatchMouseEvent',{type:'mouseReleased',x:target.x,y:target.y,button:'left',clickCount:1});
  }else if(a.action==='type'){if(!target.focused)throw new Error('Tekstfeltet kunne ikke fokuseres.');await chrome.debugger.sendCommand({tabId:c.tabId},'Input.insertText',{text:String(a.text||'').slice(0,6000)});}
 }else if(a.action!=='observe')throw new Error('Handlingen understøttes ikke.');
 await sleep(500);return {ok:true,environment:await observe(c)};
}
async function cookieAutomation(c,policy){
 if(!policy?.autoCookies)return;const tab=await chrome.tabs.get(c.tabId);if(!tab.url?.startsWith('https://'))return;
 const state=await inspect(c);if(state.protected){await protectedStop(c);return;}
 const [item]=await chrome.scripting.executeScript({target:{tabId:c.tabId},func:choice=>globalThis.__leafyDOM.cookieCandidate(choice),args:[policy.cookieChoice]});
 const target=item?.result;if(!target)return;if(target.protected){await protectedStop(c);return;}
 const key=tab.url+'|'+target.label;if(Date.now()-(cookieAttempts.get(key)||0)<15000)return;
 const authority=await rpc({op:'poll',peek:true},c.token);if(authority.control!=='AGENT_CONTROL'||!authority.settings?.autoCookies||authority.settings.cookieChoice!==policy.cookieChoice)return;
 const check=await inspect(c);if(check.protected){await protectedStop(c);return;}
 const [fresh]=await chrome.scripting.executeScript({target:{tabId:c.tabId},func:choice=>globalThis.__leafyDOM.cookieCandidate(choice),args:[policy.cookieChoice]});
 if(fresh?.result?.protected){await protectedStop(c);return;}if(fresh?.result?.label!==target.label)return;Object.assign(target,fresh.result);
 cookieAttempts.set(key,Date.now());
 await chrome.debugger.sendCommand({tabId:c.tabId},'Input.dispatchMouseEvent',{type:'mousePressed',x:target.x,y:target.y,button:'left',clickCount:1});
 await chrome.debugger.sendCommand({tabId:c.tabId},'Input.dispatchMouseEvent',{type:'mouseReleased',x:target.x,y:target.y,button:'left',clickCount:1});
 await sleep(250);
}
async function captureFrame(c,policy){
 if(policy?.viewUntil<Date.now()||!policy?.viewUntil||Date.now()-lastFrame<1800)return;
 const before=await inspect(c);if(before.protected){await protectedStop(c);return;}const tab=await chrome.tabs.get(c.tabId);if(tab.url==='about:blank')return;
 const frame=await chrome.debugger.sendCommand({tabId:c.tabId},'Page.captureScreenshot',{format:'jpeg',quality:55,captureBeyondViewport:false});
 const after=await inspect(c);if(after.protected){await protectedStop(c);return;}
 const status=await rpc({op:'poll',peek:true},c.token);if(status.control!=='AGENT_CONTROL')return;
 const binary=atob(frame.data),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));if(bytes.length>350000)return;
 const result=await fetch(API+'/frame',{method:'POST',headers:{Authorization:'Bearer '+c.token,'Content-Type':'image/jpeg'},body:bytes});if(result.ok)lastFrame=Date.now();
}
async function tick(){
 if(running)return;running=true;let c;
 try{
  c=await data();if(!c?.token)return;
  // Poll without DOM data during human control. Server can revoke/pause at any time.
  const response=await rpc({op:'poll',peek:true},c.token);
  c.control=response.control;await save(c);
  if(c.control!=='AGENT_CONTROL'){await detach();return;}
  await attach(c.tabId);
  await cookieAutomation(c,response.settings);if(c.control!=='AGENT_CONTROL')return;
  const env=await observe(c);if(env.control!=='AGENT_CONTROL')return;c.error='';await save(c);
  const current=await rpc({op:'poll',environment:env},c.token),command=current.command;
  if(current.control!=='AGENT_CONTROL'){c.control=current.control;await save(c);await detach();return;}
  if(command){let result;try{result=await perform(c,command.payload,command.id);}catch(e){result={error:e.message};}try{await rpc({op:'result',id:command.id,result},c.token);}catch{} }
  try{await captureFrame(c,current.settings);}catch(e){c.error='Livevisning: '+e.message;await save(c);}
 }catch(e){if(c){if(e.status===422&&/udløbet eller afbrudt|forbindelsen kræver en enhedsnøgle/i.test(e.message)){await clearConnection(c,{closeTab:true});}else{c.error=e.message;c.control='DISCONNECTED';await save(c);}}await detach();}finally{running=false;}
}
async function waitNavigation(c,id){for(let n=0;n<18;n++){await sleep(500);const allowed=await rpc({op:'check',id},c.token);if(!allowed.allowed)throw new Error('Handlingen er annulleret eller pauset.');const tab=await chrome.tabs.get(c.tabId);if(tab.status==='complete')return;}throw new Error('Siden indlæser stadig. Leafy aflæser den igen, når den er klar.');}
function start(){if(timer)clearInterval(timer);timer=setInterval(()=>void tick(),1200);void chrome.alarms.create('leafy-poll',{periodInMinutes:.5});void tick();}
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='leafy-poll')start();});
chrome.debugger.onDetach.addListener(async(source)=>{if(source.tabId!==attached)return;attached=null;const c=await data();if(c){c.control='PAUSED';await save(c);try{await rpc({op:'device-control',control:'PAUSED'},c.token);}catch{}}});
chrome.tabs.onRemoved.addListener(async(tabId)=>{const c=await data();if(!c||c.tabId!==tabId)return;await detach();try{await rpc({op:'device-control',control:'DISCONNECTED'},c.token);}catch{}await chrome.storage.session.remove('connection');clearInterval(timer);await chrome.alarms.clear('leafy-poll');});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id)return false;
 (async()=>{
  if(message.op==='status'){const c=await data();return c?{id:c.id,tabId:c.tabId,control:c.control,error:c.error}:null;}
  if(message.op==='connect'){
   if((await data())?.token)throw new Error('Afbryd den eksisterende forbindelse før ny parring.');
   if(!await chrome.permissions.contains({origins:['https://*/*']}))throw new Error('Giv samlet adgang til alle HTTPS-sider først.');
   const paired=await rpc({op:'exchange',code:message.code,device:'Leafys Chrome'});let tab;
   try{tab=await chrome.tabs.create({url:'about:blank',active:false});await attach(tab.id);await save({...paired,tabId:tab.id,control:'AGENT_CONTROL',schemaVersion:2});}catch(e){await detach();try{await rpc({op:'device-control',control:'DISCONNECTED'},paired.token);}catch{}if(tab?.id)try{await chrome.tabs.remove(tab.id);}catch{}throw e;}
   start();return {ok:true};
  }
  const c=await data();if(!c)throw new Error('Ingen forbindelse.');
  if(message.op==='show'){await chrome.tabs.update(c.tabId,{active:true});return {ok:true};}
  if(message.op==='control'){
   const control=message.control==='AGENT_CONTROL'?'AGENT_CONTROL':message.control==='DISCONNECTED'?'DISCONNECTED':'PROTECTED_HUMAN_CONTROL';
   if(control==='AGENT_CONTROL'){const check=await inspect(c);if(check.protected)throw new Error('Afslut det beskyttede trin før Leafy fortsætter.');}
   await rpc({op:'device-control',control},c.token);c.control=control;c.error='';await save(c);
   if(control!=='AGENT_CONTROL')await detach();if(control==='DISCONNECTED'){await clearConnection(c,{closeTab:true});}else start();return {ok:true};
  }
  throw new Error('Ukendt handling.');
 })().then(value=>respond({value})).catch(e=>respond({error:e.message}));return true;
});
void data().then(async c=>{if(!c)return;if(c.schemaVersion!==2){c.control='PAUSED';c.error='Opdateret til 0.2. Afbryd og forbind igen med samlet websiteadgang.';await save(c);try{await rpc({op:'device-control',control:'PAUSED'},c.token);}catch{}return;}start();});
