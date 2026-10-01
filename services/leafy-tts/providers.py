import os
import subprocess
import tempfile
import wave
import numpy as np

class MultiVoice:
    def __init__(self):
        self.kokoro = None

    def danish(self, text, speed):
        exe = os.getenv('PIPER_EXE', 'piper')
        model = os.getenv('PIPER_DA_MODEL', 'models/da_DK-talesyntese-medium.onnx')
        if not os.path.exists(exe):
            raise RuntimeError('Piper mangler. Koer start-scriptet igen.')
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as handle:
            out = handle.name
        try:
            subprocess.run([exe, '--model', model, '--output_file', out, '--length_scale', str(round(1 / max(speed, 0.7), 2))], input=text.encode('utf-8'), check=True)
            with wave.open(out, 'rb') as wav:
                rate = wav.getframerate()
                samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).astype(np.float32) / 32768
            shifted = np.interp(np.arange(0, len(samples), 1.04), np.arange(len(samples)), samples)
            mixed = samples[:len(shifted)] * 0.62 + shifted * 0.38
            return mixed.astype(np.float32), rate
        finally:
            if os.path.exists(out):
                os.remove(out)

    def english(self, text, speed, blend):
        if self.kokoro is None:
            from kokoro_onnx import Kokoro
            self.kokoro = Kokoro(os.getenv('KOKORO_MODEL', 'models/kokoro-v1.0.onnx'), os.getenv('KOKORO_VOICES', 'models/voices-v1.0.bin'))
        a, rate = self.kokoro.create(text, voice=os.getenv('LEAFY_VOICE_A', 'af_sky'), speed=speed, lang='en-us')
        b, _ = self.kokoro.create(text, voice=os.getenv('LEAFY_VOICE_B', 'am_adam'), speed=speed, lang='en-us')
        n = min(len(a), len(b))
        return (a[:n] * (1 - blend) + b[:n] * blend).astype(np.float32), rate

    def synthesize(self, text, language, speed, blend):
        if language == 'da':
            return self.danish(text, speed)
        return self.english(text, speed, blend)
