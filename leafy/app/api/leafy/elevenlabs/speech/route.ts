import {decryptCortiCredentials} from '@/lib/livi/credentials';
import {visitor} from '@/lib/leafy/session';
import {rateLimit} from '@/lib/leafy/store';
import {elevenLabsCredentials} from '@/lib/livi/elevenlabs';
import {prepareDanishSpeech,mapSpeechCueToDisplay} from '@/lib/livi/speech-text';
import {elevenLabsTag,emotionForSpeech,type SpeechEmotion} from '@/components/leafy/SpeechEmotion';
import {checkLeafyIntegrationOrigin,leafyIntegrationCorsHeaders} from '@/lib/leafy/integration-origins';
export const dynamic='force-dynamic';

type Viseme='rest'|'MBP'|'AA'|'EE'|'OH'|'OO'|'FV'|'L';
type Alignment={characters?:string[];character_start_times_seconds?:number[];character_end_times_seconds?:number[]};
function textCues(text:string,alignment:Alignment|undefined,offset:number,fromIndex:number){
 const source=Array.from(text),characters=alignment?.characters||[],ends=alignment?.character_end_times_seconds||[];if(!characters.length||!ends.length)return {cues:[] as {index:number;time:number}[],nextIndex:fromIndex};
 const normalize=(value:string)=>value.toLocaleLowerCase('da').normalize('NFD').replace(/\p{M}/gu,'');let cursor=fromIndex;const cues:{index:number;time:number}[]=[];
 for(let j=0;j<Math.min(characters.length,ends.length);j++){const needle=normalize(characters[j]||'');if(!needle.trim())continue;let found=-1;for(let i=cursor;i<Math.min(source.length,cursor+24);i++){if(normalize(source[i])===needle){found=i;break;}}
  if(found<0)continue;cursor=found+1;const end=ends[j];if(Number.isFinite(end)&&end>=0)cues.push({index:cursor,time:offset+end});
 }
 return {cues,nextIndex:cursor};
}
export function viseme(char:string):Viseme{
 const c=char.toLocaleLowerCase('da');if(!/[\p{L}\p{N}]/u.test(c))return'rest';if(/[mbp]/.test(c))return'MBP';if(/[fv]/.test(c))return'FV';if(/[aæ]/.test(c))return'AA';if(/[ei]/.test(c))return'EE';if(/[oå]/.test(c))return'OH';if(/[uyøw]/.test(c))return'OO';
 // The rig has no separate tongue or teeth layers. Map Danish consonants to
 // its relaxed, slightly-open consonant pose instead of falsely closing on
 // every letter outside the small vowel/closure set.
 return'L';
}
export function visemeCue(char:string,start:number,end:number,offset=0){
 const id=viseme(char),lead=id==='MBP' ? .045 : id==='FV' ? .022 : id==='rest' ? 0 : .012;
 return{time:offset+Math.max(0,start-lead),duration:end-start+lead+(id==='rest'?0:.016),id};
}
function jsonError(message:string,status=422){return Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}});}
function providerError(value:unknown){
 const root=value&&typeof value==='object'?value as Record<string,unknown>:{};
 const detail=root.detail&&typeof root.detail==='object'?root.detail as Record<string,unknown>:{};
 const raw=[detail.message,root.message,typeof root.error==='string'?root.error:null,root.error&&typeof root.error==='object'?(root.error as Record<string,unknown>).message:null].find(v=>typeof v==='string'&&v.trim());
 const message=typeof raw==='string'?raw:'ElevenLabs afviste talestrømmen uden en fejlbeskrivelse.';
 return message.replace(/xi[-_ ]?api[-_ ]?key[^\s,;]*/ig,'API-nøgle').replace(/\s+/g,' ').slice(0,260);
}
export async function GET(request:Request){
 if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return jsonError('Forbindelsen skal bruge WebSocket.',426);
 try{
  checkLeafyIntegrationOrigin(request);const user=await visitor(request);await rateLimit(user.owner,'elevenlabs-speech',120);
  const credentials=await decryptCortiCredentials(request),voice=elevenLabsCredentials(credentials);if(!voice.apiKey||!voice.voiceId)return jsonError('ElevenLabs er ikke færdigopsat på serveren.',401);
  const url=new URL('https://api.elevenlabs.io/v1/text-to-dialogue/stream-input');url.searchParams.set('model_id','eleven_v4_turbo');url.searchParams.set('output_format','mp3_44100_128');url.searchParams.set('sync_alignment','true');
  const response=await fetch(url,{headers:{Upgrade:'websocket','xi-api-key':voice.apiKey}});
  const upstream=(response as Response&{webSocket?:WebSocket}).webSocket;if(!upstream){let detail:unknown;try{detail=await response.json();}catch{detail={message:response.statusText};}return jsonError(`ElevenLabs afviste forbindelsen (${response.status}): ${providerError(detail)}`,502);}
  const pair=new WebSocketPair(),client=pair[0],server=pair[1];server.accept({allowHalfOpen:true});upstream.accept({allowHalfOpen:true});
  let submitted=false,closed=false,finalized=false,audioBytes=0,spokenCharacterCursor=0,speechText='',preparedSpeech:ReturnType<typeof prepareDanishSpeech>|null=null,speechEmotion:SpeechEmotion='neutral',upstreamTimer:ReturnType<typeof setTimeout>|undefined;
  const close=(code=1000,reason='færdig')=>{if(closed)return;closed=true;if(upstreamTimer)clearTimeout(upstreamTimer);try{server.close(code,reason);}catch{}try{upstream.close(code,reason);}catch{}};
  const armTimeout=()=>{if(upstreamTimer)clearTimeout(upstreamTimer);upstreamTimer=setTimeout(()=>{if(closed||finalized)return;try{server.send(JSON.stringify({error:'ElevenLabs brugte for lang tid på at færdiggøre lydstreamen. Leafy prøver igen.'}));}catch{}close(1011,'ElevenLabs timeout');},18_000);};
  server.addEventListener('message',event=>{
   if(submitted||typeof event.data!=='string'){close(1008,'Ugyldig anmodning');return;}submitted=true;
   try{const data=JSON.parse(event.data) as {text?:unknown};if(typeof data.text!=='string'||!data.text.trim()||data.text.length>2000){server.send(JSON.stringify({error:'Teksten til oplæsning skal være mellem 1 og 2.000 tegn.'}));close(1008,'Ugyldig tekst');return;}
    const text=data.text.trim();preparedSpeech=prepareDanishSpeech(text);speechText=preparedSpeech.text.trim();const readable=speechText.replace(/\[[^\]]{1,80}\]/gu,'');
    if(!/[\p{L}\p{N}]/u.test(readable)){server.send(JSON.stringify({error:'Dette tekststykke indeholder ingen ord eller tal efter fjernelse af emojis og udtryksmærker.'}));close(1008,'Ingen talbar tekst');return;}
    speechEmotion=emotionForSpeech(text);const hasLeadingTag=/^\[(curious|excited|reassuring|concerned)\]\s*/i.test(speechText),spokenText=hasLeadingTag?speechText:`${elevenLabsTag(speechEmotion)}${speechText}`;
    armTimeout();upstream.send(JSON.stringify({voices:[voice.voiceId]}));
    upstream.send(JSON.stringify({inputs:[{text:spokenText,voice_id:voice.voiceId}]}));
    upstream.send(JSON.stringify({close_socket:true}));
   }catch{close(1008,'Ugyldig anmodning');}
  });
  upstream.addEventListener('message',event=>{
   if(typeof event.data!=='string'){return;}try{const data=JSON.parse(event.data) as {audio?:string;alignment?:Alignment;normalized_alignment?:Alignment;is_final?:boolean;is_final_audio_for_turn?:boolean;error?:string;message?:string};
    if(data.error){server.send(JSON.stringify({error:`ElevenLabs v4 Turbo afviste talen: ${providerError(data)}`}));close(1011,'Talegenerering fejlede');return;}
    if(data.audio){armTimeout();const alignment=data.alignment||data.normalized_alignment;const offset=audioBytes*8/128000;const visemes:{time:number;duration:number;id:Viseme}[]=[];if(alignment?.characters&&alignment.character_start_times_seconds&&alignment.character_end_times_seconds){for(let i=0;i<Math.min(alignment.characters.length,alignment.character_start_times_seconds.length,alignment.character_end_times_seconds.length);i++){const start=alignment.character_start_times_seconds[i],end=alignment.character_end_times_seconds[i];if(Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end>start)visemes.push(visemeCue(alignment.characters[i]||'',start,end,offset));}}
     const aligned=textCues(speechText,alignment,offset,spokenCharacterCursor);spokenCharacterCursor=Math.max(spokenCharacterCursor,aligned.nextIndex);
     const visibleCues=aligned.cues.map(cue=>({index:preparedSpeech?mapSpeechCueToDisplay(cue.index,preparedSpeech):cue.index,time:cue.time}));
     try{server.send(JSON.stringify({audio:data.audio,visemes,textCues:visibleCues,emotion:speechEmotion}));}catch{}audioBytes+=Math.floor(data.audio.length*3/4);
    }
    // TTD has emitted both final flags across model/protocol versions. This
    // endpoint speaks one text turn per socket, so either flag closes the turn.
    if(data.is_final||data.is_final_audio_for_turn){finalized=true;server.send(JSON.stringify({is_final:true}));close();}
   }catch{server.send(JSON.stringify({error:'ElevenLabs sendte et ugyldigt svar.'}));close(1011,'Ugyldigt svar');}
  });
  server.addEventListener('close',()=>close());server.addEventListener('error',()=>close(1011,'Forbindelsesfejl'));upstream.addEventListener('close',event=>{if(!finalized&&!closed){try{server.send(JSON.stringify({error:'ElevenLabs lukkede forbindelsen, før talen var færdig. Leafy prøver igen.'}));}catch{}close(1011,`ElevenLabs lukkede (${event.code}).`);}else close();});upstream.addEventListener('error',()=>{if(!finalized&&!closed){try{server.send(JSON.stringify({error:'Forbindelsen til ElevenLabs blev afbrudt. Leafy prøver igen.'}));}catch{}close(1011,'ElevenLabs forbindelsesfejl');}else close(1011,'Forbindelsesfejl');});
  const headers=new Headers({'Cache-Control':'no-store',...leafyIntegrationCorsHeaders(request)});if(user.cookie)headers.set('Set-Cookie',user.cookie);
  return new Response(null,{status:101,webSocket:client,headers} as ResponseInit&{webSocket:WebSocket});
 }catch(e){return jsonError((e as Error).message||'Talestrømmen kunne ikke startes.',422);}
}
