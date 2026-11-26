# Sagsarbejdsplads

En selvstændig prototype på en moderne arbejdsplads til efterforskere, der lægger sig som et lag over PolSas.
Corti står for live-transskription, diktat og AI-hjælp.

Alle sager i appen er fiktive.

## Start (Windows, PowerShell)

```powershell
cd sagsapp
npm.cmd install
copy .env.example .env     # udfyld Corti-nøglerne, se nedenfor
npm.cmd run dev
```

Åbn derefter **http://localhost:5180** i Chrome eller Edge.

Uden en udfyldt `.env` kører appen i demo-tilstand. Så bruger den browserens egen danske talegenkendelse og simple forslag uden AI.

## Corti-opsætning

Tryk på **Forbind Corti** øverst til højre, udfyld felterne og tryk **Gem og test forbindelse**.
Værdierne gemmes i `sagsapp/.env`, og du kan også redigere filen direkte:

| Variabel | Beskrivelse |
|---|---|
| `CORTI_ENVIRONMENT` | `eu` eller `us` |
| `CORTI_TENANT_NAME` | Jeres tenant |
| `CORTI_CLIENT_ID` / `CORTI_CLIENT_SECRET` | Klientens nøgler (bliver kun på serveren) |
| `CORTI_AGENT_ID` | Valgfri. Ellers oprettes en agent ved første brug, og id'et skrives i konsollen |
| `CORTI_LANGUAGE` | Sprogkode til transskription (`da`) |

Tjek, at dansk er understøttet for jeres tenant: http://localhost:5180/api/corti/languages

## Baggrundsbillede

Læg et foto som `public/bg.jpg` (fx natur eller sten), så ligger det sløret bag glaspanelerne. Uden et foto bruges en lys, organisk baggrund.

## Opbygning

```
server/index.js   Node-server. Holder nøglerne og henter tokens (client credentials).
                  Udleverer en kortlivet WebSocket-URL og kalder Corti-agenten.
src/corti.js      Browser: mikrofon → Corti /transcribe (WebSocket), diktatkommandoer,
                  fallback til browserens talegenkendelse.
src/SagApp.jsx    UI: sager, tidslinje, opgaver, tale, AI-forslag og eksport til PolSas.
```

- **Diktat → resumé:** tegnsætning siges højt ("punktum", "komma"), og der er kommandoerne "ny linje", "nyt afsnit", "slet det sidste" og "stop diktat".
- **Afhøring:** automatisk tegnsætning. Transskriptionen gemmes i sagens tidslinje.
- **AI-assistent:** en Corti-agent udtrækker gerningskode, tid, sted og værdi og foreslår næste skridt. Efterforskeren godkender hvert felt.

## Før rigtige data

- Kør serveren bag login (jeres SSO) og over https.
- Tokenet til WebSocket-forbindelsen sendes i URL'en (Cortis format). Hold den kortlivet, og log den ikke.
- Indgå databehandleraftale med Corti, og vælg EU-miljøet.
