import {aiConfig,modelFetch} from '@/lib/livi/config';
import {decryptCortiCredentials} from '@/lib/livi/credentials';
import {checkOrigin,visitor} from '@/lib/leafy/session';
import {rateLimit} from '@/lib/leafy/store';

export const dynamic='force-dynamic';

export async function POST(request:Request){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Ugyldig oprindelse.'},{status:403});
 if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'Forventede JSON.'},{status:415});
 let body:{language?:unknown;strings?:unknown};
 try{body=await request.json() as typeof body;}catch{return Response.json({error:'Ugyldig oversættelsesanmodning.'},{status:400});}
 const language=typeof body.language==='string'?body.language.toLowerCase():'';
 const strings=body.strings;
 if(!/^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,2}$/.test(language)||!Array.isArray(strings)||strings.length>70||strings.some(value=>typeof value!=='string'||value.length>320))return Response.json({error:'Ugyldig oversættelsesliste.'},{status:400});
 if(strings.reduce((sum,value)=>sum+(value as string).length,0)>14000)return Response.json({error:'Oversættelsesbatchen er for stor.'},{status:413});
 const source=strings as string[];
 const names=new Intl.DisplayNames(['da'],{type:'language'});
 const target=names.of(language)||language;
 const credentials=await decryptCortiCredentials(request),config=aiConfig(credentials);
 if(!config.configured)return Response.json({error:'Der mangler en aktiv AI-forbindelse til at oversætte appens knapper og tekster.'},{status:503});
 try{
  checkOrigin(request);const user=await visitor(request);await rateLimit(user.owner,'ui-translation',20);
  const response=await modelFetch(credentials,{model:config.model,temperature:0,max_tokens:3500,messages:[
   {role:'system',content:`Translate each user interface string into ${target} (${language}). Return exactly one JSON object with a "translations" array in the same order and same length. Keep names such as Leafy, WL, Corti, ElevenLabs and technical product names unchanged. Preserve placeholders, punctuation, emoji, shortcuts, numbers and meaning. Translate only the supplied interface text; do not add explanations.`},
   {role:'user',content:JSON.stringify(source)}
  ]},AbortSignal.timeout(20000));
  if(!response.ok)throw new Error('Oversættelsesmodellen afviste anmodningen.');
  const data=await response.json() as {choices?:{message?:{content?:string}}[]};
  const content=data.choices?.[0]?.message?.content||'';
  let parsed:{translations?:unknown};
  try{parsed=JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g,'')) as typeof parsed;}catch{throw new Error('Oversættelsesmodellen returnerede et ugyldigt resultat.');}
  if(!Array.isArray(parsed.translations)||parsed.translations.length!==source.length||parsed.translations.some(value=>typeof value!=='string'))throw new Error('Oversættelsen kunne ikke valideres.');
  return Response.json({language,translations:parsed.translations},{headers:{'Cache-Control':'no-store',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});
 }catch(error){const message=(error as Error).message;return Response.json({error:message},{status:/timegrænse/i.test(message)?429:502});}
}
