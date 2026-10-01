$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\services\leafy-tts')
$python = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'
if (-not (Test-Path $python)) { Write-Host 'Python 3.11 mangler'; exit 1 }
if (-not (Test-Path .venv)) { & $python -m venv .venv }
$venv = Join-Path (Get-Location) '.venv\Scripts\python.exe'
& $venv -m pip install -r requirements.txt
New-Item -ItemType Directory -Force -Path models | Out-Null
$piper = Join-Path (Get-Location) 'models\da_DK-talesyntese-medium.onnx'
if (-not (Test-Path $piper) -or (Get-Item $piper).Length -lt 1000000) {
  Invoke-WebRequest 'https://huggingface.co/rhasspy/piper-voices/resolve/main/da/da_DK/talesyntese/medium/da_DK-talesyntese-medium.onnx' -OutFile $piper
  Invoke-WebRequest 'https://huggingface.co/rhasspy/piper-voices/resolve/main/da/da_DK/talesyntese/medium/da_DK-talesyntese-medium.onnx.json' -OutFile ($piper + '.json')
}
$piperExe = Get-ChildItem -Path models -Filter piper.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $piperExe) {
  $zip = 'models\piper.zip'
  Invoke-WebRequest 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip' -OutFile $zip
  Expand-Archive $zip -DestinationPath 'models' -Force
  $piperExe = Get-ChildItem -Path models -Filter piper.exe -Recurse | Select-Object -First 1
}
if (-not $piperExe) { Write-Host 'piper.exe blev ikke fundet'; exit 1 }
$env:PIPER_EXE = $piperExe.FullName
$env:PIPER_DA_MODEL = $piper
Write-Host "Piper: $($piperExe.FullName)"
& $venv -m uvicorn app:app --host 127.0.0.1 --port 8787
