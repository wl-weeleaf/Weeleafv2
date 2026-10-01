import io
import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from speech_controller import SpeechController
from providers import MultiVoice

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
log = logging.getLogger("leafy-tts")
app = FastAPI(title="Leafy TTS")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], expose_headers=["x-leafy-language"])
controller = SpeechController()
voices = MultiVoice()

class SpeakIn(BaseModel):
    text: str
    language: str | None = "da"
    emotion: str = "curious"
    speed: float = Field(0.96, ge=0.7, le=1.3)

@app.get("/api/leafy/speak/health")
def health():
    return {"ok": True, "defaultLanguage": "da", "piper": os.getenv("PIPER_EXE"), "model": os.getenv("PIPER_DA_MODEL")}

@app.post("/api/leafy/speak")
def speak(body: SpeakIn):
    plan = controller.prepare(body.text, body.language or "da", body.emotion, body.speed)
    plan["language"] = body.language or "da"
    if not plan["text"]:
        return JSONResponse({"error": "tom tekst"}, status_code=400)
    try:
        import numpy as np
        import soundfile as sf
        chunks = []
        rate = 22050
        for part in plan["parts"]:
            audio, rate = voices.synthesize(part, plan["language"], plan["speed"], plan["blend"])
            pause = np.zeros(int(rate * plan["pause"]), dtype=np.float32)
            chunks.append(np.concatenate([audio, pause]))
        wav = io.BytesIO()
        sf.write(wav, np.concatenate(chunks), rate, format="WAV")
        raw = wav.getvalue()
        log.info("speak lang=%s bytes=%s", plan["language"], len(raw))
        return StreamingResponse(iter([raw]), media_type="audio/wav", headers={"x-leafy-language": plan["language"]})
    except Exception as err:
        log.exception("tts failed")
        return JSONResponse({"error": str(err), "fallback": "text"}, status_code=503)
