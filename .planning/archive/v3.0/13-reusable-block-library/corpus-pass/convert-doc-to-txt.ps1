# Antiword-based batch .doc -> .txt extractor.
# Replaces fragile Word COM approach. Antiword is a single-file CLI extractor
# that doesn't open documents in Word, so no GUI hang risk.
# Skips already-extracted files. Logs every 50 files.

$ErrorActionPreference = 'Continue'
$root = 'C:\Development\SOPstart\SOPstart - Raw SOPs'
$outRoot = 'C:\Development\SOPstart\.planning\phases\13-reusable-block-library\corpus-pass\text'
$logFile = 'C:\Development\SOPstart\.planning\phases\13-reusable-block-library\corpus-pass\convert.log'
$antiword = 'C:\Program Files\Git\mingw64\bin\antiword.exe'

if (-not (Test-Path -LiteralPath $antiword)) {
    "ABORT: antiword not found at $antiword" | Tee-Object -FilePath $logFile -Append
    exit 1
}

New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
"--- antiword run started $(Get-Date -Format 'o') ---" | Out-File -LiteralPath $logFile -Append -Encoding utf8

# .doc files via antiword
$docFiles = Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object { $_.Extension -eq '.doc' }
$total = $docFiles.Count
"Total .doc source files: $total" | Tee-Object -FilePath $logFile -Append

$converted = 0
$skipped = 0
$failed = 0
$start = Get-Date

foreach ($f in $docFiles) {
    $relRoot = $f.FullName.Substring($root.Length + 1)
    $safeRel = ($relRoot -replace '[\\/]', '__') + '.txt'
    $outPath = Join-Path $outRoot $safeRel

    if (Test-Path -LiteralPath $outPath) { $skipped++; continue }

    try {
        $text = & $antiword $f.FullName 2>$null
        if ($null -eq $text -or $text.Length -eq 0) {
            $failed++
            "EMPTY: $relRoot" | Out-File -LiteralPath $logFile -Append -Encoding utf8
            continue
        }
        # antiword returns string array; join with newlines
        if ($text -is [array]) { $text = $text -join "`n" }
        [System.IO.File]::WriteAllText($outPath, $text, [System.Text.UTF8Encoding]::new($false))
        $converted++
        if ($converted % 50 -eq 0) {
            $elapsed = (Get-Date) - $start
            $rate = if ($elapsed.TotalSeconds -gt 0) { [math]::Round($converted / $elapsed.TotalSeconds, 2) } else { 0 }
            $remaining = $total - ($converted + $skipped)
            $eta = if ($rate -gt 0) { [math]::Round($remaining / $rate) } else { -1 }
            "[$converted/$total] elapsed=$([math]::Round($elapsed.TotalSeconds))s rate=${rate}/s skipped=$skipped failed=$failed eta=${eta}s" | Tee-Object -FilePath $logFile -Append
        }
    } catch {
        $failed++
        "FAIL: $relRoot -- $($_.Exception.Message)" | Out-File -LiteralPath $logFile -Append -Encoding utf8
    }
}

$total_elapsed = (Get-Date) - $start
"--- antiword DONE converted=$converted skipped=$skipped failed=$failed elapsed=$([math]::Round($total_elapsed.TotalSeconds))s ---" | Tee-Object -FilePath $logFile -Append

# .docx files: handled separately by sample-docx.mjs / mammoth in analysis step
"NOTE: .docx files (17 of them) handled by analyze.mjs via mammoth, not this script." | Tee-Object -FilePath $logFile -Append
