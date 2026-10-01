import os
import subprocess
import tempfile
import wave
import numpy as np

class MultiVoice:
    def danish(self, text, speed):
        exe = os.getenv('PIPER_EXE', '')
        model = os.getenv('PIPER_DA_MODEL', '')
        if not exe or not os.path.exists(exe):
            raise RuntimeError('Piper-programmet blev ikke fundet')
        if not model or not os.path.exists(model) or os.path.getsize(model) < 1000000:
            raise RuntimeError('Dansk stemmemodel mangler eller er for lille')
        fd, out = tempfile.mkstemp(suffix='.wav')
        os.close(fd)
        try:
            run = subprocess.run(
                [exe, '--model', model, '--output_file', out],
                input=text.encode('utf-8'),
                cwd=os.path.dirname(exe),
                capture_output=True,
            )
            if run.returncode != 0 or not os.path.exists(out) or os.path.getsize(out) < 100:
                detail = (run.stderr or run.stdout or b'').decode('utf-8', 'ignore')[-400:]
                raise RuntimeError(detail or 'Piper lavede ingen lyd')
            with wave.open(out, 'rb') as wav:
                rate = wav.getframerate()
                samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).astype(np.float32) / 32768
            return samples, rate
        finally:
            if os.path.exists(out):
                os.remove(out)

    def synthesize(self, text, language, speed, blend):
        return self.danish(text, speed)
