import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compiled=p=>ts.transpile(fs.readFileSync(p,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const moduleOf=s=>import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'));
const {loadArchive,retrieveContext,searchConversations}=await moduleOf(compiled('lib/leafy/conversations.ts'));
const message=(id,content,role='user',visuals)=>({id,role,content,complete:true,...(visuals?{visuals}:{})});
const conversation=(id,messages,date='2026-10-06T18:00:00Z')=>({id,title:'Samtale '+id,createdAt:date,updatedAt:date,messages});
test('Existing history migrates intact; multiple conversations survive reload without the old 40-message cutoff',()=>{
 const legacy=Array.from({length:65},(_,i)=>message('m'+i,'Besked '+i));const migrated=loadArchive(null,JSON.stringify(legacy));assert.equal(migrated.conversations[0].messages.length,65);
 const second=conversation('second',[message('n','Et nyt projekt')]);migrated.conversations.push(second);migrated.activeId=second.id;
 const restored=loadArchive(JSON.stringify(migrated),null);assert.equal(restored.activeId,'second');assert.equal(restored.conversations.length,2);assert.equal(restored.conversations[0].messages[0].content,'Besked 0');
});
test('Cross-conversation retrieval finds a previous topic with title and date; opt-out and deletion remove it',()=>{
 const old=conversation('budget',[message('a','Hampbudgettet er 5760 kroner.'),message('b','Tekstiler til brylluppet.','assistant')]);const active=conversation('current',[]);
 const context=retrieveContext([active,old],active.id,'Hvad var hampbudgettet?',true);assert.match(context,/5760/);assert.match(context,/Samtale budget/);assert.match(context,/2026-10/);
 assert.equal(retrieveContext([active,old],active.id,'hampbudgettet',false),'');assert.equal(retrieveContext([active],active.id,'hampbudgettet',true),'');assert.equal(searchConversations([old],'hampbudgettet').length,1);
});
test('Retrieval excludes already supplied recent messages, retrieves older active context and respects the 12000-character budget',()=>{
 const active=conversation('active',[message('old','Hamp bliver en grøn tråd.'),...Array.from({length:20},(_,i)=>message('recent'+i,'Nyt emne '+i))]);
 const others=Array.from({length:30},(_,i)=>conversation('c'+i,[message('x'+i,'hamp '.repeat(1200))]));
 const context=retrieveContext([active,...others],active.id,'hamp',true);assert.ok(context.length<=12000);assert.match(context,/grøn tråd/);assert.equal(retrieveContext([active],active.id,'Nyt emne',true).includes('recent19'),false);
});
test('A reference to the previous conversation finds its last messages without topic keywords',()=>{
 const active=conversation('active',[]),previous=conversation('previous',[message('p','Beslutningen var at afprøve kameraet.')]);assert.match(retrieveContext([active,previous],active.id,'Hvad talte vi om sidst?',true),/afprøve kameraet/);
});
test('A short follow-up keeps the just-built app in the active chat and excludes fuzzy matches from other chats',()=>{
 const bingo={id:'bingo-app',name:'Julebingo.html',mime:'text/html',content:'Julebingo med 16 felter, tilfældige plader og markering på mobil.'};
 const active=conversation('julefrokost',[message('ask','Kan vi lave en julebingo-app?'),message('built','Her er julebingo-appen med tilfældige plader.','assistant',[bingo]),message('followup','Men hvordan virker det så i praksis?')]);
 const unrelated=conversation('hamp',[message('old','I praksis virker hamp-dugen sådan her; beregneren viser dækningsbidraget.')]);
 for(const query of ['Men hvordan virker det så i praksis?','Nej, den app du lige har lavet til julebingo']){const context=retrieveContext([active,unrelated],active.id,query,true);assert.match(context,/Julebingo\.html/);assert.match(context,/tilfældige plader/);assert.doesNotMatch(context,/hamp-dugen|dækningsbidrag/);}
});
const protocol=await moduleOf(compiled('lib/livi/protocol.ts'));globalThis.__leafyTestParser=protocol.ChatStreamParser;const masterUrl='data:text/javascript;base64,'+Buffer.from(compiled('lib/livi/master-skills.ts')).toString('base64');const coreSource=compiled('lib/livi/core.ts').replace(/from ['"]\.\/master-skills['"]/,`from '${masterUrl}'`);globalThis.__leafyCore=await moduleOf(coreSource);globalThis.__leafyMaster=await moduleOf(compiled('lib/livi/master-skills.ts'));globalThis.__leafySkills=await moduleOf(compiled('lib/leafy/skill-context.ts'));globalThis.__leafyBudget=await moduleOf(compiled('lib/leafy/request-budget.ts'));
const source=compiled('lib/leafy/runtime.ts').replace(/^import .*?;\s*$/gm,'');
const runtime=await moduleOf(`const aiConfig=()=>({configured:true,provider:globalThis.__leafyTestProvider||'custom',model:'test'}),elevenLabsCredentials=()=>({configured:false}),cleanEnvironment=()=>null,sessions=async()=>[],attachmentContext=async()=>({text:'',images:[]}),createLeafySystemMessage=globalThis.__leafyCore.createLeafySystemMessage,normalizeLeafyCore=globalThis.__leafyCore.normalizeLeafyCore,skillContext=globalThis.__leafySkills.skillContext,contextExcerpt=globalThis.__leafyBudget.contextExcerpt,fitRequest=globalThis.__leafyBudget.fitRequest,LEAFY_PERSONA='',LOCKED_MASTER_SKILLS=globalThis.__leafyMaster.LOCKED_MASTER_SKILLS,ChatStreamParser=globalThis.__leafyTestParser,modelFetch=(...a)=>globalThis.__leafyModelFetch(...a);\n`+source);
const reply=(text,reason='stop',extra={})=>new Response(`data: ${JSON.stringify({choices:[{delta:{content:text,...extra},finish_reason:reason}]})}\n\ndata: [DONE]\n\n`);
test('A response ending in length is continued, with preserved text and bounded model calls',async()=>{
 const payloads=[],events=[];globalThis.__leafyModelFetch=async(_,p)=>{payloads.push(structuredClone(p));return payloads.length===1?reply('Første del. ','length'):reply('Anden del.');};
 const result=await runtime.runAgent({messages:[{role:'user',content:'Forklar grundigt'}],conversationContext:'Tidligere projekt: hamp'},null,'owner',e=>events.push(e),new AbortController().signal);
 assert.equal(result,'Første del. Anden del.');assert.equal(payloads.length,2);assert.equal(payloads[0].max_tokens,6000);assert(payloads[0].messages.some(m=>String(m.content).includes('Tidligere projekt')));assert.match(payloads[1].messages.at(-1).content,/Fortsæt/);assert.equal(events.filter(e=>'text'in e).map(e=>e.text).join(''),result);
});
test('Repeated length endings stop after two continuations with an explicit error, never a false complete response',async()=>{
 let calls=0;globalThis.__leafyModelFetch=async()=>{calls++;return reply('Afkortet tekst. ','length');};await assert.rejects(()=>runtime.runAgent({messages:[{role:'user',content:'Lang forklaring'}]},null,'owner',()=>{},new AbortController().signal),/længdegrænse/);assert.equal(calls,3);
});
test('Truncated tool arguments are not executed or treated as a completed answer',async()=>{
 let calls=0;globalThis.__leafyModelFetch=async()=>{calls++;return reply('','length',{tool_calls:[{index:0,id:'t',function:{name:'create_document',arguments:'{"name":'}}]});};await assert.rejects(()=>runtime.runAgent({messages:[{role:'user',content:'Skriv et dokument'}]},null,'owner',()=>{},new AbortController().signal),/Ingen af de afkortede handlinger/);assert.equal(calls,1);
});

test('Corti handles 80k of skills and large environment without losing full skill retrieval',async()=>{
 globalThis.__leafyTestProvider='corti';const payloads=[],events=[];const skills=Array.from({length:7},(_,i)=>({id:'skill'+i,name:i===6?'Hive økonomi':'Andet '+i,instructions:('hamp og data '.repeat(1000)).slice(0,i===6?8000:12000)}));skills[6].instructions=skills[6].instructions.slice(0,6500)+'ORIGINAL SLUTNING økonomi';
 globalThis.__leafyModelFetch=async(_,p)=>{assert(Buffer.byteLength(JSON.stringify(p))<=48000);payloads.push(structuredClone(p));return payloads.length===1?reply('','tool_calls',{tool_calls:[{index:0,id:'read',function:{name:'read_leafy_context',arguments:JSON.stringify({kind:'skill',id:'skill6',offset:6500})}}]}):reply('Forklaring baseret på det hentede afsnit.');};
 const input={leafyCore:{format:'leafy-core',version:1,skills,profileNotes:[]},messages:[{role:'user',content:'Forklar Hive økonomi'}],conversationContext:'Tidligere '.repeat(800)};const original=JSON.stringify(input);
 try{await runtime.runAgent(input,null,'owner',e=>events.push(e),new AbortController().signal);assert.equal(payloads.length,2);assert(payloads[0].messages.some(m=>String(m.content).includes('skill6')));assert.match(payloads[1].messages.find(m=>m.role==='tool').content,/ORIGINAL SLUTNING/);assert.equal(JSON.stringify(input),original);}finally{delete globalThis.__leafyTestProvider;}
});
