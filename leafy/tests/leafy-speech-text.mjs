import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpile(fs.readFileSync('lib/livi/speech-text.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const speech=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('Danish grouped numbers, currency, decimals and cue remapping remain whole for speech',()=>{
 const prepared=speech.prepareDanishSpeech('Det koster 5.000 kr. og måler 1.234,50 meter.');
 assert.match(prepared.text,/fem tusind kroner/);assert.match(prepared.text,/et tusind og to hundrede og fireogtredive komma fem nul/);
 const end=prepared.text.indexOf('tusind')+6;const mapped=speech.mapSpeechCueToDisplay(end,prepared);assert.ok(mapped>=15,'the number expansion maps to the end of the original numeric token');
});
test('Speech sentence splitting waits for an unambiguous boundary across model deltas',()=>{
 const partial=speech.takeCompleteSpeechSentences('Det samlede beløb er 5.');assert.deepEqual(partial.sentences,[]);assert.equal(partial.remainder,'Det samlede beløb er 5.');
 const next=speech.takeCompleteSpeechSentences(partial.remainder+'000 kroner. Næste punkt.',true);assert.deepEqual(next.sentences,['Det samlede beløb er 5.000 kroner. ','Næste punkt.']);
});
test('A spaced sentence boundary is spoken early, while a trailing unfinished sentence waits',()=>{
 const batch=speech.takeCompleteSpeechSentences('Her er første forklaring. Her kommer anden del');assert.deepEqual(batch.sentences,['Her er første forklaring. ']);assert.equal(batch.remainder,'Her kommer anden del');
 const final=speech.takeCompleteSpeechSentences(batch.remainder,true);assert.deepEqual(final.sentences,['Her kommer anden del']);
});
test('Currency suffixes cannot consume the start of ordinary Danish words',()=>{
 assert.equal(speech.prepareDanishSpeech('Der er 3 krav og 2 kroner.').text,'Der er tre krav og to kroner.');
 assert.equal(speech.prepareDanishSpeech('Det koster 5.000 kr. Det er 25%.').text,'Det koster fem tusind kroner. Det er femogtyve procent.');
 assert.equal(speech.prepareDanishSpeech('Brug 2FA og H2O.').text,'Brug 2FA og H2O.');
});
test('Abbreviations, initials and list markers do not break spoken sentences',()=>{
 const text='Vi bruger f.eks. Node og bl.a. Python til det. Næste opgave.';
 assert.deepEqual(speech.takeCompleteSpeechSentences(text,true).sentences,['Vi bruger f.eks. Node og bl.a. Python til det. ','Næste opgave.']);
 assert.equal(speech.prepareDanishSpeech('Det er f.eks. ca. 3 krav, dvs. flere.').text,'Det er for eksempel cirka tre krav, det vil sige flere.');
 assert.deepEqual(speech.takeCompleteSpeechSentences('1. Åbn appen nu. 2. Vælg din mappe.',true).sentences,['1. Åbn appen nu. ','2. Vælg din mappe.']);
});
test('Expanded pronunciation highlights only its original token',()=>{
 const prepared=speech.prepareDanishSpeech('Hej 5.000 kr. Nu.');
 const end=prepared.text.indexOf('kroner')+'kroner'.length;
 assert.equal(speech.mapSpeechCueToDisplay(end,prepared),'Hej 5.000 kr'.length);
 assert.equal(prepared.displayIndexByCharacter.length,Array.from(prepared.text).length);
});
