import type {SpeechEmotion} from './SpeechEmotion';
import type {NpcState} from './LeafyNPC';

export type LeafyGestureFrame={pitch:number;yaw:number;roll:number;bounce:number;squash:number};
const REST:LeafyGestureFrame={pitch:0,yaw:0,roll:0,bounce:0,squash:0};

/** Small whole-body acting cues. Speech emotion comes from the same text/tag sent to ElevenLabs;
 * voiced edges come from Leafy's active viseme timeline, so gestures follow the actual playback clock. */
export class LeafyGestures{
 private time=0;
 private nextAccent=1.8;
 private accentAge=1;
 private wasVoiced=false;
 private speaking=false;
 private current={...REST};

 update(dt:number,state:NpcState,emotion:SpeechEmotion,animate:boolean,voiced:boolean):LeafyGestureFrame{
  const step=Math.min(Math.max(dt,0),.05);
  if(!animate){this.wasVoiced=false;this.speaking=false;return this.ease(REST,step);}
  this.time+=step;
  const isSpeaking=state==='speaking';
  if(isSpeaking&&!this.speaking){this.nextAccent=this.time+1.5;this.accentAge=1;}
  this.speaking=isSpeaking;
  if(isSpeaking&&voiced&&!this.wasVoiced&&this.time>=this.nextAccent){this.accentAge=0;this.nextAccent=this.time+2.3+((Math.sin(this.time*1.73)+1)*.5)*1.5;}
  this.wasVoiced=voiced;

  const wave=Math.sin(this.time*1.65),pulse=this.accentAge<.48?Math.sin(this.accentAge/.48*Math.PI):0;
  if(this.accentAge<.48)this.accentAge+=step;
  const target={...REST};
  if(state==='speaking'){
   target.roll=wave*.012;target.pitch=Math.sin(this.time*1.25)*.008;
   if(emotion==='excited'){target.bounce=(.010+.012*(.5+.5*Math.sin(this.time*5.2)))*(voiced?.8:.28);target.squash=-pulse*.022;target.pitch+=pulse*.025;target.roll+=Math.sin(this.time*2.8)*.018;}
   else if(emotion==='curious'){target.pitch=.025+wave*.008;target.roll=.035+Math.sin(this.time*.8)*.012;target.yaw=Math.sin(this.time*.9)*.025;target.squash=-pulse*.009;}
   else if(emotion==='reassuring'){target.pitch=.018+Math.sin(this.time*.55)*.006;target.roll=Math.sin(this.time*.65)*.014;target.bounce=Math.sin(this.time*.8)*.004;}
   else if(emotion==='concerned'){target.pitch=-.012+Math.sin(this.time*.7)*.004;target.roll=-.018+Math.sin(this.time*.65)*.008;}
   else {target.pitch+=pulse*.014;target.roll+=Math.sin(this.time*.72)*.009;target.squash=-pulse*.006;}
  }else if(state==='attentive'){
   target.pitch=.018+Math.sin(this.time*.65)*.006;target.roll=Math.sin(this.time*.9)*.012;
  }else if(state==='thinking'){
   target.pitch=.008+Math.sin(this.time*.8)*.012;target.roll=Math.sin(this.time*.62)*.035;target.yaw=Math.sin(this.time*.46)*.018;
  }else{
   target.roll=Math.sin(this.time*.72)*.012;target.pitch=Math.sin(this.time*.51)*.006;
  }
  return this.ease(target,step);
 }
 private ease(target:LeafyGestureFrame,dt:number){
  const amount=1-Math.exp(-dt*5.5);
  for(const key of Object.keys(REST) as (keyof LeafyGestureFrame)[])this.current[key]+=(target[key]-this.current[key])*amount;
  return this.current;
 }
}
