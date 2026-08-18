# Clears stale Kotlin/Gradle caches and rebuilds the debug APK.
# Use this if you see "Could not close incremental caches" or
# "MobileScannerPlugin cannot find symbol" on Windows.

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "Cleaning Flutter build artifacts..."
flutter clean

Write-Host "Fetching dependencies..."
flutter pub get

Write-Host "Building debug APK..."
flutter build apk --debug

Write-Host "Done. APK: build\app\outputs\flutter-apk\app-debug.apk"
