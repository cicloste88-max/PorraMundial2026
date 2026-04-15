# qa-login.ps1
# Lee credenciales del Gestor de Windows y las devuelve para el agente QA
# NO expone las credenciales en ningun fichero ni log

$stored = cmdkey /list:tumundial-porra-app 2>&1
if ($stored -notmatch "tumundial-porra-app") {
    Write-Error "Credenciales no encontradas. Ejecuta setup-credentials.ps1 primero."
    exit 1
}

# Extraer credenciales almacenadas
$cred = Get-StoredCredential -Target "tumundial-porra-app" 2>$null
if (-not $cred) {
    # Fallback via cmdkey
    $result = cmdkey /list:tumundial-porra-app
    Write-Host "CRED_FOUND:$result"
} else {
    $plainPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($cred.Password)
    )
    # Output para consumo del agente — solo en memoria, no en disco
    Write-Output "QA_EMAIL:$($cred.UserName)"
    Write-Output "QA_PASS:$plainPass"
}
