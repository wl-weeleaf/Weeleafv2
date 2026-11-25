# Leafy 3D app — Grok handoff

## ElevenLabs speech

In **Leafy 0.1 → Settings → AI and speech**, connect an ElevenLabs API key, choose a voice, then set **Speech output** to ElevenLabs. Use **Try Leafy's voice** to test it. The existing browser voice remains available as an alternative.

The key is encrypted with the app's `LEAFY_CREDENTIALS_ENCRYPTION_KEY` and stored in this browser's `HttpOnly; Secure; SameSite=Strict` cookie. It is sent only from the app's server to ElevenLabs. The speech endpoint uses ElevenLabs' timestamped text-to-speech response to animate Leafy's existing mouth sprites. Corti and ElevenLabs credentials share the encrypted credential vault; removing one provider keeps the other.

No ElevenLabs SDK is required. The server calls the REST API directly. Each browser needs its own key and voice selection.

This archive contains the Leafy web app source, the Three.js character and its layered face/animation assets, the 3D room textures, and the existing studio, watch, and orb views.

## Project map

- `app/` — routes and API endpoints.
- `components/leafy/` — Three.js model, face layers, gaze, idle motion, speech, room and 3D floor/wall scene.
- `components/wardrobe/` — Leafy Studio controls and conversation UI.
- `public/leafy/` — runtime model, torso, face, expression, mouth and accessory assets.
- `public/room/` — separate wall/floor textures and the supplied gold-coin icon image.
- `public/platform-scene/` — existing orb integration preview.
- `assets/` — Leafy integration notes. Runtime-ready source images and GLB are included under `public/leafy/`; duplicate high-resolution art working files are omitted from this portable archive to keep it a practical single download.

## Notes for continuing in Grok

Keep the supplied Leafy GLB and the approved green-leaf character identity. The room renderer uses the original room image split into wall and floor textures; preserve these as separate surfaces when changing the scene. The character remains a live Three.js model so its eyes, expressions, idle motion and shadow can update independently. Do not replace it with a flattened screenshot.

The home route is the room. `/studio`, `/watch` and `/orb` are existing views. The API route at `/api/livi/chat` streams text. All chat views share `lib/livi/core.ts`: one stable Leafy identity, safe app context, user-approved memory notes and reusable skills. Open **Leafy Core** in the Studio conversation header or room settings to add notes and skills or import/export `leafy-core.json`. The portable core excludes chat history and API keys. `LEAFY_CORE.md` explains the integration contract; `CORTI_SETUP.md` describes Corti Models and optional Danish dictation. The archive contains no API keys or user credentials. Do not add secrets to source control.

This project is a Next.js-compatible app currently built with Vinext/Vite and pnpm. Keep the checked-in package manifest and lockfile together. For a compatible Node 22+ development environment, install dependencies with pnpm and use the existing `dev` and `build` scripts. Environment-dependent hosting authentication and deployment settings are not included.
