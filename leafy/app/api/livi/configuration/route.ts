import {cortiCookie,clearCortiCookie,decryptCortiCredentials,encryptCortiCredentials,type CortiCredentials} from '@/lib/livi/credentials';
import {aiConfig,cortiRegion,modelFetch} from '@/lib/livi/config';
export const dynamic='force-dynamic';

// Only sets this visitor's encrypted cookie; never changes shared server credentials.
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Ugyldig oprindelse.'},{status:403});
 if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'Forventede JSON.'},{status:415});
 if(Number(request.headers.get('content-length')||0)>10000)return Response.json({error:'Opsætningen er for stor.'},{status:413});
 let body:Record<string,unknown>;try{body=await request.json() as Record<string,unknown>;}catch{return Response.json({error:'Ugyldig opsætning.'},{status:400});}
 if(body.clear===true||body.clear==='corti'){const current=await decryptCortiCredentials(request);if(current?.elevenLabsApiKey){const cookie=await encryptCortiCredentials({elevenLabsApiKey:current.elevenLabsApiKey,elevenLabsVoiceId:current.elevenLabsVoiceId});return new Response(JSON.stringify({configured:false}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':cortiCookie(cookie)}});}return new Response(JSON.stringify({configured:false}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':clearCortiCookie()}});}
 const current=await decryptCortiCredentials(request);let credentials:CortiCredentials;
 try{credentials={modelsApiKey:readField(body.modelsApiKey,current?.modelsApiKey),sttClientId:readField(body.sttClientId,current?.sttClientId),sttClientSecret:readField(body.sttClientSecret,current?.sttClientSecret),tenantName:readField(body.tenantName,current?.tenantName),elevenLabsApiKey:current?.elevenLabsApiKey,elevenLabsVoiceId:current?.elevenLabsVoiceId};}
 catch{return Response.json({error:'Et Corti-felt er ugyldigt eller for langt.'},{status:400});}
 if(!credentials.modelsApiKey)return Response.json({error:'Indsæt din Corti Models API-nøgle først.'},{status:400});
 try{
  const region=cortiRegion();
  const models=await fetch(`https://ai.${region}.corti.app/v1/models`,{headers:{Authorization:`Bearer ${credentials.modelsApiKey}`},signal:AbortSignal.timeout(12000)});
  if(!models.ok)return Response.json({error:models.status===401?'Corti afviste API-nøglen. Kontrollér, at den er en Corti Models Service API Key.':'Corti kunne ikke bekræfte nøglen. Kontrollér projekt og adgang.'},{status:422});
  await models.body?.cancel();
  const test=await modelFetch(credentials,{model:aiConfig(credentials).model,messages:[{role:'user',content:'Svar kun OK.'}],stream:false,max_tokens:100},AbortSignal.timeout(15000));
  if(!test.ok){await test.body?.cancel();return Response.json({error:`Corti-nøglen kunne ikke gennemføre et rigtigt modelsvar (HTTP ${test.status}). Kontrollér Models-adgang og forbrug.`},{status:422});}
  const answer=await test.json() as {choices?:{message?:{content?:string}}[]};if(!answer.choices?.[0]?.message?.content)return Response.json({error:'Corti-testen returnerede intet modelsvar.'},{status:422});
  const hasAnySpeech=!!(credentials.sttClientId||credentials.sttClientSecret||credentials.tenantName);
  if(hasAnySpeech&&!(credentials.sttClientId&&credentials.sttClientSecret&&credentials.tenantName))return Response.json({error:'Udfyld klient-id, klienthemmelighed og tenant samlet for at aktivere Corti-diktering.'},{status:400});
  if(credentials.sttClientId&&credentials.sttClientSecret&&credentials.tenantName){
   const token=await fetch(`https://auth.${region}.corti.app/realms/${encodeURIComponent(credentials.tenantName)}/protocol/openid-connect/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:credentials.sttClientId,client_secret:credentials.sttClientSecret,grant_type:'client_credentials',scope:'openid'}),signal:AbortSignal.timeout(12000)});
   if(!token.ok)return Response.json({error:'Corti Models-nøglen virker, men Corti afviste talegenkendelsesoplysningerne. Kontrollér klient-id, klienthemmelighed og tenant.'},{status:422});
  }
  const cookie=await encryptCortiCredentials(credentials);
  if(cookie.length>3800)return Response.json({error:'Corti-oplysningerne er for lange til sikker browserlagring.'},{status:413});
  return new Response(JSON.stringify({configured:true,speechConfigured:!!credentials.sttClientId}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store, private','Set-Cookie':cortiCookie(cookie)}});
 }catch{return Response.json({error:'Leafy kan ikke bekræfte eller gemme Corti-forbindelsen lige nu.'},{status:503});}
}

function readField(input:unknown,previous?:string){
 if(input===undefined||input===null||input==='')return previous;
 if(typeof input!=='string'||input.length>2048||input.includes('\u0000'))throw new Error('Ugyldigt Corti-felt.');
 return input.trim();
}
