# Starts PropFirm Python API (:6080) + Next.js UI (:3100)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "Starting Docker Compose (postgres, redis, mailpit)..." -ForegroundColor Cyan
Push-Location $root
docker compose up -d
Pop-Location

$backendPy = Join-Path $root "backend-python"
$frontend = Join-Path $root "frontend"

if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
  Push-Location $frontend; npm.cmd install; Pop-Location
}

$env:DATABASE_URL = "postgresql+psycopg://propfirm:propfirm_dev@127.0.0.1:15433/propfirm"
$env:REDIS_URL = "redis://127.0.0.1:6380/0"
$env:HTTP_PORT = "6080"
$env:SMTP_HOST = "127.0.0.1"
$env:SMTP_PORT = "2525"
$env:CORS_ORIGIN = "http://localhost:3100,http://127.0.0.1:3100"
Remove-Item Env:NEXT_PUBLIC_API_BASE -ErrorAction SilentlyContinue
$env:API_PROXY_TARGET = "http://127.0.0.1:6080"

Write-Host "Installing Python deps (if needed)..." -ForegroundColor Cyan
Push-Location $backendPy
python -m pip install -q -r requirements.txt
Pop-Location

$python = (Get-Command python).Source
Start-Process -FilePath $python -ArgumentList @(
  "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "6080"
) -WorkingDirectory $backendPy
Start-Sleep 3

$npm = (Get-Command npm.cmd).Source
Start-Process -FilePath $npm -ArgumentList @("run", "dev") -WorkingDirectory $frontend

Write-Host ""
Write-Host "UI:      http://localhost:3100"
Write-Host "API:     http://localhost:6080  (Python FastAPI + SQLAlchemy + Redis)"
Write-Host "Mailpit: http://localhost:8026"
Write-Host "Redis:   localhost:6380 (catalog cache, login rate-limit, JWT denylist)"
Write-Host "Trader:  trader@propfirm.local / Trader1!"
Write-Host "Admin:   admin@propfirm.local / Admin1!"
Write-Host "Architecture README: .\backend-python\README.md"
Write-Host "Nest/Go references remain in .\backend and .\backend-go (not started)"
