import {getChatGPTUser} from '@/app/chatgpt-auth';

const COOKIE='leafy_guest_access';
const SESSION_SECONDS=60*60*24*14;
const encoder=new TextEncoder();
function readCookie(request:Request){
 const item=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(`${COOKIE}=`));
 return item?.slice(COOKIE.length+1)??'';
}
function toBase64Url(bytes:Uint8Array){let s='';for(const byte of bytes)s+=String.fromCharCode(byte);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function signature(payload:string){
 const secret=process.env.LEAFY_GUEST_SIGNING_SECRET;
 if(!secret)return null;
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(payload)));
}
function same(a:string,b:string){if(a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0;}
export async function validLeafyGuestSession(request:Request){
 const [expiryText,tag,...rest]=readCookie(request).split('.');if(!expiryText||!tag||rest.length)return false;
 const expiry=Number(expiryText);if(!Number.isSafeInteger(expiry)||expiry<=Date.now())return false;
 try{const expected=await signature(expiryText);return !!expected&&same(tag,toBase64Url(expected));}catch{return false;}
}
export async function hasLeafyAccess(request:Request){return !!(await getChatGPTUser())||await validLeafyGuestSession(request);}
export async function createLeafyGuestCookie(){
 const expiry=String(Date.now()+SESSION_SECONDS*1000),tag=await signature(expiry);if(!tag)throw new Error('Gæsteadgang er ikke konfigureret.');
 return `${COOKIE}=${expiry}.${toBase64Url(tag)}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}
export function clearLeafyGuestCookie(){return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;}
export function compareLeafyGuestCode(code:string){const expected=process.env.LEAFY_GUEST_ACCESS_CODE;return !!expected&&same(code,expected);}
