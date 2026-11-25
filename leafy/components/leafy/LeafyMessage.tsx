'use client';
import {useState,type ReactNode} from 'react';
import {LeafyEmojiText} from './LeafyEmoji';
import {Copy,Check} from 'lucide-react';
import LeafyInlineSvg from './LeafyInlineSvg';
function visible(value:string,start:number,progress:number|undefined):ReactNode{
 const chars=Array.from(value),count=progress===undefined?0:Math.max(0,Math.min(chars.length,progress-start));
 if(!count)return <LeafyEmojiText text={value}/>;
 return <>{count>0&&<mark className="room-spoken-highlight"><LeafyEmojiText text={chars.slice(0,count).join('')}/></mark>}<LeafyEmojiText text={chars.slice(count).join('')}/></>;
}
function inline(text:string,progress?:number,base=0):ReactNode[]{
 const pattern=/(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https:\/\/[^\s)]+\))/g,parts:ReactNode[]=[],charsBefore=(index:number)=>Array.from(text.slice(0,index)).length;let cursor=0,partIndex=0;
 for(const match of text.matchAll(pattern)){const index=match.index??0,raw=match[0];if(index>cursor)parts.push(<span key={partIndex++}>{visible(text.slice(cursor,index),base+charsBefore(cursor),progress)}</span>);const start=base+charsBefore(index);
  if(raw.startsWith('`'))parts.push(<code key={partIndex++}>{visible(raw.slice(1,-1),start+1,progress)}</code>);
  else if(raw.startsWith('**'))parts.push(<strong key={partIndex++}>{visible(raw.slice(2,-2),start+2,progress)}</strong>);
  else {const link=raw.match(/^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/);if(link){try{const url=new URL(link[2]);if(url.protocol==='https:'&&!url.username&&!url.password)parts.push(<a key={partIndex++} href={url.href} target="_blank" rel="noopener noreferrer">{visible(link[1],start+1,progress)}</a>);else parts.push(<span key={partIndex++}>{visible(raw,start,progress)}</span>);}catch{parts.push(<span key={partIndex++}>{visible(raw,start,progress)}</span>);}}else parts.push(<span key={partIndex++}>{visible(raw,start,progress)}</span>);}
  cursor=index+raw.length;
 }
 if(cursor<text.length)parts.push(<span key={partIndex}>{visible(text.slice(cursor),base+charsBefore(cursor),progress)}</span>);
 return parts;
}
function Code({text,lang}:{text:string;lang:string}){const [copied,setCopied]=useState(false),[error,setError]=useState('');return <div className="message-code"><header><span>{lang||'kode'}</span><button type="button" onClick={()=>void navigator.clipboard.writeText(text).then(()=>{setCopied(true);setError('');setTimeout(()=>setCopied(false),1500);}).catch(()=>setError('Markér koden for at kopiere.'))}>{copied?<Check size={13}/>:<Copy size={13}/>} {copied?'Kopieret':'Kopiér'}</button></header><pre><code>{text}</code></pre>{error&&<small role="status">{error}</small>}</div>;}
export default function LeafyMessage({text,spokenText}:{text:string;spokenText?:string}){
 const blocks:ReactNode[]=[],lines=text.split('\n');let i=0;
 let sourceOffset=0;
 while(i<lines.length){const line=lines[i],lineStart=sourceOffset,lineLength=Array.from(line).length;if(!line.trim()){i++;sourceOffset+=lineLength+1;continue;}const fence=line.match(/^\s*```([^\s`]*)\s*$/);if(fence){i++;sourceOffset+=lineLength+1;const code:string[]=[];while(i<lines.length&&!/^\s*```\s*$/.test(lines[i])){code.push(lines[i]);sourceOffset+=Array.from(lines[i]).length+1;i++;}if(i<lines.length){sourceOffset+=Array.from(lines[i]).length+1;i++;}if(fence[1].toLowerCase()==='svg')blocks.push(<LeafyInlineSvg key={blocks.length} source={code.join('\n')}/>);else blocks.push(<Code key={blocks.length} lang={fence[1]} text={code.join('\n')}/>);continue;}
 const heading=line.match(/^#{1,4}\s+(.+)$/);if(heading){const start=lineStart+Array.from(line.slice(0,line.indexOf(heading[1]))).length;blocks.push(<h3 key={blocks.length}>{inline(heading[1],spokenText?Array.from(spokenText).length:undefined,start)}</h3>);i++;sourceOffset+=lineLength+1;continue;}
 if(/^\s*[-*]\s+/.test(line)){const items:{text:string;start:number}[]=[];while(i<lines.length&&/^\s*[-*]\s+/.test(lines[i])){const current=lines[i],content=current.replace(/^\s*[-*]\s+/,''),prefix=current.length-content.length;items.push({text:content,start:sourceOffset+Array.from(current.slice(0,prefix)).length});sourceOffset+=Array.from(current).length+1;i++;}blocks.push(<ul key={blocks.length}>{items.map((item,n)=><li key={n}>{inline(item.text,spokenText?Array.from(spokenText).length:undefined,item.start)}</li>)}</ul>);continue;}
 if(/^\s*\d+[.)]\s+/.test(line)){const items:{text:string;start:number}[]=[];while(i<lines.length&&/^\s*\d+[.)]\s+/.test(lines[i])){const current=lines[i],content=current.replace(/^\s*\d+[.)]\s+/,''),prefix=current.length-content.length;items.push({text:content,start:sourceOffset+Array.from(current.slice(0,prefix)).length});sourceOffset+=Array.from(current).length+1;i++;}blocks.push(<ol key={blocks.length}>{items.map((item,n)=><li key={n}>{inline(item.text,spokenText?Array.from(spokenText).length:undefined,item.start)}</li>)}</ol>);continue;}
 const paragraph:string[]=[line];const paragraphStart=lineStart;i++;sourceOffset+=lineLength+1;while(i<lines.length&&lines[i].trim()&&!/^\s*```|^#{1,4}\s|^\s*(?:[-*]|\d+[.)])\s/.test(lines[i])){paragraph.push(lines[i]);sourceOffset+=Array.from(lines[i]).length+1;i++;}blocks.push(<p key={blocks.length}>{inline(paragraph.join('\n'),spokenText?Array.from(spokenText).length:undefined,paragraphStart)}</p>);
 }
 return <div className="leafy-message-content">{blocks}</div>;
}
