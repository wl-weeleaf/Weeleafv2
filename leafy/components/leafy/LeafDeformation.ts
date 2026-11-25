import type {SpeechEmotion} from './SpeechEmotion';

export type LeafDeformationFrame={
 time:number;amount:number;breath:number;flamePhase:number;flutterPhase:number;flutterOffset:number;energy:number;voiceAmount:number;
};

const clamp=(value:number,min=0,max=1)=>Math.max(min,Math.min(max,value));
const smoothstep=(edge0:number,edge1:number,value:number)=>{const x=clamp((value-edge0)/(edge1-edge0));return x*x*(3-2*x);};

/** Build shared per-frame values once so every torso and face layer moves together. */
export function createLeafDeformationFrame(t:number,amount:number,emotion:SpeechEmotion='neutral',voiced=false):LeafDeformationFrame{
 const phase=(t%5.6)/5.6;
 const inhale=phase<.38?(1-Math.cos(Math.PI*phase/.38))/2:(1+Math.cos(Math.PI*(phase-.38)/.62))/2;
 const energy=emotion==='excited'?1.48:emotion==='curious'?1.24:emotion==='reassuring'?.78:emotion==='concerned'?.72:1;
 return {time:t,amount,breath:(inhale-.5)*amount,flamePhase:t*1.12,flutterPhase:t*.79,flutterOffset:Math.sin(t*.47)*.34,energy,voiceAmount:voiced?.16:0};
}

/** Closed, shared surface deformation: a smooth undulation travels from side to side across the leaf.
 * Facial features are damped around their placement so mesh movement never breaks the face. */
export function deformPoint(x:number,y:number,z:number,turn:number,frame:LeafDeformationFrame){
 const {time:t,amount,breath,flamePhase,flutterPhase,flutterOffset,energy,voiceAmount}=frame;
 const tip=clamp((y-.35)/1.35),across=smoothstep(-1.12,1.12,x);
 const faceQuiet=1-.86*Math.exp(-(((x+.105)/.57)**2+((y+.29)/.57)**2));
 const middle=Math.max(0,1-((y+.15)/1.9)**2);
 const voice=(.70+voiceAmount)*(amount>0?1:0);
 const flame=Math.sin(flamePhase-across*4.2+flutterOffset);
 const flutter=Math.sin(flutterPhase-across*6.4+y*.65);
 const flow=faceQuiet*amount*energy*voice;
 const bend=(Math.sin(t*.73)*.075+turn*.08)*tip*tip*amount;
 const lateral=(flame*.058+flutter*.018)*flow*(.48+tip*.52);
 const vertical=Math.sin(flamePhase-across*3.7+flutterOffset)*.032*flow*(.45+tip*.55);
 const depth=Math.sin(flamePhase-across*4.4+y*.35+flutterOffset)*.029*flow*(.35+tip*.65);
 return [x*(1+breath*.07*middle)+bend+lateral,y*(1+breath*.018)+vertical,z*(1+breath*.46*middle)+Math.sin(t*.61)*.045*tip*tip*amount+depth];
}
