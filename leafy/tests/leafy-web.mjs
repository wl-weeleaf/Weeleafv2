import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

const source=await fs.readFile(new URL('../lib/leafy/web.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace("import { publicUrl } from './actions';",`const publicUrl=value=>{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.')||/^\\d+(?:\\.\\d+){3}$/.test(url.hostname)||/(^|\\.)(localhost|local|internal|test|invalid|example|onion)$/.test(url.hostname))throw Error('blocked');return url;};`);
const {searchWeb,readPage,sourceClass,sourceDomains}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
assert.equal(sourceDomains('gældende dansk lov om data').at(0),'retsinformation.dk');
assert.equal(sourceDomains('arbejdsmiljø og frister').at(0),'at.dk');
assert.equal(sourceClass('https://www.retsinformation.dk/eli/lta/2025/1'),'Officiel dansk myndighed eller primærkilde');
assert.equal(sourceClass('https://eur-lex.europa.eu/legal-content/DA/TXT/'),'Officiel EU-kilde');
assert.equal(sourceClass('https://example.org/article'),'Anden kilde');

const originalFetch=globalThis.fetch;
try{
 globalThis.fetch=async input=>{
  const url=new URL(String(input));
  if(url.hostname==='www.bing.com'){
   const q=url.searchParams.get('q')||'',domain=q.match(/site:([^\s]+)/)?.[1];
   const items=domain?`<item><title>Officiel gældende vejledning</title><link>https://www.retsinformation.dk/eli/lta/2025/1</link><description>Primær kilde</description><pubDate>Sun, 15 Nov 2026 10:00:00 GMT</pubDate></item>`:`<item><title>Nyhedsartikel</title><link>https://news.example.org/article</link><description>Sekundær kilde</description></item><item><title>Officiel gældende vejledning</title><link>https://www.retsinformation.dk/eli/lta/2025/1</link><description>Primær kilde</description></item>`;
   return new Response(`<rss><channel>${items}</channel></rss>`,{headers:{'Content-Type':'application/rss+xml'}});
  }
  return new Response(`<html><head><title>Gældende regel</title><meta property="article:modified_time" content="2026-11-15"/></head><body><h1>Officiel tekst</h1><p>${'L'.repeat(25000)}</p><a href="https://www.retsinformation.dk/eli/lta/2025/1">Retsinformation</a></body></html>`,{headers:{'Content-Type':'text/html','Last-Modified':'Sun, 15 Nov 2026 10:00:00 GMT'}});
 };
 const found=await searchWeb('gældende dansk lov om data');
 assert.match(found.retrievedAt,/^\d{4}-\d\d-\d\dT/);
 assert.ok(found.officialResultCount>0);
 assert.equal(found.results[0].sourceClass,'Officiel dansk myndighed eller primærkilde');
 assert.equal(found.results[0].url,'https://www.retsinformation.dk/eli/lta/2025/1');
 assert.equal(found.results.at(-1).sourceClass,'Anden kilde');
 const page=await readPage('https://www.retsinformation.dk/eli/lta/2025/1');
 assert.equal(page.title,'Gældende regel');
 assert.equal(page.lastModified,'2026-11-15');
 assert.equal(page.sourceClass,'Officiel dansk myndighed eller primærkilde');
 assert.equal(page.links[0].url,'https://www.retsinformation.dk/eli/lta/2025/1');
 assert.ok(page.retrievedAt);
 assert.equal(page.text.length,12000);assert.equal(page.hasMore,true);
 const nextPage=await readPage('https://www.retsinformation.dk/eli/lta/2025/1',page.offset+page.text.length);
 assert.equal(nextPage.offset,12000);assert.ok(nextPage.text.length>0);assert.equal(nextPage.hasMore,true);
 console.log('PASS: official Danish/EU source routing, official-first ordering, source labels, direct links and page retrieval timestamps.');
}finally{globalThis.fetch=originalFetch;}
