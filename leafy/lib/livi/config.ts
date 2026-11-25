import type {CortiCredentials} from './credentials';
import {createLeafySystemMessage} from './core';
export function aiConfig(userCredentials?:CortiCredentials|null,level?:string){
 if(level==='local'){
  const base=process.env.LEAFY_LOCAL_API_BASE_URL||'',model=process.env.LEAFY_LOCAL_MODEL||'';
  let valid=false;try{valid=new URL(base).protocol==='https:';}catch{}
  return {key:process.env.LEAFY_LOCAL_API_KEY||'local',base:base.replace(/\/$/,''),model,configured:!!model&&valid,provider:'local'};
 }
 const userCortiKey=userCredentials?.modelsApiKey;
 const cortiKey=userCortiKey||process.env.CORTI_BEARER||process.env.CORTI_MODELS_API_KEY||process.env.CORTI_API_KEY;
 const corti=(!!cortiKey||cortiSpeechConfigured())&& (!!userCortiKey||(!process.env.LIVI_API_KEY&&!process.env.LIVI_API_BASE_URL));
 const region=cortiRegion();
 const key=corti?cortiKey:process.env.LIVI_API_KEY||process.env.OPENAI_API_KEY;
 const base=corti?(process.env.CORTI_BASE_URL||`https://ai.${region}.corti.app/v1`):process.env.LIVI_API_BASE_URL||'https://api.openai.com/v1';
 // CLI accepts a comma-separated model list; the first entry is its default.
 const model=corti?(process.env.CORTI_MODEL?.split(',')[0].trim()||'corti-s1-mini-instant'):process.env.LIVI_MODEL||(base==='https://api.openai.com/v1'?'gpt-4.1-mini':'');
 let valid=false;try{valid=new URL(base).protocol==='https:';}catch{}
 return {key,base:base.replace(/\/$/,''),model,configured:(!!key||(corti&&cortiSpeechConfigured()))&&!!model&&valid,provider:corti?'corti':base==='https://api.openai.com/v1'?'openai':'custom'};
}
let tokenCache:{identity:string;token:string;expires:number}|undefined;
// Accept the environment names emitted by Corti CLI alongside existing Leafy settings.
export function cortiTenant(user?:CortiCredentials|null){
 return user?.tenantName||process.env.CORTI_TENANT_NAME||process.env.CORTI_TENANT||'base';
}
export function cortiClientCredentials(user?:CortiCredentials|null){
 return {clientId:user?.sttClientId||process.env.CORTI_STT_CLIENT_ID||process.env.CORTI_CLIENT_ID,
  clientSecret:user?.sttClientSecret||process.env.CORTI_STT_CLIENT_SECRET||process.env.CORTI_CLIENT_SECRET,
  tenant:cortiTenant(user)};
}
export function cortiModelsCredential(user?:CortiCredentials|null){
 return user?.modelsApiKey||process.env.CORTI_BEARER||process.env.CORTI_MODELS_API_KEY||process.env.CORTI_API_KEY;
}
export async function cortiAccessToken(user?:CortiCredentials|null,refresh=false,scopes:string[]=[]){
 const {clientId:id,clientSecret:secret,tenant}=cortiClientCredentials(user);
 if(!id||!secret||!tenant)throw new Error('Corti mangler en Models-nøgle eller klientoplysninger.');
 const scope=[...new Set(scopes)].sort(),identity=JSON.stringify([cortiRegion(),id,secret,tenant,scope]);
 if(!refresh&&!user?.sttClientId&&tokenCache?.identity===identity&&tokenCache.expires>Date.now())return tokenCache.token;
 const result=await fetch(`https://auth.${cortiRegion()}.corti.app/realms/${encodeURIComponent(tenant)}/protocol/openid-connect/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:id,client_secret:secret,grant_type:'client_credentials',scope:['openid',...scope].join(' ')}),signal:AbortSignal.timeout(12000)});
 if(!result.ok)throw new Error('Corti afviste klientoplysningerne.');
 const data=await result.json() as {access_token?:string;expires_in?:number};
 if(!data.access_token)throw new Error('Corti returnerede ikke et adgangstoken.');
 if(!user?.sttClientId)tokenCache={identity,token:data.access_token,expires:Date.now()+Math.max(0,(data.expires_in||300)-30)*1000};
 return data.access_token;
}
export async function modelFetch(credentials:CortiCredentials|null,payload:unknown,signal?:AbortSignal,level?:string){
 const config=aiConfig(credentials,level);
 if(!config.configured)throw new Error('AI-forbindelsen mangler opsætning.');
 let key=config.key;
 if(!key&&config.provider==='corti')key=cortiModelsCredential(credentials)||await cortiAccessToken(credentials);
 const send=(token:string)=>fetch(`${config.base}/chat/completions`,{method:'POST',signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...(config.provider==='corti'?{'Tenant-Name':cortiTenant(credentials)}:{})},body:JSON.stringify(payload)});
 let result=await send(key!);
 if(result.status===401&&config.provider==='corti'&&(cortiSpeechConfigured()||credentials?.sttClientId)){
  await result.body?.cancel();result=await send(await cortiAccessToken(credentials,true));
 }
 // Retry transient gateway timeouts once before returning a response stream.
 // Retrying after streaming starts could duplicate already-spoken answer text.
 if(config.provider==='corti'&&[502,503,504,522,524,529].includes(result.status)&&!signal?.aborted){
  await result.body?.cancel();
  await new Promise<void>((resolve,reject)=>{
   const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},350);
   const abort=()=>{clearTimeout(timer);reject(new DOMException('Afbrudt','AbortError'));};
   if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  });
  if(!signal?.aborted)result=await send(key!);
 }
 return result;
}
export function cortiRegion(){return (process.env.CORTI_REGION||process.env.CORTI_ENVIRONMENT)==='us'?'us':'eu';}
export function cortiSpeechConfigured(){const {clientId,clientSecret}=cortiClientCredentials();return !!(clientId&&clientSecret);}
export const LIVI_PERSONA=createLeafySystemMessage();
