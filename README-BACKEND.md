# Saint Ventura - Yoco Payment Backend

Secure backend server for processing Yoco payments.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

The `.env` file is already created with your Yoco secret key. If you need to update it:

```bash
# Edit .env and add your configuration
YOCO_SECRET_KEY=your_yoco_secret_key_here
PORT=3000

# Newsletter Email Configuration (Zoho)
ZOHO_EMAIL=customersupport@saintventura.co.za
ZOHO_PASSWORD=your_zoho_app_password_here
```

**Note for Zoho Email Setup:**
- You need to create an **App Password** in your Zoho account (not your regular password)
- Go to Zoho Mail → Settings → Security → App Passwords
- Generate a new app password and use it for `ZOHO_PASSWORD`
- The email will be sent from and to `customersupport@saintventura.co.za`

### 3. Start the Server

**Option A: Development mode (with auto-reload):**
```bash
npm run dev
```

**Option B: Production mode (simple):**
```bash
npm start
```

**Option C: Production mode with PM2 (Recommended - Keeps server running 24/7):**
```bash
# Install PM2 globally (first time only)
npm install -g pm2

# Start server with PM2
npm run pm2:start

# Save PM2 process list
pm2 save
```

**For automatic startup on Windows boot, see `README-PM2-SETUP.md`**

The server will start on `http://localhost:3000`

## 📡 API Endpoints

### 1. Health Check
```
GET /health
```
Returns server status.

### 2. Create Checkout Session
```
POST /api/create-yoco-checkout
```
Creates a Yoco checkout session and returns the payment URL.

**Request Body:**
```json
{
  "amountInCents": 10000,
  "currency": "ZAR",
  "successUrl": "https://yourdomain.com/checkout-success.html",
  "cancelUrl": "https://yourdomain.com/checkout.html",
  "metadata": {
    "customerName": "John Doe",
    "customerEmail": "john@example.com"
  }
}
```

**Response:**
```json
{
  "success": true,
  "checkoutId": "checkout_id_here",
  "redirectUrl": "https://checkout.yoco.com/checkout_id_here"
}
```

### 3. Payment Status
```
GET /api/payment-status/:checkoutId
```
Get the status of a payment by checkout ID.

### 4. Newsletter Subscription
```
POST /api/newsletter-subscribe
```
Sends newsletter subscription requests via email to customersupport@saintventura.co.za.

**Request Body:**
```json
{
  "email": "customer@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription request sent successfully"
}
```

### 5. Webhook (for payment notifications)
```
POST /api/yoco-webhook
```
Receives payment notifications from Yoco. Configure this URL in your Yoco dashboard.

## 🔒 Security Features

- ✅ Secret key stored in environment variables (never exposed to frontend)
- ✅ CORS enabled for secure cross-origin requests
- ✅ Input validation on all endpoints
- ✅ Error handling with user-friendly messages

## 🌐 Deployment

### Option 1: Deploy to Heroku

1. Install Heroku CLI
2. Login: `heroku login`
3. Create app: `heroku create your-app-name`
4. Set environment variable:
   ```bash
   heroku config:set YOCO_SECRET_KEY=your_yoco_secret_key_here
   ```
5. Deploy: `git push heroku main`

### Option 2: Deploy to Railway

1. Connect your GitHub repo to Railway
2. Add environment variable `YOCO_SECRET_KEY`
3. Deploy automatically

### Option 3: Deploy to Vercel/Netlify Functions

Convert to serverless functions (requires code modification).

### Option 4: Deploy to Your Own Server

1. Install Node.js on your server
2. Clone repository
3. Install dependencies: `npm install`
4. Set up PM2 or similar process manager:
   ```bash
   npm install -g pm2
   pm2 start server.js --name yoco-api
   pm2 save
   pm2 startup
   ```

## 🔧 Update Frontend

After deploying, update `checkout.html` line 136:

```javascript
backendUrl: 'https://your-backend-url.com/api/create-yoco-checkout'
```

## 📝 Notes

- The secret key is already configured in `.env`
- Make sure to add `.env` to `.gitignore` (already done)
- For production, use HTTPS
- Configure webhook URL in Yoco dashboard: `https://your-backend-url.com/api/yoco-webhook`

## 🐛 Troubleshooting

**Server won't start:**
- Check if port 3000 is available
- Verify YOCO_SECRET_KEY is set in `.env`

**Payment creation fails:**
- Verify your Yoco secret key is correct
- Check Yoco dashboard for API status
- Review server logs for detailed error messages

**Newsletter subscription emails not sending:**
- Verify `ZOHO_EMAIL` and `ZOHO_PASSWORD` are set in `.env`
- Make sure you're using an App Password (not your regular Zoho password)
- Check server logs for email authentication errors
- Verify Zoho SMTP settings allow connections from your server IP



