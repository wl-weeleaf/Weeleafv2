import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const storeSource='export async function rateLimit(){}';
const storeUrl='data:text/javascript;base64,'+Buffer.from(storeSource).toString('base64');
const source=ts.transpile(fs.readFileSync('lib/leafy/chat-limits.ts','utf8').replace("'./store'",`'${storeUrl}'`),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const {enforcePublicChatLimits,PublicChatRateLimitError}=await import(url);

test('Public AI calls have visitor, hashed-network and site-wide hourly limits',async()=>{
 const calls=[];await enforcePublicChatLimits(new Request('https://leafy.test/api/livi/chat',{headers:{'cf-connecting-ip':'203.0.113.10'}}),'visitor-a',async(...args)=>calls.push(args));
 assert.equal(calls.length,3);assert.deepEqual(calls[0],['visitor-a','chat-visitor',240]);assert.equal(calls[1][1],'chat-network');assert.equal(calls[1][2],600);assert.notEqual(calls[1][0],'203.0.113.10');assert.deepEqual(calls[2],['public-site','chat-global',3000]);
});

test('Network limit is omitted without a trusted Cloudflare address',async()=>{
 const calls=[];await enforcePublicChatLimits(new Request('https://leafy.test/api/livi/chat'),'visitor-b',async(...args)=>calls.push(args));assert.equal(calls.length,2);assert.deepEqual(calls[0],['visitor-b','chat-visitor',240]);assert.deepEqual(calls[1],['public-site','chat-global',3000]);
});

test('Rate-limit responses are distinguishable from database failures',async()=>{
 await assert.rejects(()=>enforcePublicChatLimits(new Request('https://leafy.test'),'visitor',async()=>{throw Error('Denne browsers timegrænse er nået.');}),PublicChatRateLimitError);
 await assert.rejects(()=>enforcePublicChatLimits(new Request('https://leafy.test'),'visitor',async()=>{throw Error('database unavailable');}),/database unavailable/);
});
