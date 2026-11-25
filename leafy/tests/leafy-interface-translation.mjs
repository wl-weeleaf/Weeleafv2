import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const label={data:'Til rummet',isConnected:true,parentElement:{closest:()=>false}};
const chat={data:'Min samtale skal ikke oversættes',isConnected:true,parentElement:{closest:()=>true}};
const handlers=new Map(),timers=new Map(),pending=[],saved=new Map([['leafy-interface-language-manual','true'],['leafy-interface-language','pt']]);let timerId=0,cleanup;
const storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
const context=vm.createContext({exports:{},useEffect:fn=>cleanup=fn(),AbortController,Map,Set,console,localStorage:storage,
 document:{body:{},documentElement:{lang:'da'},querySelectorAll:()=>[],createTreeWalker:()=>{let i=0;return{nextNode:()=>[label,chat][i++]||null}}},
 NodeFilter:{SHOW_TEXT:4},MutationObserver:class{observe(){}disconnect(){}},
 window:{addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name)},
 setTimeout:fn=>{timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id),
 fetch:(_url,options)=>new Promise(resolve=>pending.push({options,resolve}))
});
const source=fs.readFileSync('components/leafy/AutoInterfaceTranslation.tsx','utf8').replace("import {useEffect} from 'react';",'');
vm.runInContext(ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}),context);
context.exports.default();
const runTimer=()=>{const list=[...timers.values()];timers.clear();for(const fn of list)fn();};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
runTimer();assert.equal(pending.length,1);
assert.deepEqual(JSON.parse(pending[0].options.body).strings,['Til rummet']);
handlers.get('leafy:set-interface-language')({detail:{language:'en'}});assert.equal(pending[0].options.signal.aborted,true);runTimer();
assert.equal(pending.length,2);
pending[1].resolve({ok:true,json:async()=>({translations:['To the room']})});await flush();
assert.equal(label.data,'To the room');
// A provider may finish after abort; the old response must not reach DOM or caches.
pending[0].resolve({ok:true,json:async()=>({translations:['Para a sala']})});await flush();
assert.equal(label.data,'To the room');assert.equal(saved.has('leafy-ui-translation-v2-pt'),false);
assert.equal(JSON.parse(saved.get('leafy-ui-translation-v2-en'))['Til rummet'],'To the room');
assert.equal(chat.data,'Min samtale skal ikke oversættes');
handlers.get('leafy:set-interface-language')({detail:{language:'da'}});assert.equal(label.data,'Til rummet');assert.equal(context.document.documentElement.lang,'da');
cleanup();console.log('PASS: stale Portuguese response discarded, correct language cache, conversation text excluded and Danish labels restored.');
