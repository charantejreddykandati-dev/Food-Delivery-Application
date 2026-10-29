$ErrorActionPreference = "Stop"
$NodeDir = "C:\Users\chara\.gemini\antigravity\brain\2ca9040d-b002-4b5d-b678-acfbecdbfe15\scratch\node-v20.18.0-win-x64"
if (Test-Path $NodeDir) {
    $env:PATH = "$NodeDir;$env:PATH"
}

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " CravePulse AI — Hyperlocal Food Discovery, Ordering & Tracking" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

Write-Host "`n[1/3] Running PostgreSQL Schema & Seed Fixture Migration..." -ForegroundColor Yellow
node .\node_modules\tsx\dist\cli.mjs .\server\src\db\migrate.ts

Write-Host "`n[2/3] Starting Backend Server on http://localhost:5000 ..." -ForegroundColor Green
Start-Process -NoNewWindow -FilePath "node" -ArgumentList ".\node_modules\tsx\dist\cli.mjs .\server\src\index.ts"

Write-Host "[3/3] Starting React Vite Client on http://localhost:5173 ..." -ForegroundColor Green
Set-Location .\client
node ..\node_modules\vite\bin\vite.js --port 5173

