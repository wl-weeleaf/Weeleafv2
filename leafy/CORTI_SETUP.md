# Corti i Leafy

Leafy kan bruge **Corti Models** til strømmede chatsvar og, valgfrit, **Corti Speech to Text** til dansk diktering i realtid. Begge forbindelser går gennem de eksisterende samtalevisninger i rummet, garderoben og urvisningen. Corti leverer ikke Leafys oplæsning her; den bruger fortsat browserens stemme og tilnærmet mundsynkronisering.

## Tilslut Corti i appen

Åbn **Garderobe → Tal med Leafy → Corti** eller **Leafys rum → Indstillinger → Corti-forbindelse**. Indsæt din Corti Models Service API Key og vælg **Gem og kontrollér**. Appen kontrollerer nøglen hos Corti, før den gemmer den. Den krypteres med AES-GCM og opbevares i en `Secure`, `HttpOnly`, `SameSite=Strict` cookie i 30 dage. Nøglen kan ikke læses af sidens JavaScript og gemmes ikke i samtalehistorikken eller ZIP-filen. Opsætningen gælder den browser, hvor du tilføjer den.

Brug **Corti dansk diktering** til at tilføje client ID, client secret og tenant. Udfyld alle tre værdier; appen kontrollerer OAuth-adgangen hos Corti, før de gemmes. **Fjern Corti** sletter browserens krypterede cookie.

## Tabletadgang uden ChatGPT-login

Leafy kan udgives med en separat adgangskode til familiens tablet. Siden bruger så offentlig webadgang, men selve appen og dens chat-, status- og dikterings-API'er kræver en servervalideret gæstesession. Gæstesessionen ligger i en `HttpOnly`, `Secure`, `SameSite=Lax` cookie i 14 dage. Adgangskoden og signeringsnøglen skal ligge som serverhemmeligheder `LEAFY_GUEST_ACCESS_CODE` og `LEAFY_GUEST_SIGNING_SECRET`; de må ikke pakkes i kildekode eller ZIP.

En Corti Models-nøgle gemt i den indloggede ejers browser følger ikke med over på tabletten. For AI-svar på gæsteadgangen skal `CORTI_MODELS_API_KEY` derfor være sat som serverhemmelighed. Corti-diktering på gæsteadgangen kræver tilsvarende serverhemmelighederne `CORTI_STT_CLIENT_ID`, `CORTI_STT_CLIENT_SECRET` og `CORTI_TENANT_NAME`; ellers bruges browserens indbyggede diktering. Uden servernøglen virker Leafys 3D-visning, bevægelser og browserstemme, men chatten kan ikke kalde AI-modellen.

## Corti Models (chat)

Opret en API-klient i Corti Console og vælg **Copy as → Corti Models Service API Key**. Indsæt nøglen i appens Corti-boks. Hostingmiljøet kan stadig bruge en servernøgle som alternativ:

```text
CORTI_MODELS_API_KEY=<din Corti Models Service API Key>
CORTI_REGION=eu
CORTI_MODEL=corti-s1-mini-instant
```

`eu` er standardregion. Den hurtige mini-model er standard, hvis `CORTI_MODEL` udelades. Leafy sender samtalen til `https://ai.eu.corti.app/v1/chat/completions` som en strøm. Appens eksisterende `LIVI_API_KEY` og `LIVI_API_BASE_URL` har forrang, hvis du har sat dem; fjern dem, når Corti skal være aktiv. `OPENAI_API_KEY` bruges kun, når ingen Corti-nøgle eller eksplicit LIVI-forbindelse er sat.

## 2. Corti Speech to Text (valgfrit)

Til mikrofonknappen skal Corti-klienten også have Speech to Text-adgang. Indtast klientoplysningerne i den valgfri dikteringssektion i Corti-boksen. De kan fortsat konfigureres som serverhemmeligheder:

```text
CORTI_STT_CLIENT_ID=<client id>
CORTI_STT_CLIENT_SECRET=<client secret>
CORTI_TENANT_NAME=<tenant name>
```

Leafys server veksler klientoplysningerne til en kortlivet OAuth-token, når den indloggede bruger trykker mikrofonknappen. Browseren forbinder derefter direkte til Cortis `/transcribe` WebSocket med dansk (`da`), viser foreløbig tekst og samler de endelige tekststykker. Lyd sendes til Corti, kun mens mikrofonen er aktiv. Et stop sender sidste lydpakke og afslutter sessionen. Hvis disse tre værdier mangler, bruger knappen fortsat browserens indbyggede diktering.

Den kortlivede token sendes til den indloggede browser for at etablere WebSocket. Brug derfor den eksisterende private adgang til appen, og giv ikke en bredere Corti-klient flere rettigheder end nødvendigt. Værdierne må ikke skrives i kildekoden eller den offentlige ZIP.

## Kontrol

`/api/livi/status` viser `provider: "corti"`, når Models-nøglen er sat, og `dictationProvider: "corti"`, når taleadgangen er sat. Prøv derefter en kort tekstbesked og en dikteret sætning på dansk. Browserstemmen er en separat lydudgang.

Den krypterede browseropsætning kræver, at sitets runtime har hemmeligheden `LEAFY_CREDENTIALS_ENCRYPTION_KEY` (64 hextegn). Den er sat i dette Site og skal ikke indtastes af brugeren. Hvis den mangler i en anden installation, opret en tilfældig 32-byte nøgle og tilføj den som en serverhemmelighed før brug. Browserstemmen er en separat lydudgang.


## Corti CLI til kodearbejde (EU)

Cortis officielle kommando `npx @corti/cli models init --region eu` forbinder en **lokal kodeagent** med Corti. Den bygger ikke selv en app og kører ikke inde i Leafys browser. Installér eksempelvis OpenCode og Node.js 22 eller nyere på din PC.

### Byg software fra Leafys chat

Den almindelige kodearbejdsgang kræver ikke OpenCode: par Leafys PC-forbindelse, vælg projektmappen, og bed Leafy gennemgå, bygge eller rette projektet. Leafy bruger den Corti-model, der allerede er tilsluttet chatten, mens filerne og build-/test-scripts kører lokalt i den valgte mappe. Leafy læser først projektets `package.json`, foreslår en samlet filændring og viser en godkendelse før den skriver. Dependency-installering og hvert navngivne projekt-script kræver hver sin godkendelse. Resultatet og fejl vises i samtalen.

Kørsel er begrænset til scripts, der står i projektets `package.json`, og afbrydes efter to minutter. Den lokale forbindelse er ikke en operativsystem-sandbox; vælg en mappe, du har tillid til, og gennemgå godkendelsen før installering eller scriptkørsel. OpenCode via Corti CLI er en separat, valgfri arbejdsgang.

Leafy-projektet indeholder en projektlokal variant:

```bash
npm run corti:init
# Svarer til:
npx @corti/cli models init --region eu --scope project --tools opencode --no-shell-rc
```

Guiden logger ind hos Corti, kontrollerer `/models`, lader dig vælge en model og skriver OpenCodes provider-opsætning samt et lokalt `.env`-afsnit. Godkend ændringerne i guiden. Start derefter `opencode` i projektmappen. Kommandoen ændrer ikke dine globale shell-indstillinger. Leafys Terminal-fane har samme kommando med en kopiknap.

**Samme forbindelse i Leafy:** Webappens server accepterer nu både CLI-navnene `CORTI_BEARER`, `CORTI_BASE_URL`, `CORTI_MODEL`, `CORTI_ENVIRONMENT`, `CORTI_CLIENT_ID`, `CORTI_CLIENT_SECRET`, `CORTI_TENANT` og de tidligere Leafy-navne. `CORTI_REGION` har forrang over `CORTI_ENVIRONMENT`; eksisterende `CORTI_STT_CLIENT_*` og `CORTI_TENANT_NAME` har forrang over deres CLI-aliaser. Tenant er `base`, hvis den ikke er angivet. En Models-nøgle alene giver ikke Corti talegenkendelse; STT kræver klientoplysninger og adgang hos Corti.

Kopiér `corti.env.example` til `.env` ved manuel lokal opsætning. Next/Vinext læser projektets `.env`; genstart udviklingsserveren efter ændringer. For den udgivne app skal værdierne sættes som **servermiljøvariabler** i hostingmiljøet og en version genudrulles. En lokal CLI-opsætning bliver ikke automatisk overført. Alternativt kan du indsætte selve `CORTI_BEARER`-værdien i appens Corti Models-nøglefelt; indsæt ikke hele `.env`-blokken.

EU-endpoint: `https://ai.eu.corti.app/v1`. Leafys nuværende standard `corti-s1-mini-instant` bevares. Til mere krævende kodearbejde kan du vælge `corti-s1` i kodeagenten, hvis `/models` giver adgang til den. Secrets gemmes aldrig i frontend, samtalehistorik eller ZIP. Udviklingsopsætningen giver ikke Leafys PC-forbindelse en fri shell; chatgodkendelser og de eksisterende terminalhandlinger er stadig gældende.

Officiel guide: https://docs.corti.ai/models/ai-coding-agent
API-forbindelse: https://docs.corti.ai/models/quickstart
