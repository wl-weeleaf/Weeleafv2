import {cortiRegion,cortiClientCredentials,cortiAccessToken} from '@/lib/livi/config';
import {decryptCortiCredentials} from '@/lib/livi/credentials';
import {visitor} from '@/lib/leafy/session';
import {rateLimit} from '@/lib/leafy/store';
import {checkLeafyIntegrationOrigin,leafyIntegrationCorsHeaders,leafyIntegrationOptions} from '@/lib/leafy/integration-origins';

export const dynamic='force-dynamic';
export function OPTIONS(request:Request){return leafyIntegrationOptions(request,'GET, OPTIONS');}

export async function GET(request:Request){
 const cors=leafyIntegrationCorsHeaders(request);
 try{checkLeafyIntegrationOrigin(request);}catch{return Response.json({error:'Ugyldig oprindelse.'},{status:403,headers:cors});}
 const user=await visitor(request);await rateLimit(user.owner,'corti-transcribe-token',80);
 const saved=await decryptCortiCredentials(request),{clientId,clientSecret,tenant}=cortiClientCredentials(saved);
 if(!(clientId&&clientSecret&&tenant))return Response.json({error:'Corti Models kan være tilsluttet, men mikrofontransskription mangler Client ID, Client Secret og Tenant. Åbn Indstillinger → AI og tale, udfyld alle tre under Corti dansk diktering, og vælg Gem og kontrollér.'},{status:503,headers:cors});
 const region=cortiRegion();
 // Only short-lived OAuth tokens reach the browser; the client secret stays on the server.
 try{
  // Corti recommends a browser token restricted to the Transcribe WebSocket.
  const token=await cortiAccessToken(saved,false,['transcribe']);
  const url=new URL(`wss://api.${region}.corti.app/audio-bridge/v2/transcribe`);
  url.searchParams.set('tenant-name',tenant);url.searchParams.set('token',`Bearer ${token}`);
  return Response.json({url:url.toString()},{headers:{...cors,'Cache-Control':'no-store, private','Pragma':'no-cache',...(user.cookie?{'Set-Cookie':user.cookie}:{})}});
 }catch{return Response.json({error:'Corti talegenkendelse kunne ikke kontaktes.'},{status:504,headers:cors});}
}
