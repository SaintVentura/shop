# PowerShell script to start Saint Ventura Backend Server with PM2

Write-Host "Starting Saint Ventura Backend Server..." -ForegroundColor Green
Write-Host ""

# Check if PM2 is installed globally
try {
    $pm2Check = Get-Command pm2 -ErrorAction Stop
    Write-Host "PM2 found. Starting server..." -ForegroundColor Yellow
} catch {
    Write-Host "PM2 is not installed globally. Installing..." -ForegroundColor Yellow
    npm install -g pm2
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install PM2 globally. Trying local installation..." -ForegroundColor Yellow
        npm install pm2 --save-optional
        Write-Host "Starting server with local PM2..." -ForegroundColor Yellow
        npx pm2 start ecosystem.config.js
        npx pm2 save
        Write-Host "Backend server started!" -ForegroundColor Green
        exit
    }
}

# Check if server is already running
$pm2List = pm2 list 2>&1
if ($pm2List -match "saint-ventura-backend") {
    Write-Host "Backend server is already running. Restarting..." -ForegroundColor Yellow
    pm2 restart ecosystem.config.js
} else {
    Write-Host "Starting backend server..." -ForegroundColor Yellow
    pm2 start ecosystem.config.js
}

# Save PM2 process list
pm2 save

Write-Host ""
Write-Host "Backend server started successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "  - View status: npm run pm2:status"
Write-Host "  - View logs: npm run pm2:logs"
Write-Host "  - Restart: npm run pm2:restart"
Write-Host "  - Stop: npm run pm2:stop"
Write-Host ""

