import {visitor,checkOrigin,readJson} from '@/lib/leafy/session';
import {settings,setSettings} from '@/lib/leafy/settings';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const u=await visitor(request);return Response.json(await settings(u.owner),{headers:{'Cache-Control':'no-store',...(u.cookie?{'Set-Cookie':u.cookie}:{})}});}catch(e){return Response.json({error:(e as Error).message},{status:503});}}
export async function POST(request:Request){try{checkOrigin(request);const u=await visitor(request),b=await readJson(request);if(typeof b.autoCookies!=='boolean'||!['necessary','all'].includes(String(b.cookieChoice)))throw Error('Ugyldige cookieindstillinger.');return Response.json(await setSettings(u.owner,{autoCookies:b.autoCookies,cookieChoice:String(b.cookieChoice)}),{headers:{'Cache-Control':'no-store',...(u.cookie?{'Set-Cookie':u.cookie}:{})}});}catch(e){return Response.json({error:(e as Error).message},{status:422});}}
