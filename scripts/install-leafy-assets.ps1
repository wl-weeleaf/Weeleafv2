param(
  [string]$ZipPath = "$HOME\Downloads\leafy-grok-project (1).zip"
)

$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root "public\leafy"
$tmp = Join-Path $env:TEMP "leafy-grok-extract"

if (-not (Test-Path $ZipPath)) {
  Write-Host "Zip ikke fundet: $ZipPath"
  Write-Host "Ret stien, fx:"
  Write-Host "  .\scripts\install-leafy-assets.ps1 -ZipPath 'C:\Users\DIG\Downloads\leafy-grok-project (1).zip'"
  exit 1
}

New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Expand-Archive -Force -Path $ZipPath -DestinationPath $tmp

$src = Get-ChildItem -Path $tmp -Recurse -Directory -Filter leafy |
  Where-Object { Test-Path (Join-Path $_.FullName 'leafy.glb') } |
  Select-Object -First 1

if (-not $src) {
  Write-Host "public/leafy/leafy.glb blev ikke fundet i zip'en."
  exit 1
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Recurse -Force -Path (Join-Path $src.FullName '*') -Destination $dest
Write-Host "Kopieret Leafy-assets til $dest"
Get-Item (Join-Path $dest 'leafy.glb') | Format-List FullName, Length
