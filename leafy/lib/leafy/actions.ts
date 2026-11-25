export type ActionName='read_uploaded_file'|'calculate'|'pc_action'|'read_page'|'web_search'|'create_document'|'create_page'|'create_image'|'create_media'|'browser_action'|'observe_environment'|'navigate'|'click_element'|'type_element'|'remote_computer'|'human_takeover'|'set_interface_language';
export type Artifact={id:string;name:string;mime:string;content:string;createdAt:string};
export type GeneratedMedia={id:string;name:string;mime:string;size:number;kind:'image'|'video'|'sound'|'music';url:string;downloadUrl:string;createdAt:string};
export type BrowserPage={url:string;title:string;text:string;links:{text:string;url:string}[];controls?:{tag:string;type?:string;name?:string;id?:string;label?:string}[];retrievedAt?:string;lastModified?:string;sourceClass?:string;offset?:number;totalLength?:number;hasMore?:boolean};
export type Approval={id:string;name:ActionName;args:Record<string,unknown>;label:string};
export type AgentEvent={state?:import('./environment').LeafyState;environment?:import('./environment').Environment;control?:import('./environment').ControlState;activity?:{label:string;detail?:string;status:'working'|'done'|'blocked'|'waiting'};artifact?:Artifact;media?:GeneratedMedia;browser?:BrowserPage;approval?:Approval;interfaceLanguage?:string};
export const TOOL_PERMISSIONS:Record<ActionName,string>={read_uploaded_file:'read-files',calculate:'calculate',pc_action:'pc-control',read_page:'browser',web_search:'web-search',create_document:'write-files',create_page:'write-files',create_image:'write-files',create_media:'create-media',browser_action:'browser',observe_environment:'browser',navigate:'browser',click_element:'send',type_element:'send',remote_computer:'browser',human_takeover:'browser',set_interface_language:'interface-language'};
export function publicUrl(value:unknown){
 if(typeof value!=='string'||value.length>2048)throw new Error('Webadressen er ugyldig.');
 const url=new URL(value);
 const host=url.hostname.toLowerCase().replace(/\.$/,'');
 if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443'))throw new Error('Brug en offentlig HTTPS-adresse uden loginoplysninger.');
 if(!host.includes('.')||host.includes(':')||/^\[/.test(host)||/^\d+(\.\d+){3}$/.test(host)||/(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host)||host.endsWith('.local')||host.endsWith('.internal'))throw new Error('Lokale og interne adresser er ikke tilladt.');
 return url;
}
export function safeSvg(value:string){
 const svg=value.match(/<svg\b[\s\S]*?<\/svg>/i)?.[0];
 if(!svg||svg.length>180000)throw new Error('Billedet skal være en gyldig SVG-illustration.');
 if(/<(?:script|foreignObject|iframe|image|use|a|style|animate|set)\b|\bon\w+\s*=|(?:href|src)\s*=|url\s*\(|<!DOCTYPE|<!ENTITY|@import/i.test(svg))throw new Error('SVG-billedet indeholder aktive eller eksterne elementer. Prøv igen.');
 return svg;
}
export function artifact(name:string,content:string,mime:string):Artifact{
 const clean=name.replace(/[^a-zA-Z0-9æøåÆØÅ._-]/g,'-').slice(0,100)||'leafy-fil';
 if(!content.trim()||content.length>180000)throw new Error('Filen er tom eller for stor.');
 return {id:crypto.randomUUID(),name:clean,mime,content,createdAt:new Date().toISOString()};
}
export function permissionFor(name:ActionName,args:Record<string,unknown>){if(name==='pc_action')return ['status','list','read','search'].includes(String(args.action))?'read-files':['write','implement','mkdir','import_upload'].includes(String(args.action))?'write-files':'pc-control';
 if(name==='click_element'||name==='type_element')return 'send';
 if(name==='remote_computer'&&['click','type','select'].includes(String(args.action)))return 'send';
 if(name==='browser_action'){
  if(['purchase','delete','publish'].includes(String(args.effect)))return String(args.effect);
  if(/delete|remove|slet|fjern|purge/i.test(String(args.selector)))return 'delete';
  if(/buy|purchase|checkout|betal|køb/i.test(String(args.selector)))return 'purchase';
  // A page click can send, buy or delete. Always require an explicit approval.
  if(args.action==='click'||args.action==='fill')return 'send';
 }
 return TOOL_PERMISSIONS[name];
}
