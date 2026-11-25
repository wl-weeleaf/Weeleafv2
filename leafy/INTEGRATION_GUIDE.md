# Leafy 0.1 — platform integration handoff

This bundle contains a separate platform copy of Leafy 0.1 source and runtime assets, including the current 3D character, speech/mouth animation code, and first song-to-melody feature. It is an integration reference for merging Leafy into the WeeLeaf platform UI.

## Integration map

- `components/leafy/` — Three.js scene, torso model, facial layers, gaze, idle motion and animated mouth rig.
- `features/voice/` and `components/leafy/LeafySpeech.ts` — speech session, audio playback, playback-timed text and mouth cues.
- `app/page.tsx`, `components/leafy/LeafyRoom.tsx` — Leafy room and chat experience.
- `components/leafy/LeafySongSinger.tsx`, `lib/leafy/melody.ts`, `app/api/leafy/music/route.ts` — song lookup, local MIDI/MusicXML parsing and browser-based melody playback.
- `app/api/leafy/` and `app/api/livi/` — server endpoints for chat, settings, Corti transcription/streams, voice and related features.
- `lib/leafy/`, `lib/livi/`, `server/`, `db/`, `drizzle/` — assistant logic, provider credentials, persistence and schema/migrations.
- `features/leafy-live/` and `app/leafy-live/` — presenter, audience and stage views.
- `public/` — character, room, audio and runtime assets.

## Framework and deployment

The app uses React 19, TypeScript, Three.js and Vinext/Vite with Cloudflare Worker services and optional D1/R2 bindings. The platform copy adds the melody feature but does not convert the Cloudflare API/database layer to PHP/MySQL. The full app is not a direct `public_html` upload. Port server endpoints and persistence before deploying to a PHP/MySQL-only target. Keep Corti and ElevenLabs credentials server-side.

## Melody feature

- Search uses OpenScore Archive's public catalog and only offers score files whose asset metadata explicitly marks rights as public-domain, CC0 or permissive.
- Local MIDI and MusicXML files are parsed in the browser and are not uploaded or saved by this feature.
- First playback uses a synthesized hum-like sound or clean tone, not a pitch-corrected recording of Leafy's ElevenLabs voice.
- MIDI parsing was checked with a generated one-note fixture. The full app build and live catalog lookup were not run in this workspace.
- Complex scores and compressed `.mxl` files need follow-up support. Rights for the composition, edition and recording remain separate.

## Version

Base source: Leafy 0.1 production version 38, published 2026-10-19. This isolated platform copy adds song-to-melody code as copy version 39; it is not deployed over the original app.

No live API keys, `.env` files, site identity or deployment secrets are included.
