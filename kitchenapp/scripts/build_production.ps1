# Build release APK connected to the production Fastap API server.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$apiUrl = if ($env:API_BASE_URL) { $env:API_BASE_URL } else { "https://digitalrestuarants.thefingo.com" }

Write-Host "Building release APK with live API: $apiUrl"
flutter pub get
flutter build apk --release `
  --dart-define=API_MODE=external `
  --dart-define=API_BASE_URL=$apiUrl `
  --dart-define=APP_ENV=production

Write-Host "Done. APK: build\app\outputs\flutter-apk\app-release.apk"
