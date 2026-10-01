import os
import numpy as np

class MultiVoice:
    def __init__(self):
        self.kokoro = None
        self.piper = None

    def danish(self, text, speed):
        if self.piper is None:
            try:
                from piper import PiperVoice
                path = os.getenv('PIPER_DA_MODEL', '/models/da_DK-talesyntese-medium.onnx')
                self.piper = PiperVoice.load(path)
            except Exception as err:
                self.piper = False
                raise RuntimeError(f'Dansk Piper-model mangler: {err}') from err
        if not self.piper:
            raise RuntimeError('Dansk model er ikke klar')
        audio = b''.join(self.piper.synthesize_stream_raw(text))
        samples = np.frombuffer(audio, dtype=np.int16).astype(np.float32) / 32768
        shifted = np.interp(np.arange(0, len(samples), 1.04), np.arange(len(samples)), samples)
        mixed = samples[:len(shifted)] * 0.62 + shifted * 0.38
        return mixed.astype(np.float32), self.piper.config.sample_rate

    def english(self, text, speed, blend):
        if self.kokoro is None:
            from kokoro_onnx import Kokoro
            self.kokoro = Kokoro(os.getenv('KOKORO_MODEL', '/models/kokoro-v1.0.onnx'), os.getenv('KOKORO_VOICES', '/models/voices-v1.0.bin'))
        a, rate = self.kokoro.create(text, voice=os.getenv('LEAFY_VOICE_A', 'af_sky'), speed=speed, lang='en-us')
        b, _ = self.kokoro.create(text, voice=os.getenv('LEAFY_VOICE_B', 'am_adam'), speed=speed, lang='en-us')
        n = min(len(a), len(b))
        return (a[:n] * (1 - blend) + b[:n] * blend).astype(np.float32), rate

    def synthesize(self, text, language, speed, blend):
        if language == 'da':
            return self.danish(text, speed)
        return self.english(text, speed, blend)
