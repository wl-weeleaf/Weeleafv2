import ts from 'typescript';import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
const nativeRequire=createRequire(import.meta.url),cache=new Map();
function load(file){
 file=fs.realpathSync(file);if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);
 const require=name=>{
  if(name.endsWith('.css'))return {};
  if(name.startsWith('.')||name.startsWith('@/')){
   const base=name.startsWith('@/')?process.cwd()+'/'+name.slice(2):file.slice(0,file.lastIndexOf('/'))+'/'+name;
   const resolved=[base,base+'.ts',base+'.tsx',base+'/index.ts'].find(p=>fs.existsSync(p));return load(resolved);
  }return nativeRequire(name);
 };
 const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(compiled,{require,exports:module.exports,module,URL,setTimeout,clearTimeout});return module.exports;
}
const module={exports:load('components/leafy/LeafyMessage.tsx')};
const render=text=>renderToStaticMarkup(React.createElement(module.exports.default,{text}));
const attack='<img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1))\n\n[secret](https://username:password@example.com/)';
const result=render(attack);assert(!result.includes('<img'));assert(!result.includes('href='));assert(result.includes('&lt;img'));
const code='const x = `<script>danger</script>`;';const html=render('```js\n'+code+'\n```');assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;danger&lt;/script&gt;'));assert(html.includes('<pre>'));
assert(render('[Kilde](https://example.com/side)').includes('rel="noopener noreferrer"'));
assert(render('```js\nconst x = 1;').includes('const x = 1;'),'streaming incomplete code must remain visible');
console.log('PASS: React message rendering escapes HTML, rejects executable and credential-bearing links, isolates code text and supports unfinished streamed code.');

const {LEAFY_EMOJIS,emojiParts}=load('lib/leafy/emoji/catalog.ts');
assert.equal(LEAFY_EMOJIS.length,24);assert.equal(new Set(LEAFY_EMOJIS.map(e=>e.id)).size,24);
assert.equal(LEAFY_EMOJIS.filter(e=>e.group==='leafy').length,12);
assert.equal(emojiParts('Hej ❤️ og ❤!').filter(p=>p.emoji?.id==='heart').length,2);
assert(render('Tak ❤️').includes('wl-emoji-coin'));
assert(!render('```txt\n❤️\n```').includes('wl-emoji-coin'),'code examples retain literal emojis');
console.log('PASS: 24 unique Leafy/WL emojis, heart variants, chat replacement and literal code preservation.');

for(const input of ['😁','👍🏽','👨‍👩‍👧‍👦','🇩🇰','1️⃣']){const parts=emojiParts(input);assert.equal(parts.length,1);assert(parts[0].emoji,'all emoji graphemes map to a WL entry');assert(!render(input).includes(input));}
assert.equal(emojiParts('En lang almindelig tekst.').length,1,'plain text stays one render node');
assert(render('🙂').includes('/leafy/original-torso.png'),'loading fallback uses original Leafy, never native emoji');
