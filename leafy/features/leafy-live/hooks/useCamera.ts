'use client';
import {useEffect,useRef,useState} from 'react';
export function useCamera(){
 const [stream,setStream]=useState<MediaStream|null>(null),[devices,setDevices]=useState<MediaDeviceInfo[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const current=useRef<MediaStream|null>(null),generation=useRef(0);
 const refresh=async()=>{if(navigator.mediaDevices)setDevices(await navigator.mediaDevices.enumerateDevices());};
 function stop(){generation.current++;current.current?.getTracks().forEach(t=>t.stop());current.current=null;setStream(null);setBusy(false);}
 async function start(deviceId=''){
  stop();const gen=generation.current;setError('');setBusy(true);
  try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Kamera kræver HTTPS og en browser med kamera-adgang.');
   const s=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30},...(deviceId?{deviceId:{exact:deviceId}}:{})},audio:false});
   if(gen!==generation.current){s.getTracks().forEach(t=>t.stop());return;}current.current=s;setStream(s);s.getVideoTracks()[0].onended=()=>stop();await refresh();
  }catch(e){if(gen===generation.current)setError((e as Error).message);}finally{if(gen===generation.current)setBusy(false);}
 }
 useEffect(()=>{let active=true;const readDevices=()=>{if(navigator.mediaDevices)void navigator.mediaDevices.enumerateDevices().then(items=>{if(active)setDevices(items);}).catch(()=>{});};const initial=setTimeout(readDevices,0),change=()=>readDevices();navigator.mediaDevices?.addEventListener('devicechange',change);return()=>{active=false;clearTimeout(initial);generation.current++;current.current?.getTracks().forEach(t=>t.stop());navigator.mediaDevices?.removeEventListener('devicechange',change);};},[]);
 return {stream,devices,busy,error,start,stop,refresh};
}
