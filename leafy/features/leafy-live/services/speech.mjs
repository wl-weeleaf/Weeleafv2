/** Split speech safely and skip chunks containing only emotion tags, emoji or punctuation. */
export function speechChunks(text,limit=1600){
 if(!Number.isInteger(limit)||limit<2)throw Error('Invalid speech chunk limit');
 const chunks=[];let remaining=text;
 while(remaining.length>limit){const part=remaining.slice(0,limit);let cut=Math.max(part.lastIndexOf('. '),part.lastIndexOf('? '),part.lastIndexOf('! '));cut=cut>=limit/2?cut+2:part.lastIndexOf(' ')+1;if(cut<limit/2)cut=limit;if(/[\uD800-\uDBFF]/.test(remaining[cut-1])&&/[\uDC00-\uDFFF]/.test(remaining[cut]))cut--;chunks.push(remaining.slice(0,cut));remaining=remaining.slice(cut);}
 if(remaining)chunks.push(remaining);
 const hasSpeakableText=value=>/[\p{L}\p{N}]/u.test(value.replace(/\[[^\]]{1,80}\]/gu,'').replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu,''));
 return chunks.filter(chunk=>hasSpeakableText(chunk));
}
