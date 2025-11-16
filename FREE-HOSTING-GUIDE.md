# 🆓 Free Server Hosting Guide - Keep Your Backend Running

This guide explains the best **FREE** options to keep your backend server running 24/7.

## 🎯 Best Free Options

### Option 1: Railway (Recommended - Easiest)
**Free Tier:** $5 credit/month (usually enough for small projects)

**Pros:**
- ✅ Very easy to set up
- ✅ Auto-deploys from GitHub
- ✅ Good documentation
- ✅ Server wakes up automatically when needed
- ✅ No credit card required for free tier

**Cons:**
- ⚠️ Server sleeps after ~30 minutes of inactivity
- ⚠️ First request after sleep takes 10-30 seconds (cold start)
- ⚠️ Limited to $5/month credit (usually enough for 1-2 small projects)

**Setup Steps:**
1. Go to https://railway.app/
2. Sign up with GitHub (free)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `shop` repository
5. Railway auto-detects Node.js and deploys
6. Add environment variables:
   - Go to your project → "Variables" tab
   - Add:
     ```
     YOCO_SECRET_KEY=your_actual_key
     ZOHO_EMAIL=customersupport@saintventura.co.za
     ZOHO_PASSWORD=your_zoho_password
     PORT=3000
     NODE_ENV=production
     ```
7. Copy your Railway URL (e.g., `https://saint-ventura-backend-production.up.railway.app`)
8. Update frontend files with this URL (see below)

**Cost:** FREE (within $5/month credit limit)

---

### Option 2: Render
**Free Tier:** Always-on web services

**Pros:**
- ✅ Server stays running (doesn't sleep)
- ✅ Free tier available
- ✅ Auto-deploys from GitHub
- ✅ Good for always-on needs

**Cons:**
- ⚠️ Server may sleep after 15 minutes of inactivity (on free tier)
- ⚠️ First request after sleep takes 30-60 seconds
- ⚠️ Slower than Railway for cold starts
- ⚠️ May require credit card for some features

**Setup Steps:**
1. Go to https://render.com/
2. Sign up with GitHub (free)
3. Click "New" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Name:** `saint-ventura-backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
6. Add environment variables:
   ```
   YOCO_SECRET_KEY=your_actual_key
   ZOHO_EMAIL=customersupport@saintventura.co.za
   ZOHO_PASSWORD=your_zoho_password
   PORT=10000
   NODE_ENV=production
   ```
7. Click "Create Web Service"
8. Copy your Render URL (e.g., `https://saint-ventura-backend.onrender.com`)
9. Update frontend files with this URL

**Cost:** FREE (with limitations)

---

### Option 3: Fly.io
**Free Tier:** 3 shared-cpu VMs, 3GB persistent storage

**Pros:**
- ✅ More control
- ✅ Good performance
- ✅ Generous free tier

**Cons:**
- ⚠️ More complex setup
- ⚠️ Requires CLI installation
- ⚠️ More technical knowledge needed

**Setup:** More complex - see https://fly.io/docs/

---

## 🔄 How to Prevent Server Sleep (Free Methods)

### Method 1: Uptime Monitoring (Recommended)
Use a free uptime monitoring service to ping your server every 5-10 minutes:

**Services:**
- **UptimeRobot** (https://uptimerobot.com/) - Free tier: 50 monitors, checks every 5 minutes
- **Cron-Job.org** (https://cron-job.org/) - Free cron jobs
- **Pingdom** - Free tier available

**Setup UptimeRobot:**
1. Sign up at https://uptimerobot.com/ (free)
2. Click "Add New Monitor"
3. Monitor Type: HTTP(s)
4. URL: `https://your-backend-url.railway.app/health`
5. Monitoring Interval: 5 minutes
6. Click "Create Monitor"

This will ping your server every 5 minutes, keeping it awake!

---

### Method 2: Self-Ping Script (Advanced)
Create a simple script that pings your own server:

**Using Cron-Job.org:**
1. Go to https://cron-job.org/
2. Create account (free)
3. Add new cron job:
   - URL: `https://your-backend-url.railway.app/health`
   - Schedule: Every 5 minutes
   - Save

---

## 📝 After Deploying - Update Frontend URLs

Once you have your backend URL (from Railway or Render), update these 3 files:

### 1. `checkout.html` (Line ~150)
```javascript
const PRODUCTION_BACKEND_URL = 'https://your-actual-backend-url.railway.app/api/create-yoco-checkout';
```

### 2. `checkout-success.html` (Line ~106)
```javascript
const PRODUCTION_BACKEND_URL = 'https://your-actual-backend-url.railway.app';
```

### 3. `index.html` (Line ~3168)
```javascript
const PRODUCTION_BACKEND_URL = 'https://your-actual-backend-url.railway.app';
```

Then commit and push:
```bash
git add checkout.html checkout-success.html index.html
git commit -m "Update backend URLs for production"
git push origin main
```

---

## 💡 Recommendations

### For Best Free Experience:
1. **Use Railway** (easiest setup)
2. **Set up UptimeRobot** to ping `/health` every 5 minutes
3. **Result:** Server stays awake, always responsive!

### If You Need True Always-On:
- **Render Free Tier** - Better for always-on, but slower cold starts
- **Railway Pro** ($20/month) - True always-on, no sleep
- **DigitalOcean** ($5/month) - Full control, always-on

---

## ⚡ Quick Start (Railway + UptimeRobot)

1. **Deploy to Railway:**
   - Sign up: https://railway.app/
   - Deploy from GitHub
   - Add environment variables
   - Get your URL

2. **Keep it awake:**
   - Sign up: https://uptimerobot.com/
   - Monitor: `https://your-railway-url.railway.app/health`
   - Set to check every 5 minutes

3. **Update frontend:**
   - Update the 3 files with your Railway URL
   - Push to GitHub

4. **Done!** Your server will stay awake and be ready for customers! 🎉

---

## 🆓 Summary

**Best Free Setup:**
- ✅ Railway (hosting) + UptimeRobot (keep awake) = **100% FREE**
- ✅ Server stays responsive
- ✅ No cold starts for customers
- ✅ Easy to set up

**Cost:** $0/month

---

## 📞 Need Help?

- Railway Docs: https://docs.railway.app/
- Render Docs: https://render.com/docs
- UptimeRobot Docs: https://uptimerobot.com/api/

