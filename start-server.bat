@echo off
echo Starting Saint Ventura Backend Server...
echo.

REM Check if PM2 is installed
where pm2 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo PM2 is not installed globally. Installing...
    npm install -g pm2
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to install PM2. Trying local installation...
        call npm install pm2 --save-optional
        call npx pm2 start ecosystem.config.js
        goto :end
    )
)

REM Check if PM2 process is already running
pm2 list | findstr "saint-ventura-backend" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Backend server is already running. Restarting...
    pm2 restart ecosystem.config.js
) else (
    echo Starting backend server...
    pm2 start ecosystem.config.js
)

REM Save PM2 process list
pm2 save

echo.
echo Backend server started successfully!
echo.
echo Useful commands:
echo   - View status: npm run pm2:status
echo   - View logs: npm run pm2:logs
echo   - Restart: npm run pm2:restart
echo   - Stop: npm run pm2:stop
echo.
echo Press any key to exit...
pause >nul

:end

