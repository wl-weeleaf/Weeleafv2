$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\services\leafy-tts')

function Find-Python {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'),
    'C:\Python311\python.exe'
  )
  foreach ($path in $candidates) {
    if (Test-Path $path) { return $path }
  }
  return $null
}

$python = Find-Python
if (-not $python) {
  Write-Host 'Python mangler. Koer foerst: winget install -e --id Python.Python.3.11'
  exit 1
}
if (-not (Test-Path .venv)) { & $python -m venv .venv }
$venv = Join-Path (Get-Location) '.venv\Scripts\python.exe'
& $venv -m pip install -r requirements.txt
New-Item -ItemType Directory -Force -Path models | Out-Null
$piper = 'models\da_DK-talesyntese-medium.onnx'
if (-not (Test-Path $piper)) {
  Invoke-WebRequest 'https://huggingface.co/rhasspy/piper-voices/resolve/main/da/da_DK/talesyntese/medium/da_DK-talesyntese-medium.onnx' -OutFile $piper
  Invoke-WebRequest 'https://huggingface.co/rhasspy/piper-voices/resolve/main/da/da_DK/talesyntese/medium/da_DK-talesyntese-medium.onnx.json' -OutFile ($piper + '.json')
}
$piperExe = 'models\piper\piper.exe'
if (-not (Test-Path $piperExe)) {
  $zip = 'models\piper.zip'
  Invoke-WebRequest 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip' -OutFile $zip
  Expand-Archive $zip -DestinationPath 'models' -Force
}
$env:PIPER_EXE = (Resolve-Path $piperExe)
$env:PIPER_DA_MODEL = (Resolve-Path $piper)
$env:KOKORO_MODEL = (Join-Path (Get-Location) 'models\kokoro-v1.0.onnx')
$env:KOKORO_VOICES = (Join-Path (Get-Location) 'models\voices-v1.0.bin')
& $venv -m uvicorn app:app --host 127.0.0.1 --port 8787
