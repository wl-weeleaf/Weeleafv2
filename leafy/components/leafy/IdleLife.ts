/** Local acting, not an AI or a claim of consciousness. Time advances only while visible. */
export class IdleLife {
 private wait=3.5;private elapsed=0;private duration=0;private side=1;private choice=0;
 update(dt:number,blocked:boolean){
  if(blocked){this.wait=3.5;this.elapsed=0;this.duration=0;return {x:0,y:0,turn:0,event:''};}
  if(this.duration===0){this.wait-=dt;if(this.wait>0)return {x:0,y:0,turn:0,event:''};this.duration=3+Math.random()*2;this.elapsed=0;this.side=Math.random()<.5?-1:1;this.choice=(this.choice+1)%3;}
  const first=this.elapsed===0;this.elapsed+=dt;const progress=Math.min(1,this.elapsed/this.duration),envelope=Math.sin(progress*Math.PI);
  const result={x:this.side*envelope*.9,y:Math.sin(progress*Math.PI*2)*.3,turn:this.side*envelope*.42,event:first?['notice','whistle','wonder'][this.choice]:''};
  if(progress===1){this.duration=0;this.wait=5+Math.random()*8;}
  return result;
 }
}
export class IdleWhistle {
 private context:AudioContext|null=null;private tones:OscillatorNode[]=[];
 async enable(){this.context??=new AudioContext();await this.context.resume();}
 play(){const c=this.context;if(!c||c.state!=='running')return;this.stop();const t=c.currentTime;
  [1046,1318,1174].forEach((hz,i)=>{const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(hz,t+i*.23);o.frequency.linearRampToValueAtTime(hz*1.025,t+i*.23+.18);g.gain.setValueAtTime(0,t+i*.23);g.gain.linearRampToValueAtTime(.025,t+i*.23+.025);g.gain.exponentialRampToValueAtTime(.0001,t+i*.23+.2);o.connect(g);g.connect(c.destination);o.start(t+i*.23);o.stop(t+i*.23+.21);o.onended=()=>{o.disconnect();g.disconnect();};this.tones.push(o);});
 }
 stop(){for(const o of this.tones){try{o.stop();}catch{}}this.tones=[];}
 dispose(){this.stop();void this.context?.close();this.context=null;}
}
