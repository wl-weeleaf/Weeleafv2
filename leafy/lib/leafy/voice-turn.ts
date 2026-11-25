/** One microphone turn: send once at end, never on error, empty text or cancellation. */
export class VoiceTurn {
 private text='';private failed=false;private ended=false;private timer:ReturnType<typeof setTimeout>|null=null;
 constructor(private readonly callbacks:{active:()=>boolean;draft:(text:string)=>void;complete:(text:string)=>void;stop:()=>void;error:(message:string)=>void;end:()=>void},private readonly silenceMs=1800){}
 private clear(){if(this.timer)clearTimeout(this.timer);this.timer=null;}
 update=(text:string)=>{if(this.ended||!this.callbacks.active())return;this.text=text;this.callbacks.draft(text);this.clear();if(text.trim()&&this.silenceMs>0)this.timer=setTimeout(()=>{if(!this.ended&&this.callbacks.active())this.callbacks.stop();},this.silenceMs);};
 error=(message:string)=>{this.failed=true;if(this.callbacks.active())this.callbacks.error(message);};
 end=()=>{if(this.ended)return;this.ended=true;this.clear();if(!this.callbacks.active())return;this.callbacks.end();if(!this.failed&&this.text.trim())this.callbacks.complete(this.text.trim());};
 cancel=()=>{this.ended=true;this.clear();};
}
/** Audio-level endpointing: transcript latency never counts as silence. */
export class VoiceActivity {
 private heard=false;private lastVoice=0;private done=false;
 constructor(private readonly quietMs=1800,private readonly threshold=.012){}
 sample(level:number,time:number){if(this.done)return false;if(level>=this.threshold){this.heard=true;this.lastVoice=time;return false;}if(this.heard&&time-this.lastVoice>=this.quietMs){this.done=true;return true;}return false;}
}
