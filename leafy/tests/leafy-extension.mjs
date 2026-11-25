import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('integration/chrome-extension/background.js','utf8');
const manifest=JSON.parse(fs.readFileSync('integration/chrome-extension/manifest.json','utf8'));
assert(manifest.optional_host_permissions.includes('https://*/*'));
assert(manifest.host_permissions.includes('https://leafy-0-1-live.bushy-flame-4467.chatgpt.site/*'),'extension must be allowed to contact the current Leafy app');
assert(source.includes("https://leafy-0-1-live.bushy-flame-4467.chatgpt.site"),'extension API origin must match the current Leafy app');
let settings,cookieTarget,frameProtected=false;
let listener,removed,connection,granted=true,protectedPage=false,domReads=0;
const requests=[],created=[],updates=[],inputs=[],tab={id:77,url:'about:blank',status:'complete'};
const chrome={
 runtime:{id:'test-extension',onMessage:{addListener(fn){listener=fn;}}},
 storage:{session:{async get(){return {connection};},async set(v){connection=v.connection;},async remove(){connection=undefined;}}},
 permissions:{async contains(){return granted;}},
 tabs:{async create(options){created.push(options);tab.url=options.url;return {...tab};},async get(){return {...tab};},async update(id,options){updates.push({id,...options});if(options.url)tab.url=options.url;return {...tab};},async remove(){},onRemoved:{addListener(fn){removed=fn;}}},
 debugger:{async attach(){},async detach(){},async sendCommand(...args){inputs.push(args);if(args[1]==='Page.captureScreenshot'){if(frameProtected)protectedPage=true;return {data:'/9j/AA=='};}},onDetach:{addListener(){}}},
 scripting:{async executeScript(options){domReads++;if(options.files)return [];if(String(options.func).includes('cookieCandidate'))return [{result:cookieTarget}];return [{result:protectedPage?{protected:true}:{protected:false,page:tab.url,title:'Example',text:'Public text',elements:[]}}];}},
 alarms:{async create(){},async clear(){},onAlarm:{addListener(){}}}
};
const context=vm.createContext({chrome,URL,Date,console,setInterval(){return 1;},clearInterval(){},setTimeout(fn){queueMicrotask(fn);},atob,Uint8Array,fetch:async(_,opts)=>{if(opts.body instanceof Uint8Array){requests.push({frame:true});return {ok:true};}const body=JSON.parse(opts.body);requests.push(body);const d=body.op==='exchange'?{id:'session-1',token:'test-token'}:body.op==='check'?{allowed:true}:body.op==='poll'?{control:'AGENT_CONTROL',settings}:{};return {ok:true,json:async()=>d};}});
vm.runInContext(source+'\nglobalThis.testPerform=perform;globalThis.testObserve=observe;globalThis.testCookies=cookieAutomation;globalThis.testFrame=captureFrame;',context);
const send=message=>new Promise((resolve,reject)=>listener(message,{id:'test-extension'},r=>r.error?reject(new Error(r.error)):resolve(r.value)));
const flush=async()=>{for(let n=0;n<30;n++)await Promise.resolve();};
grantTest: {
 granted=false;await assert.rejects(()=>send({op:'connect',code:'pair'}),/samlet adgang/i);assert.equal(created.length,0);
}
granted=true;await send({op:'connect',code:'pair'});await flush();
assert.equal(created.length,1);assert.equal(created[0].url,'about:blank');assert.equal(connection.tabId,77);assert.equal(requests.find(r=>r.op==='exchange').device,'Leafys Chrome');
assert.equal(domReads,0,'empty newly created browser must not need injection or a selected website');
await context.testPerform(connection,{action:'navigate',url:'https://example.com/'},'command-1');
assert.equal(tab.url,'https://example.com/');assert.equal(updates[0].id,77);assert(domReads>0);
await context.testPerform(connection,{action:'navigate',url:'https://another.example.org/'},'command-2');assert.equal(tab.url,'https://another.example.org/','new sites work without selecting a tab');
const before=updates.length;await assert.rejects(()=>context.testPerform(connection,{action:'navigate',url:'https://localhost/'},'bad'));assert.equal(updates.length,before);
protectedPage=true;await assert.rejects(()=>context.testPerform(connection,{action:'type',elementId:'x',text:'secret'},'protected'),/Beskyttet/);assert.equal(inputs.length,0);assert.equal(connection.control,'PROTECTED_HUMAN_CONTROL');assert(requests.some(r=>r.op==='device-control'&&r.control==='PROTECTED_HUMAN_CONTROL'));
await removed(77);assert.equal(connection,undefined);assert(requests.some(r=>r.op==='device-control'&&r.control==='DISCONNECTED'));
console.log('PASS: single all-sites consent, automatically created tab, blank readiness, cross-site navigation, private-host rejection, protected input stop and closed-tab revocation. Chrome API simulation; real Chrome installation still needs a device test.');

const c={id:'session-1',tabId:77,token:'test-token',control:'AGENT_CONTROL'};protectedPage=false;tab.url='https://cookies.example.org/';settings={autoCookies:true,cookieChoice:'necessary',viewUntil:Date.now()+10000};cookieTarget={label:'Reject all',x:10,y:10};
let count=inputs.length;await context.testCookies(c,{autoCookies:false});assert.equal(inputs.length,count,'cookie opt-out must issue no input');
await context.testCookies(c,settings);assert.equal(inputs.length,count+2);assert.equal(inputs.at(-2)[1],'Input.dispatchMouseEvent');
count=inputs.length;settings.autoCookies=false;tab.url='https://different.example.org/';await context.testCookies(c,{autoCookies:true,cookieChoice:'necessary'});assert.equal(inputs.length,count,'server opt-out must stop an already started check');
await context.testFrame(c,{viewUntil:0});assert.equal(inputs.length,count);
settings.viewUntil=Date.now()+10000;await context.testFrame(c,settings);assert(requests.some(r=>r.frame),'requested live screenshot uploaded');
count=inputs.length;protectedPage=true;await context.testCookies(c,{autoCookies:true,cookieChoice:'necessary'});await context.testFrame(c,settings);assert.equal(inputs.length,count,'protected pages issue no cookie or screenshot command');
console.log('PASS: cookie opt-out, server policy recheck, actual simulated CDP cookie click, opt-in live frame capture and protected-page capture stop.');
