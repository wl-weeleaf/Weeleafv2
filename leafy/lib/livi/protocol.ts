export type ChatMessage={role:'user'|'assistant';content:string};
export function validateMessages(value:unknown):value is ChatMessage[]{
 return Array.isArray(value)&&value.length>0&&value.length<=40&&value.every(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string'&&m.content.trim().length>0&&m.content.length<=30000)&&value.reduce((n,m)=>n+m.content.length,0)<=120000&&value.at(-1).role==='user';
}
/** Incremental SSE parser, including CRLF, multiline data and split UTF-8 via caller decoder. */
export class ChatStreamParser{
 private buffer='';private data:string[]=[];
 push(chunk:string){this.buffer+=chunk;const events:string[]=[];let index:number;while((index=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,index).replace(/\r$/,'');this.buffer=this.buffer.slice(index+1);if(line===''){if(this.data.length)events.push(this.data.join('\n'));this.data=[];}else if(line.startsWith('data:'))this.data.push(line.slice(5).trimStart());}return events;}
}
