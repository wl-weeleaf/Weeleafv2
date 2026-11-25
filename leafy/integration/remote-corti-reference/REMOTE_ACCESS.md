# Remote access – første test på egen PC

## Anbefalet retning

### Browser
Brug:
- Chrome extension
- chrome.debugger
- Chrome DevTools Protocol
- Chrome Native Messaging

Dette giver Leafy mulighed for at arbejde med:
- DOM
- accessibility tree
- tabs
- navigation
- screenshots
- keyboard/mouse input

### Windows
Brug:
- Microsoft UI Automation
- screenshot fallback
- mouse/keyboard fallback

### Lokal komponent
Installer en lille lokal Leafy Bridge på Windows.

Forslag:

```text
Leafy platform
      │
      ▼
Chrome Extension
      │
Native Messaging
      │
      ▼
Leafy Bridge
      │
      ├── Chrome/CDP
      ├── Windows UI Automation
      ├── File access (begrænset)
      └── App control
```

## Første test

1. Åbn Leafy.
2. Start lokal Leafy Bridge.
3. Leafy opdager Chrome.
4. Brugeren siger: "Åbn ChatGPT."
5. Leafy åbner ny fane.
6. Leafy aflæser siden.
7. Leafy finder prompt-felt.
8. Leafy skriver en testbesked.
9. Leafy sender.
10. Leafy læser svaret.
11. Leafy returnerer resultat til brugeren.

Ingen særskilt OpenAI API-integration er nødvendig for denne test.

## Senere remote netværksadgang

En privat overlay-forbindelse som Tailscale kan bruges til at nå Leafy Bridge fra andre enheder uden at eksponere bridge-porten offentligt.

## Human takeover

Ved:
- MitID
- betaling
- 2FA
- CAPTCHA
- password
- bank
- biometrisk login

skal Bridge skifte til PROTECTED_HUMAN_CONTROL.

I denne state skal følgende være OFF:
- LLM screen stream
- DOM stream fra beskyttet område
- keyboard capture
- clipboard capture
- agent input

Brugeren trykker selv "Fortsæt Leafy" bagefter.
