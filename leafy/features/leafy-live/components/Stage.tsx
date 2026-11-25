'use client';
import {useEffect,useRef} from 'react';
import type {BackgroundMode,LayoutPreset,LiveMode,Presentation,Question,Rect} from '../types';
import {directScene,easeLayout} from '../services/sceneDirector.mjs';

export type StageState={background:BackgroundMode;side:'auto'|'left'|'right';preset:LayoutPreset;mode:LiveMode;camera:MediaStream|null;content:Presentation|null;question:Question|null;caption:string;status:string};
function fit(ctx:CanvasRenderingContext2D,source:CanvasImageSource,r:Rect,mirror=false){
 const v=source as HTMLVideoElement,img=source as HTMLImageElement,canvas=source as HTMLCanvasElement;
 const w=v.videoWidth||img.naturalWidth||canvas.width,h=v.videoHeight||img.naturalHeight||canvas.height;if(!w||!h||r.w<=0||r.h<=0)return;
 const scale=Math.min(r.w/w,r.h/h),dw=w*scale,dh=h*scale,x=r.x+(r.w-dw)/2,y=r.y+r.h-dh;
 ctx.save();if(mirror){ctx.translate(x+dw,y);ctx.scale(-1,1);ctx.drawImage(source,0,0,dw,dh);}else ctx.drawImage(source,x,y,dw,dh);ctx.restore();
}
function wrap(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,w:number,line:number,max:number){if(w<=0||max<=0)return;let value='',n=0;for(const word of text.replace(/\s+/g,' ').split(' ')){const test=value+word+' ';if(ctx.measureText(test).width>w&&value){ctx.fillText(value,x,y+n*line);value=word+' ';if(++n>=max)return;}else value=test;}if(n<max)ctx.fillText(value,x,y+n*line);}
export default function Stage({state,leafyFrame,onCanvas,onCameraStatus,onEyeTarget,onFPS}:{state:StageState;leafyFrame:React.RefObject<HTMLCanvasElement|null>;onCanvas:(canvas:HTMLCanvasElement)=>void;onCameraStatus:(status:string)=>void;onEyeTarget:(point:{x:number;y:number}|null)=>void;onFPS?:(fps:number)=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),data=useRef(state),statusRef=useRef(onCameraStatus);
 const eye=useRef<{x:number;y:number;at:number}|null>(null);
 const cameraVideo=useRef<HTMLVideoElement|null>(null);
 useEffect(()=>{data.current=state;statusRef.current=onCameraStatus;},[state,onCameraStatus]);
 useEffect(()=>{
  if(!state.camera || state.background!=='camera')return;
  const video=document.createElement('video');
  video.muted=true;video.playsInline=true;video.srcObject=state.camera;
  cameraVideo.current=video;
  void video.play().then(()=>{if(cameraVideo.current===video)statusRef.current('Kamerabilledet bruges som baggrund.');})
   .catch(()=>{if(cameraVideo.current===video)statusRef.current('Kamerabilledet kunne ikke vises.');});
  let alive=true,ready=false,busy=false;
  const worker=new Worker('/camera/face-worker.js');
  const fail=()=>{ready=false;eye.current=null;statusRef.current('Kamerabilledet vises. Øjenfølgning er utilgængelig.');};
  worker.onerror=fail;
  worker.onmessage=({data})=>{
   if(!alive)return;
   if(data.type==='ready')ready=true;
   if(data.type==='error')fail();
   if(data.type==='face'){
    busy=false;
    if(data.eye)eye.current={...data.eye,at:performance.now()};
   }
  };
  worker.postMessage({type:'init'});
  const timer=setInterval(async()=>{
   if(!ready||busy||video.readyState<2)return;
   busy=true;
   try{
    const bitmap=await createImageBitmap(video,{resizeWidth:320,resizeHeight:Math.max(1,Math.round(320*video.videoHeight/video.videoWidth))});
    if(alive)worker.postMessage({type:'frame',bitmap},[bitmap]);else bitmap.close();
   }catch{busy=false;}
  },150);
  return ()=>{alive=false;clearInterval(timer);worker.terminate();eye.current=null;onEyeTarget(null);cameraVideo.current=null;video.pause();video.srcObject=null;};
 },[state.camera,state.background,onEyeTarget]);
 useEffect(()=>{const el=canvas.current!,ctx=el.getContext('2d',{alpha:false})!;onCanvas(el);const background=new Image();background.src='/room/fallback.jpg';let lastGaze=0,hadEye=false,layout=directScene(),last=0,drawAt=0,frame=0,stopped=false,fpsAt=performance.now(),drawCount=0;
  const pixel=(r:Rect):Rect=>({x:r.x*1280,y:r.y*720,w:r.w*1280,h:r.h*720});
  const draw=(time:number)=>{if(stopped)return;frame=requestAnimationFrame(draw);if(time-drawAt<1000/30-.5)return;drawAt=time;drawCount++;if(time-fpsAt>=1000){onFPS?.(Math.round(drawCount*1000/(time-fpsAt)));drawCount=0;fpsAt=time;}const s=data.current,dt=last?(time-last)/1000:1/30;last=time;
   const target=directScene({preset:s.preset,mode:s.mode,presenterVisible:s.background==='camera'&&!!s.camera,activeContent:!!s.content,audienceQuestion:!!s.question});layout=easeLayout(layout,target,dt);
   ctx.fillStyle='#e6e2cc';ctx.fillRect(0,0,1280,720);if(background.complete&&background.naturalWidth)ctx.drawImage(background,0,0,1280,720);
   const wash=ctx.createLinearGradient(0,0,0,720);wash.addColorStop(0,'#173e1926');wash.addColorStop(1,'#173e191a');ctx.fillStyle=wash;ctx.fillRect(0,0,1280,720);
   const video=cameraVideo.current;
   if(s.background==='camera' && video && video.readyState>=2 && video.videoWidth && video.videoHeight){
    const scale=Math.min(el.width/video.videoWidth,el.height/video.videoHeight);
    const width=video.videoWidth*scale,height=video.videoHeight*scale;
    ctx.fillStyle='#101510';ctx.fillRect(0,0,el.width,el.height);
    ctx.drawImage(video,(el.width-width)/2,(el.height-height)/2,width,height);
   }
   const place=(r:Rect):Rect=>s.side==='left'?{...r,x:1-r.x-r.w}:r;
   const leafyRect=s.side!=='auto'&&!s.content&&s.preset==='AUTO'?{...layout.leafy,x:s.side==='left'?.04:.96-layout.leafy.w}:place(layout.leafy);
   if(time-lastGaze>=120){
    lastGaze=time;
    const targetEye=eye.current;
    if(targetEye && time-targetEye.at<750 && video?.videoWidth && leafyRect.w>.01 && leafyFrame.current){
     const scale=Math.min(1280/video.videoWidth,720/video.videoHeight);
     const eyeX=640+(targetEye.x-.5)*video.videoWidth*scale;
     const eyeY=360+(targetEye.y-.5)*video.videoHeight*scale;
     const rect=pixel(leafyRect),frame=leafyFrame.current;
     const actorHeight=Math.min(rect.h,rect.w*frame.height/Math.max(1,frame.width));
     const clamp=(n:number)=>Math.max(-1,Math.min(1,n));
     onEyeTarget({x:clamp((eyeX-rect.x-rect.w/2)/420),y:clamp((rect.y+rect.h-actorHeight*.57-eyeY)/260)});
     hadEye=true;
    }else if(hadEye){onEyeTarget(null);hadEye=false;}
   }
   for(const r of [leafyRect]){if(!r.w)continue;const q=pixel(r);ctx.save();ctx.filter='blur(12px)';ctx.fillStyle='#20351e33';ctx.beginPath();ctx.ellipse(q.x+q.w/2,q.y+q.h-4,q.w*.34,9,0,0,Math.PI*2);ctx.fill();ctx.restore();}
   if(s.content&&layout.content.w>.07&&layout.content.h>.1){const r=pixel(place(layout.content));ctx.save();ctx.beginPath();ctx.rect(r.x,r.y,r.w,r.h);ctx.clip();ctx.fillStyle='#fffcf3ee';ctx.strokeStyle='#c3a14c';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(r.x,r.y,r.w,r.h,20);ctx.fill();ctx.stroke();const inner={x:r.x+18,y:r.y+52,w:r.w-36,h:r.h-70};ctx.fillStyle='#25472b';ctx.font='600 18px system-ui';ctx.fillText(s.content.title.slice(0,60),r.x+20,r.y+32,r.w-40);if(s.content.source)fit(ctx,s.content.source,inner);else{ctx.font='26px system-ui';wrap(ctx,s.content.text||s.content.description,inner.x,inner.y+30,inner.w,36,Math.floor(inner.h/36));}ctx.restore();}

   if(leafyFrame.current)fit(ctx,leafyFrame.current,pixel(leafyRect));
   if(s.question){const r=pixel(layout.question);ctx.save();ctx.beginPath();ctx.rect(r.x,r.y,r.w,r.h);ctx.clip();ctx.fillStyle='#fffcf2f2';ctx.beginPath();ctx.roundRect(r.x,r.y,r.w,r.h,22);ctx.fill();ctx.fillStyle='#9c7623';ctx.font='600 15px system-ui';ctx.fillText(`${s.question.name} spørger`,r.x+22,r.y+24);ctx.fillStyle='#203e29';ctx.font='22px system-ui';wrap(ctx,s.question.text,r.x+22,r.y+51,r.w-44,26,2);ctx.restore();}
   ctx.fillStyle='#fffcf2cf';ctx.beginPath();ctx.roundRect(26,20,145,34,17);ctx.fill();ctx.fillStyle='#29462e';ctx.font='600 16px system-ui';ctx.fillText('WL · LEAFY LIVE',39,43);
   if(s.status){ctx.fillStyle='#fffcf2cf';ctx.beginPath();ctx.roundRect(1030,20,220,34,17);ctx.fill();ctx.fillStyle='#29462e';ctx.font='15px system-ui';ctx.fillText(s.status,1044,43,190);}
   if(s.caption&&!s.question){ctx.fillStyle='#173421de';ctx.beginPath();ctx.roundRect(210,660,860,42,16);ctx.fill();ctx.fillStyle='#fffdf3';ctx.font='19px system-ui';ctx.fillText(s.caption.replace(/\s+/g,' ').slice(-95),232,688,816);}
  };frame=requestAnimationFrame(draw);return()=>{stopped=true;cancelAnimationFrame(frame);};
 },[leafyFrame,onCanvas,onFPS,onEyeTarget]);
 return <canvas ref={canvas} width={1280} height={720} className="live-stage-canvas" role="img" aria-label="Fælles scene med foredragsholderen, Leafy og præsentationsindhold"/>;
}
