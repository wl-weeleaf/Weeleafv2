$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\services\leafy-tts')
if (-not (Test-Path .venv)) { python -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
New-Item -ItemType Directory -Force -Path models | Out-Null
$piper = 'models\da_DK-talesyntese-medium.onnx'
if (-not (Test-Path $piper)) {
  Invoke-WebRequest 'https://huggingface.co/rhasspy/piper-voices/resolve/main/da/da_DK/talesyntese/medium/da_DK-talesyntese-medium.onnx' -OutFile $piper
  Invoke-WebRequest 'https://huggingface.co/rhasspy/piper-voices/resolve/main/da/da_DK/talesyntese/medium/da_DK-talesyntese-medium.onnx.json' -OutFile ($piper + '.json')
}
$env:PIPER_DA_MODEL = (Resolve-Path $piper)
$env:KOKORO_MODEL = (Join-Path (Get-Location) 'models\kokoro-v1.0.onnx')
$env:KOKORO_VOICES = (Join-Path (Get-Location) 'models\voices-v1.0.bin')
& .\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8787
