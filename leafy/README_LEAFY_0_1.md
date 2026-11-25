# Leafy 0.1 — værktøjsmotor

Eksisterende Leafy 3D, rum, garderobe, chat, tale og Corti er bevaret. Chatten kan nu faktisk kalde weblæsning, websøgning, dokumenter, HTML-apps og SVG-billeder. Resultater bliver vist i Filer og godkendelser og registreret i Activity.

## Forbindelser

- Corti: CLI-kompatibel `CORTI_BEARER` / `CORTI_CLIENT_ID` / `CORTI_CLIENT_SECRET` / `CORTI_TENANT`, `CORTI_MODELS_API_KEY` eller eksisterende `CORTI_STT_CLIENT_ID`, `CORTI_STT_CLIENT_SECRET`, `CORTI_TENANT_NAME`. OAuth-token fornyes på serveren. `CORTI_REGION=eu` er standard.
- Model: `CORTI_MODEL=corti-s1-mini-instant`; Frontier bruger `CORTI_FRONTIER_MODEL=corti-s1-instant`.
- Lokal model: `LEAFY_LOCAL_API_BASE_URL` (HTTPS, fx en beskyttet tunnel til en lokal OpenAI-kompatibel modelserver), `LEAFY_LOCAL_MODEL`, valgfrit `LEAFY_LOCAL_API_KEY`.
- Vedvarende data: Cloudflare D1-binding `DB`, erklæret i `.openai/hosting.json`. Tabeller oprettes ved første brug. Opgaver og godkendelser er knyttet til en tilfældig HttpOnly besøgsidentitet; ingen login kræves. Rydning af cookies betyder, at den gamle besøgsidentitet ikke længere kan tilgås.
- Browsermotor: `LEAFY_BROWSER_URL` og `LEAFY_BROWSER_TOKEN`. Den komplette Playwright-motor ligger i `integration/browser-engine` og i `public/downloads/leafy-browser-engine.zip`.

Sæt hemmeligheder i serverens miljøvariabler. Gem aldrig nøgler i frontend, Git, ZIP eller prompts. Når Sites-miljøvariabler ændres, skal en gemt version udgives igen.

## Corti til kodearbejde

Leafy kan bygge og rette software direkte fra chatten, når PC-forbindelsen er parret. Den læser projektfiler og `package.json`, foreslår komplette filændringer og kan køre projektets build-/test-scripts. Hver filændring, dependency-installering og projektscript kræver en konkret godkendelse i samtalen. Kørsel er begrænset til den valgte mappe og scripts, projektet selv har angivet; der er ingen fri shell. Den udgivne app bruger den Corti-forbindelse, der er sat i servermiljøet eller appens Corti-indstillinger.

OpenCode via Cortis EU CLI er stadig en valgfri lokal kodeagent og kræver særskilt opsætning. I projektet: `npm run corti:init`. Se `CORTI_SETUP.md` og `corti.env.example`.

## Arbejdsflow

1. Skriv en konkret opgave til Leafy, fx “Læs https://www.weeleaf.com og lav et kort dansk oplæg som en Markdown-fil”.
2. Offentlig læsning og søgning udføres, hvis tilladelsen er ALLOW.
3. Leafy viser et konkret godkendelseskort for ASK-handlinger. Klik Godkend handling for at udføre det. BLOCK forhindrer handlingen.
4. Filer kan vises og hentes. HTML kører isoleret, SVG vises som et billede. Billedgenereringen er illustrationer, ikke en fotorealistisk diffusionsmodel.
5. Opgavefanen kører korte opgaver på serveren og gemmer resultatet. Maksimalt 24 sekunder pr. job. Lange forløb skal opdeles. Dette er ikke en kø, der kører ubegrænset natten over.

Browserlæseren kan hente offentlige HTTPS-siders tekst og følge links uden ekstra tjenester. Gældende dansk/EU-regler og andre kritiske oplysninger søges først mod officielle myndigheds- og primærkilder, herunder Retsinformation og EUR-Lex; søgeresultater har direkte kildelinks og hentetidspunkt. JavaScript, klik, formularer og login kræver den separate kørende browsermotor. Motoren får ikke adgang til din personlige browsers login. Ingen køb, publicering eller sletning udføres skjult.

## Kontrol

`pnpm exec tsc --noEmit`, `pnpm run build`, `node tests/leafy-actions.mjs`, `node tests/leafy-core.mjs`, `node tests/livi-runtime.mjs`.

Den eksisterende generelle lint-kommando scanner også indlejrede tredjepartsbundles i `public/platform-scene` og har allerede fejl uden for dette arbejde. Kør scoped lint på ændrede kildefiler ved vedligeholdelse.

## Livekontrol 30. september 2026

- Udgivelse, offentlig adgang, D1, weblæsning og ALLOW/ASK/BLOCK er testet på det udgivne site.
- En ASK-godkendelse stoppede før udførelse, kunne ikke bruges af en anden besøgende og kunne kun udføres én gang.
- Corti afviste de eksisterende credentials med HTTP 400 i en minimal test uden Leafy-prompt eller tools. AI-svar, autonom AI-kørsel og AI-genererede SVG-filer kan derfor ikke erklæres fungerende endnu. Indsæt en gyldig Corti Models Service API Key i Corti-fanen; Gem og kontrollér tester nu et rigtigt modelsvar.
- JavaScript-browsermotoren er pakket og syntakskontrolleret, men ikke tilsluttet eller prøvet på en kørende browser. Den kræver et serverendpoint og en token.
- Korte serveropgaver er begrænset til 24 sekunder. En lokal model kræver et særskilt kørende endpoint.

## Remote + Corti, 5. oktober 2026
Starterpakken er integreret i den eksisterende app. Se `integration/README_REMOTE.md` for opsætning og præcise grænser. Chrome-udvidelsen kan hentes i Browser-fanen. Nye Drizzle-migrationer opretter de tre remote-tabeller; de gamle task-/approval-tabeller ændres ikke.

Verificeret lokalt: TypeScript, produktionsbuild, SQLite-parring/ejerskab/tokenhash/engangsclaim, pause og revokering, udløb, beskyttet observation samt taleafsendelse præcis én gang. De eksisterende tests for persona, SSE og mund-/talekø er også bestået. Chrome-udvidelsen er syntakskontrolleret, men endnu ikke installeret eller testet på Nickis PC. Mikrofon, hardwaretale og den fulde Corti-styrede Chrome-samtale er ikke live verificeret. De eksisterende Corti-credentials bevares; starterpakken leverer ingen ny gyldig nøgle.

## Samlet AI-interface, 5. oktober 2026

Leafys rum er indgangen. Logoet Leafy 0.1 og talebobler åbner præcis samme fuldskærmsarbejdsrum med Samtale, Dashboard, Opgaver, Filer og godkendelser, Browser og Indstillinger. 3D, kamera og den øvrige scene frigives, mens arbejdsrummet er åbent, og genoprettes ved retur. Sidebarens WL-mønt åbner/lukker navigationen. Mobil åbner samtalen med sidebar lukket. Standard chat med tekststreaming, stop, diktering der automatisk sender afsluttet tale, oplæsning, Markdown/kodevisning og eksisterende lokal historik.

Dokumenter, HTML og SVG genereres fra samtalen, ikke fra separate formularer eller arbejdsflader. Filer, konkrete godkendelser og korte serveropgaver er bevaret. Corti og Leafys portable profil/skills er samlet i Indstillinger. Brugeren kan styre relevante tilladelser der. Dobbelte dashboards, manuelle CSS-selector-felter og garderobe/orb/watch-genveje er fjernet fra hovednavigationen. Underliggende 3D-kode, eksport og integrationsfiler bevares.

Dashboardet læser rigtige model-/værktøjshændelser og browserstatus; terminalvisningen er en aktivitetslog, ikke en installeret OpenClaw eller en lokal shell. Ingen opdigtede proces-/RAM-tal. Modelstatus viser om en forbindelse er konfigureret, ikke om den sidst har bestået en live test.

Chrome-udvidelse 0.2 anmoder om alle offentlige HTTPS-sider i én Chrome-dialog ved parring. Den opretter Leafys fane automatisk, kræver ikke side- eller fanevalg og kan navigere til relevante nye websites gennem den eksisterende værktøjsmotor. Beskyttede flows og godkendelse af klik/indtastning bevares. Version 0.1 skal erstattes, genindlæses og parres igen; gamle sessioner pauses. Se integration/chrome-extension/README.md.

Tests: eksisterende persona, SSE/tale, action guard, SQLite-remote og stemmeafsendelse; ny Chrome-API-simulation i tests/leafy-extension.mjs og sikker React-rendering i tests/leafy-message.mjs. TypeScript og produktionsbuild er krav før udgivelse. Ingen live Chrome-/mikrofon-/Corti-test er påstået.
