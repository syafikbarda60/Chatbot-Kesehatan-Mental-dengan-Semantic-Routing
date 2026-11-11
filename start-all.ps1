# Starts the whole Sajiwa stack on this laptop: database + migrations, Ollama, backend,
# dashboard and Expo, each app in its own window so its log stays readable.
# Double-click start-all.cmd, or: powershell -ExecutionPolicy Bypass -File start-all.ps1
# Safe to run again: anything already listening on its port is left alone.
Set-Location $PSScriptRoot
$root = $PSScriptRoot

function Listening($port) {
  $c = New-Object Net.Sockets.TcpClient
  try { $c.Connect('127.0.0.1', $port); $true } catch { $false } finally { $c.Close() }
}

function Window($title, $dir, $command) {
  Start-Process powershell -WorkingDirectory $dir -ArgumentList '-NoExit', '-Command', "`$host.UI.RawUI.WindowTitle = '$title'; $command"
}

# 1. Database (Docker Desktop must be running first)
cmd /c "docker info >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Menyalakan Docker Desktop...'
  Start-Process "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
  $deadline = (Get-Date).AddMinutes(3)
  do { Start-Sleep 3; cmd /c "docker info >nul 2>&1" } until ($LASTEXITCODE -eq 0 -or (Get-Date) -gt $deadline)
  if ($LASTEXITCODE -ne 0) { Write-Host 'Docker Desktop belum siap setelah 3 menit. Buka manual lalu jalankan lagi.' -ForegroundColor Red; exit 1 }
}
Write-Host 'Database + migrasi...'
# migrate waits for a healthy db, applies new migrations, then exits; pgAdmin is skipped to save RAM
docker compose up migrate
if ($LASTEXITCODE -ne 0) { Write-Host 'Migrasi gagal, lihat log di atas.' -ForegroundColor Red; exit 1 }

# 2. Ollama (the chatbot's model)
if (-not (Listening 11434)) {
  $ollama = (Get-Command ollama -ErrorAction SilentlyContinue).Source
  if (-not $ollama) { $ollama = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" }
  if (Test-Path $ollama) { Start-Process $ollama 'serve' -WindowStyle Hidden }
  else { Write-Host 'Ollama tidak ditemukan: aplikasi jalan, tapi chatbot tidak bisa membalas.' -ForegroundColor Yellow }
}

# 3. The laptop's Wi-Fi address, which the phone uses to reach the backend
$ip = @(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' })[0].IPv4Address.IPAddress
if (-not $ip) { $ip = 'localhost'; Write-Host 'Tidak terhubung ke jaringan: HP tidak akan bisa terhubung.' -ForegroundColor Yellow }
$envFile = "$root\apps\mobile\.env"
$line = "EXPO_PUBLIC_API_URL=http://${ip}:8000"
$text = if (Test-Path $envFile) { [IO.File]::ReadAllText($envFile) } else { '' }
if ($text -match '(?m)^EXPO_PUBLIC_API_URL=') { $text = $text -replace '(?m)^EXPO_PUBLIC_API_URL=[^\r\n]*', $line }
else { $text = $text.TrimEnd() + "`r`n$line`r`n" }
[IO.File]::WriteAllText($envFile, $text)

# 4. Backend, on all interfaces so the phone can reach it
if (-not (Listening 8000)) {
  $py = @("$root\.venv\Scripts\python.exe", "$root\apps\backend\venv\Scripts\python.exe", "$root\apps\backend\.venv\Scripts\python.exe") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $py) { Write-Host 'Virtualenv Python tidak ditemukan (.venv atau apps\backend\venv).' -ForegroundColor Red; exit 1 }
  Window 'Sajiwa backend' "$root\apps\backend" "& '$py' -m uvicorn main:app --host 0.0.0.0 --port 8000"
}

# 5. Dashboard
if (-not (Listening 3000)) { Window 'Sajiwa dashboard' "$root\apps\dashboard" 'npm run dev' }

# 6. Expo; --clear so the app picks up the address written above
if (-not (Listening 8081)) { Window 'Sajiwa Expo' "$root\apps\mobile" 'npx expo start --lan --clear' }

Write-Host ''
Write-Host 'Sajiwa jalan:' -ForegroundColor Green
Write-Host "  Dashboard : http://localhost:3000"
Write-Host "  Backend   : http://${ip}:8000/docs"
Write-Host "  Mobile    : scan QR di jendela 'Sajiwa Expo' pakai Expo Go (exp://${ip}:8081)"
Write-Host '  HP harus satu Wi-Fi dengan laptop. Tutup jendela-jendelanya untuk berhenti.'
