$j = Get-Content '.planning/phases/13-reusable-block-library/seed-source/global-blocks.json' -Raw | ConvertFrom-Json
$blocks = $j.blocks
if (-not $blocks) { Write-Host 'MISSING blocks array'; exit 1 }
$hazardCount = ($blocks | Where-Object { $_.kind_slug -eq 'hazard' }).Count
$ppeCount = ($blocks | Where-Object { $_.kind_slug -eq 'ppe' }).Count
$stepCount = ($blocks | Where-Object { $_.kind_slug -eq 'step' }).Count
Write-Host "hazard=$hazardCount ppe=$ppeCount step=$stepCount total=$($blocks.Count)"
if ($hazardCount -lt 50 -or $hazardCount -gt 60) { Write-Host 'hazard count out of expected band 50-60'; exit 1 }
if ($ppeCount -lt 4 -or $ppeCount -gt 6) { Write-Host 'ppe count out of expected band 4-6'; exit 1 }
if ($stepCount -lt 2 -or $stepCount -gt 4) { Write-Host 'step count out of expected band 2-4'; exit 1 }
foreach ($b in $blocks) {
  if (-not $b.name -or -not $b.kind_slug -or -not $b.content -or -not $b.content.kind) {
    Write-Host "INVALID entry: $($b | ConvertTo-Json -Compress)"
    exit 1
  }
  if ($b.kind_slug -ne $b.content.kind) {
    Write-Host "MISMATCH kind_slug=$($b.kind_slug) vs content.kind=$($b.content.kind) for $($b.name)"
    exit 1
  }
  if ($b.kind_slug -eq 'hazard') {
    if (-not $b.content.text -or -not $b.content.severity) { Write-Host "BAD hazard: $($b.name)"; exit 1 }
    if ($b.content.severity -notin @('critical','warning','notice')) { Write-Host "BAD severity: $($b.content.severity) for $($b.name)"; exit 1 }
  }
}
'OK'
