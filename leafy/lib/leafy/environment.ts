export type LeafyState='idle'|'listening'|'thinking'|'observing'|'acting'|'speaking'|'waiting_for_human'|'error';
export type ControlState='AGENT_CONTROL'|'HUMAN_CONTROL'|'PROTECTED_HUMAN_CONTROL'|'PAUSED'|'DISCONNECTED';
export type UIElement={id:string;role:string;label:string;href?:string;type?:string};
export type Environment={type:'leafy-platform'|'chrome';sessionId:string;page:string;title:string;control:ControlState;elements:UIElement[];text:string;observedAt:string};
export type UIAction={action:'observe'|'navigate'|'click'|'type'|'scroll'|'back'|'forward'|'select';elementId?:string;text?:string;url?:string;direction?:'up'|'down';expectedLabel?:string};
export const CONTROL_STATES:ControlState[]=['AGENT_CONTROL','HUMAN_CONTROL','PROTECTED_HUMAN_CONTROL','PAUSED','DISCONNECTED'];
export const UI_ACTIONS=['observe','navigate','click','type','scroll','back','forward','select'] as const;
export function protectedLabel(value:string){return /mitid|captcha|\b2fa\b|one.?time|verification code|sikkerhedskode|bekræftelseskode|adgangskode|password|credit.?card|card.?number|betalingskort|kortnummer|cvv|cvc|checkout|betaling|bankgodkendelse/i.test(value);}
export function safeControl(value:unknown):ControlState{return CONTROL_STATES.includes(value as ControlState)?value as ControlState:'PROTECTED_HUMAN_CONTROL';}
export function cleanEnvironment(value:unknown):Environment|null{
 if(!value||typeof value!=='object')return null;const v=value as Record<string,unknown>;
 if(!/^[a-f0-9-]{36}$/.test(String(v.sessionId)))return null;
 const control=safeControl(v.control);const elements=control==='AGENT_CONTROL'&&Array.isArray(v.elements)?v.elements.slice(0,100).filter(e=>e&&typeof e.id==='string'&&typeof e.label==='string'&&!protectedLabel(e.label)).map(e=>({id:e.id.slice(0,80),role:String(e.role||'button').slice(0,30),label:e.label.slice(0,160),...(typeof e.href==='string'?{href:e.href.slice(0,2048)}:{}),...(typeof e.type==='string'?{type:e.type.slice(0,30)}:{})})):[];
 return {type:v.type==='chrome'?'chrome':'leafy-platform',sessionId:String(v.sessionId),control,page:control==='AGENT_CONTROL'?String(v.page||'').slice(0,2048):'',title:control==='AGENT_CONTROL'?String(v.title||'').slice(0,200):'',elements,text:control==='AGENT_CONTROL'?String(v.text||'').slice(0,10000):'',observedAt:new Date().toISOString()};
}
export function validateAction(value:unknown):UIAction{
 if(!value||typeof value!=='object')throw new Error('Ugyldig UI-handling.');const v=value as Record<string,unknown>;
 if(!UI_ACTIONS.includes(v.action as UIAction['action']))throw new Error('Handlingen understøttes ikke i denne version.');
 if(['click','type','select'].includes(String(v.action))&&(!/^[a-zA-Z0-9_-]{1,80}$/.test(String(v.elementId))))throw new Error('Vælg et element fra den seneste observation.');
 const text=String(v.text||'');if(text.length>6000)throw new Error('Teksten er for lang.');
 return {action:v.action as UIAction['action'],...(v.elementId?{elementId:String(v.elementId)}:{}),...(text?{text}:{}),...(v.url?{url:String(v.url)}:{}),...(typeof v.expectedLabel==='string'?{expectedLabel:v.expectedLabel.slice(0,160)}:{}),direction:v.direction==='up'?'up':'down'};
}
