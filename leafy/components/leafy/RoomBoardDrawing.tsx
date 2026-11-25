'use client';

import {useEffect,useRef,useState} from 'react';
import {Eraser,PenLine,RotateCcw,X} from 'lucide-react';

type Point={x:number;y:number};
type Stroke={points:Point[];color:string;width:number};
const activities=[
 {id:'write',label:'Skriv',prompt:'Skriv en sætning med dine egne ord.'},
 {id:'spell',label:'Stav',prompt:'Øv stavning: skriv “bæredygtighed”.'},
 {id:'math',label:'Regn',prompt:'Regn ud: 24 + 18 ='},
 {id:'phrase',label:'Formulér',prompt:'Forklar en idé kort og tydeligt.'},
] as const;

export default function RoomBoardDrawing(){
 const [open,setOpen]=useState(false),[activity,setActivity]=useState<(typeof activities)[number]['id']>('write');
 const canvas=useRef<HTMLCanvasElement>(null),strokes=useRef<Stroke[]>([]),active=useRef<Stroke|null>(null),size=useRef({width:0,height:0});
 const selected=activities.find(item=>item.id===activity)!;

 function redraw(){
  const element=canvas.current;if(!element)return;
  const context=element.getContext('2d');if(!context)return;
  const {width,height}=size.current,dpr=window.devicePixelRatio||1;
  context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);
  for(const stroke of [...strokes.current,...(active.current?[active.current]:[])]){
   if(!stroke.points.length)continue;
   context.beginPath();context.strokeStyle=stroke.color;context.lineWidth=stroke.width;context.lineCap='round';context.lineJoin='round';
   context.moveTo(stroke.points[0].x*width,stroke.points[0].y*height);
   for(const point of stroke.points.slice(1))context.lineTo(point.x*width,point.y*height);
   if(stroke.points.length===1){context.lineTo(stroke.points[0].x*width+.1,stroke.points[0].y*height+.1);}
   context.stroke();
  }
 }

 useEffect(()=>{
  const element=canvas.current;if(!element)return;
  const resize=()=>{const rect=element.getBoundingClientRect(),dpr=window.devicePixelRatio||1;size.current={width:rect.width,height:rect.height};element.width=Math.max(1,Math.round(rect.width*dpr));element.height=Math.max(1,Math.round(rect.height*dpr));redraw();};
  const observer=new ResizeObserver(resize);observer.observe(element);resize();
  return()=>observer.disconnect();
 },[open]);

 function start(event:React.PointerEvent<HTMLCanvasElement>){
  if(!open)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);
  const rect=event.currentTarget.getBoundingClientRect();active.current={points:[{x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height}],color:'#29452b',width:3};redraw();
 }
 function move(event:React.PointerEvent<HTMLCanvasElement>){
  if(!active.current)return;event.preventDefault();const rect=event.currentTarget.getBoundingClientRect();
  active.current.points.push({x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))});redraw();
 }
 function end(){if(!active.current)return;strokes.current.push(active.current);active.current=null;redraw();}

 if(!open)return <button type="button" className="room-board-draw-trigger" aria-label="Åbn tegnefunktionen på tavlen" onClick={event=>{event.stopPropagation();setOpen(true);}}><PenLine size={15}/> Tegn</button>;

 return <div className="room-board-drawing" onClick={event=>event.stopPropagation()}>
  <div className="room-board-draw-tools">
   <div className="room-board-practice-tabs" role="group" aria-label="Vælg øvelse">{activities.map(item=><button key={item.id} type="button" aria-pressed={activity===item.id} onClick={()=>setActivity(item.id)}>{item.label}</button>)}</div>
   <span className="room-board-practice-prompt">{selected.prompt}</span>
   <div className="room-board-draw-actions">
    <button type="button" aria-label="Fortryd seneste streg" title="Fortryd" onClick={()=>{strokes.current.pop();redraw();}}><RotateCcw size={15}/></button>
    <button type="button" aria-label="Ryd tavlen" title="Ryd" onClick={()=>{strokes.current=[];active.current=null;redraw();}}><Eraser size={15}/></button>
    <button type="button" aria-label="Luk tegnefunktionen" title="Luk" onClick={()=>setOpen(false)}><X size={17}/></button>
   </div>
  </div>
  <canvas ref={canvas} className="room-board-draw-canvas" aria-label={`Tegnefelt. ${selected.prompt}`} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}/>
 </div>;
}
