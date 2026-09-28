param(
  [string]$ZipPath = "$HOME\Downloads\leafy-grok-project (1).zip"
)

$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root "public\leafy"
$tmp = Join-Path $env:TEMP "leafy-grok-extract"

if (-not (Test-Path -LiteralPath $ZipPath)) {
  Write-Host "Zip ikke fundet: $ZipPath"
  exit 1
}

New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Expand-Archive -Force -LiteralPath $ZipPath -DestinationPath $tmp

$src = Get-ChildItem -Path $tmp -Recurse -Directory |
  Where-Object {
    $_.Name -eq 'leafy' -and (
      (Test-Path -LiteralPath (Join-Path $_.FullName 'leafy.glb')) -or
      (Test-Path -LiteralPath (Join-Path $_.FullName 'npc-base.png'))
    )
  } |
  Select-Object -First 1

if (-not $src) {
  Write-Host "public/leafy blev ikke fundet i zip'en."
  exit 1
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Recurse -Force -Path (Join-Path $src.FullName '*') -Destination $dest

$ref = Get-ChildItem -Path $tmp -Recurse -Filter reference-geometry.json | Select-Object -First 1
if ($ref) {
  Copy-Item -Force -LiteralPath $ref.FullName (Join-Path $dest 'reference-geometry.json')
}

Write-Host "Kopieret Leafy-assets til $dest"
Get-ChildItem $dest | Select-Object Name, Length
