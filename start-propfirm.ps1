# Starts PropFirm API (:6080) + Next.js UI (:3100)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "Starting Docker Compose (postgres, redis, mailpit)..." -ForegroundColor Cyan
Push-Location $root
docker compose up -d
Pop-Location

$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

if (-not (Test-Path (Join-Path $backend "node_modules"))) {
  Push-Location $backend; npm.cmd install; Pop-Location
}
if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
  Push-Location $frontend; npm.cmd install; Pop-Location
}

$env:DATABASE_URL = "postgresql://propfirm:propfirm_dev@127.0.0.1:15433/propfirm"
$env:HTTP_PORT = "6080"
$env:SMTP_PORT = "2525"
$env:CORS_ORIGIN = "http://localhost:3100,http://127.0.0.1:3100"
# Prefer same-origin Next rewrites for httpOnly cookies (Redux track). Unset direct API base.
Remove-Item Env:NEXT_PUBLIC_API_BASE -ErrorAction SilentlyContinue
$env:API_PROXY_TARGET = "http://127.0.0.1:6080"

Write-Host "Building backend..." -ForegroundColor Cyan
Push-Location $backend
npm.cmd run build
Pop-Location

$node = (Get-Command node.exe).Source
Start-Process -FilePath $node -ArgumentList @((Join-Path $backend "dist\main.js")) -WorkingDirectory $backend
Start-Sleep 2

$npm = (Get-Command npm.cmd).Source
Start-Process -FilePath $npm -ArgumentList @("run", "dev") -WorkingDirectory $frontend

Write-Host ""
Write-Host "UI:      http://localhost:3100"
Write-Host "API:     http://localhost:6080"
Write-Host "Mailpit: http://localhost:8026"
Write-Host "Trader:  trader@propfirm.local / Trader1!"
Write-Host "Admin:   admin@propfirm.local / Admin1!"
