# Arranca el addon con la URL publica de Cloudflare.
# Uso:
#   powershell -ExecutionPolicy Bypass -File .\scripts\start-cloudflare.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

$env:PUBLIC_URL = 'https://lacartoon.cc'
Write-Host "PUBLIC_URL=$env:PUBLIC_URL"
Write-Host "Iniciando addon en puerto 7000..."
node addon.js
