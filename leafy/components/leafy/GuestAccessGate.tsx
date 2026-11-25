'use client';
import {createContext,useContext,useEffect,useState} from 'react';
const GuestOwnerContext=createContext(false);
export function useLeafyOwnerAccess(){return useContext(GuestOwnerContext);}
// Public app: owner lookup only controls credential settings, never room access.
export default function GuestAccessGate({children}:{children:React.ReactNode}){
 const [owner,setOwner]=useState(false);
 useEffect(()=>{let live=true;fetch('/api/livi/guest-access',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(raw=>{const data=raw as {owner?:boolean};if(live)setOwner(data.owner===true);}).catch(()=>{});return()=>{live=false;};},[]);
 return <GuestOwnerContext.Provider value={owner}>{children}</GuestOwnerContext.Provider>;
}
