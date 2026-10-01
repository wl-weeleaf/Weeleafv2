import re

EMOTION = {
    "curious": {"speed": 0.96, "pause": 0.18, "blend": 0.5},
    "warm": {"speed": 0.92, "pause": 0.22, "blend": 0.46},
    "playful": {"speed": 1.04, "pause": 0.12, "blend": 0.54},
    "calm": {"speed": 0.88, "pause": 0.26, "blend": 0.48},
}

class SpeechController:
    def prepare(self, text, language=None, emotion="curious", speed=0.96):
        clean = re.sub(r"\s+", " ", text or "").strip()
        lang = language or self.detect(clean)
        profile = EMOTION.get(emotion, EMOTION["curious"])
        parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", clean) if p.strip()]
        return {
            "text": clean,
            "parts": parts or [clean],
            "language": lang,
            "emotion": emotion if emotion in EMOTION else "curious",
            "speed": float(speed or profile["speed"]),
            "pause": profile["pause"],
            "blend": profile["blend"],
        }

    def detect(self, text):
        if re.search(r"[\u00e6\u00f8\u00e5\u00c6\u00d8\u00c5]", text):
            return "da"
        if re.search(r"\b(og|jeg|det|ikke|hej)\b", text.lower()):
            return "da"
        return "en"
