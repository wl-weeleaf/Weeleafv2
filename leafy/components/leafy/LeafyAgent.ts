import type {Expression} from './AnimatedFace';
import type {SpeechPacket} from './LeafySpeech';
export type AgentReply={text:string;expression?:Expression;speech?:SpeechPacket};
export type AgentTransport=(question:string,signal:AbortSignal)=>Promise<AgentReply>;
/** Connect your real AI transport here. No simulated model, credentials or vendor coupling. */
export class LeafyAgent {
 private controller:AbortController|null=null;private generation=0;
 constructor(private transport:AgentTransport,private view:{stop:()=>void;speak:(text:string)=>void;playSpeech:(packet:SpeechPacket)=>Promise<void>},private onThinking:(value:boolean)=>void,private onReply:(reply:AgentReply)=>void){}
 async ask(question:string){
  this.cancel();const generation=this.generation,controller=new AbortController();this.controller=controller;this.onThinking(true);
  try{const reply=await this.transport(question,controller.signal);if(controller.signal.aborted||generation!==this.generation)return;this.onReply(reply);this.onThinking(false);if(reply.speech)await this.view.playSpeech(reply.speech);else this.view.speak(reply.text);return reply;}
  finally{if(generation===this.generation)this.onThinking(false);}
 }
 cancel(){this.generation++;this.controller?.abort();this.controller=null;this.view.stop();this.onThinking(false);}
 dispose(){this.cancel();}
}
