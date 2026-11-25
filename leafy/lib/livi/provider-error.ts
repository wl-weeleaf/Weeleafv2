/** Extract the small, useful error message from Corti/OpenAI-compatible APIs. */
export function providerErrorDetail(raw:string,maxLength=360){
 let value:unknown;
 try{value=JSON.parse(raw);}catch{return raw.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,maxLength);}
 if(!value||typeof value!=='object')return String(value??'').slice(0,maxLength);
 const root=value as Record<string,unknown>,error=root.error;
 const detail=root.detail;
 const candidates:unknown[]=[];
 if(typeof error==='string')candidates.push(error);
 if(error&&typeof error==='object'){
  const nested=error as Record<string,unknown>;
  candidates.push(nested.message,nested.detail,nested.error_description,nested.code);
 }
 if(typeof detail==='string')candidates.push(detail);
 if(detail&&typeof detail==='object'){
  const nested=detail as Record<string,unknown>;
  candidates.push(nested.message,nested.detail,nested.code);
 }
 candidates.unshift(detail,error&&typeof error==='object'?(error as Record<string,unknown>).message:undefined);
 candidates.push(root.message,root.error_description);
 const text=candidates.find(candidate=>typeof candidate==='string'&&candidate.trim());
 return typeof text==='string'?text.replace(/\s+/g,' ').replace(/(?:Bearer\s+|xi-api-key[=: ]+|sk-[A-Za-z0-9_-]{8})\S+/gi,'[redacted]').slice(0,maxLength):'';
}
