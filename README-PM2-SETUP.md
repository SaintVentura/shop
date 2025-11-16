# PM2 Setup Guide - Keep Backend Always Running

This guide will help you set up PM2 to keep your backend server running 24/7, even after computer restarts.

## 🚀 Quick Start

### Option 1: Simple Start (Manual - Recommended for first time)

1. **Install PM2 globally:**
   ```bash
   npm install -g pm2
   ```

2. **Start the server:**
   ```bash
   npm run pm2:start
   ```
   Or double-click `start-server.bat` (Windows) or run `start-server.ps1` (PowerShell)

3. **Save PM2 process list:**
   ```bash
   pm2 save
   ```

### Option 2: Automatic Startup on Windows Boot

1. **Run the setup script as Administrator:**
   - Right-click `setup-pm2-startup.ps1`
   - Select "Run with PowerShell" (as Administrator)
   - Or open PowerShell as Admin and run:
     ```powershell
     .\setup-pm2-startup.ps1
     ```

2. **The server will now start automatically on Windows boot!**

## 📋 Available Commands

```bash
# Start the server
npm run pm2:start
# or
pm2 start ecosystem.config.js

# Stop the server
npm run pm2:stop
# or
pm2 stop ecosystem.config.js

# Restart the server
npm run pm2:restart
# or
pm2 restart ecosystem.config.js

# View server status
npm run pm2:status
# or
pm2 status

# View logs (real-time)
npm run pm2:logs
# or
pm2 logs ecosystem.config.js

# Delete the process
npm run pm2:delete
# or
pm2 delete ecosystem.config.js
```

## 🔍 Monitoring

### Check if server is running:
```bash
npm run pm2:status
```

You should see `saint-ventura-backend` with status `online`.

### View logs:
```bash
npm run pm2:logs
```

Logs are also saved to:
- `./logs/pm2-out.log` (standard output)
- `./logs/pm2-error.log` (errors)

## 🔄 Auto-Restart Features

PM2 automatically:
- ✅ Restarts the server if it crashes
- ✅ Restarts the server if it uses too much memory (>1GB)
- ✅ Keeps the server running after you close the terminal
- ✅ Can start on Windows boot (if configured)

## 🛠️ Troubleshooting

### Server won't start:
1. Check if port 3000 is already in use:
   ```bash
   netstat -ano | findstr :3000
   ```
2. Check PM2 logs:
   ```bash
   npm run pm2:logs
   ```
3. Check if .env file exists and has correct values

### Server keeps stopping:
1. Check logs for errors:
   ```bash
   npm run pm2:logs
   ```
2. Verify your .env file has all required variables:
   - `YOCO_SECRET_KEY`
   - `ZOHO_EMAIL`
   - `ZOHO_PASSWORD`
   - `PORT`

### PM2 not found:
```bash
npm install -g pm2
```

### Remove PM2 startup (if needed):
```bash
pm2 uninstall pm2-windows-startup
```

## 📝 Notes

- The server runs in the background - you can close the terminal
- Logs are automatically saved to the `logs/` folder
- To stop the server completely, use `npm run pm2:stop`
- The server will restart automatically if it crashes
- For production, make sure to set up the startup script so it runs on boot

## 🔐 Security

- Never commit your `.env` file (already in `.gitignore`)
- Keep your PM2 process list secure
- Use strong passwords for your email service

