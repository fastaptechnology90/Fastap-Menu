# Loads .env into the current PowerShell session.
# This project reads process.env directly and does NOT auto-load .env,
# so run this once per terminal before pnpm db:setup / dev:api / smoke:*
#
#   . .\load-env.ps1
#
# (note the leading dot + space — it must be dot-sourced to persist)

$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "No .env found at $envFile" -ForegroundColor Red
    return
}

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $name = $matches[1]
        $value = $matches[2].Trim().Trim('"').Trim("'")
        Set-Item -Path "env:$name" -Value $value
    }
}

Write-Host "Loaded .env" -ForegroundColor Green
Write-Host "  DATABASE_URL -> localhost:$env:PGPORT/$env:PGDATABASE"
Write-Host "  NODE_ENV     -> $env:NODE_ENV"
