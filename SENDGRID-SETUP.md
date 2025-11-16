# 📧 SendGrid Email Setup Guide (RECOMMENDED)

## Why SendGrid?

SendGrid is **the most reliable** email service for cloud platforms like Render. It's used by major companies and has excellent free tier support.

## ✅ Quick Setup (5 minutes)

### Step 1: Sign Up for SendGrid (Free)

1. Go to https://signup.sendgrid.com/
2. Click **"Start for Free"**
3. Fill in your details:
   - **Email:** Use your business email
   - **Company:** Saint Ventura
   - **Use case:** Transactional emails
4. Verify your email address

### Step 2: Verify Your Sender Email

1. After logging in, go to **Settings** → **Sender Authentication**
2. Click **"Verify a Single Sender"**
3. Fill in:
   - **From Email Address:** `customersupport@saintventura.co.za`
   - **From Name:** Saint Ventura
   - **Reply To:** `customersupport@saintventura.co.za`
   - **Company Address:** Your business address
4. Click **"Create"**
5. **Check your email** and click the verification link

### Step 3: Create API Key

1. Go to **Settings** → **API Keys**
2. Click **"Create API Key"**
3. Name it: `Saint Ventura Production`
4. Select **"Full Access"** (or "Restricted Access" with Mail Send permissions)
5. Click **"Create & View"**
6. **Copy the API key immediately** (you won't see it again!)
   - It starts with `SG.`

### Step 4: Add to Render Environment Variables

1. Go to https://dashboard.render.com/
2. Click your `saint-ventura-backend` service
3. Go to **Environment** tab
4. Click **"Add Environment Variable"**
5. Add:
   - **Key:** `SENDGRID_API_KEY`
   - **Value:** Your API key (starts with `SG.`)
6. Click **"Save Changes"**

### Step 5: Deploy

Render will automatically redeploy. Wait 2-3 minutes.

### Step 6: Test

Try subscribing to the newsletter on your website. It should work immediately!

## 📊 SendGrid Free Tier

- **100 emails/day** - Perfect for starting out
- **No credit card required**
- **Works on all hosting platforms** (Render, Railway, Heroku, etc.)
- **Very reliable** - used by major companies

## 🎯 How It Works

The server now tries email services in this order:
1. **SendGrid** (if `SENDGRID_API_KEY` is set) ✅ **RECOMMENDED**
2. **Resend** (if `RESEND_API_KEY` is set)
3. **SMTP/Zoho** (fallback, may not work on Render)

## 🧪 Test Email Endpoint

After setup, test it:

```bash
curl -X POST https://saint-ventura-backend.onrender.com/api/test-email \
  -H "Content-Type: application/json"
```

Or check Render logs to see:
- `✅ Email sent via SendGrid API` (success!)

## 🔐 Domain Authentication (Optional - Later)

For production, you can verify your entire domain:
1. Go to **Settings** → **Sender Authentication**
2. Click **"Authenticate Your Domain"**
3. Add DNS records to your domain
4. This allows sending from any email on your domain

---

**That's it!** SendGrid is the most reliable option and will work immediately on Render! 🎉

