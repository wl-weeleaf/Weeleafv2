import io
import logging
import os
from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from speech_controller import SpeechController
from mixer import blend

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
log = logging.getLogger("leafy-tts")
app = FastAPI(title="Leafy TTS")
controller = SpeechController()
engine = None

class SpeakIn(BaseModel):
    text: str
    language: str | None = None
    emotion: str = "curious"
    speed: float = Field(0.96, ge=0.7, le=1.3)

def load_engine():
    global engine
    if engine is not None:
        return engine
    try:
        from kokoro_onnx import Kokoro
        model = os.getenv("KOKORO_MODEL", "/models/kokoro-v1.0.onnx")
        voices = os.getenv("KOKORO_VOICES", "/models/voices-v1.0.bin")
        engine = Kokoro(model, voices)
        log.info("kokoro ready")
    except Exception as err:
        log.warning("kokoro unavailable: %s", err)
        engine = False
    return engine

def synth(text, speed, blend_ratio):
    kokoro = load_engine()
    if not kokoro:
        raise RuntimeError("Kokoro er ikke klar")
    voice_a = os.getenv("LEAFY_VOICE_A", "af_sky")
    voice_b = os.getenv("LEAFY_VOICE_B", "am_adam")
    samples_a, rate = kokoro.create(text, voice=voice_a, speed=speed, lang="en-us")
    samples_b, _ = kokoro.create(text, voice=voice_b, speed=speed, lang="en-us")
    return blend(samples_a, samples_b, blend_ratio), rate

@app.get("/api/leafy/speak/health")
def health():
    ready = bool(load_engine())
    return {"ok": ready, "provider": "kokoro", "voices": [os.getenv("LEAFY_VOICE_A", "af_sky"), os.getenv("LEAFY_VOICE_B", "am_adam")]}

@app.get("/api/leafy/speak/test")
def test():
    return health()

@app.post("/api/leafy/speak")
def speak(body: SpeakIn):
    plan = controller.prepare(body.text, body.language, body.emotion, body.speed)
    if not plan["text"]:
        return JSONResponse({"error": "tom tekst"}, status_code=400)
    try:
        import numpy as np
        import soundfile as sf
        chunks = []
        rate = 24000
        for part in plan["parts"]:
            audio, rate = synth(part, plan["speed"], plan["blend"])
            pause = np.zeros(int(rate * plan["pause"]), dtype=np.float32)
            chunks.append(np.concatenate([audio, pause]))
        wav = io.BytesIO()
        sf.write(wav, np.concatenate(chunks), rate, format="WAV")
        wav.seek(0)
        def stream():
            while True:
                block = wav.read(8192)
                if not block:
                    break
                yield block
        log.info("speak lang=%s emotion=%s chars=%s", plan["language"], plan["emotion"], len(plan["text"]))
        return StreamingResponse(stream(), media_type="audio/wav")
    except Exception as err:
        log.exception("tts failed")
        return JSONResponse({"error": str(err), "fallback": "text"}, status_code=503)
