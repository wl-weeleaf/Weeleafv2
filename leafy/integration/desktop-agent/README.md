# Leafy Desktop Agent 0.1 (Windows)

A small, transparent, always-on-top desktop widget that loads the real Leafy 3D model and voice session from the hosted Leafy app. It does not contain API credentials or copy Leafy's model/AI logic.

## Install and start

1. Install Node.js 22 or newer.
2. Extract this folder somewhere you can write to.
3. Open PowerShell in this folder and run:

   ```powershell
   npm install
   npm start
   ```

The first run downloads Electron from npm. The Leafy widget appears above other windows. Drag the Leafy figure to move it. Click once to start/stop Leafy's live microphone conversation; double-click to open the full dashboard. Microphone permission is only granted to the official Leafy site, and Leafy still asks for microphone access through the browser session.

## Notes

- Internet access is required; the current hosted Leafy app supplies the 3D actor, voice, settings, memory and AI connection.
- Configure or sign in to Leafy in the dashboard first if the hosted app asks for it. The desktop client stores its own browser session.
- This is an unsigned developer package, not a Microsoft Store installer. It contains source and uses the installed Node/npm runtime; it does not execute a downloaded PowerShell script.
- No Corti, ElevenLabs, or model secrets are included. They remain in Leafy's server-side configuration or the app's encrypted credential settings.
