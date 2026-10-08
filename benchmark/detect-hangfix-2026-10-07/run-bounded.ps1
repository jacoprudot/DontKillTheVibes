# run-bounded.ps1 — hard wall-clock cap around one report.mjs run, the same shape
# as the sweep harness: Start-Process + WaitForExit(cap) + taskkill /T /F.
#
# Invoke with:
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File run-bounded.ps1 `
#     -Name <repo> -Target <dir> -Out <dir> -Reporter <report.mjs> [-CapSeconds 180] [-ResultsJson <file>]
#
# -Reporter exists so the SAME harness can run the frozen pre-fix tree (copied to
# a temp dir with detectors.json restored from HEAD) and the working tree, which
# is the only way a before/after number is comparable.
param(
  [Parameter(Mandatory=$true)][string]$Name,
  [Parameter(Mandatory=$true)][string]$Target,
  [Parameter(Mandatory=$true)][string]$Out,
  [Parameter(Mandatory=$true)][string]$Reporter,
  [int]$CapSeconds = 180,
  [string]$ResultsJson = ''
)
$ErrorActionPreference = 'Stop'
$node = 'C:\Program Files\nodejs\node.exe'
if (-not (Test-Path $node)) { $node = 'node' }
if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$cmdPath = Join-Path $Out 'run.cmd'
Set-Content -Path $cmdPath -Encoding ascii -Value @(
  '@echo off',
  "`"$node`" `"$Reporter`" --target `"$Target`" --out `"$Out`" > `"$Out\stdout.txt`" 2> `"$Out\stderr.txt`"",
  "echo %ERRORLEVEL% > `"$Out\exit.txt`""
)

$sw = [Diagnostics.Stopwatch]::StartNew()
$proc = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "`"$cmdPath`"" -PassThru -WindowStyle Hidden
if (-not $proc.WaitForExit($CapSeconds * 1000)) {
  taskkill /PID $proc.Id /T /F | Out-Null
  $status = 'timeout'
} else {
  $status = 'ok'
}
$sw.Stop()
$exit = if (Test-Path (Join-Path $Out 'exit.txt')) { (Get-Content (Join-Path $Out 'exit.txt') -Raw).Trim() } else { 'none' }
$sizes = @{}
foreach ($f in 'findings.json','report.md','prompts.md','stdout.txt','stderr.txt') {
  $p = Join-Path $Out $f
  $sizes[$f] = if (Test-Path $p) { (Get-Item $p).Length } else { -1 }
}
$rec = [ordered]@{
  name = $Name; status = $status; seconds = [math]::Round($sw.Elapsed.TotalSeconds, 2); exit_code = $exit; cap_seconds = $CapSeconds
  findings_json_bytes = $sizes['findings.json']; report_md_bytes = $sizes['report.md']; prompts_md_bytes = $sizes['prompts.md']
  stdout_bytes = $sizes['stdout.txt']; stderr_bytes = $sizes['stderr.txt']
}
$json = ($rec | ConvertTo-Json -Compress)
Write-Output $json
if ($ResultsJson -ne '') { Add-Content -Path $ResultsJson -Value $json }
