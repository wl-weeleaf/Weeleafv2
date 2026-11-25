'use client';
import {useEffect,useRef,useState} from 'react';
export function useMicrophone(){
 const [stream,setStream]=useState<MediaStream|null>(null),[muted,setMuted]=useState(false),[error,setError]=useState(''),[speaking,setSpeaking]=useState(false);
 const ref=useRef<MediaStream|null>(null),generation=useRef(0);
 function stop(){generation.current++;ref.current?.getTracks().forEach(t=>t.stop());ref.current=null;setStream(null);setSpeaking(false);}
 async function start(deviceId=''){stop();const gen=generation.current;setError('');try{
  const s=await navigator.mediaDevices.getUserMedia({video:false,audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,...(deviceId?{deviceId:{exact:deviceId}}:{})}});
  if(gen!==generation.current){s.getTracks().forEach(t=>t.stop());return;}ref.current=s;setStream(s);setMuted(false);s.getAudioTracks()[0].onended=stop;
 }catch(e){if(gen===generation.current)setError((e as Error).message);}}
 function mute(){if(!ref.current)return;const next=!muted;ref.current.getAudioTracks().forEach(t=>{t.enabled=!next;});setMuted(next);}
 useEffect(()=>{if(!stream||muted)return;const ctx=new AudioContext(),source=ctx.createMediaStreamSource(stream),analyser=ctx.createAnalyser();analyser.fftSize=512;source.connect(analyser);const samples=new Float32Array(512);let last=0;const timer=setInterval(()=>{analyser.getFloatTimeDomainData(samples);const rms=Math.sqrt(samples.reduce((n,x)=>n+x*x,0)/samples.length);if(rms>.025)last=Date.now();setSpeaking(Date.now()-last<600);},120);return()=>{clearInterval(timer);source.disconnect();void ctx.close();setSpeaking(false);};},[stream,muted]);
 useEffect(()=>()=>{generation.current++;ref.current?.getTracks().forEach(t=>t.stop());},[]);
 return {stream,muted,error,speaking,start,stop,mute};
}
