/** Budget the actual UTF-8 JSON, never shorten tool arguments or the core system rules. */
export function contextExcerpt(text:string,chars:number){if(text.length<=chars)return text;const head=Math.floor(chars*.7);return text.slice(0,head)+'\n[Uddrag: resten er ikke med i dette kald. Brug read_leafy_context for mere.]\n'+text.slice(-(chars-head));}
export function fitRequest<T extends {messages:{role:string;content:unknown}[]}>(payload:T,limit=48000):T{
 const copy={...payload,messages:payload.messages.map(m=>({...m,content:Array.isArray(m.content)?m.content.map(p=>({...p})):m.content}))};
 const size=()=>new TextEncoder().encode(JSON.stringify(copy)).byteLength;
 const context=(m:{role:string;content:unknown})=>m.role==='user'&&typeof m.content==='string'&&/^(AKTUELT MILJØ|REFERENCE FRA AKTIV BROWSER|UDDRAG FRA SAMTALEARKIV|AKTIVE LEAFY-SKILLS|VEDHÆFTNINGER)/.test(m.content);
 // Remove completed old exchanges, not the active tool chain or current task.
 while(size()>limit){
  const current=copy.messages.findLastIndex(m=>m.role==='user'&&!context(m));
  const latestReply=copy.messages.findLastIndex((m,i)=>i<current&&m.role==='assistant');
  const start=copy.messages.findIndex((m,i)=>i>0&&i<latestReply&&m.role==='assistant');if(start<0)break;
  let from=start;if(from>1&&copy.messages[from-1].role==='user'&&!context(copy.messages[from-1]))from--;
  let end=start+1;while(end<current&&copy.messages[end].role==='tool')end++;
  copy.messages.splice(from,end-from);
 }
 // Shrink supplemental context first. Full sources remain available through retrieval.
 const current=copy.messages.findLastIndex(m=>m.role==='user'&&!context(m));
 const candidates=[...copy.messages.filter(context),...copy.messages.filter(m=>m.role==='tool'),...copy.messages.filter((m,i)=>i<current&&(m.role==='assistant'||m.role==='user')&&typeof m.content==='string'&&!context(m)),...(current>=0?[copy.messages[current]]:[])];
 for(const m of candidates){
  if(size()<=limit)break;
  if(typeof m.content==='string'){
   const original=m.content;const floor=m===copy.messages[current]?1200:400;
   for(let cap=Math.floor(original.length/2);size()>limit&&cap>=floor;cap=Math.floor(cap/2))m.content=contextExcerpt(original,cap);
  }else if(Array.isArray(m.content)){
   for(const part of m.content){if(size()<=limit)break;if(part.type==='text'&&typeof part.text==='string'){const original=part.text;for(let cap=Math.floor(original.length/2);size()>limit&&cap>=1200;cap=Math.floor(cap/2))part.text=contextExcerpt(original,cap);}}
  }
 }
 // Last resort: the retained latest reply and context excerpts still do not fit. Drop completed old exchanges
 // (oldest first) before refusing, so a long history can never block a small current action.
 while(size()>limit){
  const cur=copy.messages.findLastIndex(m=>m.role==='user'&&!context(m));
  const start=copy.messages.findIndex((m,i)=>i>0&&i<cur&&(m.role==='assistant'&&!(m as {tool_calls?:unknown}).tool_calls||m.role==='user'&&!context(m)));
  if(start<0||cur<0)break;
  let end=start+1;while(end<cur&&copy.messages[end].role==='tool')end++;
  copy.messages.splice(start,end-start);
 }
 if(size()>limit)throw Error('Det aktuelle værktøjskald eller billedinput er større end Cortis grænse. Leafy kan ikke sende det uden at ændre selve handlingen. Del denne ene handling op. Skills og filer behøver ikke slettes.');
 return copy as T;
}
