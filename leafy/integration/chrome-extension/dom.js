// Isolated extension world; no page code or model-provided JavaScript is executed.
if(!globalThis.__leafyDOM){
 globalThis.__leafyDOM=(()=>{
  const ids=new WeakMap(),registry=new Map();
  const protectedWords=/mitid|captcha|\b2fa\b|two.factor|one.?time|verification code|sikkerhedskode|bekræftelseskode|adgangskode|password|credit.?card|card.?number|betalingskort|kortnummer|cvv|cvc|checkout|betaling|bankgodkendelse/i;
  const visible=e=>e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden'&&!e.hidden;
  function protectedPage(){
   if(/(^|\.)(mitid|nemid|nets|paypal)\./i.test(location.hostname)||/\/login|\/signin|\/checkout|\/payment|\/authenticate/i.test(location.pathname))return true;
   for(const e of document.querySelectorAll('input,iframe,[role=dialog]')){
    if(!visible(e))continue;
    if(e.type==='password'||protectedWords.test([e.getAttribute('autocomplete'),e.name,e.id,e.placeholder,e.getAttribute('aria-label'),e.getAttribute('src'),e.getAttribute('title')].join(' ')))return true;
   }
   return /mitid|captcha|verification code|bekræftelseskode|indtast.{0,20}(kortnummer|sikkerhedskode)|two.factor authentication/i.test((document.body?.innerText||'').slice(0,10000));
  }
  function observe(){
   registry.clear();if(protectedPage())return {protected:true};
   const elements=[];
   for(const e of document.querySelectorAll('button,a[href],input:not([type=password]):not([type=hidden]),textarea,select,[role=button],[contenteditable=true]')){
    if(!visible(e)||e.disabled||e.closest('[aria-hidden=true]'))continue;
    const label=(e.getAttribute('aria-label')||e.placeholder||e.innerText||e.title||e.name||'').trim().slice(0,160);
    if(!label||protectedWords.test(label)||protectedWords.test(e.type||''))continue;
    let id=ids.get(e);if(!id){id='el_'+crypto.randomUUID().replaceAll('-','');ids.set(e,id);}registry.set(id,e);
    elements.push({id,role:e.getAttribute('role')||e.tagName.toLowerCase(),label,...(e.tagName==='A'?{href:e.href}:{}),...(e.type?{type:e.type}:{})});if(elements.length>=100)break;
   }
   return {page:location.href,title:document.title,text:(document.body?.innerText||'').slice(0,10000),elements};
  }
  function target(action){
   if(protectedPage())return {protected:true};const e=registry.get(action.elementId);if(!e||!e.isConnected||!visible(e)||e.disabled)throw new Error('Elementet findes ikke længere. Observer igen.');
   const currentLabel=(e.getAttribute('aria-label')||e.placeholder||e.innerText||e.title||e.name||'').trim().slice(0,160);if(action.expectedLabel&&action.expectedLabel!==currentLabel)throw new Error('Elementets indhold er ændret. Observer og godkend igen.');
   const label=[e.type,e.name,e.id,e.getAttribute('aria-label'),e.innerText].join(' ');
   if(protectedWords.test(label)||e.type==='password')return {protected:true};
   if(action.action==='click'){
    if(/delete|remove|slet|fjern|purchase|buy|køb|betal|publish|publicér|udgiv/i.test(label))throw new Error('Denne handling skal udføres manuelt.');
    const rect=e.getBoundingClientRect();e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};
   }
   if(action.action==='type'){
    if(!['INPUT','TEXTAREA'].includes(e.tagName)&&!e.isContentEditable)throw new Error('Elementet er ikke et tekstfelt.');
    if(e.tagName==='INPUT'&&!['text','search','email','url','tel'].includes(e.type))throw new Error('Feltet er ikke et almindeligt tekstfelt.');
    e.focus();if(e.select)e.select();else{const range=document.createRange();range.selectNodeContents(e);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);}return {focused:document.activeElement===e};
   }
   if(action.action==='select'){
    if(e.tagName!=='SELECT'||!Array.from(e.options).some(o=>o.value===action.text))throw new Error('Valget findes ikke.');e.value=action.text;e.dispatchEvent(new Event('change',{bubbles:true}));return {ok:true};
   }
   throw new Error('Ukendt elementhandling.');
  }
  function cookieCandidate(choice){
   if(protectedPage())return {protected:true};
   const necessary=/^(afvis alle|afvis|kun nødvendige|kun nødvendige cookies|accepter kun nødvendige|reject all|reject|only necessary|necessary only|essential only|accept necessary|continue without accepting)$/i;
   const all=/^(accepter alle|accepter alle cookies|accept all|accept all cookies|allow all)$/i;
   for(const e of document.querySelectorAll('button,[role=button],input[type=button]')){
    if(!visible(e)||e.disabled)continue;
    const label=(e.innerText||e.value||e.getAttribute('aria-label')||'').trim();
    if(!(choice==='all'?all:necessary).test(label))continue;
    const container=e.closest('[role=dialog],dialog,[id*=cookie i],[class*=cookie i],[id*=consent i],[class*=consent i]');
    if(!container||!/cookie|samtykke|consent/i.test(container.innerText||''))continue;
    e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return {label,x:r.x+r.width/2,y:r.y+r.height/2};
   }
   return null;
  }
  return {observe,target,protectedPage,cookieCandidate};
 })();
}
