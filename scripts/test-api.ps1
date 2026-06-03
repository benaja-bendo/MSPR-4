# Vérification rapide des 3 fonctions COFRAP (health checks)
# Usage : .\scripts\test-api.ps1
# Prérequis : fn-auth (:8080), fn-mfa (:8081), fn-password (:8082) démarrés

$ErrorActionPreference = "Stop"

$services = @(
    @{ Name = "fn-auth";     Url = "http://localhost:8080" },
    @{ Name = "fn-mfa";      Url = "http://localhost:8081" },
    @{ Name = "fn-password"; Url = "http://localhost:8082" }
)

Write-Host "=== Test santé des fonctions COFRAP ===" -ForegroundColor Cyan

foreach ($svc in $services) {
    try {
        $res = Invoke-RestMethod -Uri $svc.Url -Method Get -TimeoutSec 5
        if ($res.status -eq "ok") {
            Write-Host "[OK] $($svc.Name) -> $($res.service)" -ForegroundColor Green
        } else {
            Write-Host "[WARN] $($svc.Name) réponse inattendue:" ($res | ConvertTo-Json -Compress)
        }
    } catch {
        Write-Host "[ECHEC] $($svc.Name) sur $($svc.Url)" -ForegroundColor Red
        Write-Host "  $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "  Lancez la fonction (voir docs/guide-demarrage-local.md)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Pour tester le parcours complet : http://localhost:3000 (frontend)" -ForegroundColor Cyan
