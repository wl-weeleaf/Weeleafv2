import {publicUrl,type BrowserPage} from './actions';

const sources={
 law:['retsinformation.dk','eur-lex.europa.eu','domstol.dk','ft.dk'],
 police:['politi.dk','retsinformation.dk','domstol.dk','eur-lex.europa.eu'],
 health:['sst.dk','retsinformation.dk','sundhed.dk','laegemiddelstyrelsen.dk','foedevarestyrelsen.dk'],
 work:['at.dk','retsinformation.dk','borger.dk','star.dk'],
 tax:['skat.dk','retsinformation.dk','eur-lex.europa.eu','skatteministeriet.dk'],
 public:['retsinformation.dk','borger.dk','eur-lex.europa.eu','lifeindenmark.borger.dk','virk.dk'],
 environment:['mst.dk','retsinformation.dk','ens.dk','at.dk','eur-lex.europa.eu'],
 finance:['finanstilsynet.dk','retsinformation.dk','forbrug.dk','skat.dk'],
} as const;
type SourceCategory=keyof typeof sources;
function text(value:string){return value.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(1114111,Number(n)))).replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();}
function hostIs(host:string,domain:string){return host===domain||host.endsWith(`.${domain}`);}
export function sourceClass(value:string){const host=new URL(value).hostname.toLowerCase();if(host==='europa.eu'||host.endsWith('.europa.eu'))return 'Officiel EU-kilde';if(Object.values(sources).flat().some(domain=>hostIs(host,domain)))return 'Officiel dansk myndighed eller primærkilde';return 'Anden kilde';}
export function sourceDomains(query:string):string[]{
 const q=query.toLocaleLowerCase('da-DK');let category:SourceCategory='public';
 if(/politi|efterforskn|anhold|sigtet|straff|kriminal|afhør|beredskab/.test(q))category='police';
 else if(/sygdom|sundhed|medicin|lægemiddel|læge|behandling|symptom|fødevare/.test(q))category='health';
 else if(/skat|moms|fradrag|skattemæssig|afgift|økonomisk støtte/.test(q))category='tax';
 else if(/ansætt|arbejdsmiljø|arbejdsskade|dagpenge|kontanthjælp|barsel|feriepenge|lønmodtager/.test(q))category='work';
 else if(/rente|lån|forsikring|pension|forbruger|investering|finanstilsyn/.test(q))category='finance';
 else if(/klima|miljø|energi|kvælstof|natur|affald|vandmiljø/.test(q))category='environment';
 else if(/lov|regler|retsinformation|dom|bekendtgørelse|paragraf|rettighed|pligt|forordning|direktiv|gdpr|persondata/.test(q))category='law';
 return [...sources[category]];
}
async function fetchPublic(input:string){
 let url=publicUrl(input);
 for(let n=0;n<5;n++){
  const response=await fetch(url.href,{redirect:'manual',headers:{Accept:'text/html,text/plain,application/xhtml+xml,application/rss+xml','User-Agent':'Leafy/0.1 public-reader'},signal:AbortSignal.timeout(10000)});
  if(response.status>=300&&response.status<400){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw new Error('Siden returnerede en ugyldig omdirigering.');url=publicUrl(new URL(location,url).href);continue;}
  if(!response.ok){await response.body?.cancel();throw new Error(`Siden kunne ikke læses (HTTP ${response.status}).`);}
  if(!/text\/|application\/(xhtml\+xml|rss\+xml|xml|json)/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw new Error('Denne filtype kan ikke læses i webvisningen.');}
  const reader=response.body?.getReader();if(!reader)throw new Error('Siden er tom.');
  const decoder=new TextDecoder();let html='',bytes=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>800000)throw new Error('Siden er for stor til webvisningen.');html+=decoder.decode(value,{stream:true});}html+=decoder.decode();}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  return {url:url.href,html,lastModified:response.headers.get('last-modified')||undefined,retrievedAt:new Date().toISOString()};
 }
 throw new Error('Siden omdirigerer for mange gange.');
}
export async function readPage(input:string,offset=0):Promise<BrowserPage>{
 if(!Number.isSafeInteger(offset)||offset<0||offset>2_000_000)throw new Error('Sideafsnittet er ugyldigt.');
 const {url,html,lastModified,retrievedAt}=await fetchPublic(input),links:BrowserPage['links']=[];
 for(const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  try{const target=publicUrl(new URL(match[1].replace(/&amp;/g,'&'),url).href).href;const label=text(match[2]);if(label&&!links.some(x=>x.url===target))links.push({text:label.slice(0,160),url:target});}catch{}
  if(links.length>=60)break;
 }
 const meta=html.match(/<meta\b[^>]*(?:property|name)=["'](?:article:modified_time|dateModified|date-modified|last-modified)["'][^>]*>/i)?.[0]||'';const modified=meta.match(/content=["']([^"']+)/i)?.[1]||html.match(/(?:dateModified|date-modified|last-modified)\s*["':=]+([^"'<>\s]+)/i)?.[1];
 const bodyText=text(html),chunk=bodyText.slice(offset,offset+12000);
 return {url,title:text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||new URL(url).hostname),text:chunk,links,retrievedAt,lastModified:modified||lastModified,sourceClass:sourceClass(url),offset,totalLength:bodyText.length,hasMore:offset+chunk.length<bodyText.length};
}
function decodeXml(value:string){return text(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').trim();}
function parseResults(html:string){
 const results:{title:string;url:string;description:string;publishedAt?:string;sourceClass:string}[]=[];
 for(const match of html.matchAll(/<item>([\s\S]*?)<\/item>/gi)){
  const item=match[1],raw=item.match(/<link>([\s\S]*?)<\/link>/i)?.[1]||item.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1];
  try{if(raw){const url=publicUrl(decodeXml(raw)).href;const published=decodeXml(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]||'');results.push({title:decodeXml(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||''),url,description:decodeXml(item.match(/<description>([\s\S]*?)<\/description>/i)?.[1]||''),...(published?{publishedAt:published}:{}),sourceClass:sourceClass(url)});}}catch{}
  if(results.length>=10)break;
 }
 return results;
}
export async function searchWeb(query:string){
 if(!query.trim()||query.length>500)throw new Error('Søgningen er tom eller for lang.');
 const domains=sourceDomains(query),retrievedAt=new Date().toISOString(),official:ReturnType<typeof parseResults>=[],general:ReturnType<typeof parseResults>=[];
 // Search primary Danish/EU sources first. A broad search is retained as context,
 // but it cannot outrank official material in the returned evidence set.
 for(const domain of domains.slice(0,3)){
  try{const {html}=await fetchPublic(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(`site:${domain} ${query}`)}`);for(const result of parseResults(html))if(hostIs(new URL(result.url).hostname.toLowerCase(),domain)&&!official.some(x=>x.url===result.url))official.push(result);}catch{}
 }
 try{const {html}=await fetchPublic(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`);general.push(...parseResults(html));}catch{}
 for(const result of general)if(result.sourceClass!=='Anden kilde'&&!official.some(x=>x.url===result.url))official.push(result);
 const others=general.filter(result=>result.sourceClass==='Anden kilde'&&!official.some(x=>x.url===result.url));
 const results=[...official.slice(0,5),...others.slice(0,3)].slice(0,8);
 if(!results.length)throw new Error('Søgetjenesten fandt ingen læsbare resultater. Prøv en konkret webadresse eller en anden formulering.');
 return {query,retrievedAt,sourcePolicy:'Officielle danske og relevante EU-kilder søges først; øvrige søgeresultater er sekundær kontekst.',preferredDomains:domains,officialResultCount:official.length,results};
}
