# Leafy NPC — interaktiv guide

## Start

Node.js 22+, `npm install`, `npm run dev`. Next.js App Router og Three.js. Ingen ekstra animation-, tale- eller agentpakker er nødvendige.

## Separate billedlag på den oprindelige torso

- `LayeredLeafyNPC.ts`: bruger samme torso-geometri som den eksisterende Leafy 3D-torso. Front, bagside, `Eyes_sprite`, `Brows_sprite` og `Mouth_sprite` er separate meshes under samme model. Ansigtslagene følger de samme vertexpositioner og UV-koordinater med lille dybdeafstand, så de følger hele figurens rotation og hop.
- `FaceSpriteLayers.ts`: laver selvstændige CanvasTextures. Originalens øjne, bryn og hvilemund udskæres som billedlag; ni blikretninger og blink fra gaze-sprites.png registreres til de samme øjenområder. De øvrige mundformer kommer fra det eksisterende mund-atlas. Den rensede hudtekstur bruges kun inden for ansigtets masker; den oprindelige torsoform bevares. `LeafyNPC.ts` er bevaret som tidligere geometrisk version og som kilde til fælles mund-ID'er.
- `LeafySpeech.ts`: talestart/stop og mundformer. Browserstemme til afprøvning. Lydens `currentTime` styrer tidsstemplede mundformer fra ekstern TTS.
- `LeafyAgent.ts`: en lille adapter til jeres faktiske AI. Afbryder gamle svar og tale, viser tænketilstand og leverer svar til figuren. Ingen AI-model eller backend er tilkoblet i demoen.

NPC-adfærden er en lokal tilstandsmaskine, ikke bevidsthed eller selvstændig ræsonnering. Figurfølelsen kommer fra forsinkelser, begrænset blikretning og små bevægelser. Der er ingen mikrofonoptagelse i denne version.

## Brug i Next.js

Kopiér `components/leafy/` og `public/leafy/`. Installer `three` og `@types/three`. Den selvstændige Canvas-komponent kræver ikke UI-bibliotekerne fra studiet.

```tsx
'use client';
import { useRef } from 'react';
import LeafyCanvas, { type LeafyHandle } from './LeafyCanvas';
export default function Guide() {
  const leafy = useRef<LeafyHandle>(null);
  return <>
    <div style={{ height: 600 }}>
      <LeafyCanvas ref={leafy} followPointer expression="idle" />
    </div>
    <button onClick={() => leafy.current?.speak('Hej. Jeg er Leafy.')}>Tal</button>
  </>;
}
```

CSS: `.leafy-canvas { width:100%; height:100%; position:relative; } .leafy-canvas canvas { display:block; touch-action:none; }`

Props: `expression` (idle/happy/curious/sleepy), `followPointer`, `eyesVisible`, `mouthVisible`, `facePlaying`, `motion` (idle/hop/still), `thinking`, `mouthPreview` (null = automatisk, none = skjult eller en mundform), `rotate`, `wireframe`, `onReady`, `onSpeaking`.
Ref: `speak(text)`, `stop()`, `playSpeech(packet)`, `view(front/side/back)`, `exportGLB()`.

## Præcis tidsstyret lipsync

TTS-leverandøren skal levere lyd og mundtider. Alle tidsangivelser er **sekunder fra lydens start**. Lyd og tidsstempler skal stamme fra samme ytring. Ved stilhed, pause, buffering og afslutning går munden til rest.

```ts
await leafy.current?.playSpeech({
  audioUrl: '/audio/leafy-svar.mp3', // din faktiske lydfil
  visemes: [
    { time: 0.10, duration: 0.09, id: 'MBP' },
    { time: 0.19, duration: 0.16, id: 'AA' },
    { time: 0.35, duration: 0.12, id: 'L' },
  ],
});
```

Eksemplet angiver formatet, ikke mundtider til en medfølgende optagelse. Match TTS-leverandørens fonemer/visemer til disse otte visuelle grupper: `rest`, `MBP`, `AA`, `EE`, `OH`, `OO`, `FV`, `L`. Tilpas grupperingen til stemmens sprog og fonemformat. Klip og frameopdatering følger lydens afspilningsur frem for uafhængige timere. Browserens medie- og skærmopløsning sætter den praktiske synkroniseringspræcision.

Browserstemmens `boundary`-events giver kun ordgrænser og understøttes ikke af alle stemmer/browsere. Demoen bruger dem, når de findes, og en estimeret tegnsekvens ellers. **Denne fallback er omtrentlig, ikke fonempræcis lipsync.** Stemmen er browserens tilgængelige danske stemme, ikke en trænet Leafy-stemme.

## Tilkobl den rigtige AI

```ts
import { LeafyAgent } from './LeafyAgent';
const agent = new LeafyAgent(
  async (question, signal) => {
    // Implementér denne serverroute mod jeres Leafy/OpenClaw/Ollama- eller AI-service.
    const response = await fetch('/api/leafy', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (!response.ok) throw new Error('Leafy kunne ikke svare');
    return response.json(); // { text, expression?, speech?: { audioUrl, visemes } }
  },
  leafy.current!,
  setThinking,
  reply => { setExpression(reply.expression ?? 'idle'); setAnswer(reply.text); },
);
// Kald først efter onReady; håndtér fejl i appens UI.
await agent.ask('Hvordan kan jeg spare på energien?');
// Ved unmount: agent.dispose();
```

`/api/leafy` er et integrationseksempel og er ikke implementeret eller kaldt af demoen. API-nøgler hører hjemme på serveren. Afbrydelseslogikken ignorerer et gammelt svar, selv hvis transporten ikke respekterer AbortSignal.

## Filer og eksport

- `torso-source.png`: uændret original. Arme og ben ligger uden for torsoens mesh.
- `torso-clean-source.png`: genereret hud til at dække de fasttegnede ansigtstræk.
- `gaze-sprites.png`: kildeark; kun øjenudsnit bruges i lagene. Hele kroppe fra arket animeres aldrig.
- `npc-base.png`: bevaret til den tidligere geometriske NPC.
- `back.png`: monteret bagside.
- `mouths/*.png`: otte billeder med gennemsigtighed og fælles anker.
- `mouths/atlas.png`: 4 × 2 atlas; `mouths/sequence.gif`: oversigt over alle mundformer. GIF'en afspilles ikke i en blind løkke under tale; lipsync vælger den rigtige frame.
- `leafy.glb`: tidligere gemt model. Brug garderobens Hent GLB til den aktuelle torso med separate billedlag. Interaktivt blik, blink, tale og agentadfærd kræver koden og kan ikke alene gemmes i almindelig GLB.

Tidligere ansigts-GIF'er bevares i pakken, men NPC-versionen bruger separate øjne og mund for at undgå to munde eller fastlåste blikke.

## Kontrol og afgrænsning

TypeScript og Next.js-produktionsbuild kontrolleres. Tests dækker mundtider, stilhed, ankerhierarki og begrænsning af blik og kropsdrejning. Browserstemmens lyd og WebGL-udseendet er ikke browserafprøvet her.

Billedværktøj: indbygget billedgenerering. Baseprompt: bevar Leafys bladform, grønne tekstur og kinder; fjern øjne, bryn og mund til separate lag. Mundprompt: otte isolerede mundformer i samme stil på magenta ekstraktionsbaggrund. Spriteudtræk fjerner ekstraktionsbaggrunden og monterer hvert billede omkring samme centrum.

Dokumentation:
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/boundary_event
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime

## Leafys garderobe
The home screen combines movement controls with streaming text chat. Chat and settings persist locally in the browser, with JSON export. Read-aloud is optional; browser speech uses approximate mouth timing, not guaranteed phoneme alignment. For precise lipsync use the audio/viseme packet interface described above.

Server configuration: set OPENAI_API_KEY (or LIVI_API_KEY); optional LIVI_MODEL and LIVI_API_BASE_URL for an HTTPS OpenAI-compatible chat-completions provider. No credentials belong in NEXT_PUBLIC variables. Missing configuration disables send and shows an explicit notice. The default model is gpt-4.1-mini.

The hosted app uses trusted Sites authentication headers. When migrating to another hosting setup, replace getChatGPTUser in app/chatgpt-auth.ts with that platform's verified server session before enabling the chat API. Never trust client-supplied identity headers on a public deployment. AI integration requires credentials and has not been live-tested without them.

PWA: manifest and icons are provided. Service worker caches only character/icon assets and a generic offline page. Conversations, API responses and authenticated pages are never cached by it. AI requires an internet connection.

## Kontrol af de nye lag
Canvas-kontrol bekræfter, at øjenopdateringer ikke ændrer mundteksturen og omvendt, og at skjult mund er helt transparent. Originalens pixels uden for ansigtsområderne bevares. Lagene kan vises/skjules separat i Mund & model i garderoben (/studio). Hent GLB fryser alle lag som separate teksturer; tale og blik følger med TypeScript-koden. WebGL-visningen og hørbar browserstemme skal stadig slutkontrolleres på en enhed med WebGL.

## Opdatering: godkendt GLB-form og enkelt mundforløb
`reference-geometry.json` indeholder positioner, normaler og trekanter direkte fra brugerens leafy (2).glb. ReferenceGeometry bevarer nu også originalens UV; for- og bagsidens kantpositioner er identiske. Basematerialet er helt opakt, så teksturalfa ikke skærer huller i kanten. Ansigtslagene er fortsat transparente, separate meshes.

Munden har fem åbningsgrader af originalens samme smil. `rest`/`MBP` = lukket, FV = 1, EE/L = 2, OH/OO = 3, AA = 4. Der tegnes ikke længere andre munddesigns fra det gamle atlas. Taletiming styrer graden; i stilhed står munden stille. Manuel afprøvning er i Mund & model.

IdleLife vælger små blik-/drejeforløb med pauser. Museinteraktion, kameratræk, tale, tænketilstand, animationspause og skjult fane undertrykker idle-forløb. Idle-lyd aktiveres med en brugerhandling i Bevægelser og gemmes ikke som autoplay-præference. Fløjt er syntetiseret med Web Audio; korte danske bemærkninger bruger browserstemmen, højst én per minut. Det er lokal karakteranimation, ikke selvstændig bevidsthed. Stop og samtaler har forrang. Lyde og slutresultatet i WebGL kræver stadig kontrol på brugerens enhed.


## Aktuel renderer: original torso og samtalebevægelser
Denne opdatering erstatter de ældre torso-/gaze-ark i den aktive renderer. `original-torso.png` er det uændrede første 512×512-billede. `npc-base.png` dækker kun ansigtsområderne; øjne, iris, bryn og smilet udtrækkes fra originalen. Resten af originalens pixels bevares. Historiske billedark i pakken bruges ikke af LayeredLeafyNPC.

LeafDeformation bøjer bladspidsen med forsinkelse efter drejning og giver langsom vejrtrækning. Den samme deformation bruges på begge sider og alle ansigtslag, så kanten forbliver lukket. Idle giver små hop, sjældne stræk og dobbeltblink. Pause/reduceret bevægelse dæmper deformationen tilbage til neutral.

ConversationPose prioriterer aktiv lytning, tale, tænkning og samtalefokus over idle/mus. Kameraet drejes tilbage mod fronten under samtaler. Kamera-knappen kræver tilladelse og behandler billeder lokalt i en Worker; kun ansigtskoordinater bruges. MediaPipe 0.10.14 og detektionsmodellen hentes fra CDN ved aktivering, så første opstart kræver internet. Ingen billeder optages eller uploades. Manglende ansigt giver fremadvendt blik. Skjult fane/deaktivering stopper kameraet. Husk at medtage public/camera ved integration.

Diktér bruger valgfri browser-SpeechRecognition og udfylder kun tekstfeltet; brugeren trykker Send. Browserens taleudbyder kan behandle lyden eksternt, hvilket oplyses i UI. Det er ikke fuld duplex stemmesamtale. Browseroplæsning har omtrentlig mundtiming; præcise tidskodede visemer kan tilkobles via den eksisterende audio-pakkegrænseflade.

Kontrolleret: separate ansigtslag, fjernede faste ansigtstræk, fælles kant under deformation, samtaletilstandes prioritet, stream-/talestop og TypeScript. Kamera, mikrofon, hørbar tale og den endelige GPU-visning skal afprøves på målenheden. AI-serveren kræver fortsat en gyldig servernøgle og verificeret loginintegration hos Filip.


## Smartwatch-fane og /watch
Garderobens Smartwatch-fane genbruger den aktive LeafyCanvas og samme samtale, uden en ekstra WebGL-instans. Rund/afrundet skærm er en browserforhåndsvisning, ikke en enhedsprofil eller parring. /watch åbner samme Wardrobe med kompakt urvisning. Den deler kun lokal historik på samme browser/origin; der er ingen synkronisering mellem telefon og ur.

Urvisningen bruger nu samme orbit, musefølgning, kamera og idle-lyd som garderoben. Faneskift bevarer sensorer og lyd. Strømsparevalg begrænser rendering til højst 20 fps og pixel ratio 1; skjult side springer rendering over. I urvisningen afbrydes tale, diktering og ventende svar, når siden skjules. Dette er browseradfærd, ikke en garanti om batteriforbrug eller native Always On. Taletest bruger eksisterende browserstemme og mundsekvens. AI bruger den eksisterende autentificerede chat-API.

Nødvendigt før fysisk integration: urmodel, OS-version og parret telefon. Apple Watch kræver en watchOS-implementering; Wear OS kræver en passende ur-app. Genbrug Leafys originale billedlag og animationstilstande, men tilpas rendering og livscyklus til platformen. Lad aldrig en servernøgle ligge i urklienten. Der er ikke oprettet Bluetooth-parring, baggrundslytning, en watch face, native installationspakke eller permanent aktiv assistent i dette trin.

Officielle livscyklusreferencer til Filip:
- https://developer.apple.com/documentation/watchos-apps/designing-your-app-for-the-always-on-state/
- https://developer.android.com/training/wearables/always-on


## Fælles adfærd i garderobe og watch (opdateret)
Begge visninger bruger samme LeafyCanvas, LayeredLeafyNPC og IdleLife. WatchControls ændrer alene skærmform og renderingens strømprofil. De fælles kontroller for mus, kamera, lydreaktion, bevægelser og fløjt/bemærkninger findes også i watch-visningen. Profil-knappen viser dybdevejrtrækningen tydeligt.

Vejrtrækning: 5,6 sekunders cyklus med kortere indånding og længere udånding. Den centrale del af både ryg og mave flyttes proportionalt langs z (ca. ±23% centralt); siderne udvides langt mindre. Alle lag og begge sider bruger samme deformation, så søm og ansigtsplacering bevares. IdleLife begynder efter 3,5 sekunders ro og vælger nye forløb efter 5–13 sekunder. Samtale og sanseinput har forrang; vejrtrækningen fortsætter dæmpet under opmærksomhed. Dette er karakteradfærd, ikke selvstændig bevidsthed.

SoundAttention kræver en separat mikrofonaktivering. Web Audio analyserer RMS lokalt; intet optages, uploades eller afspilles fra mikrofonen. Stereo estimerer en side ud fra kanalernes energiforskel, ikke en målt fysisk lydretning. Mono/ukendt kanalantal giver kun fremadvendt reaktion. Mikrofongeometri, kanalorden, støjbehandling og rummet kan gøre stereosignalet upålideligt. Kalibrering på den konkrete enhed er nødvendig. Under Leafys tale ignoreres lydhint for at begrænse selvreaktion. Start af browserdiktering stopper lydsensoren. Skjult side, deaktivering og unmount frigiver mikrofonen. Kamera kan nu også give opmærksomhed uden en igangværende samtale.

Dokumentation: https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings/channelCount og https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createChannelSplitter

## Valgfrie hænder og hampsko
`FloatingAccessories.ts` bygger to fritsvævende hænder og to sko som selvstændige 3D-grupper under den eksisterende Leafy. Ingen arme eller ben. Hænderne følger idle og laver korte vink; tale får lette håndbevægelser, tænkning løfter én hånd. Skoene svæver forskudt. Hamplooket er et vævet CanvasTexture-materiale med grønne kanter og lyse såler. Det er en 3D-fortolkning af det godkendte konceptbillede, ikke hele konceptbilledet monteret som sprite.

Garderobens Mund & model og Smartwatch har separate kontroller for hænder og sko; valg gemmes i de eksisterende lokale indstillinger. Begge er tændt som udgangspunkt. Slå begge fra for original torso. De øvrige LeafyCanvas-forbrugere er fortsat torso-only, medmindre `handsVisible`/`shoesVisible` sættes til true. Kameraindramningen tilpasses via en separat visningsgruppe; original torso-geometri og ansigtslag bevares. GLB-eksport medtager de synlige dele som et øjebliksbillede. Runtime-animationen følger med kildekoden.

## Opdateret: hænder bruger billeder
De procedurale håndkugler er fjernet. `public/leafy/hands-atlas.png` er et transparent 3×2-ark afledt af det godkendte Leafy-koncept: afslappet, åben og pegende hånd, hver med for- og bagside. `HandSprites.ts` udtrækker billederne ved indlæsning og sætter dem på let buede billedflader. Højre hånd spejles. Hænderne skifter med korte overgange: afslappet under idle, åben ved vink/tale og pegende ved tænkning. Vink og undrende gestik kommer fra bevægelse af disse positurer, ikke en blind GIF-løkke. Skoene er uændrede.

Dette er 2.5D: for/bagsider og en begrænset tilpasning til betragtningsvinklen reducerer fladheden, men er ikke fuldt volumetriske fingre ved alle vinkler. Modellen kan fortsat drejes. Materialet har baked lys fra billedet og toneMapped=false. Runtime kan udvides med flere positurer og separate sidebilleder. Håndbillederne er genererede afledninger af referencebilledet, ikke uændrede pixeludsnit. Ingen tredjeparts håndmodel er importeret.

Billedprompt: isoler Leafys grønne hænder fra det godkendte koncept; samme organiske form og tekstur, tre poser og tilsvarende bagsider, transparent 3×2-ark uden torso/sko/tekst. Skabt med det indbyggede billedværktøj. Testet: transparente billedceller, separate for-/bagsider, spejling og positurskift; den endelige WebGL-visning kræver visuel kontrol på en understøttet enhed.
