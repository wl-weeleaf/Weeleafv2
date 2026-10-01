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
        if not model or not os.path.exists(model):
            raise RuntimeError('Dansk stemmemodel mangler')
        folder = os.path.dirname(exe)
        data = os.path.join(folder, 'espeak-ng-data')
        text_file = tempfile.NamedTemporaryFile(suffix='.txt', delete=False)
        out = text_file.name + '.wav'
        text_file.write(text.encode('utf-8'))
        text_file.close()
        try:
            with open(text_file.name, 'rb') as handle:
                run = subprocess.run(
                    [exe, '--model', model, '--output_file', out, '--espeak_data', data, '--debug'],
                    stdin=handle,
                    cwd=folder,
                    capture_output=True,
                )
            if run.returncode != 0 or not os.path.exists(out) or os.path.getsize(out) < 100:
                detail = (run.stderr or run.stdout or b'ingen lyd').decode('utf-8', 'ignore')[-500:]
                raise RuntimeError(detail)
            with wave.open(out, 'rb') as wav:
                rate = wav.getframerate()
                samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).astype(np.float32) / 32768
            return samples, rate
        finally:
            for path in (text_file.name, out):
                if os.path.exists(path):
                    os.remove(path)

    def synthesize(self, text, language, speed, blend):
        return self.danish(text, speed)
