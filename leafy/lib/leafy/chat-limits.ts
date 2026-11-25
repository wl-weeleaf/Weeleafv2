import {rateLimit} from './store';

export class PublicChatRateLimitError extends Error{
 constructor(){super('Leafy har nået sin midlertidige samtalegrænse. Prøv igen senere.');this.name='PublicChatRateLimitError';}
}

export async function enforcePublicChatLimits(request:Request,visitorId:string,consume=rateLimit){
 try{
  await consume(visitorId,'chat-visitor',240);
  const address=request.headers.get('cf-connecting-ip');
  if(address){
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(address));
   const hashedAddress=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
   await consume(hashedAddress,'chat-network',600);
  }
  await consume('public-site','chat-global',3000);
 }catch(error){
  if(error instanceof PublicChatRateLimitError)throw error;
  if(error instanceof Error&&/timegrænse/i.test(error.message))throw new PublicChatRateLimitError();
  throw error;
 }
}
