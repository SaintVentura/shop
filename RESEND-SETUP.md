# 📧 Resend Email Setup Guide

## Why Resend?

Render's free tier **blocks outbound SMTP connections**, which is why Zoho SMTP (ports 465 and 587) are timing out. **Resend** uses an API-based approach that works on all hosting platforms.

## ✅ Quick Setup (5 minutes)

### Step 1: Sign Up for Resend (Free)

1. Go to https://resend.com
2. Click **"Sign Up"** (free account)
3. Verify your email

### Step 2: Get Your API Key

1. After logging in, go to **API Keys** in the sidebar
2. Click **"Create API Key"**
3. Name it: `Saint Ventura Production`
4. Copy the API key (starts with `re_...`)

### Step 3: Add to Render Environment Variables

1. Go to https://dashboard.render.com/
2. Click your `saint-ventura-backend` service
3. Go to **Environment** tab
4. Click **"Add Environment Variable"**
5. Add:
   - **Key:** `RESEND_API_KEY`
   - **Value:** Your API key (starts with `re_...`)
6. Click **"Save Changes"**

### Step 4: Deploy

Render will automatically redeploy. Wait 2-3 minutes.

### Step 5: Test

Try subscribing to the newsletter on your website. It should work immediately!

## 📊 Resend Free Tier

- **3,000 emails/month** - Perfect for starting out
- **No credit card required**
- **Works on all hosting platforms** (Render, Railway, Heroku, etc.)

## 🔐 Domain Verification (Optional)

By default, emails will be sent from `onboarding@resend.dev`. To use your own domain (`@saintventura.co.za`):

1. In Resend dashboard, go to **Domains**
2. Click **"Add Domain"**
3. Enter: `saintventura.co.za`
4. Add the DNS records they provide to your domain
5. Wait for verification (usually 5-10 minutes)
6. Update `server.js` line 74 to use your domain:
   ```javascript
   from: 'Saint Ventura <noreply@saintventura.co.za>',
   ```

## 🎯 How It Works

The server now:
1. **First tries Resend** (if `RESEND_API_KEY` is set) ✅
2. **Falls back to SMTP** (if Resend fails or not configured)

This means:
- ✅ Works immediately on Render with Resend
- ✅ Still works locally with Zoho SMTP
- ✅ Automatic fallback if one fails

## 🧪 Test Email Endpoint

After setup, test it:

```bash
curl -X POST https://saint-ventura-backend.onrender.com/api/test-email \
  -H "Content-Type: application/json"
```

Or check Render logs to see:
- `✅ Email sent via Resend API: re_...` (success!)

---

**That's it!** Your emails will now work reliably on Render! 🎉

