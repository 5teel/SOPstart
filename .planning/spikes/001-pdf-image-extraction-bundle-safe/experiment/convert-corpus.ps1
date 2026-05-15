param(
    [string]$RawDir = "C:\Development\SOPstart\SOPstart - Raw SOPs",
    [string]$OutDir = "C:\Development\SOPstart\.planning\spikes\001-pdf-image-extraction-bundle-safe\experiment\corpus"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

$targets = @(
    @{ Src = "EN-FOR-02-001 Forming Safety.docx";                       OutName = "small-forming-safety.pdf";       Note = "Small (~80 KB) baseline" }
    @{ Src = "EN-FOR-03-001 Forming Machine Swabbing.docx";             OutName = "medium-forming-swabbing.pdf";    Note = "Medium (~1.4 MB) image-rich" }
    @{ Src = "EN-FOR-03-043 Blank Temperature Measurement with Rondot Probe.docx"; OutName = "large-rondot-probe.pdf"; Note = "Large (~5 MB) industrial SOP" }
)

$existingPdf = Join-Path $RawDir "Plant JSA's\Plenum chamber change procedure.pdf"
if (Test-Path $existingPdf) {
    Copy-Item -Path $existingPdf -Destination (Join-Path $OutDir "real-plenum-chamber.pdf") -Force
    Write-Output ("COPIED real PDF -> real-plenum-chamber.pdf")
} else {
    Write-Output ("MISSING real PDF: " + $existingPdf)
}

$needsConvert = $false
foreach ($t in $targets) {
    $dst = Join-Path $OutDir $t.OutName
    if (-not (Test-Path $dst)) { $needsConvert = $true; break }
}

if (-not $needsConvert) {
    Write-Output "All conversions already present, skipping Word COM step."
    Get-ChildItem $OutDir -Filter *.pdf | Select-Object Name, Length | Format-Table -AutoSize | Out-String | Write-Output
    exit 0
}

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    foreach ($t in $targets) {
        $src = Join-Path $RawDir $t.Src
        $dst = Join-Path $OutDir $t.OutName
        if (Test-Path $dst) { Write-Output ("SKIP (exists): " + $t.OutName); continue }
        if (-not (Test-Path $src)) { Write-Output ("MISSING SRC: " + $src); continue }
        Write-Output ("CONVERT: " + $t.Src + " -> " + $t.OutName + " (" + $t.Note + ")")
        $doc = $word.Documents.Open($src, $false, $true)
        try {
            # ExportAsFixedFormat(OutputFileName, ExportFormat=17 wdExportFormatPDF)
            $doc.ExportAsFixedFormat($dst, 17)
        } finally {
            $doc.Close($false)
        }
    }
} finally {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}

Write-Output "--- Corpus ready ---"
Get-ChildItem $OutDir -Filter *.pdf | Select-Object Name, Length | Format-Table -AutoSize | Out-String | Write-Output
