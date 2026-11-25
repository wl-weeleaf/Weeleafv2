import {aiConfig,cortiAccessToken,cortiModelsCredential,cortiTenant,modelFetch} from '@/lib/livi/config';
import {decryptCortiCredentials} from '@/lib/livi/credentials';
import {checkOrigin,visitor} from '@/lib/leafy/session';
import {rateLimit} from '@/lib/leafy/store';
import {providerErrorDetail} from '@/lib/livi/provider-error';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{
  checkOrigin(request);const user=await visitor(request);await rateLimit(user.owner,'connection',10);
  const credentials=await decryptCortiCredentials(request),config=aiConfig(credentials);
  if(!config.configured)throw new Error('Ingen model er konfigureret.');
  const key=config.key||(config.provider==='corti'?(cortiModelsCredential(credentials)||await cortiAccessToken(credentials)):'');
  const catalog=await fetch(`${config.base}/models`,{headers:{Authorization:`Bearer ${key}`,...(config.provider==='corti'?{'Tenant-Name':cortiTenant(credentials)}:{})},signal:AbortSignal.timeout(10000)});
  let models:string[]=[];
  if(catalog.ok){const data=await catalog.json() as {data?:{id:string}[]};models=(data.data||[]).map(x=>x.id);}
  const response=await modelFetch(credentials,{model:config.model,messages:[{role:'user',content:'Svar kun OK.'}],max_tokens:100,stream:false},AbortSignal.timeout(15000));
  const raw=await response.text();let result:{choices?:{message?:{content?:string}}[]}={};try{result=JSON.parse(raw);}catch{}
  return Response.json({ready:response.ok&&!!result.choices?.[0]?.message?.content,model:config.model,models,upstreamStatus:response.status,message:response.ok?'Forbindelsen er testet med et rigtigt modelsvar.':providerErrorDetail(raw,400)||'Corti afviste anmodningen uden en fejlbeskrivelse. Kontrollér Models-adgang på API-klienten.'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({ready:false,message:(e as Error).message},{status:503});}
}
