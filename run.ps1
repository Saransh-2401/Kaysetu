# KaySetu — one-command local runner.
#
#   .\run.ps1            bring the whole stack up + seed SuperAdmin & demo tenants
#   .\run.ps1 -Fresh     wipe the database first (clean slate), then bring up
#   .\run.ps1 -Logs      follow logs after starting
#
# It starts Docker Desktop if it is not already running, builds + starts every
# service, waits for the API to be healthy, then seeds a SuperAdmin and one
# demo tenant per package and prints all the credentials.
[CmdletBinding()]
param(
    [switch]$Fresh,
    [switch]$Logs
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Say($msg)  { Write-Host "==> $msg" -ForegroundColor Cyan }
function Warn($msg) { Write-Host "!!  $msg" -ForegroundColor Yellow }

# ---------------------------------------------------------------- Docker up?
function Test-Docker {
    try { docker info *> $null; return $LASTEXITCODE -eq 0 } catch { return $false }
}

if (-not (Test-Docker)) {
    Say "Docker is not running. Starting Docker Desktop..."
    $exe = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
    if (Test-Path $exe) { Start-Process $exe } else { Warn "Docker Desktop not found at $exe" }

    $deadline = (Get-Date).AddSeconds(180)
    while (-not (Test-Docker)) {
        if ((Get-Date) -gt $deadline) {
            throw "Docker did not become ready within 3 minutes. Start Docker Desktop manually and re-run."
        }
        Start-Sleep -Seconds 3
        Write-Host "." -NoNewline
    }
    Write-Host ""
}
Say "Docker is ready."

# ---------------------------------------------------------------- fresh slate
if ($Fresh) {
    Warn "-Fresh: removing all containers AND the database volume."
    docker compose down -v
}

# ---------------------------------------------------------------- build + up
Say "Building and starting the stack (first run pulls images + installs deps; give it a few minutes)..."
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed." }

# ---------------------------------------------------------------- wait for API
Say "Waiting for the API to come up..."
$deadline = (Get-Date).AddSeconds(240)
$healthy = $false
while (-not $healthy) {
    if ((Get-Date) -gt $deadline) {
        Warn "The API did not report healthy in time. Recent backend logs:"
        docker compose logs --tail=40 backend
        throw "Backend health check timed out."
    }
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8000/api/health" -UseBasicParsing -TimeoutSec 4
        if ($r.StatusCode -eq 200) { $healthy = $true; break }
    } catch { }
    Start-Sleep -Seconds 3
    Write-Host "." -NoNewline
}
Write-Host ""
Say "API is healthy."

# ------------------------------------------------- seed admin + demo tenants
Say "Seeding the SuperAdmin and one demo tenant per package (this provisions a database per tenant)..."
docker compose exec -T backend python manage.py bootstrap
if ($LASTEXITCODE -ne 0) { Warn "Bootstrap reported an error above; the stack is still up." }

Write-Host ""
Say "Up. URLs:"
Write-Host "    SuperAdmin console   http://localhost:3000/ops/login" -ForegroundColor Green
Write-Host "    Tenant portal        http://localhost:3001"           -ForegroundColor Green
Write-Host "    API                  http://localhost:8000/api"       -ForegroundColor Green
Write-Host ""
Write-Host "    The two web apps compile on first request, so give http://localhost:3000"
Write-Host "    and :3001 ~30s the first time you open them."
Write-Host ""
Write-Host "    Stop everything:  .\stop.ps1        (data kept)"
Write-Host "    Reset everything: .\run.ps1 -Fresh  (wipes tenants + admin)"

if ($Logs) { docker compose logs -f }
