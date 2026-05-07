$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Get-Content '.env.local' | ForEach-Object {
  if ($_ -match '^(SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL)=(.*)$') {
    [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}
$base = $env:NEXT_PUBLIC_SUPABASE_URL
$key  = $env:SUPABASE_SERVICE_ROLE_KEY
$h    = @{ apikey = $key; Authorization = "Bearer $key" }

foreach ($kind in @('hazard','ppe','step')) {
  $rows = Invoke-RestMethod -Uri "$base/rest/v1/blocks?organisation_id=is.null&kind_slug=eq.$kind&select=id" -Headers $h -Method GET
  Write-Host "$kind -> $($rows.Count) rows"
}

# Total
$all = Invoke-RestMethod -Uri "$base/rest/v1/blocks?organisation_id=is.null&select=id" -Headers $h -Method GET
Write-Host "TOTAL global blocks -> $($all.Count)"

# Verify each row has current_version_id
$missing = Invoke-RestMethod -Uri "$base/rest/v1/blocks?organisation_id=is.null&current_version_id=is.null&select=id,name" -Headers $h -Method GET
Write-Host "rows missing current_version_id -> $($missing.Count)"
