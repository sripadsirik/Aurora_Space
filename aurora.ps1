[CmdletBinding()]
param(
  [ValidateSet("start", "stop", "status")]
  [string]$Action = "start",
  [switch]$SkipSpaceTrack,
  [switch]$SkipFrontend,
  [switch]$KeepInfra
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$StateDir = Join-Path $RepoRoot ".aurora"
$LogsDir = Join-Path $StateDir "logs"
$StateFile = Join-Path $StateDir "processes.json"

function Ensure-Directory {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Load-DotEnv {
  param([string]$Path)

  $variables = @{}
  if (-not (Test-Path $Path)) {
    return $variables
  }

  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $separatorIndex = $trimmed.IndexOf("=")
    if ($separatorIndex -lt 1) {
      continue
    }

    $name = $trimmed.Substring(0, $separatorIndex).Trim()
    $value = $trimmed.Substring($separatorIndex + 1)

    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $variables[$name] = $value
  }

  return $variables
}

function Apply-Environment {
  param([hashtable]$Variables)

  foreach ($entry in $Variables.GetEnumerator()) {
    Set-Item -Path ("Env:" + $entry.Key) -Value $entry.Value
  }
}

function Get-TrackedRecords {
  if (-not (Test-Path $StateFile)) {
    return @()
  }

  $records = Get-Content $StateFile | ConvertFrom-Json
  if ($null -eq $records) {
    return @()
  }

  if ($records -isnot [System.Array]) {
    return @($records)
  }

  return $records
}

function Get-LiveRecords {
  $liveRecords = @()
  foreach ($record in Get-TrackedRecords) {
    try {
      Get-Process -Id $record.Pid -ErrorAction Stop | Out-Null
      $liveRecords += $record
    }
    catch {
    }
  }

  return $liveRecords
}

function Save-TrackedRecords {
  param([array]$Records)

  Ensure-Directory $StateDir
  $Records | ConvertTo-Json | Set-Content $StateFile
}

function Get-BrokerEndpoint {
  param([string]$Brokers)

  $firstBroker = ($Brokers -split ",")[0].Trim()
  if ($firstBroker -match "^(?<host>[^:]+):(?<port>\d+)$") {
    return @{
      Host = $matches.host
      Port = [int]$matches.port
    }
  }

  return $null
}

function Wait-ForTcpPort {
  param(
    [string]$EndpointHost,
    [int]$Port,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
      $connect = $client.BeginConnect($EndpointHost, $Port, $null, $null)
      if ($connect.AsyncWaitHandle.WaitOne(1000, $false) -and $client.Connected) {
        $client.EndConnect($connect)
        return $true
      }
    }
    catch {
    }
    finally {
      $client.Dispose()
    }

    Start-Sleep -Milliseconds 500
  }

  return $false
}

function Start-TrackedProcess {
  param(
    [string]$Name,
    [string]$FilePath,
    [string]$WorkingDirectory,
    [string[]]$ArgumentList = @()
  )

  $stdoutPath = Join-Path $LogsDir ($Name + ".log")
  $stderrPath = Join-Path $LogsDir ($Name + ".stderr.log")

  foreach ($path in @($stdoutPath, $stderrPath)) {
    if (Test-Path $path) {
      Remove-Item $path -Force
    }
  }

  $startProcessArgs = @{
    FilePath               = $FilePath
    WorkingDirectory       = $WorkingDirectory
    RedirectStandardOutput = $stdoutPath
    RedirectStandardError  = $stderrPath
    WindowStyle            = "Hidden"
    PassThru               = $true
  }

  if ($ArgumentList.Count -gt 0) {
    $startProcessArgs.ArgumentList = $ArgumentList
  }

  $process = Start-Process @startProcessArgs

  Start-Sleep -Milliseconds 750
  $process.Refresh()
  if ($process.HasExited) {
    throw ("{0} exited immediately. Check {1} and {2}" -f $Name, $stdoutPath, $stderrPath)
  }

  Write-Host ("Started {0} (PID {1})" -f $Name, $process.Id)

  return [pscustomobject]@{
    Name      = $Name
    Pid       = $process.Id
    Log       = $stdoutPath
    ErrorLog  = $stderrPath
    StartedAt = (Get-Date).ToString("s")
  }
}

function Show-Status {
  $liveRecords = Get-LiveRecords
  if ($liveRecords.Count -eq 0) {
    Write-Host "Aurora is not running."
    return
  }

  Write-Host "Aurora services:"
  foreach ($record in $liveRecords) {
    Write-Host ("- {0}: PID {1}, log {2}" -f $record.Name, $record.Pid, $record.Log)
  }

  Write-Host ""
  Write-Host "URLs:"
  Write-Host "- Frontend: http://localhost:5173"
  Write-Host "- WebSocket: ws://localhost:8080/ws"
  Write-Host "- Prometheus: http://localhost:9090"
  Write-Host "- Grafana: http://localhost:3001"
}

function Stop-Aurora {
  $liveRecords = Get-LiveRecords
  if ($liveRecords.Count -eq 0) {
    Write-Host "No tracked Aurora processes are running."
  }
  else {
    foreach ($record in $liveRecords) {
      try {
        Stop-Process -Id $record.Pid -Force -ErrorAction Stop
        Write-Host ("Stopped {0} (PID {1})" -f $record.Name, $record.Pid)
      }
      catch {
        Write-Warning ("Failed to stop {0} (PID {1}): {2}" -f $record.Name, $record.Pid, $_.Exception.Message)
      }
    }
  }

  if (Test-Path $StateFile) {
    Remove-Item $StateFile -Force
  }

  if (-not $KeepInfra) {
    Push-Location (Join-Path $RepoRoot "infra")
    try {
      docker compose down | Out-Host
    }
    finally {
      Pop-Location
    }
  }
  else {
    Write-Host "Docker infra left running."
  }
}

function Start-Aurora {
  $liveRecords = Get-LiveRecords
  if ($liveRecords.Count -gt 0) {
    throw "Aurora already has tracked processes running. Use .\aurora.ps1 stop first."
  }

  $backendDir = Join-Path $RepoRoot "backend"
  $backendBinDir = Join-Path $backendDir "bin"
  $frontendDir = Join-Path $RepoRoot "frontend"
  $infraDir = Join-Path $RepoRoot "infra"
  $backendEnvPath = Join-Path $backendDir ".env"
  $viteScript = Join-Path $frontendDir "node_modules\vite\bin\vite.js"

  foreach ($requiredPath in @(
      $backendEnvPath,
      (Join-Path $backendBinDir "gateway.exe"),
      (Join-Path $backendBinDir "celestrak.exe"),
      (Join-Path $backendBinDir "noaa.exe"),
      (Join-Path $backendBinDir "engine-rust.exe"),
      (Join-Path $infraDir "docker-compose.yml"),
      $viteScript
    )) {
    if (-not (Test-Path $requiredPath)) {
      throw ("Required path not found: {0}" -f $requiredPath)
    }
  }

  $backendEnv = Load-DotEnv $backendEnvPath
  if (-not $backendEnv.ContainsKey("KAFKA_BROKERS")) {
    $backendEnv["KAFKA_BROKERS"] = "localhost:9092"
  }
  if (-not $backendEnv.ContainsKey("METRICS_PORT_ENGINE_RUST")) {
    $backendEnv["METRICS_PORT_ENGINE_RUST"] = "2117"
  }

  Apply-Environment $backendEnv
  Ensure-Directory $StateDir
  Ensure-Directory $LogsDir

  Push-Location $infraDir
  try {
    docker compose up -d | Out-Host
  }
  finally {
    Pop-Location
  }

  $brokerEndpoint = Get-BrokerEndpoint $env:KAFKA_BROKERS
  if ($null -ne $brokerEndpoint) {
    Write-Host ("Waiting for Kafka at {0}:{1}..." -f $brokerEndpoint.Host, $brokerEndpoint.Port)
    if (-not (Wait-ForTcpPort -EndpointHost $brokerEndpoint.Host -Port $brokerEndpoint.Port -TimeoutSeconds 60)) {
      throw ("Kafka did not become reachable at {0}:{1}" -f $brokerEndpoint.Host, $brokerEndpoint.Port)
    }
  }

  $records = @()
  $records += Start-TrackedProcess -Name "gateway" -FilePath (Join-Path $backendBinDir "gateway.exe") -WorkingDirectory $backendDir
  $records += Start-TrackedProcess -Name "celestrak" -FilePath (Join-Path $backendBinDir "celestrak.exe") -WorkingDirectory $backendDir
  $records += Start-TrackedProcess -Name "noaa" -FilePath (Join-Path $backendBinDir "noaa.exe") -WorkingDirectory $backendDir
  $records += Start-TrackedProcess -Name "engine-rust" -FilePath (Join-Path $backendBinDir "engine-rust.exe") -WorkingDirectory $backendDir

  if (-not $SkipSpaceTrack) {
    if ([string]::IsNullOrWhiteSpace($env:SPACETRACK_USERNAME) -or [string]::IsNullOrWhiteSpace($env:SPACETRACK_PASSWORD)) {
      Write-Host "Skipping Space-Track because SPACETRACK_USERNAME or SPACETRACK_PASSWORD is not set in backend/.env."
    }
    else {
      $records += Start-TrackedProcess -Name "spacetrack" -FilePath (Join-Path $backendBinDir "spacetrack.exe") -WorkingDirectory $backendDir
    }
  }

  if (-not $SkipFrontend) {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    $records += Start-TrackedProcess -Name "frontend" -FilePath $nodePath -WorkingDirectory $frontendDir -ArgumentList @($viteScript)
  }

  Save-TrackedRecords -Records $records

  Write-Host ""
  Write-Host "Aurora started."
  Show-Status
  Write-Host ""
  Write-Host "Use .\aurora.ps1 stop to shut everything down."
}

switch ($Action) {
  "start" { Start-Aurora }
  "stop" { Stop-Aurora }
  "status" { Show-Status }
}
