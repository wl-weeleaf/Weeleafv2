export type MelodyNote={midi:number;start:number;duration:number};
export type Melody={notes:MelodyNote[];title?:string;composer?:string;tempo:number;source:string};
type XmlNode={nodeType:number;localName:string;textContent:string|null;parentElement:XmlNode|null;childNodes:Iterable<XmlNode>;children:Iterable<XmlNode>;getAttribute(name:string):string|null;hasAttribute(name:string):boolean;getElementsByTagName(name:string):Iterable<XmlNode>};
type XmlDocument=XmlNode&{documentElement:XmlNode;querySelector(selector:string):XmlNode|null};

const STEP:Record<string,number>={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const KEY_SHARPS:Record<number,string[]>={1:['F'],2:['F','C'],3:['F','C','G'],4:['F','C','G','D'],5:['F','C','G','D','A'],6:['F','C','G','D','A','E'],7:['F','C','G','D','A','E','B']};
const KEY_FLATS:Record<number,string[]>={[-1]:['B'],[-2]:['B','E'],[-3]:['B','E','A'],[-4]:['B','E','A','D'],[-5]:['B','E','A','D','G'],[-6]:['B','E','A','D','G','C'],[-7]:['B','E','A','D','G','C','F']};

export function parseMusicXml(text:string):Melody{
 const parsed=new DOMParser().parseFromString(text,'application/xml');if(parsed.querySelector('parsererror'))throw Error('Noden kunne ikke læses som MusicXML.');
 const xml=parsed as unknown as XmlDocument,root=xml.documentElement;
 const first=(parent:XmlNode|null|undefined,name:string):XmlNode|null=>parent?Array.from(parent.childNodes).find(node=>node.nodeType===1&&node.localName===name)??null:null;
 const textOf=(parent:XmlNode|null|undefined,name:string)=>first(parent,name)?.textContent?.trim()||'';
 const descendants=(parent:XmlDocument|XmlNode,name:string)=>Array.from(parent.getElementsByTagName('*')).filter(e=>e.localName===name);
 const title=descendants(xml,'work-title')[0]?.textContent?.trim()||descendants(xml,'movement-title')[0]?.textContent?.trim()||undefined;
 const composer=descendants(xml,'creator').find(e=>e.getAttribute('type')==='composer')?.textContent?.trim()||undefined;
 const timewise=root.localName==='score-timewise';if(!timewise&&root.localName!=='score-partwise')throw Error('Filen er ikke en gyldig MusicXML-node.');
 const parts=timewise?descendants(root,'part').filter(e=>e.parentElement?.localName==='measure'):Array.from(root.children).filter(e=>e.localName==='part');
 const part=parts.find(p=>descendants(p,'note').some(e=>first(e,'pitch')))||parts[0];if(!part)throw Error('MusicXML-filen indeholder ikke et nodesystem.');
 const partId=part.getAttribute('id');const measures:XmlNode[][]=timewise?Array.from(root.children).filter(e=>e.localName==='measure').map(m=>{const measurePart=Array.from(m.children).find(p=>p.localName==='part'&&(!partId||p.getAttribute('id')===partId));return measurePart?Array.from(measurePart.children):[];}):Array.from(part.children).filter(e=>e.localName==='measure').map(m=>Array.from(m.children));
 let divisions=1,tempo=120,keyFifths=0,barQuarters=4,measureStart=0;const notes:MelodyNote[]=[];
 for(const children of measures){
  let quarter=0,maxQuarter=0;
  for(const child of children){
    if(child.localName==='attributes'){
    const d=Number(textOf(child,'divisions'));if(d>0)divisions=d;
    const key=first(child,'key'),k=Number(textOf(key,'fifths'));if(Number.isFinite(k))keyFifths=Math.max(-7,Math.min(7,k));
    const time=first(child,'time'),beats=Number(textOf(time,'beats').split('+').reduce((sum,value)=>sum+Number(value),0)),beatType=Number(textOf(time,'beat-type'));if(beats>0&&beatType>0)barQuarters=beats*4/beatType;
    }else if(child.localName==='direction'){
    const sound=Array.from(child.getElementsByTagName('*')).find(e=>e.localName==='sound'&&e.hasAttribute('tempo'));const metronome=Array.from(child.getElementsByTagName('*')).find(e=>e.localName==='metronome');const t=Number(sound?.getAttribute('tempo')||textOf(metronome,'per-minute'));if(t>20&&t<400)tempo=t;
   }else if(child.localName==='backup'){quarter=Math.max(0,quarter-Number(textOf(child,'duration')||0)/divisions);maxQuarter=Math.max(maxQuarter,quarter);}
   else if(child.localName==='forward'){quarter+=Number(textOf(child,'duration')||0)/divisions;maxQuarter=Math.max(maxQuarter,quarter);}
   else if(child.localName==='note'){
    const dur=Number(textOf(child,'duration')||0)/divisions,chord=!!first(child,'chord'),pitch=first(child,'pitch'),step=textOf(pitch,'step'),octave=Number(textOf(pitch,'octave')||0);
    if(pitch&&STEP[step]!==undefined){const alterNode=first(pitch,'alter'),accidental=textOf(child,'accidental');let alter=alterNode?Number(alterNode.textContent):accidental==='natural'?0:accidental==='flat'?-1:accidental==='sharp'?1:accidental==='double-flat'?-2:accidental==='double-sharp'?2:(KEY_SHARPS[keyFifths]||[]).includes(step)?1:(KEY_FLATS[keyFifths]||[]).includes(step)?-1:0;
     if(!Number.isFinite(alter))alter=0;const start=measureStart+quarter*60/tempo;if(!chord)notes.push({midi:12*(octave+1)+STEP[step]+alter,start,duration:Math.max(.06,dur*60/tempo)});
    }
    if(!chord)quarter+=dur;maxQuarter=Math.max(maxQuarter,quarter);
   }
  }
  measureStart+=Math.max(barQuarters,maxQuarter)*60/tempo;
 }
 if(!notes.length)throw Error('Jeg fandt ingen meloditoner i den første nodepart.');
 return {notes,title,composer,tempo,source:'Importeret MusicXML'};
}

function variable(data:Uint8Array,pos:{i:number}){let value=0,b=0;do{b=data[pos.i++];value=(value<<7)|(b&127);}while(b&128&&pos.i<data.length);return value;}
export function parseMidi(buffer:ArrayBuffer):Melody{
 const data=new Uint8Array(buffer),view=new DataView(buffer);if(data.length<14||String.fromCharCode(...data.slice(0,4))!=='MThd')throw Error('Filen er ikke en gyldig MIDI-fil.');
 const division=view.getUint16(12);if(division&0x8000)throw Error('SMPTE-timing i denne MIDI-fil understøttes ikke endnu.');const ppq=division||480;
 let offset=14,tempo=120;const tracks:{tick:number;type:'on'|'off';note:number;vel:number;track:number}[][]=[];const tempos:{tick:number;us:number}[]=[];
 for(let ti=0;ti<view.getUint16(10)&&offset+8<=data.length;ti++){
  const tag=String.fromCharCode(...data.slice(offset,offset+4)),len=view.getUint32(offset+4);offset+=8;if(tag!=='MTrk'||offset+len>data.length)break;
  const end=offset+len,pos={i:offset};let tick=0,status=0;const evts:typeof tracks[number]=[];
  while(pos.i<end){tick+=variable(data,pos);let s=data[pos.i];if(s&128){status=s;pos.i++;}else s=status;if(s===0xff){const type=data[pos.i++],n=variable(data,pos);if(type===0x51&&n===3){const us=(data[pos.i]<<16)|(data[pos.i+1]<<8)|data[pos.i+2];if(us>0)tempos.push({tick,us});}pos.i+=n;continue;}if(s===0xf0||s===0xf7){pos.i+=variable(data,pos);continue;}const cmd=s&0xf0;if(cmd===0x80||cmd===0x90){const note=data[pos.i++],vel=data[pos.i++]||0;evts.push({tick,type:cmd===0x90&&vel>0?'on':'off',note,vel,track:ti});}else if(cmd===0xc0||cmd===0xd0)pos.i++;else if(cmd>=0x80)pos.i+=2;
  }
  tracks.push(evts);offset=end;
 }
 tempos.sort((a,b)=>a.tick-b.tick);if(tempos[0])tempo=60_000_000/tempos[0].us;
 const toSec=(target:number)=>{let currentTick=0,currentUs=500000,secs=0;for(const t of tempos){if(t.tick>target)break;secs+=(t.tick-currentTick)*currentUs/(ppq*1e6);currentTick=t.tick;currentUs=t.us;}return secs+(target-currentTick)*currentUs/(ppq*1e6);};
 const track=tracks.sort((a,b)=>b.filter(e=>e.type==='on').length-a.filter(e=>e.type==='on').length)[0]||[];const active=new Map<number,number[]>(),notes:MelodyNote[]=[];
 for(const e of track){const key=e.note;if(e.type==='on'){const arr=active.get(key)||[];arr.push(e.tick);active.set(key,arr);}else{const arr=active.get(key);const start=arr?.shift();if(start!==undefined){const a=toSec(start),b=toSec(e.tick);notes.push({midi:key,start:a,duration:Math.max(.06,b-a)});}}}
 notes.sort((a,b)=>a.start-b.start);if(!notes.length)throw Error('MIDI-filen indeholder ingen aflæselige toner.');return {notes,tempo,source:'Importeret MIDI'};
}

export function playMelody(melody:Melody,mode:'hum'|'tones'='hum',speed=1,octave=0,onEnded?:()=>void,onError?:(message:string)=>void){
 const Ctx=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!Ctx)throw Error('Denne browser understøtter ikke Web Audio.');
 const notes=melody.notes.filter(n=>Number.isFinite(n.midi)&&Number.isFinite(n.start)&&Number.isFinite(n.duration)&&n.duration>0);if(!notes.length||!Number.isFinite(speed)||speed<=0)throw Error('Melodien eller tempoet er ugyldigt.');
 const ctx=new Ctx(),master=ctx.createGain(),compressor=ctx.createDynamicsCompressor(),vibrato=ctx.createOscillator();master.gain.value=mode==='hum'?.28:.18;compressor.threshold.value=-18;compressor.knee.value=12;compressor.ratio.value=4;compressor.attack.value=.008;compressor.release.value=.12;master.connect(compressor);compressor.connect(ctx.destination);vibrato.frequency.value=5.1;vibrato.start();let closed=false;
 const finish=()=>{if(closed)return;closed=true;try{vibrato.stop();}catch{}void ctx.close().catch(()=>{});onEnded?.();};
 const cancel=()=>{if(closed)return;closed=true;try{vibrato.stop();}catch{}void ctx.close().catch(()=>{});};
 void ctx.resume().then(()=>{
  if(closed)return;const now=ctx.currentTime+.06;
  const last=notes.reduce((a,b)=>a.start+a.duration>b.start+b.duration?a:b);for(const n of notes){const start=now+Math.max(0,n.start)/speed,duration=Math.max(.05,n.duration/speed),f=440*Math.pow(2,(n.midi+octave*12-69)/12),osc=ctx.createOscillator(),filter=ctx.createBiquadFilter(),formant=ctx.createBiquadFilter(),gain=ctx.createGain();osc.type=mode==='hum'?'sawtooth':'sine';osc.frequency.setValueAtTime(f,start);filter.type='lowpass';filter.frequency.setValueAtTime(mode==='hum'?Math.min(1750,Math.max(700,f*4)):12000,start);filter.Q.value=mode==='hum'?.7:.0001;formant.type=mode==='hum'?'peaking':'allpass';formant.frequency.setValueAtTime(330,start);formant.Q.value=.8;formant.gain.value=mode==='hum'?4:0;const vib=ctx.createGain();vib.gain.value=mode==='hum'?f*.0028:0;vibrato.connect(vib);vib.connect(osc.frequency);const attack=Math.min(.03,duration*.22),release=Math.min(.065,duration*.26),peak=mode==='hum'?.2:.5,sustain=Math.max(start+attack,start+duration-release);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(peak,start+attack);gain.gain.setValueAtTime(peak,sustain);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);osc.connect(filter);filter.connect(formant);formant.connect(gain);gain.connect(master);osc.start(start);osc.stop(start+duration+.015);osc.onended=()=>{osc.disconnect();filter.disconnect();formant.disconnect();gain.disconnect();vib.disconnect();if(n===last)finish();};}
 }).catch(error=>{if(closed)return;cancel();onError?.((error as Error).message||'Browserens lydmotor kunne ikke starte.');});
 return cancel;
}
