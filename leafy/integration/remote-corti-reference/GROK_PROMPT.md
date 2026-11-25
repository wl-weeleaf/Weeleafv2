# Grok prompt – Leafy perception, navigation, remote access og Corti runtime

Implementér en grundfunktion i Leafy, hvor Leafy som standard kan opfatte og navigere den platform, Leafy befinder sig i, samt arbejde gennem en kontrolleret fjernadgang til en ekstern computer/browser-session.

Målet er, at Leafy ikke kun fungerer som en chatfunktion, men som en digital agent, der kan se, forstå og interagere med sine digitale omgivelser.

## Standardmiljø

Leafy skal som standard have kontekst om:
- den aktuelle side
- den aktuelle app
- synlige UI-elementer
- aktive opgaver
- tilgængelige browser-/computer-sessioner
- hvilken enhed eller session Leafy aktuelt arbejder på

Leafy skal kunne identificere:
- knapper
- links
- faner
- formularfelter
- menuer
- dialoger
- tekstområder
- filer
- browsere
- programmer
- andre interaktive komponenter

Leafy skal kunne:
- navigere mellem sider og funktioner
- klikke
- scrolle
- skrive
- vælge muligheder
- åbne links
- åbne/lukke faner
- uploade og downloade filer
- åbne programmer
- skifte mellem programmer
- bruge tastatur og mus
- aflæse ændringer efter en handling
- fortsætte ud fra den nye tilstand

Brug DOM, accessibility tree og strukturerede UI-data som primær informationskilde, hvor det er muligt.

Brug visuel forståelse/screenshots som supplement, når UI ikke kan forstås tilstrækkeligt gennem strukturerede data.

Navigationen må ikke afhænge af hardcodede selectors eller bestemte websites. Leafy skal forstå elementer ud fra funktion, tekst, placering og kontekst.

## Generisk action-system

Implementér som minimum:
- observe
- inspect
- click
- doubleClick
- type
- keyPress
- scroll
- select
- open
- back
- forward
- switchTab
- openTab
- closeTab
- upload
- download
- wait
- launchApp
- closeApp
- switchApp
- movePointer
- humanTakeover

Alle handlinger skal returnere:
- resultat
- opdateret state
- relevante ændringer
- eventuelle fejl
- nye mulige handlinger

## Grundloop

USER GOAL
→ OBSERVE ENVIRONMENT
→ UNDERSTAND STATE
→ PLAN NEXT STEP
→ EXECUTE
→ OBSERVE RESULT
→ VALIDATE
→ CONTINUE

Leafy skal opleve den platform eller computer, Leafy befinder sig på, som sit digitale miljø.

## Corti

Brug Corti som Leafys primære reasoning-/LLM-motor.

Corti skal ligge server-side.
API-credentials må aldrig eksponeres i browseren.

Forslået struktur:

/app/api/leafy/route.ts
/lib/corti.ts
/lib/leafy-runtime.ts
/lib/leafy-tools.ts
/components/Leafy3D.tsx
/hooks/useLeafy.ts

Corti runtime skal modtage:
- user message
- Leafy persona
- memory/context
- current environment
- tool definitions
- active task state

Corti skal kunne returnere:
- almindeligt svar
- tool call
- human takeover request

## Remote access

Tilføj en Remote Computer Layer.

Leafy skal kunne forbindes til:
- lokal Windows-PC
- mini-PC
- virtuel maskine
- browser-session
- senere andre enheder

Arkitektur:

Leafy App
→ Leafy Core
→ Remote Session Manager
→ Remote Computer Agent
→ Browser / Operating System / Apps

Remote Computer Agent skal kunne:
- sende screenshots eller visuel state
- sende accessibility/UI-data hvor muligt
- modtage musehandlinger
- modtage tastaturhandlinger
- starte programmer
- skifte vinduer
- håndtere browser
- håndtere filer inden for tilladte områder
- rapportere ændringer tilbage til Leafy

Hver session skal have:
- sessionId
- deviceId
- currentState
- permissions
- controlStatus
- lastActivity
- activeApplication

## Browser på brugerens PC

Første version bør bruge:
- Chrome extension
- chrome.debugger / Chrome DevTools Protocol
- Chrome Native Messaging
- lokal Leafy Bridge

Flow:

Leafy
→ Chrome Extension
→ Native Messaging
→ Leafy Bridge
→ Windows

Browseren skal bruge:
1. DOM/accessibility
2. visuel forståelse
3. koordinater som fallback

## Windows

Brug Microsoft UI Automation som primær semantisk adgang til desktop-apps.

Fallback:
- screenshot
- mouse
- keyboard

Leafy skal senere kunne:
- åbne VS Code
- åbne Blender
- bruge File Explorer
- finde filer
- starte programmer
- skifte mellem vinduer

## Human takeover

Når Leafy møder:
- MitID
- betalingskort
- bankgodkendelse
- CAPTCHA
- 2FA
- sikkerhedskoder
- biometrisk login
- sensitive loginoplysninger
- andre human-only handlinger

skal flow være:

LEAFY WORKING
→ HUMAN ACTION REQUIRED
→ PAUSE AGENT
→ REMOVE LEAFY CONTROL
→ PAUSE PERCEPTION OF PROTECTED CONTENT
→ USER TAKES CONTROL
→ USER COMPLETES ACTION
→ USER PRESSES "CONTINUE WITH LEAFY"
→ LEAFY OBSERVES NEW SAFE STATE
→ TASK CONTINUES

Under protected human takeover må Leafy ikke modtage:
- screenshots af følsomt trin
- tastetryk
- clipboard-data
- adgangskoder
- MitID-information
- kortoplysninger
- 2FA-koder

Dette skal håndhæves teknisk og ikke kun gennem LLM-prompting.

## Eksterne websites og apps

Leafy skal ikke kræve en specialintegration til hvert website.

Eksempel:
Bruger: "Find den bedste løsning og gør den klar."

Leafy:
1. bruger Corti til at forstå opgaven
2. finder relevante oplysninger
3. finder relevante links/programmer
4. åbner nødvendigt website/app
5. navigerer brugerfladen
6. udfører handlinger
7. vurderer resultatet
8. stopper ved human-only handling
9. fortsætter bagefter

Eksterne AI-værktøjer som ChatGPT, Grok, Canva, GitHub eller andre webapps kan bruges gennem deres normale brugerflade, hvis brugeren har adgang til dem, og hvis brugen er tilladt af tjenestens vilkår.

## Tool discovery

Leafy skal kunne opdage nye værktøjer og forstå brugerflader, den ikke tidligere har set.

Grundregel:

FORSTÅ MÅLET
→ FIND VÆRKTØJ
→ ÅBN VÆRKTØJ
→ FORSTÅ UI
→ UDFØR
→ KONTROLLÉR RESULTAT

## Første implementering

Prioritér:
1. Leafy kan se sin egen platform
2. Leafy kan navigere platformen
3. Corti fungerer som primær reasoning-motor
4. tool calls fungerer
5. remote session kan etableres
6. Chrome kan styres på brugerens PC
7. human takeover virker
8. activity log virker
9. desktop apps kan tilføjes bagefter

Undgå mocks og placeholder-knapper hvor reel funktion kan implementeres.

Grundprincippet er:

Leafy skal ikke kun kunne tale om den digitale verden.
Leafy skal kunne se den, navigere i den og bruge den.
Når menneskelig handling er nødvendig, skal Leafy give kontrollen til mennesket og fortsætte bagefter.
