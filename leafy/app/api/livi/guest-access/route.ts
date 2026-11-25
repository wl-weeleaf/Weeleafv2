import {getChatGPTUser} from '@/app/chatgpt-auth';
export const dynamic='force-dynamic';
export async function GET(){
 let owner=false;
 try{owner=!!await getChatGPTUser();}catch{/* Public access is independent of sign-in. */}
 return Response.json({authorized:true,owner,guest:!owner},{headers:{'Cache-Control':'no-store, private'}});
}
