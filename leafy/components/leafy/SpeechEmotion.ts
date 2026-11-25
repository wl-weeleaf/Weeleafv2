/** One compact acting cue is shared by ElevenLabs' audio tag and Leafy's face. */
export type SpeechEmotion='neutral'|'curious'|'excited'|'reassuring'|'concerned';
export type FaceEmotion='idle'|'happy'|'curious'|'sleepy'|'gentle'|'concerned';
export function emotionForSpeech(text:string):SpeechEmotion{
 const value=text.trim().toLocaleLowerCase('da');
 if(/^\[(curious|excited|reassuring|concerned)\]/i.test(value))return value.slice(1,value.indexOf(']')) as SpeechEmotion;
 if(/\b(bare rolig|det skal nok gå|du kan godt|vi tager det stille|jeg hjælper dig|det er helt forståeligt)\b/.test(value))return'reassuring';
 if(/\b(ked af det|bekymret|det gør ondt|svært at stå i|det lyder hårdt|jeg forstår godt det er svært)\b/.test(value))return'concerned';
 if(/\b(hvordan|hvorfor|hvad|hvem|hvilken|hvilket|hvor)\b/.test(value)||/[?？]/.test(value))return'curious';
 if(/\b(fedt|fantastisk|spændende|dejligt|glæder mig|hurra|juhuu|genialt)\b|!{2,}/.test(value))return'excited';
 return'neutral';
}
export function elevenLabsTag(emotion:SpeechEmotion){
 if(emotion==='neutral')return'';
 // Reuse the provider's documented reassuring delivery for a concerned facial cue.
 return`[${emotion==='concerned'?'reassuring':emotion}] `;
}
export function faceEmotion(emotion:SpeechEmotion):FaceEmotion{
 return emotion==='excited'?'happy':emotion==='reassuring'?'gentle':emotion==='concerned'?'concerned':emotion==='curious'?'curious':'idle';
}
