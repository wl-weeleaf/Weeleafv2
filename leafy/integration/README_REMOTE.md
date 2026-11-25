# Integreret Leafy Remote + Corti

Starterpakken er bevaret i remote-corti-reference/. Dens eksempelkode er reference, ikke en ny alternativ app.

## Implementeret
- Fælles Corti-værktøjsloop med observe_environment, navigate, click_element, type_element, remote_computer og human_takeover.
- Leafy ser overskrifter og aktuelle synlige UI-elementer på sin egen platform. Feltværdier, samtalen, Corti-opsætning, godkendelser og fjernadgangens nøgler er undtaget.
- Aktuelle element-ID'er, genobservation efter handling og label-validering før et godkendt klik/indtastning.
- D1-mailbox med ejerskab, engangsparring, tokenhash, udløb, claim og beskyttet overtagelse.
- Chrome MV3-udvidelse med scripting i isoleret world og CDP-input. Leafys egen automatisk oprettede fane; én samlet brugerbevilling til alle offentlige HTTPS-sider.
- Browser-fane til parring, forbindelsesstatus, aktuel aflæsning og overtagelse. Navigation og relevant websitevalg udføres fra samtalen.
- ALLOW/ASK/BLOCK og konkrete godkendelseskort. Klik og indtastning kan aldrig blive skjult ALLOW. Destruktive Chrome-knapper afvises af udvidelsen.
- Leafy 0.1 flyttet til eksisterende logo; topbaren er skjult under arbejdsfladen.
- Mikrofonen sender automatisk ved afsluttet tale; Corti stoppes efter 1,8 sekunders lydpause efter registreret tale (Web Audio RMS), hvorefter det endelige transcript bruges. Hvis Web Audio ikke kan starte, bruges kun en afsluttet Corti-segmentmarkør som fallback, aldrig manglende interim-transcripts. Browsergenkendelse sender ved onend. Fejl, global Stop og afbrudte sessioner sender ikke.

## Opsætning
Brug Browser-fanens vejledning eller chrome-extension/README.md. Ingen åben indgående PC-port eller separat bridge-server er nødvendig for Chrome-testen. Windows/Native Messaging kræver en senere lokal komponent.

Corti er fortsat server-side. Eksisterende krypterede browsercredentials og servervariabler bevares. Starterpakkens CORTI_BEARER og CORTI_BASE_URL understøttes som servervariabler, sammen med CORTI_MODEL. Ingen nøgle sendes til udvidelsen. Dokumentation: https://docs.corti.ai/models/quickstart og https://docs.corti.ai/quickstart/ai-coding-tools.

## Præcise grænser
- Ikke installeret automatisk på brugerens Windows-PC. Installation og Chrome-tilladelse kræver brugeren.
- Ingen desktop UI Automation, filer, screenshots, keylogging, clipboard eller iframe/canvas-kontrol.
- Beskyttede sider giver ingen perception og ingen nye handlinger; brugerens overtagelse rydder serverens snapshot og annullerer køen. Et allerede udført klik kan ikke fortrydes ved efterfølgende pause.
- Konservativ detektion af kendte følsomme flows kan ikke garantere genkendelse af enhver ukendt side. Brug overtagelsesknappen før følsomme trin.
- Pausede/opgaver med udløbet kommando fortsætter ikke automatisk. Observer og godkend på ny.
- Cortex/Corti Models skal acceptere gyldige credentials før AI-planlægning kan testes. Manuel parring, observation og godkendte handlinger kræver ikke LLM.
- Tale skal testes på den faktiske mikrofon/browser; ingen live stemme eller PC-kontrol er påstået testet alene ud fra build.

Det samlede AI-dashboard er fælles for samtale og Leafy 0.1. Terminalvisningen viser de eksisterende agenthændelser. En lokal terminal/shell, OpenClaw-service og Windows UI Automation er ikke tilkoblet. Den lokale Chrome-simulation tester browserforløbet uden et live modelkald; se tests/leafy-extension.mjs.
