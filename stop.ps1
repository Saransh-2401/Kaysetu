# KaySetu — stop the local stack.
#
#   .\stop.ps1          stop + remove containers, KEEP the database
#   .\stop.ps1 -Wipe    also delete the database volume (tenants + admin gone)
[CmdletBinding()]
param([switch]$Wipe)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if ($Wipe) {
    Write-Host "==> Stopping and WIPING all data (database volume included)." -ForegroundColor Yellow
    docker compose down -v
} else {
    Write-Host "==> Stopping the stack (database is kept; .\run.ps1 brings it back)." -ForegroundColor Cyan
    docker compose down
}
