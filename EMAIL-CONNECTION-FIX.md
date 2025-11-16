# 🔧 Email Connection Timeout Fix

## ✅ What Was Fixed

The server now automatically tries **both SMTP ports** for Zoho:
1. **Port 465 (SSL)** - Primary attempt
2. **Port 587 (STARTTLS)** - Fallback if 465 fails

This should resolve the `ETIMEDOUT` connection errors.

## 🔍 If Emails Still Don't Work

### Issue: Render Blocks Outbound SMTP

Some hosting providers (including Render's free tier) may block outbound SMTP connections. If both ports fail, you have these options:

### Option 1: Use Zoho Mail API (Recommended)
Zoho has a REST API that might work better than SMTP:

1. Go to https://api-console.zoho.com/
2. Create a new application
3. Get API credentials
4. Use Zoho Mail API instead of SMTP

### Option 2: Use Alternative Email Service

**SendGrid (Free Tier):**
- 100 emails/day free
- Better for hosting providers
- More reliable SMTP

**Mailgun (Free Tier):**
- 5,000 emails/month free
- Great API and SMTP

**Resend (Free Tier):**
- 3,000 emails/month free
- Modern API

### Option 3: Use Render's Email Service
- Render might have built-in email service
- Check Render dashboard for email options

## 🧪 Test Email Connection

After deployment, test the email endpoint:

```bash
curl -X POST https://saint-ventura-backend.onrender.com/api/test-email \
  -H "Content-Type: application/json"
```

Or in browser console:
```javascript
fetch('https://saint-ventura-backend.onrender.com/api/test-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
.then(r => r.json())
.then(console.log);
```

## 📊 Check Render Logs

1. Go to https://dashboard.render.com/
2. Click `saint-ventura-backend`
3. Go to **Logs** tab
4. Look for:
   - `✅ Email server connection verified using port 465` (success)
   - `⚠️ Port 465 failed, trying next...` (trying 587)
   - `❌ All SMTP ports failed` (both failed - need alternative)

## 🔑 Verify Zoho Credentials

Make sure in Render → Environment Variables:
- `ZOHO_EMAIL` = `customersupport@saintventura.co.za`
- `ZOHO_PASSWORD` = Your **App Password** (not regular password)

**To get App Password:**
1. Log into Zoho Mail
2. Go to Settings → Security → App Passwords
3. Generate new app password
4. Use that password (not your regular password)

## 🚀 Next Steps

1. **Wait for deployment** (2-3 minutes after push)
2. **Test email endpoint** using the command above
3. **Check Render logs** to see which port works
4. **If both ports fail**, consider alternative email service

---

**The code now tries both ports automatically!** Check Render logs after deployment to see which port works.

