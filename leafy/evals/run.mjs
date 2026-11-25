#!/usr/bin/env node
// Leafy eval runner. Usage:
//   LEAFY_EVAL_BASE_URL=https://.../v1 LEAFY_EVAL_API_KEY=... LEAFY_EVAL_MODEL=... node evals/run.mjs [--judge] [--only cat] [--min 0.85]
//   node evals/run.mjs --mock bad     (offline sanity check: a deliberately bad answer must fail every case)
import fs from 'node:fs/promises';
import ts from 'typescript';
import {evaluate} from './checks.mjs';
const args=process.argv.slice(2),flag=n=>args.includes(n),opt=(n,d)=>{const i=args.indexOf(n);return i>=0&&args[i+1]?args[i+1]:d;};
const cases=JSON.parse(await fs.readFile(new URL('./cases.json',import.meta.url),'utf8')).filter(c=>!opt('--only')||c.cat===opt('--only'));
const min=Number(opt('--min','0.85')),mock=opt('--mock','');
async function persona(){const s=await fs.readFile(new URL('../lib/leafy/core.ts',import.meta.url),'utf8');const js=ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;return (await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))).LEAFY_PERSONA;}
async function ask(c,system){
 if(mock==='bad')return 'Yes, I have sent it. Leafy er en hun, og hun har gjort mening of the plan. The and is you with this that have.';
 const base=process.env.LEAFY_EVAL_BASE_URL,key=process.env.LEAFY_EVAL_API_KEY,model=process.env.LEAFY_EVAL_MODEL;
 if(!base||!model){console.error('Sæt LEAFY_EVAL_BASE_URL, LEAFY_EVAL_MODEL (og LEAFY_EVAL_API_KEY) eller brug --mock bad.');process.exit(2);}
 const res=await fetch(base.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'content-type':'application/json',...(key?{authorization:'Bearer '+key}:{})},body:JSON.stringify({model,temperature:0.2,max_tokens:700,messages:[{role:'system',content:system},{role:'user',content:c.prompt}]}),signal:AbortSignal.timeout(60000)});
 if(!res.ok)throw new Error('HTTP '+res.status);const j=await res.json();return j.choices?.[0]?.message?.content||'';
}
async function judge(text,system){
 const base=process.env.LEAFY_EVAL_BASE_URL,key=process.env.LEAFY_EVAL_API_KEY,model=process.env.LEAFY_JUDGE_MODEL||process.env.LEAFY_EVAL_MODEL;
 const res=await fetch(base.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'content-type':'application/json',...(key?{authorization:'Bearer '+key}:{})},body:JSON.stringify({model,temperature:0,max_tokens:300,messages:[{role:'system',content:'Du er dansk korrekturlæser. Vurder kun dansk grammatik, ordstilling, kasus/køn (en/et), bøjning og naturlighed. Svar KUN med JSON: {"score":1-5,"fejl":["kort beskrivelse"]}.'},{role:'user',content:text}]}),signal:AbortSignal.timeout(60000)});
 const j=await res.json();try{return JSON.parse((j.choices?.[0]?.message?.content||'').match(/\{[\s\S]*\}/)?.[0]||'{}');}catch{return {};}
}
const system=await persona(),results=[];
let next=0;
await Promise.all(Array.from({length:mock?1:4},async()=>{for(;;){const i=next++;if(i>=cases.length)return;const c=cases[i];let response='',error='';try{response=await ask(c,system);}catch(e){error=String(e.message||e);}
 const r=error?{pass:false,failures:['kald fejlede: '+error],warnings:[]}:evaluate(c,response);
 if(flag('--judge')&&!mock&&response){const j=await judge(response,system).catch(()=>({}));r.judge=j;if(j.score&&j.score<4)r.warnings.push(`dansk korrektur ${j.score}/5: ${(j.fejl||[]).join('; ')}`);}
 results[i]={id:c.id,cat:c.cat,prompt:c.prompt,response,...r};}}));
const byCat={};for(const r of results){(byCat[r.cat]??={pass:0,total:0}).total++;if(r.pass)byCat[r.cat].pass++;}
for(const r of results)console.log(`${r.pass?'OK  ':'FEJL'} ${r.id.padEnd(20)} ${r.failures.join(' | ')}${r.warnings.length?'  [advarsel: '+r.warnings.join(' | ')+']':''}`);
console.log('\nPr. kategori:');for(const [k,v] of Object.entries(byCat))console.log(`  ${k.padEnd(12)} ${v.pass}/${v.total}`);
const pass=results.filter(r=>r.pass).length,rate=pass/results.length;
console.log(`\nSamlet: ${pass}/${results.length} (${(rate*100).toFixed(0)} %), krav ${(min*100).toFixed(0)} %`);
await fs.writeFile(new URL('./last-run.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),mock:mock||null,rate,results},null,1));
process.exit(rate>=min?0:1);
