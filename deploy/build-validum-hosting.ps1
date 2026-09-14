param(
  [string]$EnvironmentFile = "apps/validum/.env.production",
  [string]$OutputDirectory = "output/validum-hosting"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$environmentPath = Join-Path $repositoryRoot $EnvironmentFile
$outputPath = Join-Path $repositoryRoot $OutputDirectory
$distPath = Join-Path $repositoryRoot "apps/validum/dist"
$archivePath = "$outputPath.zip"

if (-not (Test-Path -LiteralPath $environmentPath)) {
  throw "Falta $EnvironmentFile. Copie apps/validum/.env.production.example y agregue la URL pública del API."
}

$configuration = @{}
Get-Content -LiteralPath $environmentPath | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
    $parts = $line.Split("=", 2)
    $configuration[$parts[0].Trim()] = $parts[1].Trim()
  }
}

foreach ($requiredName in @("VITE_API_URL")) {
  if (-not $configuration.ContainsKey($requiredName) -or
      [string]::IsNullOrWhiteSpace($configuration[$requiredName]) -or
      $configuration[$requiredName] -match "REEMPLAZAR") {
    throw "La variable $requiredName no está configurada correctamente en $EnvironmentFile."
  }
  [Environment]::SetEnvironmentVariable($requiredName, $configuration[$requiredName], "Process")
}

Push-Location $repositoryRoot
try {
  $validumDirectory = Join-Path $repositoryRoot "apps/validum"
  $typescriptCommand = Join-Path $validumDirectory "node_modules/.bin/tsc.CMD"
  $viteCommand = Join-Path $validumDirectory "node_modules/.bin/vite.CMD"
  if (-not (Test-Path -LiteralPath $typescriptCommand) -or -not (Test-Path -LiteralPath $viteCommand)) {
    throw "Faltan dependencias. Ejecute pnpm install desde la raíz antes de crear el paquete."
  }
  Push-Location $validumDirectory
  try {
    & $typescriptCommand
    if ($LASTEXITCODE -ne 0) { throw "La validación TypeScript de Validum falló." }
    & $viteCommand build
    if ($LASTEXITCODE -ne 0) { throw "La compilación de Validum falló." }
  } finally {
    Pop-Location
  }

  if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -LiteralPath $outputPath -Recurse -Force
  }
  New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
  Copy-Item -Path (Join-Path $distPath "*") -Destination $outputPath -Recurse -Force

  # Artefactos de calibración usados durante el desarrollo; no se publican.
  foreach ($developmentAsset in @(
    "famisanar_calibration_grid.pdf",
    "page1_extracted.jpg",
    "test_famisanar_perfect.pdf",
    "test_filled_acro.pdf",
    "test_ruler.pdf"
  )) {
    $developmentAssetPath = Join-Path $outputPath $developmentAsset
    if (Test-Path -LiteralPath $developmentAssetPath) {
      Remove-Item -LiteralPath $developmentAssetPath -Force
    }
  }

  if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }
  Compress-Archive -Path (Join-Path $outputPath "*") -DestinationPath $archivePath -CompressionLevel Optimal
  Write-Host "Paquete listo: $archivePath"
} finally {
  Pop-Location
}
