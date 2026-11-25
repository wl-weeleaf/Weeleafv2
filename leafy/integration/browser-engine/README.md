# Leafy 0.1 browsermotor

Dette er den faktiske Playwright/Chromium-motor til Leafys eksisterende webapp. Den kan åbne JavaScript-sider, læse dem, klikke og udfylde felter. Samme session bevares i op til 20 minutters inaktivitet. Hver besøgende har sin egen browserkontekst.

1. På en Linux-server med Docker: generér en hemmelig token med `openssl rand -hex 32`, og gem den i miljøvariablen `LEAFY_BROWSER_TOKEN`.
2. Kør `docker compose up -d --build` i denne mappe.
3. Eksponér port 8788 gennem en HTTPS reverse proxy eller en eksisterende tunnel. Porten er som standard kun åben på localhost. Send aldrig token til browserklienten eller Git.
4. På Leafy-sitet sættes servervariablerne `LEAFY_BROWSER_URL` til denne HTTPS-adresse og `LEAFY_BROWSER_TOKEN` til samme token. Udgiv den gemte siteversion igen efter ændringen.
5. Browserfanen viser nu “Browsermotor tilsluttet”. Test navigation først, dernæst et eksplicit godkendt klik og en eksplicit godkendt indtastning.

Filerne konfigurerer ikke hosting eller DNS automatisk. Sitet kan læse offentlig webtekst uden denne motor. Klik og indtastning vises som godkendelseskort før udførelse. Køb, sletning og publicering bør fortsat holdes på BLOCK/ASK. CAPTCHA og tjenester, der blokerer automatisering, kræver særskilt håndtering; motoren forsøger ikke at omgå dem.

Motoren har ingen adgang til din personlige browser eller dens eksisterende login. Sessioner og login i motoren forsvinder ved genstart. Maksimalt otte samtidige sessioner.
