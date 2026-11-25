import {aiConfig,modelFetch} from '@/lib/livi/config';
import {decryptCortiCredentials} from '@/lib/livi/credentials';
import {checkOrigin,visitor} from '@/lib/leafy/session';
import {rateLimit} from '@/lib/leafy/store';

export const dynamic='force-dynamic';

export async function POST(request:Request){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Ugyldig oprindelse.'},{status:403});
 if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'Forventede JSON.'},{status:415});
 const raw=await request.text();if(raw.length>160000)return Response.json({error:'Dagsloggen er for stor til én analyse.'},{status:413});
 let body:unknown;try{body=JSON.parse(raw);}catch{return Response.json({error:'Ugyldig dagslog.'},{status:400});}
 if(!body||typeof body!=='object')return Response.json({error:'Ugyldig dagslog.'},{status:400});
 const input=body as {date?:unknown;entries?:unknown};
 if(typeof input.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||!Array.isArray(input.entries)||input.entries.length>500)return Response.json({error:'Dagsloggen har et ugyldigt format.'},{status:400});
 const entries=input.entries.filter((e):e is {time:number;kind:string;text:string}=>!!e&&typeof e==='object'&&typeof (e as {time?:unknown}).time==='number'&&typeof (e as {kind?:unknown}).kind==='string'&&typeof (e as {text?:unknown}).text==='string').map(e=>({time:e.time,kind:e.kind.slice(0,20),text:e.text.slice(0,4000)}));
 const transcript=entries.map(e=>`${new Date(e.time).toISOString()} · ${e.kind}: ${e.text}`).join('\n').slice(0,120000);
 if(!transcript.trim())return Response.json({error:'Der er ingen logposter at analysere.'},{status:400});
 try{
  checkOrigin(request);const user=await visitor(request);await rateLimit(user.owner,'voice-analysis');
  const credentials=await decryptCortiCredentials(request),config=aiConfig(credentials);
  if(!config.configured)return Response.json({error:'Dagsanalysen afventer en aktiv AI-forbindelse.'},{status:503});
  const result=await modelFetch(credentials,{model:config.model,stream:false,temperature:0.2,max_tokens:900,messages:[
   {role:'system',content:'Du laver en privat, kildebunden dagsopsummering af brugerens egen stemmelog. Svar på dansk og højst 1200 ord. Skeln mellem brugerudsagn, Leafys svar og usikre transskriptioner. Medtag: kort opsummering, emner og beslutninger, præferencer brugeren tydeligt har udtrykt, åbne opfølgninger og usikkerheder. Opfind ikke fakta, diagnoser eller hensigter. Udled ikke følsomme personlige egenskaber. Medtag aldrig adgangskoder, API-nøgler eller andre hemmeligheder; markér blot at følsomt indhold blev udeladt. Dette er en personlig hukommelsesnote, ikke modeltræning eller en ændring af Leafys kode.'},
   {role:'user',content:`Dato for loggen (${input.date}, Europe/Copenhagen). Transskriptioner kan være ufuldstændige. Analysér kun dette materiale:\n\n${transcript}`}
  ]},AbortSignal.timeout(45_000));
  if(!result.ok)return Response.json({error:'AI-modellen kunne ikke lave dagsanalysen lige nu.'},{status:502});
  const data=await result.json() as {choices?:{message?:{content?:string}}[]};const summary=data.choices?.[0]?.message?.content;
  if(typeof summary!=='string'||!summary.trim())return Response.json({error:'AI-modellen returnerede en tom dagsanalyse.'},{status:502});
  return Response.json({date:input.date,summary:summary.slice(0,12000)},{headers:{'Cache-Control':'no-store, private'}});
 }catch(e){return Response.json({error:(e as Error).message||'Dagsanalysen kunne ikke gennemføres.'},{status:503});}
}
