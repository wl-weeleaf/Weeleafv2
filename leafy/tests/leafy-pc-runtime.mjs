import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import ts from 'typescript';
const compile=s=>ts.transpile(s,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS});
const load=path=>{const c=vm.createContext({exports:{},URL,crypto});vm.runInContext(compile(fs.readFileSync(path,'utf8')),c);return c.exports;};
const {validatePCAction}=load('lib/leafy/pc-action.ts'),{permissionFor}=load('lib/leafy/actions.ts'),{DEFAULT_PERMISSIONS,enforcePermissionFloor}=load('lib/leafy/core.ts'),{ChatStreamParser}=load('lib/livi/protocol.ts');
const pc={id:crypto.randomUUID(),device:'My PC',control:'AGENT_CONTROL',capabilities:{}};const events=[],saved=new Map(),executed=[];let modelCalls=0;
const context=vm.createContext({exports:{},process:{env:{}},URL,crypto,Response,TextDecoder,DEFAULT_PERMISSIONS,enforcePermissionFloor,permissionFor,validatePCAction,ChatStreamParser,
 cleanEnvironment:e=>e||null,sessions:async(_owner,kind)=>kind==='pc'?[pc]:[],
 pcConnectionStatus:async()=>({connected:true,device:pc}),resolvePCSession:async(_owner,id)=>{assert(!id||id===pc.id);return pc},
 waitAction:async(...args)=>{executed.push(args);return{implemented:true}},
 saveApproval:async(owner,id,approval)=>saved.set(id,{owner,approval}),takeApproval:async(owner,id)=>{const item=saved.get(id);if(!item||item.owner!==owner)throw Error('used');saved.delete(id);return item.approval},
 aiConfig:()=>({configured:true,model:'corti-s1-instant',provider:'corti'}),elevenLabsCredentials:()=>({configured:false}),normalizeLeafyCore:()=>({skills:[]}),LOCKED_MASTER_SKILLS:[],createLeafySystemMessage:()=>'',contextExcerpt:s=>s,skillContext:()=>'',attachmentContext:async()=>({text:'',images:[]}),fitRequest:x=>x,
 modelFetch:async()=>{modelCalls++;const call={index:0,id:'call_1',function:{name:'pc_action',arguments:JSON.stringify({action:'implement',files:[{path:'hello.txt',content:'Hej Leafy'}]})}};return new Response('data: '+JSON.stringify({choices:[{delta:{tool_calls:[call]},finish_reason:'tool_calls'}]})+'\n\ndata: [DONE]\n\n');}
});
const source=fs.readFileSync('lib/leafy/runtime.ts','utf8').replace(/^import .*?;\n/gm,'');vm.runInContext(compile(source),context);const runtime=context.exports;
const pcOnly=runtime.tools(null,false,true,false).map(t=>t.function.name);
assert(pcOnly.includes('pc_action'));assert(!pcOnly.includes('navigate'));assert(!pcOnly.includes('click_element'));assert(!pcOnly.includes('type_element'));
const pcSchema=runtime.tools(null,false,true,false).find(t=>t.function.name==='pc_action').function.parameters.properties.action.enum;
assert(pcSchema.includes('project_scripts'));assert(pcSchema.includes('run_script'));assert(pcSchema.includes('install_dependencies'));
const disconnected=runtime.tools(null,false,false,false);assert(disconnected.some(t=>t.function.name==='pc_action'),'status remains callable while disconnected');
assert.deepEqual(Array.from(disconnected.find(t=>t.function.name==='pc_action').function.parameters.required),['action']);
const emit=e=>events.push(e);
assert.equal((await runtime.guardedAction('owner','observe_environment',{target:'pc'},{},emit)).connected,true);
assert.equal(saved.size,0);assert.equal(executed.length,0);
await assert.rejects(()=>runtime.executeAction('owner','observe_environment',{target:'platform'},emit),/siger ikke noget om PC/);
await runtime.guardedAction('owner','pc_action',{action:'list',path:'.'},{},emit);assert.equal(executed[0][1],pc.id);assert.equal(saved.size,0);
const before=executed.length;
const blocked=await runtime.guardedAction('owner','pc_action',{action:'implement',files:[{path:'app.txt',content:'Hej'}]},{permissions:[{id:'pc-control',mode:'block'}]},emit);
assert.equal(blocked.blocked,true);assert.equal(saved.size,0);assert.equal(executed.length,before);
const answer=await runtime.runAgent({messages:[{role:'user',content:'Byg filen på min PC'}]},null,'owner',emit,new AbortController().signal);
assert.equal(modelCalls,1,'pending approval ends the model tool loop');assert.equal(saved.size,1);assert.equal(executed.length,before);assert.match(answer,/godkendelse/);
const id=[...saved.keys()][0];assert.equal(saved.get(id).approval.args.sessionId,pc.id,'approval binds the actual paired device');
await runtime.approveAction('owner',id,emit,null,{});assert.equal(executed.length,before+1);assert.equal(saved.size,0);
await assert.rejects(()=>runtime.approveAction('owner',id,emit,null,{}));assert.equal(executed.length,before+1);
const scriptProposal=await runtime.guardedAction('owner','pc_action',{action:'run_script',path:'.',script:'build'},{},emit);
assert.equal(scriptProposal.waitingForApproval,true);assert.equal(saved.size,1);
const scriptApproval=[...saved.keys()][0];assert.match(saved.get(scriptApproval).approval.label,/Kør scriptet “build”/);
await runtime.approveAction('owner',scriptApproval,emit,null,{});assert.equal(executed.length,before+2);assert.equal(saved.size,0);
const depsProposal=await runtime.guardedAction('owner','pc_action',{action:'install_dependencies',path:'app'},{},emit);
assert.equal(depsProposal.waitingForApproval,true);assert.equal(saved.size,1);
console.log('PASS: PC-only tool routing, status without approval, explicit BLOCK, one implementation proposal and one execution after approval.');
