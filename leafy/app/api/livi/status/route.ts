import {aiConfig,cortiRegion,cortiSpeechConfigured} from '@/lib/livi/config';
import {decryptCortiCredentials,encryptCortiCredentials,cortiCookie} from '@/lib/livi/credentials';
import {browserConfigured} from '@/lib/leafy/runtime';
import {elevenLabsCredentials} from '@/lib/livi/elevenlabs';
import {leafyIntegrationCorsHeaders} from '@/lib/leafy/integration-origins';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const userCredentials=await decryptCortiCredentials(request),config=aiConfig(userCredentials);
 const renewed=userCredentials?cortiCookie(await encryptCortiCredentials(userCredentials)):undefined;
 const userSpeechReady=!!(userCredentials?.sttClientId&&userCredentials.sttClientSecret&&userCredentials.tenantName),speechReady=userSpeechReady||cortiSpeechConfigured();
 const elevenlabs=elevenLabsCredentials(userCredentials);
 return Response.json({configured:config.configured,model:config.configured?config.model:null,region:config.provider==='corti'?cortiRegion():null,provider:config.configured?config.provider:null,dictationProvider:elevenlabs.configured?'scribe':speechReady?'corti':'browser',cortiSpeechConfigured:speechReady,hasSavedCortiKey:!!userCredentials?.modelsApiKey,hasSavedCortiSpeech:userSpeechReady,hasSavedElevenLabsKey:elevenlabs.configured,elevenLabsVoiceId:elevenlabs.voiceId||null,browserAutomation:browserConfigured(),images:true,imageFormat:"svg",tasks:true},{headers:{...leafyIntegrationCorsHeaders(request),'Cache-Control':'no-store, private',...(renewed?{'Set-Cookie':renewed}:{})}});
}
