export type UploadedFile={id:string;name:string;mime:string;size:number;visions:number;createdAt:number};

const MAX_FILE_SIZE=150_000_000;
const CHUNK_SIZE=8_000_000;
const EXTRACT_LIMIT=25_000_000;

async function smallJpeg(canvas:HTMLCanvasElement){
 for(const size of [640,480,320,240]){
  const c=document.createElement('canvas'),scale=Math.min(1,size/Math.max(canvas.width,canvas.height));
  c.width=Math.max(1,Math.round(canvas.width*scale));c.height=Math.max(1,Math.round(canvas.height*scale));
  const ctx=c.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(canvas,0,0,c.width,c.height);
  for(const q of [.65,.4,.2]){const blob=await new Promise<Blob|null>(resolve=>c.toBlob(resolve,'image/jpeg',q));if(blob&&blob.size<=9000)return blob;}
 }
 throw Error('Billedet kunne ikke klargøres til modellen.');
}

async function imagePreview(file:File){
 const url=URL.createObjectURL(file);
 try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas'),scale=Math.min(1,1000/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);return await smallJpeg(canvas);}
 finally{URL.revokeObjectURL(url);}
}

async function officeText(file:File){
 const {unzipSync,strFromU8}=await import('fflate');let entries=0,total=0;
 const files=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:f=>{if(!/^(word\/document.xml|xl\/sharedStrings.xml|xl\/worksheets\/sheet\d+.xml|ppt\/slides\/slide\d+.xml)$/.test(f.name)||f.originalSize>=1000000)return false;entries++;total+=f.originalSize;if(entries>40||total>8000000)return false;return true;}});
 return Object.keys(files).slice(0,40).map(name=>{const xml=new DOMParser().parseFromString(strFromU8(files[name]),'application/xml');return Array.from(xml.querySelectorAll('t')).map(n=>n.textContent||'').join(' ');}).join('\n').slice(0,40000);
}

async function pdfText(file:File){
 const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.min.mjs';
 const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true});
 try{
  const pdf=await task.promise;let text='';
  for(let n=1;n<=Math.min(pdf.numPages,20);n++){const page=await pdf.getPage(n),content=await page.getTextContent();text+=content.items.map(item=>'str' in item?item.str:'').join(' ')+'\n';if(text.length>40000)break;}
  let vision:Blob|undefined;
  if(!text.trim()){const page=await pdf.getPage(1),viewport=page.getViewport({scale:1}),canvas=document.createElement('canvas'),scale=Math.min(1,1000/Math.max(viewport.width,viewport.height)),view=page.getViewport({scale});canvas.width=Math.round(view.width);canvas.height=Math.round(view.height);await page.render({canvasContext:canvas.getContext('2d')!,viewport:view}).promise;vision=await smallJpeg(canvas);}
  return {excerpt:`PDF med ${pdf.numPages} sider. Udtræk fra højst de første 20 sider:\n${text.slice(0,39000)}`.trim(),vision};
 }finally{await task.destroy();}
}

function base64(bytes:Uint8Array){let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary);}

async function metadata(file:File){
 let excerpt='',vision:Blob|undefined;
 if(/\.(txt|md|csv|json|js|ts|tsx|jsx|html|css|xml|svg|log|py|yml|yaml|sql)$/i.test(file.name))excerpt=(await file.slice(0,180000).text()).slice(0,40000);
 else if(file.size<=EXTRACT_LIMIT&&/\.(docx|xlsx|pptx)$/i.test(file.name))excerpt=await officeText(file);
 else if(file.size<=EXTRACT_LIMIT&&/\.pdf$/i.test(file.name)){const result=await pdfText(file);excerpt=result.excerpt;vision=result.vision;}
 else if(file.size<=EXTRACT_LIMIT&&/^image\/(jpeg|png|webp|gif)$/.test(file.type))vision=await imagePreview(file);
 if(excerpt.includes('\0'))excerpt='';
 const visionBase64=vision?base64(new Uint8Array(await vision.arrayBuffer())):'';
 return {excerpt,vision:visionBase64};
}

async function json<T>(response:Response){
 const data=await response.json().catch(()=>({})) as T&{error?:string};
 if(!response.ok)throw Error(data.error||'Uploaden mislykkedes.');
 return data;
}

export async function uploadFile(file:File,onProgress?:(percent:number)=>void):Promise<UploadedFile>{
 if(file.size<=0)throw Error(`${file.name}: filen er tom.`);
 if(file.size>MAX_FILE_SIZE)throw Error(`${file.name}: Leafy kan gemme filer på op til 150 MB. Lydtransskriptioner følger Cortis grænse på 150 MB og 120 minutter.`);
 const extra=await metadata(file);
 let uploadId='';
 try{
  const start=await json<{uploadId?:string;chunkSize?:number}>(await fetch('/api/leafy/files',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start',name:file.name,mime:file.type||'application/octet-stream',size:file.size,...extra})}));
  if(!start.uploadId||!start.chunkSize)throw Error('Leafy kunne ikke starte filuploaden.');
  uploadId=start.uploadId;const parts:{partNumber:number;etag:string}[]=[];
  for(let offset=0,partNumber=1;offset<file.size;offset+=start.chunkSize,partNumber++){
   const chunk=file.slice(offset,Math.min(file.size,offset+start.chunkSize)),form=new FormData();form.set('uploadId',uploadId);form.set('partNumber',String(partNumber));form.set('chunk',chunk,`part-${partNumber}.bin`);
   const part=await json<{partNumber?:number;etag?:string}>(await fetch('/api/leafy/files',{method:'POST',body:form}));
   if(part.partNumber!==partNumber||!part.etag)throw Error(`Del ${partNumber} af filen blev ikke bekræftet.`);
   parts.push({partNumber:part.partNumber,etag:part.etag});onProgress?.(Math.min(99,Math.round(Math.min(file.size,offset+chunk.size)/file.size*100)));
  }
  const complete=await json<{file?:UploadedFile}>(await fetch('/api/leafy/files',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'complete',uploadId,parts})}));
  if(!complete.file)throw Error('Leafy modtog ikke den samlede fil.');uploadId='';onProgress?.(100);return complete.file;
 }catch(error){
  if(uploadId)void fetch('/api/leafy/files',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'abort',uploadId})}).catch(()=>{});
  throw error;
 }
}
