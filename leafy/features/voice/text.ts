/** Merge cumulative ASR hypotheses and adjacent finalized segments without logging them twice. */
export function normalizeVoiceText(value:string){
 return value.toLocaleLowerCase('da').normalize('NFD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}

/** Remove exact adjacent ASR sentence repeats while preserving changed wording. */
export function collapseRepeatedVoicePhrases(value:string){
 const clauses=value.match(/[^.!?…]+(?:[.!?…]+|$)/gu)||[value];
 const kept:string[]=[],key=(clause:string)=>normalizeVoiceText(clause);
 for(const clause of clauses){if(!key(clause))continue;kept.push(clause.trim());for(let size=Math.min(8,Math.floor(kept.length/2));size>0;size--){const previous=kept.slice(-size*2,-size),latest=kept.slice(-size);if(previous.every((part,index)=>key(part)===key(latest[index]))){kept.splice(-size);break;}}}
 return kept.join(' ').replace(/\s+([,.!?…])/gu,'$1').replace(/\s{2,}/gu,' ').trim();
}

export function mergeVoiceText(previous:string,next:string){
 const left=collapseRepeatedVoicePhrases(previous.trim().replace(/\s+/g,' ')),right=collapseRepeatedVoicePhrases(next.trim().replace(/\s+/g,' '));
 if(!left)return right;if(!right)return left;
 const a=normalizeVoiceText(left),b=normalizeVoiceText(right);
 if(!a)return right;if(!b)return left;
 if(a===b||a.startsWith(b))return collapseRepeatedVoicePhrases(left);
 if(b.startsWith(a))return collapseRepeatedVoicePhrases(right);
 const aw=a.split(' '),bw=b.split(' ');
 for(let count=Math.min(aw.length,bw.length,12);count>0;count--){
  if(aw.slice(-count).join(' ')===bw.slice(0,count).join('')){
   const tail=right.split(/\s+/).slice(count).join(' ');
   return collapseRepeatedVoicePhrases(tail?`${left} ${tail}`:left);
  }
 }
 return collapseRepeatedVoicePhrases(`${left} ${right}`);
}

const STOP_WORDS=new Set('det den de der som at og i på til af for med en et er var jeg du vi har kan skal vil hvad hvor hvordan hvorfor når om ikke også bare så'.split(' '));
export function voiceQueryTerms(value:string){return [...new Set(normalizeVoiceText(value).split(' ').filter(word=>word.length>=4&&!STOP_WORDS.has(word)))];}
