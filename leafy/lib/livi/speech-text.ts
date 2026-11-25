export type PreparedSpeechText={text:string;displayIndexByCharacter:number[];displayLength:number};
export type SpeechSentenceBatch={sentences:string[];remainder:string};

const ABBREVIATIONS:Record<string,string>={'f.eks.':'for eksempel','fx.':'for eksempel','bl.a.':'blandt andet','dvs.':'det vil sige','osv.':'og så videre','m.m.':'med mere','ca.':'cirka','evt.':'eventuelt','inkl.':'inklusive','ekskl.':'eksklusive','nr.':'nummer','kl.':'klokken','pct.':'procent','pr.':'per','jf.':'jævnfør'};
const abbreviationPattern=Object.keys(ABBREVIATIONS).map(s=>s.replaceAll('.','\\.')).join('|');
function abbreviationDot(buffer:string,index:number){
 const prefix=buffer.slice(0,index+1);
 return new RegExp(`(?:^|[^\\p{L}])(?:${abbreviationPattern}|kr\\.)$`,'iu').test(prefix)||/(?:^|\s)\p{Lu}\.$/u.test(prefix)||/(?:^|\n)\s*\d+\.$/u.test(prefix);
}

/** Only ends a streamed sentence after its boundary is unambiguous. A period at
 * the end of a partial network chunk may still be a thousands/decimal mark. */
export function takeCompleteSpeechSentences(buffer:string,final=false,minLength=12):SpeechSentenceBatch{
 const sentences:string[]=[];let cursor=0;
 const boundary=/[.!?…]['”’)]*\s+/gu;
 for(const match of buffer.matchAll(boundary)){
  if(match[0][0]==='.'&&abbreviationDot(buffer,match.index??0))continue;
  const end=(match.index??0)+match[0].length,chunk=buffer.slice(cursor,end);
  if(chunk.trim().length>=minLength){sentences.push(chunk);cursor=end;}
 }
 const remainder=buffer.slice(cursor);
 if(final&&remainder.trim()){sentences.push(remainder);return {sentences,remainder:''};}
 return {sentences,remainder};
}

const SMALL=['nul','en','to','tre','fire','fem','seks','syv','otte','ni','ti','elleve','tolv','tretten','fjorten','femten','seksten','sytten','atten','nitten'];
const TENS=['','','tyve','tredive','fyrre','halvtreds','tres','halvfjerds','firs','halvfems'];
function underHundred(n:number){if(n<20)return SMALL[n];const ten=Math.floor(n/10),unit=n%10;return unit?`${unit===1?'en':SMALL[unit]}og${TENS[ten]}`:TENS[ten];}
function underThousand(n:number){if(n<100)return underHundred(n);const hundreds=Math.floor(n/100),rest=n%100;const head=hundreds===1?'et hundrede':`${SMALL[hundreds]} hundrede`;return rest?`${head} og ${underHundred(rest)}`:head;}
function cardinal(n:number):string{
 if(!Number.isSafeInteger(n)||n<0)return String(n);
 if(n<1000)return underThousand(n);
 const groups:[number,string,string][]=[[1_000_000_000,'milliard','milliarder'],[1_000_000,'million','millioner'],[1000,'tusind','tusind']];
 for(const [size,singular,plural] of groups){if(n>=size){const q=Math.floor(n/size),rest=n%size,head=`${q===1?(size===1000?'et':'en'):cardinal(q)} ${q===1?singular:plural}`;if(!rest)return head;return `${head}${rest<1000||rest<100?' og ': ' '}${cardinal(rest)}`;}}
 return String(n);
}
const DIGIT_WORDS=['nul','en','to','tre','fire','fem','seks','syv','otte','ni'];
function numberWords(raw:string){
 const grouped=raw.match(/^\d{1,3}(?:\.\d{3})+$/);
 if(grouped)return cardinal(Number(raw.replace(/\./g,'')));
 const groupedDecimal=raw.match(/^(\d{1,3}(?:\.\d{3})+),(\d+)$/);
 const decimal=groupedDecimal||raw.match(/^(\d+)[,.](\d+)$/);
 if(decimal){const integer=Number(decimal[1].replace(/\./g,''));return `${cardinal(integer)} komma ${Array.from(decimal[2],d=>DIGIT_WORDS[Number(d)]).join(' ')}`;}
 return cardinal(Number(raw));
}
const NUMBER=/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[,.]\d+)?/g;
const EMOJI=/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/u;

/** Converts numeric tokens into Danish words for TTS while retaining an index map to visible text. */
export function prepareDanishSpeech(displayText:string):PreparedSpeechText{
 const tokens=new RegExp(`(?:${abbreviationPattern})(?![\\p{L}\\p{N}_])|${NUMBER.source}`,'giu');
 const matches=[...displayText.matchAll(tokens)],output:string[]=[],map:number[]=[];let utf16Cursor=0,cpIndex=0;
 const appendOriginal=(chunk:string,start:number)=>{for(const character of chunk){output.push(EMOJI.test(character)?' ':character);map.push(start++);}};
 for(const match of matches){const at=match.index??0;if(at<utf16Cursor)continue;
  const before=displayText.slice(utf16Cursor,at);appendOriginal(before,cpIndex);cpIndex+=Array.from(before).length;
  const token=match[0],tokenLength=Array.from(token).length,start=cpIndex,end=start+tokenLength,abbreviation=ABBREVIATIONS[token.toLowerCase()];
  const touchesIdentifier=/[\p{L}\p{N}_]/u.test(displayText[at-1]||'')||(!abbreviation&&/[\p{L}_]/u.test(displayText[at+token.length]||'')&&!/^(?:kr|dkk)(?![\p{L}\p{N}_])/iu.test(displayText.slice(at+token.length)));
  if(touchesIdentifier){appendOriginal(token,start);utf16Cursor=at+token.length;cpIndex=end;continue;}
  let spoken=abbreviation||numberWords(token),suffixEnd=end;
  const suffix=abbreviation?null:displayText.slice(at+token.length).match(/^\s*(kr(?![\p{L}\p{N}_])|dkk(?![\p{L}\p{N}_])|%)/iu);
  if(suffix){const unit=suffix[1].toLowerCase();spoken+=unit==='%'?' procent':unit==='dkk'?' danske kroner':' kroner';suffixEnd+=Array.from(suffix[0]).length;}
  for(const character of spoken){output.push(character);map.push((suffix? suffixEnd : end)-1);}
  utf16Cursor=at+token.length+(suffix?suffix[0].length:0);cpIndex=end+(suffix?Array.from(suffix[0]).length:0);
 }
 const tail=displayText.slice(utf16Cursor);appendOriginal(tail,cpIndex);
 return {text:output.join(''),displayIndexByCharacter:map,displayLength:Array.from(displayText).length};
}

export function mapSpeechCueToDisplay(index:number,prepared:PreparedSpeechText){
 if(index<=0)return 0;
 const source=prepared.displayIndexByCharacter[Math.min(index,prepared.displayIndexByCharacter.length)-1];
 return source===undefined?prepared.displayLength:Math.min(prepared.displayLength,source+1);
}
