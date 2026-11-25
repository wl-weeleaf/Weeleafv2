# Leafy · Browser 0.3

1. Åbn Leafy → eksisterende Leafy 0.1-logo eller en taleboble → Browser.
2. Hent og pak ZIP-filen ud på din PC. Åbn `chrome://extensions`, aktivér Udviklertilstand, vælg Indlæs udpakket og vælg mappen med manifest.json.
3. I appen: Opret parringskode. I udvidelsen: indsæt koden og tryk Forbind Leafys browser.
4. Bekræft én samlet adgang til `https://*/*`. Ingen fane- eller websitevælger. Leafy opretter selv en tom fane og kan navigere til offentlige HTTPS-sider på kommando.
5. Gå til Samtale og skriv fx “Find en offentlig side om dansk natur og åbn den i Chrome”. Leafy vælger URL gennem de faktiske remote_computer-værktøjer. Det kræver en fungerende model med værktøjskald.
6. Overtag kontrollen i Leafy eller i udvidelsen. Fortsæt først efter det beskyttede trin. Vis Leafys fane aktiverer fanen i Chrome. Lukning af fanen afbryder forbindelsen.

**Opgradering fra 0.1/0.2:** erstat filerne, genindlæs udvidelsen i Chrome, afbryd den tidligere forbindelse, og par igen. Gamle sessioner pauses automatisk, indtil de er forbundet med det nye forløb. Tilladelsen til alle websites gives samlet ved forbindelsen, ikke af AI'en.

Udvidelsen laver udgående HTTPS-kald; ingen åben PC-port eller særskilt server kræves. Enhedsadgang udløber efter 24 timer, parringskode efter 10 minutter og kan bruges én gang. Token ligger i Chromes session storage og hashes på serveren. Modelnøgler overføres aldrig til udvidelsen. Ny Leafy-browsersession kræver ny parring.

Samlet websiteadgang giver Leafy mulighed for at åbne nye sider i **sin egen fane**. Eksisterende private faner vælges eller aflæses ikke automatisk. Lokale adresser, fil-URL'er, Leafys eget website og Chromes interne sider er blokeret. Login, adgangskoder, MitID, betaling, CAPTCHA og sikkerhedskoder stopper både input og observation. Ukendte følsomme sider kan ikke garanteres genkendt: overtag før følsomme trin. Klik/indtastning kræver konkrete godkendelseskort; websitegodkendelse er en separat samlet tilladelse.

Browser-fanen i appen viser live JPEG-billeder fra den kontrollerede Chrome-fane ca. hvert andet sekund, mens den er åben. Browseren oprettes i baggrunden; almindelig navigation og Leafys betjening kan følges inde i appen. Det er en livevisning, ikke et iframe med krav om at siden tillader indlejring. Giv kommandoer i chatten eller brug browserens adresse- og navigationsknapper. Login og andre beskyttede trin foretages i Chrome efter overtagelse; der tages ingen nye billeder under overtagelsen. Visningen ligger privat i appens filopbevaring og vises kun til den parrede ejer under aktiv kontrol.

Cookiehåndtering er automatisk som standard. Strikte cookie-/samtykkebannere behandles med “Afvis alle” eller “Kun nødvendige”; valget og automatikken kan ændres i Indstillinger. Ukendte bannere overlades til almindelig betjening i stedet for at gætte på en knap. Serverens indstilling og beskyttede sider kontrolleres umiddelbart før klik. Cookieklik er den konkrete automatisering brugeren har valgt; øvrige klik og indtastning godkendes i chatten.

Ingen modelleveret vilkårlig JavaScript, clipboard, keylogging eller generel Windows GUI-kontrol. Fil-/programadgang findes i den separate, lokalt installerede PC-forbindelse under Terminal og PC.

Verificeret: syntaks og simulerede Chrome-API'er for automatisk faneoprettelse, tom-fane-aflæsning, navigation mellem websites, følsom overtagelse, privat-adresseblokering og revokering ved lukning. Cookie-opt-out, faktiske DOM-regler, simulerede CDP-cookieklik og livebilleder er også testet. En rigtig Chrome-installation og modelstyret samtale skal stadig afprøves på en PC.

Primære referencer: https://developer.chrome.com/docs/extensions/reference/api/permissions og https://developer.chrome.com/docs/extensions/reference/api/debugger.
