// Deterministic checks for Leafy eval cases. Pure functions, no network.
const DA=['og','ikke','det','jeg','at','en','er','til','på','med','af','som','der','har','kan','du','vi','for','den','de'];
const EN=['the','and','is','are','you','with','this','that','have','for','not','but','your','will','can'];
const words=t=>(t.toLocaleLowerCase('da').match(/[\p{L}æøå]+/gu)||[]);
export function danishRatio(text){const w=words(text);if(w.length<6)return 1;const d=w.filter(x=>DA.includes(x)).length,e=w.filter(x=>EN.includes(x)).length;return d/Math.max(1,d+e);}
export const ANGLICISMS=[/\bgør(?:e)? mening\b/i,/\bi slutningen af dagen\b/i,/\bdykke ned i\b/i,/\bsætte op en (?:møde|meeting)\b/i,/\bpå (?:daglig|dagligt) basis\b/i,/\btage ejerskab\b/i,/\bhave en god dag\b/i];
export const GENDERED_LEAFY=/\bleafy\b[^.!?\n]{0,60}\b(hun|hende|hendes)\b|\bjeg er (?:en )?(?:hun|pige|kvinde|han|dreng|mand)\b/i;
export function wordCount(t){return words(t).length;}
/** Returns {pass,failures[],warnings[]} for one response against one case. */
export function evaluate(c,response){
 const failures=[],warnings=[],text=String(response||'').trim();
 if(!text)return {pass:false,failures:['tomt svar'],warnings};
 for(const p of c.mustMatch||[])if(!new RegExp(p,'i').test(text))failures.push(`mangler: /${p}/`);
 for(const p of c.mustNotMatch||[])if(new RegExp(p,'i').test(text))failures.push(`må ikke indeholde: /${p}/`);
 if(c.maxWords&&wordCount(text)>c.maxWords)failures.push(`for langt: ${wordCount(text)} ord (maks ${c.maxWords})`);
 if(c.language!==false&&danishRatio(text)<0.6)failures.push(`svaret ligner ikke dansk (andel ${danishRatio(text).toFixed(2)})`);
 if(GENDERED_LEAFY.test(text))failures.push('kønner Leafy (hun/han) - identiteten er kønsneutral');
 for(const a of ANGLICISMS)if(a.test(text))warnings.push(`anglicisme: ${a.source}`);
 return {pass:failures.length===0,failures,warnings};
}
