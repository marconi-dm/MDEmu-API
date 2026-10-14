# Executar a partir da raiz do repositório MDEmu-API:
#   powershell -ExecutionPolicy Bypass -File .\scripts\baixar-motor-snes2005.ps1
$ErrorActionPreference = 'Stop'
$project = Resolve-Path (Join-Path $PSScriptRoot '..')
$dest = Join-Path $project 'public\lab-snes2005'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$base='https://raw.githubusercontent.com/HenryLF/snes9x2005-wasm/main'
$targets=@(
  @{Uri="$base/dist/index.js"; Output=(Join-Path $dest 'snes2005.js')},
  @{Uri="$base/snes9x2005/snes9x_2005.wasm"; Output=(Join-Path $dest 'snes9x_2005.wasm')}
)
foreach ($t in $targets) {
  Write-Host "Baixando $($t.Uri)" -ForegroundColor Cyan
  Invoke-WebRequest -Uri $t.Uri -OutFile $t.Output -UseBasicParsing
  $size=(Get-Item $t.Output).Length
  if ($size -lt 4096) {throw "Arquivo muito pequeno, possivel erro no download: $($t.Output) ($size bytes)"}
  Write-Host "OK: $($t.Output) ($size bytes)" -ForegroundColor Green
}
$bin=[IO.File]::ReadAllBytes((Join-Path $dest 'snes9x_2005.wasm'))
if ($bin.Length -lt 4 -or $bin[0] -ne 0 -or $bin[1] -ne 97 -or $bin[2] -ne 115 -or $bin[3] -ne 109) {
 throw 'Arquivo wasm invalido: assinatura WebAssembly ausente.'
}
Write-Host 'Arquivos do motor verificados. Agora publique public/ na Vercel.' -ForegroundColor Green
