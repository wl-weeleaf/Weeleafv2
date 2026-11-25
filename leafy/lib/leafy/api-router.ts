export type ApiModule=Record<string,unknown>;
/** Explicit Worker dispatch: API requests must never fall through to an HTML page. */
export async function dispatchAPI(request:Request,routes:Record<string,ApiModule>):Promise<Response|null>{
 const path=new URL(request.url).pathname.replace(/\/$/,'');if(!path.startsWith('/api/'))return null;
 for(const [file,module] of Object.entries(routes)){
  const route=file.replace(/^.*?\/app\//,'/').replace(/\/route\.ts$/,'');const names:string[]=[];
  const pattern=route.split('/').map(part=>{if(/^\[.+\]$/.test(part)){const name=part.slice(1,-1);names.push(name.replace(/^\.\.\./,''));return name.startsWith('...')?'(.+)':'([^/]+)';}return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('/');
  const match=path.match(new RegExp('^'+pattern+'$'));if(!match)continue;
  const method=request.method==='HEAD'?'GET':request.method,handler=module[method];
  if(typeof handler!=='function')return Response.json({error:'Metoden understøttes ikke.'},{status:405,headers:{Allow:Object.keys(module).filter(k=>/^(GET|POST|DELETE|PATCH|PUT|OPTIONS)$/.test(k)).join(', '),'Cache-Control':'no-store'}});
  try{const params=Object.fromEntries(names.map((name,i)=>[name,decodeURIComponent(match[i+1])]));const response=await handler(request,{params:Promise.resolve(params)});return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response;}
  catch{return Response.json({error:'Leafys API kunne ikke gennemføre anmodningen. Prøv igen.'},{status:503,headers:{'Cache-Control':'no-store'}});}
 }
 return Response.json({error:'Denne Leafy API-funktion findes ikke i den udgivne version.'},{status:404,headers:{'Cache-Control':'no-store'}});
}
