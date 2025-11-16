# 🔄 Keep Server Always Active - Quick Setup

Your server is now configured with internal keep-alive, but for best results, also set up external monitoring.

## ✅ What's Already Done

1. **Internal Keep-Alive** - Server pings itself every 10 minutes (already in code)
2. **Keep-Alive Endpoint** - `/keep-alive` endpoint available for external pings

## 🚀 Recommended: Set Up UptimeRobot (Free)

UptimeRobot will ping your server every 5 minutes, keeping it awake 24/7.

### Step 1: Sign Up
1. Go to https://uptimerobot.com/
2. Sign up for free account (50 monitors free)

### Step 2: Add Monitor
1. Click **"Add New Monitor"**
2. Configure:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** Saint Ventura Backend
   - **URL:** `https://saint-ventura-backend.onrender.com/keep-alive`
   - **Monitoring Interval:** 5 minutes
   - **Alert Contacts:** (optional - add your email)
3. Click **"Create Monitor"**

### Step 3: Done!
Your server will now be pinged every 5 minutes and stay awake!

## 📊 Verify It's Working

1. **Check UptimeRobot Dashboard:**
   - Should show "UP" status
   - Green checkmark = server is active

2. **Check Render Logs:**
   - Go to Render dashboard → Your service → Logs
   - You should see: "Keep-alive ping received at: ..." every 5 minutes

3. **Test Manually:**
   - Visit: `https://saint-ventura-backend.onrender.com/keep-alive`
   - Should see: `{"status":"alive","message":"Server is active",...}`

## 🔧 Alternative: Cron-Job.org

If you prefer Cron-Job.org:

1. Go to https://cron-job.org/
2. Sign up (free)
3. Create new cron job:
   - **URL:** `https://saint-ventura-backend.onrender.com/keep-alive`
   - **Schedule:** Every 5 minutes
   - **Save**

## ⚡ Result

- ✅ Server stays awake 24/7
- ✅ No cold starts for customers
- ✅ Emails send immediately
- ✅ Forms respond instantly
- ✅ 100% FREE

---

**Note:** The internal keep-alive (every 10 minutes) is already active, but external monitoring (every 5 minutes) is recommended for best results.

