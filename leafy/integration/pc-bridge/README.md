# Leafy PC-forbindelse 0.1

Kør på din egen PC, ikke på Sites-serveren. Ingen indgående port eller tredjepartsapp er nødvendig. Node.js 22 eller nyere er påkrævet.

1. Pak ud. I Leafy: Terminal og PC → Opret parringskode.
2. **Windows:** Åbn mappen i Stifinder. Klik i adresselinjen, skriv `powershell`, og tryk Enter. Kør derefter `node .\\connect.mjs` i PowerShell-vinduet. Linux/macOS: `node connect.mjs` i terminalen.
3. Vælg mappen Leafy må arbejde i, og indsæt engangskoden. Standard er en ny workspace-mappe i pakken.
4. Lad terminalvinduet køre. Giv Leafy kommandoer i chatten. Godkendelser vises direkte der.
5. Ctrl+C lukker PC-programmet, men gemmer parringen. Start igen med `node connect.mjs` i samme mappe. **Afbryd** i appen ophæver adgangen permanent. En aktiv forbindelse fornyer sin adgang løbende; efter 30 dage uden forbindelse kræves en ny parring med `node connect.mjs --pair`.

Ved opdatering: Luk den gamle proces med Ctrl+C, og pak den nye ZIP ud i samme mappe. Bevar dine eksisterende `leafy-pc.json` og `.leafy-pc-session.json`. Ældre udgaver kan have slettet parringen ved lukning; i så fald skal den oprettes én gang igen. Parring tilhører den browser, hvor koden blev oprettet. Chrome og desktopwidget kan have forskellige browseridentiteter.

Windows blokerer nogle gange downloadede `.cmd`- og `.ps1`-startfiler. Derfor startes forbindelsen direkte med Node.js i PowerShell; der skal ikke køres en separat startfil eller ændres i PowerShells sikkerhedspolitik. Hvis `node` ikke genkendes, installér Node.js 22 eller nyere fra nodejs.org, luk PowerShell, åbn det igen i mappen, og prøv kommandoen igen.

Leafy kan liste/søge mapper, læse tekst, skrive dokumenter, oprette mapper, åbne dokumenter/mapper og registrerede programmer samt køre fem faste terminalkommandoer: node-version, python-version, git-status, git-diff, git-log. Til softwareprojekter kan Leafy også læse scripts fra projektets package.json, installere projektets dependencies og køre et navngivet build-, test- eller andet projektscript. Hver installering og scriptkørsel kræver en særskilt godkendelse i Leafy. Kørsel foregår i den valgte mappe, bruger højst to minutter og viser højst 10.000 tegn output. Der kan ikke sendes en fri shellkommando. Windows registrerer automatisk Notesblok og Lommeregner. PDF, Office og billeder uploades/analyseres via chatten; lokal læsning understøtter tekstfiler.

Tilføj eller fjern programmer fra Leafy-appen under **Indstillinger → PC-forbindelse → Åbn Terminal og PC → Tilladte programmer**. Brug programmets fulde lokale sti; argumenter er valgfrie og skrives ét pr. linje. Leafy PC kontrollerer, at stien findes, og gemmer ændringen lokalt i `leafy-pc.json`. Kun brugerfladen kan ændre listen; AI-værktøjet kan kun starte programmer, brugeren allerede har registreret. `shell:false` bruges til de faste kommandoer; projektscripts startes gennem projektets valgte package manager, kræver brugerens godkendelse og har en tidsgrænse. Der er ikke en fri shellkommando eller muse-/tastaturkontrol af Windows-apps.

Filadgang er begrænset til den valgte mappe, inklusive realpath-kontrol af symbolske links. Nøglefiler og forbindelsens credentials er undtaget. Nye filer kan ikke overskrive eksisterende; overskrivning kræver hash fra en aktuel læsning. Parringen giver vedvarende adgang til læsning, mapper, registrerede programmer og godkendt afvikling af projektets scripts. Leafy samler færdige filer i ét konkret godkendelseskort før implementering. Pause og BLOCK respekteres fortsat. Programmer åbnes på PC'en og deres vinduer vises ikke i webappen. Et program kører som din bruger; dette er ingen OS-sandbox. Vælg en særskilt Leafy-mappe til første test.

Enhedstoken gemmes kun i .leafy-pc-session.json og hashes på serveren. Del ikke den fil eller leafy-pc.json. Ingen Corti-nøgle sendes til PC'en. Udgående HTTPS-polling bruger samme ejerskab, kø, pause, udløb og engangsclaim som Chrome, med særskilt enhedstype.
