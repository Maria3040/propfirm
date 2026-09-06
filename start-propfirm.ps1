# Starts PropFirm Go API (:6080) + Next.js UI (:3100)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "Starting Docker Compose (postgres, redis, mailpit)..." -ForegroundColor Cyan
Push-Location $root
docker compose up -d
Pop-Location

$backendGo = Join-Path $root "backend-go"
$frontend = Join-Path $root "frontend"

if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
  Push-Location $frontend; npm.cmd install; Pop-Location
}

$env:DATABASE_URL = "postgresql://propfirm:propfirm_dev@127.0.0.1:15433/propfirm"
$env:HTTP_PORT = "6080"
$env:SMTP_PORT = "2525"
$env:CORS_ORIGIN = "http://localhost:3100,http://127.0.0.1:3100"
$env:GOTOOLCHAIN = "local"
Remove-Item Env:NEXT_PUBLIC_API_BASE -ErrorAction SilentlyContinue
$env:API_PROXY_TARGET = "http://127.0.0.1:6080"

Write-Host "Building Go API..." -ForegroundColor Cyan
Push-Location $backendGo
go build -o propfirm-api.exe ./cmd/api
Pop-Location

$apiExe = Join-Path $backendGo "propfirm-api.exe"
Start-Process -FilePath $apiExe -WorkingDirectory $backendGo
Start-Sleep 2

$npm = (Get-Command npm.cmd).Source
Start-Process -FilePath $npm -ArgumentList @("run", "dev") -WorkingDirectory $frontend

Write-Host ""
Write-Host "UI:      http://localhost:3100"
Write-Host "API:     http://localhost:6080  (Go modular monolith)"
Write-Host "Mailpit: http://localhost:8026"
Write-Host "Trader:  trader@propfirm.local / Trader1!"
Write-Host "Admin:   admin@propfirm.local / Admin1!"
Write-Host "Nest reference backend remains in .\backend (not started)"
