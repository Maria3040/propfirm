# Smoke-test PropFirm happy path
$ErrorActionPreference = "Stop"
$base = "http://localhost:6080"

Write-Host "root..."
(Invoke-RestMethod "$base/").orm | Out-Null

Write-Host "login trader..."
$login = Invoke-RestMethod -Method POST "$base/api/auth/login" -ContentType "application/json" `
  -Body '{"email":"trader@propfirm.local","password":"Trader1!"}'
$h = @{ Authorization = "Bearer $($login.accessToken)" }

Write-Host "catalog..."
$products = Invoke-RestMethod "$base/api/catalog/products"
$pid = $products[0].id

Write-Host "order + confirm..."
$order = Invoke-RestMethod -Method POST "$base/api/orders" -Headers $h -ContentType "application/json" `
  -Body (@{ productId = $pid } | ConvertTo-Json)
$paid = Invoke-RestMethod -Method POST "$base/api/orders/$($order.orderId)/confirm" -Headers $h
$cid = $paid.challengeId
if (-not $cid) { throw "no challengeId" }

Write-Host "simulate small win..."
Invoke-RestMethod -Method POST "$base/api/challenges/$cid/trades/simulate" -Headers $h -ContentType "application/json" `
  -Body '{"pnl":50,"symbol":"EURUSD","side":"buy","lots":1}' | Out-Null

Write-Host "challenge detail..."
$ch = Invoke-RestMethod "$base/api/challenges/$cid" -Headers $h
Write-Host "status=$($ch.status) equity=$($ch.account.equity)"

Write-Host "OK - PropFirm smoke passed"
