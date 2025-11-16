# 🔍 Debugging Form Submission Issues

If forms aren't submitting on your GitHub Pages site, follow these steps:

## Step 1: Check Browser Console

1. Open your GitHub Pages site
2. Press **F12** to open Developer Tools
3. Go to the **Console** tab
4. Try submitting a form (newsletter or contact)
5. Look for these messages:

### Expected Console Messages:
```
Detecting backend URL for hostname: saintventura.github.io origin: https://saintventura.github.io
Detected GitHub Pages, using production backend: https://saint-ventura-backend.onrender.com
Newsletter subscription - Backend URL: https://saint-ventura-backend.onrender.com/api/newsletter-subscribe
Newsletter subscription - Email: test@example.com
```

### If you see errors:
- **"Failed to fetch"** = Cannot connect to Render backend
- **"CORS error"** = CORS configuration issue
- **"NetworkError"** = Network connectivity issue

## Step 2: Test Backend Connection

### Test 1: Health Check
Open in browser: `https://saint-ventura-backend.onrender.com/health`

**Expected response:**
```json
{
  "status": "ok",
  "message": "Yoco Payment API is running",
  "timestamp": "2024-...",
  "environment": "production"
}
```

### Test 2: Test Endpoint
Open in browser: `https://saint-ventura-backend.onrender.com/api/test`

**Expected response:**
```json
{
  "success": true,
  "message": "Backend is reachable",
  "backendUrl": "https://saint-ventura-backend.onrender.com",
  "timestamp": "2024-..."
}
```

## Step 3: Check Render Dashboard

1. Go to https://dashboard.render.com/
2. Click on your `saint-ventura-backend` service
3. Check **Logs** tab for errors
4. Check **Events** tab for deployment status

### Common Issues:

**Server Sleeping:**
- Render free tier servers sleep after 15 minutes of inactivity
- First request after sleep takes 30-60 seconds
- Solution: Use UptimeRobot to ping `/health` every 5 minutes

**Environment Variables Missing:**
- Check **Environment** tab in Render
- Ensure these are set:
  - `YOCO_SECRET_KEY`
  - `ZOHO_EMAIL`
  - `ZOHO_PASSWORD`
  - `PORT` (should be 10000 for Render, or let Render auto-assign)

**Deployment Failed:**
- Check **Logs** for build errors
- Common issues:
  - Missing `package.json`
  - Node.js version mismatch
  - Build command errors

## Step 4: Test from Browser Console

Open browser console on your GitHub Pages site and run:

```javascript
// Test backend detection
function getBackendBaseUrl() {
    const hostname = window.location.hostname;
    const origin = window.location.origin;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
        return 'http://localhost:3000';
    }
    
    const PRODUCTION_BACKEND_URL = 'https://saint-ventura-backend.onrender.com';
    
    if (hostname.includes('github.io') || hostname.includes('github.com') || origin.includes('github.io') || origin.includes('github.com')) {
        return PRODUCTION_BACKEND_URL;
    }
    
    return PRODUCTION_BACKEND_URL;
}

// Test connection
fetch(`${getBackendBaseUrl()}/api/test`)
  .then(r => r.json())
  .then(data => console.log('✅ Backend is reachable:', data))
  .catch(err => console.error('❌ Backend connection failed:', err));
```

## Step 5: Check Network Tab

1. Open Developer Tools (F12)
2. Go to **Network** tab
3. Try submitting a form
4. Look for the request to `saint-ventura-backend.onrender.com`
5. Check:
   - **Status Code**: Should be 200 (success) or 400/500 (error)
   - **Request URL**: Should be `https://saint-ventura-backend.onrender.com/api/...`
   - **Response**: Click on the request to see response

## Common Solutions

### Issue: "Failed to fetch"
**Solution:**
- Render server might be sleeping - wait 30-60 seconds and try again
- Check Render dashboard to ensure service is running
- Set up UptimeRobot to keep server awake

### Issue: CORS Error
**Solution:**
- Already fixed in latest code
- Make sure you've deployed the latest `server.js` to Render
- Check Render logs to confirm server restarted

### Issue: Forms work locally but not on GitHub Pages
**Solution:**
- Check console logs to see which backend URL is being used
- Verify GitHub Pages URL detection is working
- Make sure `PRODUCTION_BACKEND_URL` is set correctly

### Issue: Server responds but forms still fail
**Solution:**
- Check Render logs for backend errors
- Verify environment variables are set correctly
- Check if Zoho email credentials are correct

## Quick Fix: Keep Server Awake

1. Sign up at https://uptimerobot.com/ (free)
2. Add new monitor:
   - Type: HTTP(s)
   - URL: `https://saint-ventura-backend.onrender.com/health`
   - Interval: 5 minutes
3. This will ping your server every 5 minutes, keeping it awake

## Still Not Working?

1. Check Render logs for specific error messages
2. Test backend endpoints directly in browser
3. Check browser console for exact error messages
4. Verify all environment variables are set in Render
5. Make sure latest code is deployed to both GitHub and Render

---

**Remember:** After making changes to `server.js`, you need to:
1. Commit and push to GitHub
2. Render will auto-deploy (or manually trigger deployment)
3. Wait 2-3 minutes for deployment to complete

