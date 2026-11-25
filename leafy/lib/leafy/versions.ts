import type {Artifact} from './actions';
/**
 * Append-only artifact history. An "update" never overwrites earlier code: every result is a version,
 * grouped by file name. Old versions are only pruned by a per-file cap and a total size budget, and the
 * newest version of every file is never pruned.
 */
export type ArtifactVersion=Artifact&{version:number};
export const MAX_VERSIONS_PER_NAME=12;
export const MAX_TOTAL_CHARS=1_200_000;
const total=(list:Artifact[])=>list.reduce((n,a)=>n+a.content.length+a.name.length+80,0);
/** Add an artifact (ignored if its id is already stored) and prune oldest versions within the caps. */
export function addArtifact(list:Artifact[],next:Artifact,maxPerName=MAX_VERSIONS_PER_NAME,maxChars=MAX_TOTAL_CHARS):Artifact[]{
 if(list.some(a=>a.id===next.id))return list;
 let out=[...list,next];
 const sameName=out.filter(a=>a.name===next.name);
 if(sameName.length>maxPerName){const drop=new Set(sameName.slice(0,sameName.length-maxPerName).map(a=>a.id));out=out.filter(a=>!drop.has(a.id));}
 return pruneToBudget(out,maxChars);
}
/** Drop the oldest non-latest versions until the list fits. A single oversized latest file is kept. */
export function pruneToBudget(list:Artifact[],maxChars=MAX_TOTAL_CHARS):Artifact[]{
 const out=[...list];
 const latest=(a:Artifact)=>{for(let i=out.length-1;i>=0;i--)if(out[i].name===a.name)return out[i].id===a.id;return false;};
 while(total(out)>maxChars){const i=out.findIndex(a=>!latest(a));if(i<0)break;out.splice(i,1);}
 return out;
}
/** Versions of one file, oldest first, numbered from 1. */
export function versionsOf(list:Artifact[],name:string):ArtifactVersion[]{return list.filter(a=>a.name===name).map((a,i)=>({...a,version:i+1}));}
export function latestOf(list:Artifact[],name:string):ArtifactVersion|undefined{const v=versionsOf(list,name);return v[v.length-1];}
/** Restore = append a copy of an old version as the newest one, so history itself is never rewritten. */
export function restoreVersion(list:Artifact[],id:string,newId:string=crypto.randomUUID(),now:string=new Date().toISOString()):Artifact[]{
 const old=list.find(a=>a.id===id);if(!old)return list;
 return addArtifact(list,{...old,id:newId,createdAt:now});
}
/** Cheap line-level change summary for a "what changed" label (not a full diff). */
export function changeSummary(previous:string,next:string){
 const a=previous.split('\n'),b=next.split('\n'),sa=new Set(a),sb=new Set(b);
 return {added:b.filter(l=>!sa.has(l)).length,removed:a.filter(l=>!sb.has(l)).length,unchanged:b.filter(l=>sa.has(l)).length};
}
/** Write with quota recovery: on failure drop old versions, then old media, then give up with a boolean the UI can show. */
export function saveWithQuotaRecovery<T extends {artifacts:Artifact[];media:unknown[]}>(data:T,write:(json:string)=>void):{ok:boolean;data:T}{
 let current=data;
 for(let attempt=0;attempt<6;attempt++){
  try{write(JSON.stringify(current));return {ok:true,data:current};}catch{
   const budget=Math.floor(total(current.artifacts)/2);
   current={...current,artifacts:pruneToBudget(current.artifacts,Math.max(budget,50_000)),media:current.media.slice(-Math.max(1,5-attempt))};
  }
 }
 return {ok:false,data:current};
}
