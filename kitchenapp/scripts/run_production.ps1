# Run the kitchen app against the production Fastap API server.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$apiUrl = if ($env:API_BASE_URL) { $env:API_BASE_URL } else { "https://digitalrestuarants.thefingo.com" }

Write-Host "Starting app with live API: $apiUrl"
flutter run `
  --dart-define=API_MODE=external `
  --dart-define=API_BASE_URL=$apiUrl `
  --dart-define=APP_ENV=production
