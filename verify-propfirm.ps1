# Smoke-test PropFirm happy path (httpOnly cookie session)
$ErrorActionPreference = "Stop"
$base = "http://localhost:6080"
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

Write-Host "root..."
$root = Invoke-RestMethod "$base/" -WebSession $session
Write-Host "  service=$($root.service)"

Write-Host "login trader..."
Invoke-RestMethod -Method POST "$base/api/auth/login" -ContentType "application/json" `
  -Body '{"email":"trader@propfirm.local","password":"Trader1!"}' -WebSession $session | Out-Null

Write-Host "catalog..."
$products = Invoke-RestMethod "$base/api/catalog/products" -WebSession $session
$productId = $products[0].id

Write-Host "order + confirm..."
$order = Invoke-RestMethod -Method POST "$base/api/orders" -WebSession $session -ContentType "application/json" `
  -Body (@{ productId = $productId } | ConvertTo-Json)
$paid = Invoke-RestMethod -Method POST "$base/api/orders/$($order.orderId)/confirm" -WebSession $session
$cid = $paid.challengeId
if (-not $cid) { throw "no challengeId" }

Write-Host "simulate small win..."
Invoke-RestMethod -Method POST "$base/api/challenges/$cid/trades/simulate" -WebSession $session -ContentType "application/json" `
  -Body '{"pnl":50,"symbol":"EURUSD","side":"buy","lots":1}' | Out-Null

Write-Host "challenge detail..."
$ch = Invoke-RestMethod "$base/api/challenges/$cid" -WebSession $session
Write-Host "status=$($ch.status) equity=$($ch.account.equity)"

Write-Host "OK - PropFirm smoke passed (Python FastAPI track)"

Write-Host "coupon validate..."
$coupon = Invoke-RestMethod -Method POST "$base/api/coupons/validate" -WebSession $session -ContentType "application/json" `
  -Body '{"code":"WELCOME10","subtotal":100}'
if ($coupon.finalTotal -ne 90) { throw "coupon expected 90 got $($coupon.finalTotal)" }

Write-Host "payouts eligible equity..."
$elig = Invoke-RestMethod "$base/api/payouts/eligible" -WebSession $session
if (-not $elig.accounts -or $null -eq $elig.accounts[0].equity) { throw "eligible accounts missing equity" }

Write-Host "OK - coupon + payouts eligible checks passed"
