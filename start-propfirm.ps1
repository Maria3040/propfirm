# Starts PropFirm ASP.NET Core API (:6080) + Next.js UI (:3100)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "Starting Docker Compose (postgres, redis, mailpit)..." -ForegroundColor Cyan
Push-Location $root
docker compose up -d
Pop-Location

$backend = Join-Path $root "backend-dotnet\src\PropFirm.Api"
$frontend = Join-Path $root "frontend"

if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
  Push-Location $frontend; npm.cmd install; Pop-Location
}

$env:ConnectionStrings__Default = "Host=127.0.0.1;Port=15433;Database=propfirm;Username=propfirm;Password=propfirm_dev"
$env:HTTP_PORT = "6080"
$env:Smtp__Host = "127.0.0.1"
$env:Smtp__Port = "2525"
$env:Cors__Origins = "http://localhost:3100,http://127.0.0.1:3100,http://localhost:3200,http://127.0.0.1:3200"
Remove-Item Env:NEXT_PUBLIC_API_BASE -ErrorAction SilentlyContinue
$env:API_PROXY_TARGET = "http://127.0.0.1:6080"

Write-Host "Starting ASP.NET Core API..." -ForegroundColor Cyan
$dotnet = (Get-Command dotnet).Source
$apiOut = Join-Path $root "backend-dotnet\api-out.log"
$apiErr = Join-Path $root "backend-dotnet\api-err.log"
Start-Process -FilePath $dotnet `
  -ArgumentList @("run", "--project", $backend, "--no-launch-profile") `
  -WorkingDirectory (Join-Path $root "backend-dotnet") `
  -RedirectStandardOutput $apiOut `
  -RedirectStandardError $apiErr `
  -WindowStyle Hidden
Write-Host "API logs: $apiOut / $apiErr"
Start-Sleep 8

$npm = (Get-Command npm.cmd).Source
Start-Process -FilePath $npm -ArgumentList @("run", "dev") -WorkingDirectory $frontend

Write-Host ""
Write-Host "UI:      http://localhost:3100"
Write-Host "API:     http://localhost:6080  (ASP.NET Core + EF Core + Postgres)"
Write-Host "Swagger: http://localhost:6080/swagger"
Write-Host "Mailpit: http://localhost:8026"
Write-Host "Trader:  trader@propfirm.local / Trader1!"
Write-Host "Admin:   admin@propfirm.local / Admin1!"
Write-Host "Architecture README: .\backend-dotnet\README.md"
