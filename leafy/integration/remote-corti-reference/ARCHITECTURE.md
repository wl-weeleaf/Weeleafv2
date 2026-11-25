# Arkitektur

## Overblik

```text
                LEAFY 3D
        persona + animation + voice
                   │
                   ▼
              Leafy Runtime
                   │
          ┌────────┴────────┐
          │                 │
          ▼                 ▼
      CORTI S1          ENVIRONMENT
   reasoning / LLM      page / browser
                         remote PC
          │                 │
          └────────┬────────┘
                   ▼
               TOOL LOOP
                   │
        observe → reason → act
             ↑             │
             └─────────────┘
                   │
          HUMAN TAKEOVER
           when required
```

## Lag

### 1. Leafy 3D
Ansvar:
- visuel karakter
- tale
- animation
- brugerinput
- visning af agentstatus

Forslag til states:
- idle
- listening
- thinking
- observing
- acting
- speaking
- waiting_for_human
- error

### 2. Leafy Runtime
Ansvar:
- persona
- memory
- context
- current environment
- tool registry
- planning loop
- action validation
- activity log
- human handoff

### 3. Corti
Corti bruges som Leafys primære reasoning-/LLM-lag.

Leafy behøver ikke særskilte API-integrationer til alle eksterne apps.
Eksterne AI-værktøjer og webapps kan bruges gennem deres UI via Leafys browser-/computer-control.

### 4. Perception
Prioritet:
1. DOM / accessibility tree
2. struktureret UI state
3. visuel forståelse / screenshot
4. koordinatbaseret fallback

### 5. Remote Computer Layer
```text
Leafy App
→ Leafy Core
→ Remote Session Manager
→ Remote Computer Agent
→ Browser / Windows / Apps
```

### 6. Human Takeover
States:
- AGENT_CONTROL
- HUMAN_CONTROL
- PROTECTED_HUMAN_CONTROL
- PAUSED
- DISCONNECTED

Ved PROTECTED_HUMAN_CONTROL:
- agent actions OFF
- screen capture til LLM OFF
- DOM/UI-data OFF for beskyttet område
- keyboard observation OFF
- clipboard observation OFF

Brugeren udfører selv:
- MitID
- betaling
- bankgodkendelse
- 2FA
- CAPTCHA
- biometrisk login
- andre human-only flows
