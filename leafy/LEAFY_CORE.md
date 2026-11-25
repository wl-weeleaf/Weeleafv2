# Leafy Core — portable integration

Leafy has one stable identity with app-specific context layered around it. Keep the core prompt and the JSON profile/skills separate from each host application's UI and tools.

## Portable user data

Export `leafy-core.json` from the Leafy Core panel and pass it to another Leafy app. It contains only the user's opted-in notes and reusable skills, never conversation history or API secrets.

```json
{
  "format": "leafy-core",
  "version": 1,
  "profileNotes": ["Prefers a short summary followed by concrete next steps."],
  "skills": [
    {"id":"project-plan","name":"Project plan","instructions":"Clarify the goal, list milestones, owners, risks and the next action."}
  ]
}
```

## Host integration

Copy `lib/livi/core.ts` into the host or import it as a small shared module. Load/validate the JSON using `normalizeLeafyCore`, then build a system instruction with `createLeafySystemMessage(core, appContext)`. `appContext` is a known lightweight key (`room`, `studio`, `watch`, `game`, `website` or `companion`) so each host can add a safe, short context without redefining Leafy's identity. Send the resulting system instruction and the current conversation to whichever compatible language model the host uses.

The module defines the shared identity, Danish-first voice, honesty about available tools, user profile notes and task skills. Each app remains responsible for its model connection, permissions and actual tools. Do not claim browsing, file changes, code execution or other actions unless the host supplies those tools and they run successfully.

## Learning and portability

The user adds or removes profile notes and skills explicitly in Leafy Core settings. This lets them decide what Leafy remembers. In this app, data is stored in the current browser's local storage. Import/export transfers it to another browser or app. It excludes chats and credentials.

Keep the core identity stable across products. Add local features as skills or app context, and only promise capabilities that the current host has connected.
