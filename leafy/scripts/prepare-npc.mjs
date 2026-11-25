import fs from 'node:fs';import {execFileSync} from 'node:child_process';
// Reuse silhouette registration, without regenerating earlier GIFs.
const source=fs.readFileSync('scripts/prepare-expressions.mjs','utf8');
const prefix=source.slice(0,source.indexOf('const atlas=')).replace("import fs from 'node:fs';",'').replace("import {execFileSync} from 'node:child_process';",'');
const run=new Function('execFileSync',prefix+"save(normalize(read('assets/leafy/npc-base-source.png',1024,1024),1024,1024),'public/leafy/npc-base.png');");run(execFileSync);
const data=execFileSync('convert',['assets/leafy/mouth-source.png','-resize','1256x1256!','-depth','8','rgba:-'],{maxBuffer:10e6});
const names=['rest','MBP','AA','EE','OH','OO','FV','L'];
for(let i=0;i<8;i++){
 const col=i%4,row=Math.floor(i/4),w=314,h=628;let left=w,right=0,top=h,bottom=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=((row*h+y)*1256+col*w+x)*4,r=data[k],g=data[k+1],b=data[k+2];if(!(r>g*1.8&&b>g*1.5&&r>80)){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
 const width=right-left+1,height=bottom-top+1,out=Buffer.alloc(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const k=((row*h+top+y)*1256+col*w+left+x)*4,o=(y*width+x)*4;data.copy(out,o,k,k+3);out[o+3]=(data[k]>data[k+1]*1.8&&data[k+2]>data[k+1]*1.5&&data[k]>80)?0:255;}
 // One global scale keeps small OO lips small, while all sprites share a fixed centre.
 const targetW=Math.round(width*.82),targetH=Math.round(height*.82);
 execFileSync('convert',['-size',`${width}x${height}`,'-depth','8','rgba:-','-resize',`${targetW}x${targetH}!`,'-gravity','center','-background','none','-extent','256x256',`public/leafy/mouths/${names[i]}.png`],{input:out,maxBuffer:5e6});
}
execFileSync('montage',[...names.map(n=>`public/leafy/mouths/${n}.png`),'-tile','4x2','-geometry','256x256+0+0','-background','none','public/leafy/mouths/atlas.png']);
execFileSync('convert',['-delay','15',...['rest','MBP','AA','EE','OH','OO','FV','L','rest'].map(n=>`public/leafy/mouths/${n}.png`),'-loop','0','-dispose','background','public/leafy/mouths/sequence.gif']);
console.log('Prepared mouthless base and 8 separate mouth sprites.');
