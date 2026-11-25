import type {CortiCredentials} from './credentials';

/** Resolve encrypted per-user settings first, then shared server-only Site secrets. */
export function elevenLabsCredentials(user?:CortiCredentials|null){
 return {
  apiKey:user?.elevenLabsApiKey||process.env.ELEVENLABS_API_KEY||'',
  voiceId:user?.elevenLabsVoiceId||process.env.ELEVENLABS_VOICE_ID||'',
  configured:!!(user?.elevenLabsApiKey||process.env.ELEVENLABS_API_KEY),
 };
}
