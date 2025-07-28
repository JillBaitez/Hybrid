# build.ps1  –  automatic HTOS build
Write-Host "HTOS Build Starting..." -ForegroundColor Green

# 1. Clean
Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "dist" | Out-Null

# 2. Build with Rollup (handles format splitting)
Write-Host "Building with Rollup..." -ForegroundColor Yellow
npx rollup -c

# 3. Mirror src -> dist
robocopy "src" "dist" /S /NP /NFL /NDL > $null

# 4. Static files
Copy-Item "popup.html","popup.js","manifest.json" -Destination "dist"

# Create rules directory and copy JSON files
New-Item -ItemType Directory -Force -Path "dist\rules" | Out-Null
Copy-Item "rules\*.json" -Destination "dist\rules"

# --- TypeScript already places files in correct locations (Path-correct) ---
# No moves needed - files are already in dist/core/, dist/host/, dist/pow/

# --- Fix 2: add icons folder ---
if (Test-Path "icons") {
    Copy-Item "icons" "dist/icons" -Recurse -Force
} else {
    # minimal placeholder if no icons exist
    New-Item -ItemType Directory -Force "dist/icons"
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><circle cx="64" cy="64" r="60" fill="#667eea"/></svg>'
    $svg | Out-File -Encoding utf8 "dist/icons/icon16.svg"
    $svg | Out-File -Encoding utf8 "dist/icons/icon32.svg"
    $svg | Out-File -Encoding utf8 "dist/icons/icon48.svg"
    $svg | Out-File -Encoding utf8 "dist/icons/icon128.svg"
}

# 5. Clean up artifacts and unwanted directories
Write-Host "Cleaning artifacts and unwanted directories..." -ForegroundColor Yellow

# Remove TypeScript artifacts
Get-ChildItem -Path "dist" -Recurse -Include "*.ts","*.d.ts","*.map" | Remove-Item -Force

# Remove empty nested directories created by robocopy
Get-ChildItem -Path "dist" -Recurse -Directory | Where-Object { $_.Name -in @('core','host','pow','storage','types') -and $_.FullName -notmatch '^.*\\dist\\(core|host|pow|storage)$' } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# Remove Chrome extension metadata
Remove-Item -Path "dist/_metadata" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "dist/types" -Recurse -Force -ErrorAction SilentlyContinue

# --- Verify ---
@(
    "dist/manifest.json",
    "dist/core/sw.js",
    "dist/core/cs.js",
    "dist/core/dispatch.js",
    "dist/core/dnr.js",
    "dist/storage/idb.js",
    "dist/host/0h.html",
    "dist/host/0h.js",
    "dist/pow/0f.html",
    "dist/pow/0f.js",
    "dist/icons/icon16.svg",
    "dist/icons/icon32.svg",
    "dist/icons/icon48.svg",
    "dist/icons/icon128.svg",
    "dist/rules/chatgpt.json",
    "dist/rules/claude.json",
    "dist/rules/gemini.json"
) | % {
    if (!(Test-Path $_)) { Write-Host "❌ Missing $_" -ForegroundColor Red; exit 1 }
    if ((Get-Item $_).Length -eq 0) { Write-Host "⚠️ Zero-byte $_" -ForegroundColor Yellow; exit 1 }
}

Write-Host "✅ All required files present and non-empty" -ForegroundColor Green
Write-Host "✅ Service worker at dist/core/sw.js" -ForegroundColor Green
Write-Host "✅ Icons at dist/icons/" -ForegroundColor Green
Write-Host "✅ Rules at dist/rules/" -ForegroundColor Green
Write-Host "Build complete! dist\ is ready to load as an unpacked extension." -ForegroundColor Green
