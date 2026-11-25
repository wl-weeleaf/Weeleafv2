import {FaceSpriteLayers} from '@/components/leafy/FaceSpriteLayers';
import type {LeafyEmojiId} from './catalog';
const images=new Map<string,Promise<HTMLImageElement>>(),cache=new Map<string,Promise<string>>();
export function emojiImage(src:string){let p=images.get(src);if(!p){p=new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Emoji-billedet kunne ikke indlæses.'));image.src=src;});images.set(src,p);p.catch(()=>images.delete(src));}return p;}
let queue=Promise.resolve();
export function leafyEmojiPNG(id:LeafyEmojiId){let p=cache.get(id);if(p)return p;
 p=new Promise<string>((resolve,reject)=>{queue=queue.then(async()=>{await new Promise(r=>setTimeout(r,0));try{resolve(await draw(id));}catch(e){cache.delete(id);reject(e);}});});cache.set(id,p);return p;}
async function draw(id:LeafyEmojiId){
 const [original,clean]=await Promise.all(['/leafy/original-torso.png','/leafy/npc-base.png'].map(emojiImage));const face=new FaceSpriteLayers(original,clean);
 try{
 const closed=['laugh','sleepy','love'].includes(id),happy=['happy','laugh','love','celebrate'].includes(id),thinking=['thinking','curious'].includes(id),mood=happy?'happy':thinking?'curious':id==='sleepy'?'sleepy':'idle';
 face.setEyes(thinking?.65:0,thinking?.45:0,closed?.05:id==='sad'?.75:1,'idle',mood,1);face.setBrows('idle',mood,thinking,1);face.setMouth(happy?'AA':id==='surprised'?'none':id==='sad'?'none':'FV');
 const source=document.createElement('canvas');source.width=source.height=512;const g=source.getContext('2d')!;
 for(const texture of [face.base,face.eyes,face.brows,face.mouth])g.drawImage(texture.image as HTMLCanvasElement,0,0);
 if(id==='wink'){g.drawImage(face.base.image as HTMLCanvasElement,250,230,120,105,250,230,120,105);g.strokeStyle='#173c09';g.lineWidth=5;g.beginPath();g.moveTo(288,278);g.quadraticCurveTo(316,292,340,278);g.stroke();}
 if(id==='love'){for(const x of [168,316]){g.fillStyle='#d26d74';g.beginPath();g.moveTo(x,294);g.bezierCurveTo(x-40,272,x-25,247,x,267);g.bezierCurveTo(x+25,247,x+40,272,x,294);g.fill();}}
 if(id==='surprised'){g.fillStyle='#173008';g.beginPath();g.ellipse(238,350,23,29,0,0,Math.PI*2);g.fill();g.fillStyle='#af7229';g.beginPath();g.ellipse(238,368,14,6,0,0,Math.PI*2);g.fill();}
 if(id==='sad'){g.strokeStyle='#163908';g.lineWidth=7;g.beginPath();g.moveTo(207,361);g.quadraticCurveTo(238,334,269,361);g.stroke();}
 if(['sad','laugh'].includes(id)){for(const x of id==='laugh'?[126,358]:[343]){g.fillStyle='#68b8d3';g.beginPath();g.moveTo(x,288);g.bezierCurveTo(x-19,309,x-12,328,x,328);g.bezierCurveTo(x+12,328,x+19,309,x,288);g.fill();}}
 if(id==='cool'){g.fillStyle='#20382a';g.strokeStyle='#ba974d';g.lineWidth=4;for(const x of [132,280]){g.beginPath();g.roundRect(x,250,73,45,12);g.fill();g.stroke();}g.beginPath();g.moveTo(205,265);g.lineTo(280,265);g.stroke();}
 if(id==='sleepy'){g.fillStyle='#a98132';g.font='bold 32px Arial';g.fillText('z',335,220);g.font='bold 23px Arial';g.fillText('z',360,193);}
 if(id==='celebrate'){for(const [x,y,c] of [[111,200,'#d9b256'],[367,200,'#d9b256'],[128,345,'#527e4c'],[358,345,'#c48364']]){g.fillStyle=c as string;g.fillRect(x as number,y as number,9,18);}}
 const output=document.createElement('canvas');output.width=output.height=160;output.getContext('2d')!.drawImage(source,0,0,160,160);source.width=1;return output.toDataURL('image/png');
 }finally{face.dispose();}
}
