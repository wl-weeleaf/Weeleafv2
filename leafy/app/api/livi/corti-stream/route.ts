import {cortiAccessToken,cortiClientCredentials,cortiRegion} from '@/lib/livi/config';
import {decryptCortiCredentials} from '@/lib/livi/credentials';
import {checkOrigin,visitor} from '@/lib/leafy/session';
import {rateLimit} from '@/lib/leafy/store';

export const dynamic='force-dynamic';

/** Create one Corti Streams interaction for the user-selected long-session mode. */
export async function POST(request:Request){
 try{
  checkOrigin(request);
  const user=await visitor(request);await rateLimit(user.owner,'corti-stream-session',12);
  const saved=await decryptCortiCredentials(request),{clientId,clientSecret,tenant}=cortiClientCredentials(saved);
  if(!(clientId&&clientSecret&&tenant))return Response.json({error:'Corti Streams kræver Client ID, Client Secret og Tenant i indstillingerne.'},{status:503});
  const region=cortiRegion();
  // The full OAuth token is used only server-side to create an interaction.
  const apiToken=await cortiAccessToken(saved);
  // Preflight the browser-only scope so failed stream-token grants do not
  // leave an empty interaction at Corti.
  const streamToken=await cortiAccessToken(saved,true,['streams']);
  const created=await fetch(`https://api.${region}.corti.app/v2/interactions/`,{
   method:'POST',signal:AbortSignal.timeout(15000),
   headers:{Authorization:`Bearer ${apiToken}`,'Content-Type':'application/json','Tenant-Name':tenant},
   body:JSON.stringify({encounter:{identifier:crypto.randomUUID(),title:'Leafy Live · dansk samtale',status:'planned',type:'first_consultation'}})
  });
  if(!created.ok){await created.body?.cancel();return Response.json({error:`Corti kunne ikke oprette en Streams-session (${created.status}). Kontrollér API-rettighederne for Interactions.`},{status:502});}
  const interaction=await created.json() as {interactionId?:string;websocketUrl?:string};
  if(!interaction.interactionId||!interaction.websocketUrl)return Response.json({error:'Corti returnerede ikke et interaction-id og en WebSocket-adresse.'},{status:502});
  // The browser receives only a short-lived, Streams-only token.
  const websocket=new URL(interaction.websocketUrl);
  if(websocket.protocol!=='wss:'||!websocket.hostname.endsWith('.corti.app'))return Response.json({error:'Corti returnerede en ugyldig WebSocket-adresse.'},{status:502});
  websocket.searchParams.set('token',`Bearer ${streamToken}`);
  const headers=new Headers({'Cache-Control':'no-store, private','Pragma':'no-cache'});if(user.cookie)headers.set('Set-Cookie',user.cookie);
  return Response.json({url:websocket.toString(),interactionId:interaction.interactionId},{headers});
 }catch(error){return Response.json({error:(error as Error).message||'Corti Streams kunne ikke startes.'},{status:502});}
}
