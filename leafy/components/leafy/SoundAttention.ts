export type SoundStatus='off'|'starting'|'mono'|'stereo'|'error';
/** Channel-energy hint only: not measured azimuth, speech recognition or recording. */
export function soundHint(left:number,right:number,stereo:boolean){
 if(Math.max(left,right)<.025)return null;
 const balance=stereo?(right-left)/(right+left+.0001):0;
 return {x:Math.abs(balance)<.12?0:Math.max(-.85,Math.min(.85,balance*1.5)),y:.04};
}
export class SoundAttention{
 private stream:MediaStream|null=null;private context:AudioContext|null=null;private nodes:AudioNode[]=[];private analysers:AnalyserNode[]=[];private data=new Float32Array(512);private stereo=false;private generation=0;private lastPoint:{x:number;y:number}|null=null;private heardAt=0;
 constructor(private onStatus:(s:SoundStatus,message?:string)=>void){}
 async start(){
  this.stop();const gen=this.generation;this.onStatus('starting');
  try{
   const ctx=new AudioContext();this.context=ctx;await ctx.resume();
   if(gen!==this.generation)return;
   if(!navigator.mediaDevices?.getUserMedia)throw Error('unsupported');
   const stream=await navigator.mediaDevices.getUserMedia({video:false,audio:{channelCount:{ideal:2},echoCancellation:true,noiseSuppression:true,autoGainControl:false}});
   if(gen!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;const track=stream.getAudioTracks()[0];this.stereo=(track.getSettings().channelCount??1)>=2;
   const source=ctx.createMediaStreamSource(stream),split=ctx.createChannelSplitter(2),mute=ctx.createGain();mute.gain.value=0;source.connect(split);mute.connect(ctx.destination);this.nodes=[source,split,mute];
   for(let i=0;i<(this.stereo?2:1);i++){const a=ctx.createAnalyser();a.fftSize=512;split.connect(a,i);a.connect(mute);this.analysers.push(a);this.nodes.push(a);}
   track.onended=()=>{if(gen===this.generation)this.stop();};this.onStatus(this.stereo?'stereo':'mono');
  }catch{if(gen!==this.generation)return;this.stop();this.onStatus('error','Mikrofonen kunne ikke åbnes. Tjek tilladelsen i browseren.');}
 }
 sample(){if(this.context?.state!=='running'||!this.analysers.length)return null;const levels=this.analysers.map(a=>{a.getFloatTimeDomainData(this.data);let n=0;for(const v of this.data)n+=v*v;return Math.sqrt(n/this.data.length);});const point=soundHint(levels[0],levels[1]??levels[0],this.stereo);if(point){this.lastPoint=point;this.heardAt=performance.now();}return performance.now()-this.heardAt<900?this.lastPoint:null;}
 stop(){this.generation++;this.lastPoint=null;this.heardAt=0;this.stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});this.stream=null;this.nodes.forEach(n=>n.disconnect());this.nodes=[];this.analysers=[];void this.context?.close().catch(()=>{});this.context=null;this.onStatus('off');}
}
