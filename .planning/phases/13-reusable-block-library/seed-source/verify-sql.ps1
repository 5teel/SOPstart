$f = Get-Content 'supabase/migrations/00023_phase13_nz_global_block_seed.sql' -Raw
$ok = $true
foreach ($p in @('do $$','organisation_id','D-Global-03',"'severity'","'critical'","'warning'","'notice'",'already present')) {
  if (-not ($f -match [regex]::Escape($p))) { Write-Host "MISSING in migration: $p"; $ok=$false }
}
$hazardInserts = ([regex]::Matches($f, "'kind'\s*,\s*'hazard'")).Count
$ppeInserts = ([regex]::Matches($f, "'kind'\s*,\s*'ppe'")).Count
$stepInserts = ([regex]::Matches($f, "'kind'\s*,\s*'step'")).Count
Write-Host "hazard=$hazardInserts ppe=$ppeInserts step=$stepInserts"
if ($hazardInserts -lt 50) { Write-Host 'too few hazard inserts'; $ok=$false }
if ($ppeInserts -lt 4) { Write-Host 'too few ppe inserts'; $ok=$false }
if ($stepInserts -lt 2) { Write-Host 'too few step inserts'; $ok=$false }
if (-not $ok) { exit 1 } else { 'OK' }
