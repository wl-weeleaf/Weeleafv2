# Leafy TTS

Kokoro kører her, adskilt fra Leafy Core.

```bash
docker compose up leafy-tts --build
curl http://localhost:8787/api/leafy/speak/health
curl -X POST http://localhost:8787/api/leafy/speak -H "content-type: application/json" -d "{\"text\":\"Hej, jeg er Leafy\",\"language\":\"da\",\"emotion\":\"curious\",\"speed\":0.96}" --output leafy.wav
```

Stemmen er et mix af Voice A og Voice B. Hvis modellen ikke svarer, sender endpointet 503, og siden viser kun tekst.
