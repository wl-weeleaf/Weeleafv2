import {aiConfig,cortiClientCredentials,cortiModelsCredential,cortiSpeechConfigured} from '@/lib/livi/config';
import {decryptCortiCredentials} from '@/lib/livi/credentials';
import {elevenLabsCredentials} from '@/lib/livi/elevenlabs';
import {checkOrigin,visitor} from '@/lib/leafy/session';

export const dynamic='force-dynamic';

/**
 * Imports only the readiness of server-side shared settings into the UI.
 * Provider secrets and short-lived tokens never leave this route.
 */
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const user=await visitor(request);
  const saved=await decryptCortiCredentials(request);
  const ai=aiConfig(saved);
  const eleven=elevenLabsCredentials(saved);
  const modelsSource=saved?.modelsApiKey?'browser':cortiModelsCredential()?'server':null;
  const speech=saved?.sttClientId&&saved?.sttClientSecret&&saved?.tenantName
   ?'browser'
   :cortiClientCredentials().clientId&&cortiClientCredentials().clientSecret
    ?'server':null;
  const elevenSource=saved?.elevenLabsApiKey?'browser':process.env.ELEVENLABS_API_KEY?'server':null;
  return Response.json({
   imported:true,
   services:{
    corti:{configured:ai.configured,model:ai.configured?ai.model:null,source:modelsSource,speechConfigured:!!speech||cortiSpeechConfigured(),speechSource:speech|| (cortiSpeechConfigured()?'server':null)},
    elevenLabs:{configured:eleven.configured,source:elevenSource,voiceSelected:!!eleven.voiceId}
   },
   note:'Kun status blev hentet. Hemmelige nøgler blev på serveren.'
  },{headers:{'Cache-Control':'no-store, private',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});
 }catch{
  return Response.json({error:'Opsætningen kunne ikke hentes sikkert lige nu.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
