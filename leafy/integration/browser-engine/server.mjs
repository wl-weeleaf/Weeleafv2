import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {lookup} from 'node:dns/promises';
import {chromium} from 'playwright';

const token=process.env.LEAFY_BROWSER_TOKEN;
if(!token||token.length<32)throw new Error('Set LEAFY_BROWSER_TOKEN to a random secret of at least 32 characters.');
const browser=await chromium.launch({headless:true});
const sessions=new Map();
function authorized(value){const actual=Buffer.from(value||''),expected=Buffer.from(`Bearer ${token}`);return actual.length===expected.length&&timingSafeEqual(actual,expected);}
function publicAddress(ip){
 if(ip.includes(':'))return !/^(?:\:\:|fc|fd|fe[89ab]|ff)/i.test(ip)&&!ip.toLowerCase().includes('ffff:');
 const p=ip.split('.').map(Number);return p.length===4&&p[0]!==0&&p[0]!==10&&p[0]!==127&&!(p[0]===169&&p[1]===254)&&!(p[0]===172&&p[1]>=16&&p[1]<=31)&&!(p[0]===192&&p[1]===168)&&!(p[0]===100&&p[1]>=64&&p[1]<=127)&&p[0]<224;
}
async function safeUrl(value){
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||!u.hostname.includes('.')||/[\[\]:]/.test(u.hostname))throw new Error('Only public HTTPS URLs are allowed.');
 const addresses=await lookup(u.hostname,{all:true});if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new Error('Private network access is blocked.');return u.href;
}
async function getPage(id){
 let session=sessions.get(id);if(session){session.used=Date.now();return session;}
 if(sessions.size>=8)throw new Error('The browser is at its session limit.');
 const context=await browser.newContext({acceptDownloads:false,permissions:[]});
 await context.route('**/*',async route=>{try{await safeUrl(route.request().url());await route.continue();}catch{await route.abort();}});
 const page=await context.newPage();page.setDefaultTimeout(10000);
 session={context,page,used:Date.now(),chain:Promise.resolve()};sessions.set(id,session);return session;
}
async function snapshot(page){
 const url=page.url();if(url==='about:blank')return {url:'',title:'Ny browser',text:'Navigér til en HTTPS-adresse først.',links:[],controls:[]};
 await safeUrl(url);
 return {url,title:await page.title(),text:(await page.locator('body').innerText()).slice(0,18000),links:await page.locator('a[href]').evaluateAll(nodes=>nodes.slice(0,60).map(a=>({text:a.textContent?.trim().slice(0,120)||'',url:a.href}))),controls:await page.locator('input,textarea,button,a[href]').evaluateAll(nodes=>nodes.slice(0,60).map(el=>({tag:el.tagName.toLowerCase(),type:el.getAttribute('type'),name:el.getAttribute('name'),id:el.id,label:el.getAttribute('aria-label')||el.textContent?.trim().slice(0,80)||el.getAttribute('placeholder')})))};
}
const server=http.createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 if(!authorized(req.headers.authorization)){res.writeHead(401);res.end(JSON.stringify({error:'Unauthorized'}));return;}
 if(req.url==='/health'&&req.method==='GET'){res.end(JSON.stringify({ready:true,engine:'playwright'}));return;}
 if(req.url!=='/action'||req.method!=='POST'){res.writeHead(404);res.end('{}');return;}
 try{
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)throw new Error('Request too large.');}
  const input=JSON.parse(raw);if(!/^[a-f0-9]{64}$/.test(input.session))throw new Error('Invalid session.');
  const session=await getPage(input.session);
  const work=session.chain.then(async()=>{
   const {page}=session;
   if(input.action==='navigate')await page.goto(await safeUrl(input.url),{waitUntil:'domcontentloaded',timeout:15000});
   else if(input.action==='click'||input.action==='fill'){
    if(typeof input.selector!=='string'||input.selector.length>500)throw new Error('Invalid selector.');
    const target=page.locator(input.selector);if(await target.count()!==1)throw new Error('Selector must match exactly one element.');
    if(input.action==='click')await target.click();
    else {if(typeof input.text!=='string'||input.text.length>4000)throw new Error('Invalid field text.');await target.fill(input.text);}
   }else if(input.action!=='snapshot')throw new Error('Unsupported action.');
   return snapshot(page);
  });session.chain=work.catch(()=>{});res.end(JSON.stringify(await work));
 }catch(e){res.writeHead(422);res.end(JSON.stringify({error:e.message}));}
});
server.listen(Number(process.env.PORT||8788),'0.0.0.0');
setInterval(()=>{for(const [id,s] of sessions)if(s.used<Date.now()-20*60000){sessions.delete(id);s.context.close().catch(()=>{});}},60000).unref();
async function shutdown(){server.close();await browser.close();process.exit(0);}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
