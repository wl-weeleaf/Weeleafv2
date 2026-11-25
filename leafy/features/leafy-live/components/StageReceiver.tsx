'use client';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {receiveOutput} from '../services/output';
import '../live.css';
const subscribeToLocation=(callback:()=>void)=>{window.addEventListener('popstate',callback);return()=>window.removeEventListener('popstate',callback);};
const getLocationSearch=()=>window.location.search;
const getServerSearch=()=>'';
export default function StageReceiver(){const video=useRef<HTMLVideoElement>(null),[status,setStatus]=useState('Forbinder til Leafy-scenen…'),[sound,setSound]=useState(false),[retry,setRetry]=useState(0);
 const search=useSyncExternalStore(subscribeToLocation,getLocationSearch,getServerSearch),params=new URLSearchParams(search),session=params.get('session')||'',key=params.get('key')||'';
 useEffect(()=>{const controller=new AbortController();let closed=false,stop:(()=>void)|undefined;
  if(!session||!key)return;
  receiveOutput(session,key,stream=>{if(!closed&&video.current){video.current.srcObject=stream;void video.current.play().catch(()=>setStatus('Tryk på scenen for at starte afspilning.'));}},s=>{if(!closed)setStatus(s);},controller.signal).then(fn=>{if(closed)fn();else stop=fn;}).catch(e=>{if(!closed)setStatus(e.message);});return()=>{closed=true;controller.abort();stop?.();if(video.current)video.current.srcObject=null;};
 },[retry,session,key]);
 const displayStatus=status||(session&&key?'Forbinder til Leafy-scenen…':'Åbn scenelinket fra Leafy Live-kontrolpanelet.');
 return <main className="live-clean-stage" data-leafy-no-control><video ref={video} autoPlay playsInline muted={!sound} onClick={()=>{setSound(true);void video.current?.play();}}/>{displayStatus&&<div className="live-stage-message"><strong>Leafy Live</strong><p>{displayStatus}</p><button disabled={!session||!key} onClick={()=>{setStatus('Forbinder til Leafy-scenen…');setRetry(n=>n+1);}}>Forbind igen</button></div>}{!sound&&<button className="live-enable-sound" onClick={()=>{setSound(true);void video.current?.play();}}>Slå scenelyd til</button>}</main>;
}
