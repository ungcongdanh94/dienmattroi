# update.ps1
# Cach dung: .\update.ps1 -SourceZip "C:\Users\ungco\Downloads\ten-file-moi.zip"
#
# Script nay se:
# 1. Giai nen file zip Claude vua gui
# 2. Copy de toan bo file vao dung thu muc du an (da noi voi GitHub)
# 3. git add + commit + push tu dong
#
# CHI CAN CHAY 1 LAN DAU: sua duong dan $ProjectPath ben duoi cho dung may ban,
# roi luu file nay vao trong chinh thu muc du an (solar-calculator).

param(
    [Parameter(Mandatory=$true)]
    [string]$SourceZip,

    [string]$CommitMessage = "Update from Claude"
)

# ==== SUA DUONG DAN NAY CHO DUNG MAY BAN (chi 1 lan) ====
$ProjectPath = "C:\Users\ungco\Downloads\solar-calculator-project\solar-calculator"
# ==========================================================

if (-not (Test-Path $SourceZip)) {
    Write-Host "Khong tim thay file zip: $SourceZip" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $ProjectPath)) {
    Write-Host "Khong tim thay thu muc du an: $ProjectPath" -ForegroundColor Red
    Write-Host "Sua bien `$ProjectPath` trong file update.ps1 cho dung duong dan." -ForegroundColor Yellow
    exit 1
}

$TempExtract = Join-Path $env:TEMP "solar-update-$(Get-Random)"
Write-Host "Giai nen $SourceZip ..." -ForegroundColor Cyan
Expand-Archive -Path $SourceZip -DestinationPath $TempExtract -Force

# Zip co the giai nen ra thu muc con "solar-calculator" ben trong, hoac ra thang goc.
# Tu dong tim thu muc chua package.json de copy dung noi dung.
$SourceContent = Get-ChildItem -Path $TempExtract -Recurse -Filter "package.json" | Select-Object -First 1
if ($SourceContent) {
    $SourceFolder = $SourceContent.DirectoryName
} else {
    $SourceFolder = $TempExtract
}

Write-Host "Copy de vao $ProjectPath ..." -ForegroundColor Cyan
Copy-Item -Path (Join-Path $SourceFolder "*") -Destination $ProjectPath -Recurse -Force

Remove-Item -Path $TempExtract -Recurse -Force

Write-Host "Dang commit va push..." -ForegroundColor Cyan
Set-Location $ProjectPath
git add .
git commit -m $CommitMessage
git push origin main

Write-Host "`nXong! Railway se tu dong build lai." -ForegroundColor Green
