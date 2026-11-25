# Leafy realtime voice

## Data flow

- The room and Leafy Live share `features/leafy-live/services/transcription.ts` for Corti WebSocket capture, Danish transcript events, teardown, and telemetry.
- The existing `VoiceSession` owns end-of-turn handling, echo suppression, meeting wake phrases, and barge-in. The room's Talk button starts direct conversation mode: Leafy answers normal Danish speech after a short silence without requiring a wake phrase, and new non-echo speech interrupts both an in-progress answer and spoken audio.
- Corti Transcribe is the normal one-microphone path. Leafy Live can select Corti Streams for long sessions or multiple speakers; it opens one Streams connection instead of a simultaneous Transcribe connection.
- The browser requests microphone access only after the user starts listening. Current capture requests echo cancellation, noise suppression, and automatic gain control. The same stream feeds Corti; the service does not open another microphone.
- ElevenLabs remains the only generated Leafy voice. If the browser supports MP3 Media Source Extensions, audio starts while later ElevenLabs chunks arrive. Otherwise the app buffers that reply, then plays it.
- ElevenLabs character alignment is mapped to coarse viseme groups. This is timed character-to-viseme approximation, not provider phoneme output. If streaming alignment is absent, the mouth uses conservative text-timed visemes while MP3 audio is playing, including while the browser has only current-frame buffer data.

## Corti setup

Required for browser STT: Corti Client ID, Client Secret, and Tenant (the app defaults to `base`). The settings form stores these encrypted; the secret stays on the server. For a self-hosted local app, configure `LEAFY_CREDENTIALS_ENCRYPTION_KEY` as 32 random bytes encoded as 64 hexadecimal characters.

Accepted server environment aliases:

- `CORTI_REGION` or `CORTI_ENVIRONMENT`: `eu` or `us`.
- `CORTI_STT_CLIENT_ID` / `CORTI_STT_CLIENT_SECRET`, or `CORTI_CLIENT_ID` / `CORTI_CLIENT_SECRET`.
- `CORTI_TENANT_NAME` or `CORTI_TENANT`.

The normal `/transcribe` endpoint receives a short-lived token scoped to `openid transcribe`. Streams creation uses a server-only token to create the Corti interaction, then gives the browser a short-lived token scoped to `openid streams`. Corti Streams uses diarization for its selected multi-speaker mode and sends final transcript segments with speaker IDs. A session is reopened after Corti's documented four-hour WebSocket limit.

Streams configuration sets `retentionPolicy: none`. Corti's documentation separately notes that account-level persistence of raw recordings can require a Corti-side setting; verify the tenant's retention policy with Corti before using this for data that must not be retained. The Leafy app does not save raw microphone audio. Its transcript log is opt-in and defaults to local browser storage according to the user's existing voice-log setting.

## Current limitations

- Streams is available from the Leafy Live microphone selector, not the ordinary room microphone. The room continues to use low-latency Transcribe.
- The user can interrupt by speaking; browser AEC and transcript echo filtering reduce self-transcription, but cannot guarantee echo-free recognition on every speaker/microphone setup.
- Barge-in commits only completed Leafy TTS chunks to the spoken echo history. If a chunk is interrupted, it is omitted rather than falsely logging the entire unplayed chunk as spoken.
- The room's expanded Realtime diagnostics reports observed STT, model-response, and ElevenLabs-start timings after real sessions. Nothing is hard-coded as a latency promise.
- No active Corti tenant or ElevenLabs key is available to this build process, so external credential authorization, account-specific quotas, and live media interoperability still require a real browser/device test.
