import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const W=512;
const read=(p,w,h)=>execFileSync('convert',[p,'-resize',`${w}x${h}!`,'-depth','8','rgba:-'],{maxBuffer:40e6});
const original=read('public/leafy/leafy.png',W,W);
function bounds(data,w,h){const rows=[];for(let y=0;y<h;y++){let lo=w,hi=-1;for(let x=0;x<w;x++){const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];if(g>r*1.12&&g>b*1.2&&g>25){lo=Math.min(lo,x);hi=Math.max(hi,x);}}rows.push([lo,hi]);}return rows;}
const target=[];for(let y=0;y<W;y++){let lo=W,hi=-1;for(let x=0;x<W;x++)if(original[(y*W+x)*4+3]>180){lo=Math.min(lo,x);hi=x;}target.push([lo,hi]);}
const valid=target.map((p,i)=>p[1]>p[0]?i:-1).filter(i=>i>=0),ty0=valid[0],ty1=valid.at(-1);
function normalize(data,w,h){
 const rows=bounds(data,w,h),valid=rows.map((p,i)=>p[1]-p[0]>2?i:-1).filter(i=>i>=0),sy0=valid[0],sy1=valid.at(-1),out=Buffer.alloc(W*W*4);
 if(!valid.length)throw Error('No leaf pixels');
 for(let y=ty0;y<=ty1;y++){
  const [left,right]=target[y];if(right<=left)continue;
  const sy=Math.max(sy0,Math.min(sy1,Math.round(sy0+(y-ty0)/(ty1-ty0)*(sy1-sy0))));let [sl,sr]=rows[sy];if(sr<=sl)continue;
  for(let x=left;x<=right;x++){
   const sx=Math.max(sl,Math.min(sr,Math.round(sl+(x-left)/(right-left)*(sr-sl))));const from=(sy*w+sx)*4,to=(y*W+x)*4;data.copy(out,to,from,from+3);out[to+3]=original[to+3];
  }
 }
 return out;
}
function save(data,p){execFileSync('convert',['-size','512x512','-depth','8','rgba:-',p],{input:data,maxBuffer:10e6});}
const atlas=read('assets/leafy/expression-atlas-source.png',1256,1256),cell=314,names=['idle','happy','curious','sleepy'];
const normalized=Buffer.alloc(2048*2048*4);
for(let row=0;row<4;row++)for(let col=0;col<4;col++){
 const cut=Buffer.alloc(cell*cell*4);for(let y=0;y<cell;y++)atlas.copy(cut,y*cell*4,((row*cell+y)*1256+col*cell)*4,((row*cell+y)*1256+col*cell+cell)*4);
 const frame=normalize(cut,cell,cell);save(frame,`public/leafy/expressions/${names[row]}-${col}.png`);
 for(let y=0;y<W;y++)frame.copy(normalized,((row*W+y)*2048+col*W)*4,y*W*4,(y+1)*W*4);
}
execFileSync('convert',['-size','2048x2048','-depth','8','rgba:-','public/leafy/expressions/atlas.png'],{input:normalized,maxBuffer:25e6});
save(normalize(read('assets/leafy/back-source.png',1024,1024),1024,1024),'public/leafy/back.png');
const order=[0,3,0,1,2,1,0],duration=[1500,800,1200,70,100,70,900];
for(const name of names){const args=[];for(let i=0;i<order.length;i++)args.push('-delay',String(duration[i]/10),`public/leafy/expressions/${name}-${order[i]}.png`);args.push('-loop','0','-dispose','background',`public/leafy/expressions/${name}.gif`);execFileSync('convert',args,{maxBuffer:10e6});}
fs.writeFileSync('components/leafy/sequence.json',JSON.stringify({order,duration,names},null,2));
console.log('Prepared 16 aligned frames, 4 GIF loops, atlas and rear texture.');
