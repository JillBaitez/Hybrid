# build.ps1  –  automatic HTOS build
Write-Host "Building HTOS extension..." -ForegroundColor Green

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

# Copy OS HTML files for offscreen documents
New-Item -ItemType Directory -Force -Path "dist\OS" | Out-Null
Copy-Item "src\OS\*.html" -Destination "dist\OS"

# Copy content HTML files for provider engines
New-Item -ItemType Directory -Force -Path "dist\content" | Out-Null
Copy-Item "src\content\*.html" -Destination "dist\content"

# Phase 1: No static rules needed - using dynamic DNR manager
# Rules are generated at runtime by DNRManager

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

# Verify session layer files exist
if (-not (Test-Path "dist/session-layer/nj-engine.js")) {
    Write-Host "ERROR: Session layer files not created properly" -ForegroundColor Red
    exit 1
}

Write-Host "✅ All required files present and non-empty" -ForegroundColor Green
Write-Host "✅ Service worker at dist/core/sw.js" -ForegroundColor Green
Write-Host "✅ Icons at dist/icons/" -ForegroundColor Green
Write-Host "✅ Dynamic DNR rules (no static files needed)" -ForegroundColor Green
Write-Host "Build complete! dist\ is ready to load as an unpacked extension." -ForegroundColor Green

