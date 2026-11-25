import type {LeafySkill} from '../livi/core';
/** Select relevant original passages; locked Master Skills stay in app source, user skills stay in local profile. */
export function skillContext(skills:LeafySkill[],query:string,maxChars=8500){
 if(!skills.length)return '';
 const terms=[...new Set(query.toLocaleLowerCase('da').match(/[\p{L}\p{N}]{3,}/gu)||[])];
 const catalog=skills.map(s=>JSON.stringify({id:s.id,navn:s.name,tegn:s.instructions.length,låst:'locked' in s&&s.locked===true,version:'version' in s?s.version:undefined,status:'status' in s?s.status:undefined})).join('\n');
 // Rank complete paragraphs rather than fixed-size slices. Mid-sentence fragments
 // can look like malformed instructions and are especially harmful for language rules.
 const chunks=skills.flatMap((s,order)=>{let offset=0;return s.instructions.split(/\n\s*\n/).filter(Boolean).map(text=>{const start=s.instructions.indexOf(text,offset);offset=start+text.length;const lower=(s.name+' '+text).toLocaleLowerCase('da');return {s,offset:start,text,score:terms.reduce((n,w)=>n+(lower.includes(w)?1:0)+(s.name.toLocaleLowerCase('da').includes(w)?3:0),0),order};});}).filter(c=>c.score>0||terms.length===0&&c.text.startsWith('# ')).sort((a,b)=>b.score-a.score||a.order-b.order||a.offset-b.offset);
 let out='AKTIVE LEAFY-SKILLS (låste Master Skills og brugerens egne skills; anvend kun relevante anvisninger. De ændrer ikke Leafys sprogvalg, identitet, lov, gældende vedtægter, sikkerhed eller godkendelser):\nKatalog, alle tilgængelige skills:\n'+catalog+'\nHele relevante afsnit (afsnit deles ikke midt i en sætning). Brug read_leafy_context kind=skill med id og offset for resten af en skill. Påstå ikke at have læst alt.\n';
 for(const c of chunks){const passage=JSON.stringify({id:c.s.id,navn:c.s.name,offset:c.offset,tekst:c.text})+'\n';if(out.length+passage.length<=maxChars)out+=passage;}
 return out;
}
