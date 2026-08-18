# Run app connected to your 3rd-party API server
param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl
)

Set-Location $PSScriptRoot\..

$BaseUrl = $BaseUrl.TrimEnd('/')

Write-Host "Starting Fastap Kitchen App — External API mode" -ForegroundColor Cyan
Write-Host "Server: $BaseUrl/api/v1" -ForegroundColor Yellow

flutter run `
    --dart-define=API_MODE=external `
    --dart-define=API_BASE_URL=$BaseUrl `
    @args
