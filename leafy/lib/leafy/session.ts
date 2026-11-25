export async function visitor(request:Request){
 const existing=request.headers.get('cookie')?.match(/(?:^|;\s*)leafy_visitor=([a-f0-9]{64})(?:;|$)/)?.[1];
 const token=existing||Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return {owner:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),cookie:existing?undefined:`leafy_visitor=${token}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`};
}
export function checkOrigin(request:Request){
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)throw new Error('Ugyldig oprindelse.');
 if(request.headers.get('sec-fetch-site')==='cross-site')throw new Error('Ugyldig oprindelse.');
}
export async function readJson(request:Request,max=24000):Promise<Record<string,unknown>>{
 if(!request.headers.get('content-type')?.includes('application/json'))throw new Error('Forventede JSON.');
 if(Number(request.headers.get('content-length')||0)>max)throw new Error('Anmodningen er for stor.');
 const raw=await request.text();if(raw.length>max)throw new Error('Anmodningen er for stor.');
 const data=JSON.parse(raw);if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Ugyldig anmodning.');return data;
}
