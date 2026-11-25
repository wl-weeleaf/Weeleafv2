'use client';
import {useEffect,useState} from 'react';
export default function LeafyServerNotes(){
 const [notes,setNotes]=useState<{id:string;text:string}[]>([]),[text,setText]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(true);
 async function request(method:string,body?:object){
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/leafy/core',{method,cache:'no-store',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
   const result=await response.json() as {error?:string;notes:{id:string;text:string}[]};
   if(!response.ok)throw Error(result.error);
   setNotes(result.notes);if(method==='POST')setText('');
  }catch(e){setError(e instanceof Error?e.message:'Forbindelsen mislykkedes.');}finally{setBusy(false);}
 }
 useEffect(()=>{void request('GET');},[]);
 return <section className="leafy-core-list"><h4>Servernoter til chatten</h4>
 {notes.map(n=><div key={n.id}>{n.text} <button disabled={busy} onClick={()=>void request('DELETE',{id:n.id})}>Fjern</button></div>)}
 <input aria-label="Ny servernote" maxLength={240} value={text} onChange={e=>setText(e.target.value)}/>
 <button disabled={busy||!text.trim()} onClick={()=>void request('POST',{text})}>Gem servernote</button>
 <button disabled={busy} onClick={()=>{if(window.confirm('Slet alle servernoter og slettemærker permanent?'))void request('DELETE',{confirm:'SLET ALLE SERVERNOTER'});}}>Slet alle servernoter</button>
 {error&&<p role="alert">{error}</p>}</section>;
}
