# Leafy Remote + Corti Starterpakke

Denne pakke samler den foreslåede arkitektur for Leafy 3D med:

- Corti som primær reasoning-/LLM-motor
- Leafy som standard observer af sin egen platform
- Browser- og UI-navigation
- Fjernadgang til brugerens PC
- Human takeover ved MitID, betaling, CAPTCHA, 2FA m.m.
- Tool discovery
- Activity log
- Modulær vej fra Leafy-platform -> browser -> remote PC -> desktop apps

## Grundprincip

Leafy skal ikke kun kunne tale om den digitale verden.

Leafy skal kunne:
1. se sit aktuelle digitale miljø,
2. forstå hvad der er på skærmen/siden,
3. beslutte næste handling,
4. udføre handlingen,
5. observere resultatet,
6. fortsætte,
7. stoppe og bede brugeren overtage ved menneskekrævende handlinger.

Standardflow:

USER GOAL
→ OBSERVE
→ UNDERSTAND
→ PLAN
→ ACT
→ OBSERVE RESULT
→ VALIDATE
→ CONTINUE
→ HUMAN TAKEOVER IF REQUIRED

## Første testmål

1. Leafy svarer via Corti.
2. Leafy modtager state fra den aktuelle side.
3. Leafy kan returnere et tool call.
4. Leafy kan navigere egen platform.
5. Leafy kan åbne/styre Chrome via en lokal bridge.
6. Leafy kan bruge eksterne webapps uden særskilt API-integration.
7. Leafy stopper korrekt ved MitID/betaling.
