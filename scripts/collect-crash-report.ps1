# collect-crash-report.ps1
# Kumpulkan bukti BSOD terakhir: minidump + event Critical/Error terbaru dari
# System log. Jalankan setelah PC restart akibat BSOD.
#
# Cara pakai:
#   1. Klik kanan file ini -> "Run with PowerShell"
#      (atau buka PowerShell biasa lalu: powershell -ExecutionPolicy Bypass -File collect-crash-report.ps1)
#   2. Hasilnya akan tersimpan di crash-report.txt di folder yang sama
#   3. Kirim isi crash-report.txt itu

$ErrorActionPreference = "SilentlyContinue"
$outFile = Join-Path $PSScriptRoot "crash-report.txt"
"=== Crash Report collected $(Get-Date -Format o) ===" | Out-File $outFile

# 1. Latest minidump
"`n--- Minidump files (C:\Windows\Minidump) ---" | Out-File $outFile -Append
$dumps = Get-ChildItem "C:\Windows\Minidump\*.dmp" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
if ($dumps) {
    $dumps | Select-Object -First 5 Name, LastWriteTime, Length | Format-Table | Out-String | Out-File $outFile -Append
    "Most recent dump: $($dumps[0].FullName) at $($dumps[0].LastWriteTime)" | Out-File $outFile -Append
} else {
    "No minidump files found. Minidumps may be disabled, or check C:\Windows\LiveKernelReports too." | Out-File $outFile -Append
    "`n--- LiveKernelReports ---" | Out-File $outFile -Append
    Get-ChildItem "C:\Windows\LiveKernelReports\*.dmp" -Recurse -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 5 FullName, LastWriteTime |
        Format-Table | Out-String | Out-File $outFile -Append
}

# 2. Most recent BugCheck event (this is the actual Stop Code record)
"`n--- BugCheck events (System log, Source=Microsoft-Windows-WER-SystemErrorReporting or 'BugCheck') ---" | Out-File $outFile -Append
Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-WER-SystemErrorReporting'} -MaxEvents 5 -ErrorAction SilentlyContinue |
    Format-List TimeCreated, Id, LevelDisplayName, Message | Out-String | Out-File $outFile -Append

# 3. Last 25 Critical/Error events in System log around the crash, useful to spot
#    which driver (Serial, usbccgp, silabser/CP210x, etc.) was implicated.
"`n--- Last 25 Critical/Error events in System log ---" | Out-File $outFile -Append
Get-WinEvent -FilterHashtable @{LogName='System'; Level=1,2} -MaxEvents 25 -ErrorAction SilentlyContinue |
    Select-Object TimeCreated, Id, LevelDisplayName, ProviderName, Message |
    Format-List | Out-String | Out-File $outFile -Append

# 4. Specifically filter for anything mentioning serial/usb/silabs/cp210x/driver
"`n--- Events mentioning USB / Serial / CP210x / Silabs / driver (last 100 System events scanned) ---" | Out-File $outFile -Append
Get-WinEvent -LogName System -MaxEvents 100 -ErrorAction SilentlyContinue |
    Where-Object { $_.Message -match "serial|usb|silabs|cp210|driver|WDF|kernel" } |
    Select-Object TimeCreated, Id, LevelDisplayName, ProviderName, Message |
    Format-List | Out-String | Out-File $outFile -Append

Write-Host "Done. Report saved to: $outFile"
Write-Host "Silakan buka file itu dan kirim isinya."
