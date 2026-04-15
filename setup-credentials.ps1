# setup-credentials.ps1
# Ejecutar UNA SOLA VEZ para guardar credenciales de forma segura
# Las credenciales se almacenan cifradas en el Gestor de Windows

param(
    [string]$email,
    [string]$password
)

if (-not $email -or -not $password) {
    $email    = Read-Host "Email de la Porra App"
    $password = Read-Host "Contraseña" -AsSecureString
    $password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
    )
}

# Guardar en Gestor de Credenciales de Windows
$securePass = ConvertTo-SecureString $password -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($email, $securePass)

# Almacenar con cmdkey (nativo de Windows)
cmdkey /add:tumundial-porra-app /user:$email /pass:$password

Write-Host ""
Write-Host "✓ Credenciales guardadas en el Gestor de Windows" -ForegroundColor Green
Write-Host "  Target: tumundial-porra-app" -ForegroundColor Gray
Write-Host "  Usuario: $email" -ForegroundColor Gray
Write-Host ""
Write-Host "Ya puedes ejecutar qa-login.ps1 de forma automatica." -ForegroundColor Cyan
