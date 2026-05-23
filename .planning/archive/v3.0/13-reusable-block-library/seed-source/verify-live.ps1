$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Get-Content '.env.local' | ForEach-Object {
  if ($_ -match '^(SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL)=(.*)$') {
    [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}
$base = $env:NEXT_PUBLIC_SUPABASE_URL
$key = $env:SUPABASE_SERVICE_ROLE_KEY
if (-not $base -or -not $key) { Write-Host 'env missing'; exit 1 }
$headers = @{ apikey = $key; Authorization = "Bearer $key"; Prefer = 'count=exact'; 'Range-Unit' = 'items'; 'Range' = '0-0' }

Write-Host '--- Counts of organisation_id IS NULL blocks by kind ---'
foreach ($kind in @('hazard','ppe','step')) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri "$base/rest/v1/blocks?organisation_id=is.null&kind_slug=eq.$kind&select=id" -Headers $headers -Method GET
    $cr = $resp.Headers['Content-Range']
    Write-Host "$kind -> Content-Range: $cr"
  } catch {
    Write-Host "$kind -> ERROR: $($_.Exception.Message)"
  }
}

Write-Host ''
Write-Host '--- Sample 3 blocks ---'
try {
  $h2 = @{ apikey = $key; Authorization = "Bearer $key" }
  $sample = Invoke-WebRequest -UseBasicParsing -Uri "$base/rest/v1/blocks?organisation_id=is.null&select=id,name,kind_slug,category_tags,current_version_id&limit=3" -Headers $h2 -Method GET
  Write-Host $sample.Content
  Write-Host ''
  Write-Host '--- Block versions for those 3 ---'
  $rows = $sample.Content | ConvertFrom-Json
  foreach ($r in $rows) {
    if ($r.current_version_id) {
      $vr = Invoke-WebRequest -UseBasicParsing -Uri "$base/rest/v1/block_versions?id=eq.$($r.current_version_id)&select=content" -Headers $h2 -Method GET
      Write-Host "$($r.name) -> $($vr.Content)"
    } else {
      Write-Host "$($r.name) -> NO current_version_id"
    }
  }
} catch {
  Write-Host "ERROR: $($_.Exception.Message)"
}
