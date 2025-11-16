# PowerShell script to set up PM2 to start on Windows boot
# Run this script as Administrator

Write-Host "Setting up PM2 to start on Windows boot..." -ForegroundColor Green
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Check if PM2 is installed
try {
    $pm2Check = Get-Command pm2 -ErrorAction Stop
} catch {
    Write-Host "PM2 is not installed. Installing globally..." -ForegroundColor Yellow
    npm install -g pm2
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install PM2. Please install it manually: npm install -g pm2" -ForegroundColor Red
        exit 1
    }
}

# Install PM2 Windows Startup
Write-Host "Installing PM2 Windows Startup..." -ForegroundColor Yellow
pm2 install pm2-windows-startup

# Start the server if not already running
$pm2List = pm2 list 2>&1
if (-not ($pm2List -match "saint-ventura-backend")) {
    Write-Host "Starting backend server..." -ForegroundColor Yellow
    pm2 start ecosystem.config.js
}

# Save PM2 process list
pm2 save

Write-Host ""
Write-Host "PM2 startup configured successfully!" -ForegroundColor Green
Write-Host "The backend server will now start automatically on Windows boot." -ForegroundColor Green
Write-Host ""
Write-Host "To verify, restart your computer and check: npm run pm2:status" -ForegroundColor Cyan
Write-Host ""

