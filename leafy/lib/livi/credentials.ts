export type CortiCredentials={modelsApiKey?:string;sttClientId?:string;sttClientSecret?:string;tenantName?:string;elevenLabsApiKey?:string;elevenLabsVoiceId?:string};
const COOKIE='leafy_corti';
export const CORTI_COOKIE_MAX_AGE=60*60*24*400;

function encryptionKey(){
 const hex=process.env.LEAFY_CREDENTIALS_ENCRYPTION_KEY;
 if(!hex||!/^[0-9a-f]{64}$/i.test(hex))throw new Error('Leafy credential encryption is not configured.');
 return crypto.subtle.importKey('raw',new Uint8Array(hex.match(/.{2}/g)!.map(x=>parseInt(x,16))),'AES-GCM',false,['encrypt','decrypt']);
}
function toBase64Url(bytes:Uint8Array){let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function fromBase64Url(value:string){const binary=atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4));return Uint8Array.from(binary,c=>c.charCodeAt(0));}

export async function encryptCortiCredentials(value:CortiCredentials){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=new TextEncoder().encode(JSON.stringify(value));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(),data);
 return toBase64Url(new Uint8Array([...iv,...new Uint8Array(encrypted)]));
}
export async function decryptCortiCredentials(request:Request):Promise<CortiCredentials|null>{
 const cookie=request.headers.get('cookie')?.split(';').map(part=>part.trim()).find(part=>part.startsWith(`${COOKIE}=`));
 if(!cookie)return null;
 try{
  const bytes=fromBase64Url(cookie.slice(COOKIE.length+1));if(bytes.length<29||bytes.length>4096)return null;
  const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},await encryptionKey(),bytes.slice(12));
  const value=JSON.parse(new TextDecoder().decode(clear)) as CortiCredentials;
  return value&&typeof value==='object'?value:null;
 }catch{return null;}
}
export function cortiCookie(value:string){return `${COOKIE}=${value}; Path=/api; Max-Age=${CORTI_COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Strict`}
export function clearCortiCookie(){return `${COOKIE}=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Strict`}
