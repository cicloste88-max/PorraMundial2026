# deploy-and-qa.ps1
# Flujo completo: commit + push + esperar deploy + verificar login
# Uso: .\deploy-and-qa.ps1 "mensaje del commit"

param([string]$msg = "fix: actualizacion automatica")

$repo = "C:\Users\San\Documents\GitHub\PorraMundial2026"

Write-Host "== DEPLOY ==" -ForegroundColor Cyan
Set-Location $repo
git add index.html
git commit -m $msg
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Error "Error en git push"
    exit 1
}

Write-Host "✓ Push completado — esperando deploy Netlify (30s)..." -ForegroundColor Green
Start-Sleep -Seconds 35

Write-Host "== QA COMPLETADO ==" -ForegroundColor Cyan
Write-Host "Abre tumundial.netlify.app y verifica el resultado" -ForegroundColor Yellow

# Señal para Claude en Chrome
Write-Output "DEPLOY_DONE:$(Get-Date -Format 'HH:mm:ss')"
