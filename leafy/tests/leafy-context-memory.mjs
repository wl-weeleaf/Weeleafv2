import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpile(fs.readFileSync('lib/leafy/conversations.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const clean=source.replace(/^import .*?;\s*$/gm,'');
const memory=await import('data:text/javascript;base64,'+Buffer.from(clean).toString('base64'));
const message=(id,content,role='user',visuals)=>({id,role,content,complete:true,...(visuals?{visuals}:{})});
const conversation=(id,messages,date='2026-10-06T18:00:00Z')=>({id,title:'Samtale '+id,createdAt:date,updatedAt:date,messages});
test('A completed app survives the archive and is retrieved on a short follow-up two turns later',()=>{
 const artifact={id:'app-1',name:'Leafy-beregner.html',mime:'text/html',content:'<main>Hamp budget calculator 5.000 kr</main>'};
 const active=conversation('active',[message('u1','Byg en app'),message('a1','Jeg byggede beregneren.','assistant',[artifact]),message('u2','Lad os justere farverne'),message('a2','Jeg ændrer farverne.','assistant'),message('u3','Gør den mere blå')]);
 const saved={version:1,activeId:'active',crossContext:true,conversations:[active]};const restored=memory.loadArchive(JSON.stringify(saved),null);
 const context=memory.retrieveContext(restored.conversations,'active','gør den mere blå',true);assert.match(context,/Leafy-beregner.html/);assert.match(context,/Hamp budget calculator/);assert.match(context,/BYGGET ARTEFAKT/);
});
test('A previous-conversation request retrieves the prior built app and its last discussion',()=>{
 const prior=conversation('previous',[message('artifact','App bygget','assistant',[{id:'old-app',name:'Hive-app.html',mime:'text/html',content:'<main>Hive app builder for hemp graph</main>'}]),message('decision','Beslutningen var at afprøve kameraet.')],'2026-10-01T18:00:00Z');const active=conversation('active',[]);
 const artifacts=memory.retrieveContext([active,prior],'active','kan du huske den sidste app?',true);assert.match(artifacts,/Hive-app.html/);
 const discussion=memory.retrieveContext([active,prior],'active','hvad talte vi om sidst?',true);assert.match(discussion,/afprøve kameraet/);
});
test('Visible bingo stays in scope with shared memory off and an unrelated newer file',()=>{
 const file=name=>({id:name,name,mime:'text/html',content:'<style>'+'.a{}'.repeat(1500)+'</style><button>Ny plade</button>'});
 const active=conversation('party',[message('reply','','assistant',[file('Julebingo.html'),file('Menu.html')])]);
 const other=conversation('private',[message('old','bingo hemmelig tekst')]);
 const result=memory.retrieveContext([active,other],'party','hvordan funger bingo appen i praksis',false);
 assert.match(result,/Julebingo.html/);assert.match(result,/synligTekst":"Ny plade/);assert.doesNotMatch(result,/hemmelig tekst|Menu.html/);
});
