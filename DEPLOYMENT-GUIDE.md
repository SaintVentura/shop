# 🚀 Complete Deployment Guide - Always-On Server

This guide will help you deploy your Saint Ventura website so it's always accessible online, with the backend server always running.

## 📋 Overview

Your website has two parts:
1. **Frontend** (HTML, CSS, JavaScript) - Can be hosted on GitHub Pages (free)
2. **Backend** (Node.js server) - Needs a hosting service that runs 24/7

## 🎯 Quick Start - Recommended: Railway (Easiest & Free)

Railway is the easiest option with a free tier that keeps your server running.

### Step 1: Deploy Backend to Railway

1. **Sign up for Railway:**
   - Go to https://railway.app/
   - Click "Start a New Project"
   - Sign up with GitHub (recommended)

2. **Connect Your Repository:**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your `shop` repository
   - Railway will automatically detect it's a Node.js project

3. **Configure Environment Variables:**
   - Click on your project
   - Go to "Variables" tab
   - Add these environment variables:
     ```
     YOCO_SECRET_KEY=your_actual_yoco_secret_key
     ZOHO_EMAIL=customersupport@saintventura.co.za
     ZOHO_PASSWORD=your_actual_zoho_app_password
     PORT=3000
     NODE_ENV=production
     ```

4. **Deploy:**
   - Railway will automatically deploy when you push to GitHub
   - Wait for deployment to complete (2-3 minutes)
   - Railway will give you a URL like: `https://saint-ventura-backend.railway.app`

5. **Get Your Backend URL:**
   - In Railway dashboard, click on your service
   - Copy the "Public Domain" URL
   - It will look like: `https://saint-ventura-backend-production.up.railway.app`

### Step 2: Update Frontend with Backend URL

1. **Update `checkout.html`:**
   - Open `checkout.html`
   - Find the line with `PRODUCTION_BACKEND_URL`
   - Replace `'https://your-backend-url.railway.app/api/create-yoco-checkout'` with your actual Railway URL
   - Example: `'https://saint-ventura-backend-production.up.railway.app/api/create-yoco-checkout'`

2. **Update `checkout-success.html`:**
   - Open `checkout-success.html`
   - Find the line with `PRODUCTION_BACKEND_URL`
   - Replace `'https://your-backend-url.railway.app'` with your actual Railway URL (without `/api/...`)
   - Example: `'https://saint-ventura-backend-production.up.railway.app'`

3. **Commit and Push:**
   ```bash
   git add checkout.html checkout-success.html
   git commit -m "Update backend URLs for production"
   git push origin main
   ```

### Step 3: Deploy Frontend to GitHub Pages

1. **Enable GitHub Pages:**
   - Go to your GitHub repository: https://github.com/SaintVentura/shop
   - Click "Settings" → "Pages"
   - Under "Source", select "Deploy from a branch"
   - Select branch: `main`
   - Select folder: `/ (root)`
   - Click "Save"

2. **Get Your Website URL:**
   - GitHub will give you a URL like: `https://saintventura.github.io/shop/`
   - Your website will be live at this URL!

3. **Update Yoco Success/Cancel URLs (if needed):**
   - If your GitHub Pages URL is different, update the `PRODUCTION_DOMAIN` in `checkout.html`
   - Find: `const PRODUCTION_DOMAIN = 'https://saintventura.co.za';`
   - Replace with your GitHub Pages URL: `const PRODUCTION_DOMAIN = 'https://saintventura.github.io/shop';`

## 🔄 Alternative: Render (Free Tier)

Render also offers free hosting with always-on servers.

### Step 1: Deploy Backend to Render

1. **Sign up for Render:**
   - Go to https://render.com/
   - Sign up with GitHub

2. **Create New Web Service:**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Select your `shop` repository

3. **Configure Service:**
   - **Name:** `saint-ventura-backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free

4. **Add Environment Variables:**
   - Click "Environment" tab
   - Add:
     ```
     YOCO_SECRET_KEY=your_actual_yoco_secret_key
     ZOHO_EMAIL=customersupport@saintventura.co.za
     ZOHO_PASSWORD=your_actual_zoho_app_password
     PORT=10000
     NODE_ENV=production
     ```

5. **Deploy:**
   - Click "Create Web Service"
   - Render will deploy automatically
   - Your backend URL will be: `https://saint-ventura-backend.onrender.com`

6. **Update Frontend URLs:**
   - Update `checkout.html` and `checkout-success.html` with your Render URL
   - Replace Railway URLs with: `https://saint-ventura-backend.onrender.com`

## 📝 Important Notes

### Free Tier Limitations:

**Railway:**
- Free tier includes $5 credit/month
- Server sleeps after inactivity (wakes up on first request)
- First request after sleep may take 10-30 seconds

**Render:**
- Free tier keeps server running but may sleep after 15 minutes of inactivity
- First request after sleep may take 30-60 seconds
- Consider upgrading to paid plan for always-on service

### For Production (Recommended):

For a real e-commerce site, consider:
- **Railway Pro** ($20/month) - Always-on, no sleep
- **Render Paid** ($7/month) - Always-on, faster
- **DigitalOcean** ($5/month) - Full control
- **AWS/Azure** - Enterprise solutions

## ✅ Testing Your Deployment

1. **Test Backend:**
   - Visit: `https://your-backend-url.railway.app/health`
   - Should see: `{"status":"ok","message":"Yoco Payment API is running"}`

2. **Test Frontend:**
   - Visit your GitHub Pages URL
   - Try adding items to cart
   - Try newsletter subscription
   - Try checkout process

3. **Check Logs:**
   - Railway: Dashboard → Your Service → Logs
   - Render: Dashboard → Your Service → Logs

## 🔧 Troubleshooting

### Backend Not Responding:
- Check Railway/Render dashboard for errors
- Verify environment variables are set correctly
- Check logs for error messages
- Ensure `PORT` environment variable matches service requirements

### Frontend Can't Connect to Backend:
- Verify backend URL in `checkout.html` is correct
- Check CORS settings (already configured in `server.js`)
- Test backend health endpoint directly
- Check browser console for errors

### Payment Not Working:
- Verify `YOCO_SECRET_KEY` is set correctly
- Check that success/cancel URLs use HTTPS
- Verify backend is running (check health endpoint)
- Check Yoco dashboard for payment attempts

## 🎉 You're Done!

Once deployed:
- ✅ Backend runs 24/7 (or wakes up automatically)
- ✅ Frontend is accessible via GitHub Pages
- ✅ Customers can use your website from anywhere
- ✅ Payments, emails, and all features work online

## 📞 Need Help?

- Railway Docs: https://docs.railway.app/
- Render Docs: https://render.com/docs
- GitHub Pages Docs: https://docs.github.com/pages

---

**Remember:** After deploying, update the `PRODUCTION_BACKEND_URL` in both `checkout.html` and `checkout-success.html` with your actual backend URL!

