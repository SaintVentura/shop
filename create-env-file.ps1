# PowerShell script to create .env file
# Run this script: .\create-env-file.ps1

$envContent = @"
YOCO_SECRET_KEY=your_yoco_secret_key_here
PORT=3000
ZOHO_EMAIL=customersupport@saintventura.co.za
ZOHO_PASSWORD=your_zoho_app_password_here
"@

$envContent | Out-File -FilePath ".env" -Encoding utf8 -NoNewline
Write-Host ".env file created successfully!" -ForegroundColor Green



