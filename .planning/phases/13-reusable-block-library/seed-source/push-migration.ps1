$ErrorActionPreference = 'Stop'
$envFile = '.env.local'
if (-not (Test-Path $envFile)) { Write-Host "no $envFile"; exit 1 }
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^(SUPABASE_ACCESS_TOKEN|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_PASSWORD)=(.*)$') {
    [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}
Write-Host "Pushing migration to Supabase..."
& npx --yes supabase@latest db push --include-all
exit $LASTEXITCODE
