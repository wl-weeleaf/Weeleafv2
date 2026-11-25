import {DEFAULT_PERMISSIONS,LEAFY_STORAGE_KEY} from './core';
import type {AgentEvent,Approval,Artifact,BrowserPage,GeneratedMedia} from './actions';
import {addArtifact,saveWithQuotaRecovery} from './versions';
export const RESULTS_KEY='leafy-results-v1';
export type Results={artifacts:Artifact[];approvals:Approval[];media:GeneratedMedia[];browser?:BrowserPage};
export function workspaceContext(){
 try{const state=JSON.parse(localStorage.getItem(LEAFY_STORAGE_KEY)||'{}');return {provider:state.provider||'eu',permissions:state.permissions||DEFAULT_PERMISSIONS,memories:state.memories||[],project:state.projects?.find((p:{id:string})=>p.id===state.activeProject)?.name||'Generel samtale',browser:results().browser,environment:(window as unknown as {leafyEnvironment?:import('./environment').Environment}).leafyEnvironment};}catch{return {permissions:DEFAULT_PERMISSIONS,provider:'eu'};}
}
export function results():Results{try{return {artifacts:[],approvals:[],media:[],...JSON.parse(localStorage.getItem(RESULTS_KEY)||'{}')};}catch{return {artifacts:[],approvals:[],media:[]};}}
export function recordEvent(event:AgentEvent){
 const data=results();
 if(event.artifact)data.artifacts=addArtifact(data.artifacts,event.artifact);
 if(event.media&&!data.media.some(m=>m.id===event.media!.id))data.media=[...data.media.slice(-9),event.media];
 if(event.approval&&!data.approvals.some(a=>a.id===event.approval!.id))data.approvals=[...data.approvals.slice(-9),event.approval];
 if(event.browser)data.browser=event.browser;
 try{
  const saved=saveWithQuotaRecovery(data,json=>localStorage.setItem(RESULTS_KEY,json));
  if(!saved.ok)window.dispatchEvent(new CustomEvent('leafy-storage-error',{detail:{key:RESULTS_KEY}}));
  if(event.activity){const state=JSON.parse(localStorage.getItem(LEAFY_STORAGE_KEY)||'{}');state.activity=[...(state.activity||[]).slice(-49),{...event.activity,id:crypto.randomUUID(),time:new Date().toISOString()}];localStorage.setItem(LEAFY_STORAGE_KEY,JSON.stringify(state));}
 }catch{}
 window.dispatchEvent(new CustomEvent('leafy-event',{detail:event}));
 if(event.interfaceLanguage)window.dispatchEvent(new CustomEvent('leafy:set-interface-language',{detail:{language:event.interfaceLanguage,manual:true}}));
}
export function removeApproval(id:string){const data=results();data.approvals=data.approvals.filter(a=>a.id!==id);try{localStorage.setItem(RESULTS_KEY,JSON.stringify(data));}catch{window.dispatchEvent(new CustomEvent('leafy-storage-error',{detail:{key:RESULTS_KEY}}));}window.dispatchEvent(new CustomEvent('leafy-event'));}
export function downloadArtifact(file:Artifact){const url=URL.createObjectURL(new Blob([file.content],{type:file.mime+';charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
