# 🚀 Complete Setup Instructions - Saint Ventura E-commerce

## ✅ What's Already Done

1. ✅ Backend server created (`server.js`)
2. ✅ Environment variables configured (`.env` file)
3. ✅ Yoco API keys added
4. ✅ Google Maps address autocomplete integrated (with fallback)
5. ✅ Frontend connected to backend
6. ✅ Success page created

## 📋 Step-by-Step Setup

### Step 1: Install Node.js (if not already installed)

Download and install from: https://nodejs.org/
- Choose the LTS version
- This will install both Node.js and npm

### Step 2: Install Backend Dependencies

Open terminal/command prompt in your project folder (`c:\Users\steve\SV`) and run:

```bash
npm install
```

This will install:
- express (web server)
- cors (cross-origin requests)
- axios (HTTP client)
- dotenv (environment variables)

### Step 3: Start the Backend Server

```bash
npm start
```

You should see:
```
🚀 Yoco Payment API Server running on port 3000
📍 Health check: http://localhost:3000/health
💳 Checkout endpoint: http://localhost:3000/api/create-yoco-checkout
```

**Keep this terminal window open** - the server needs to be running for payments to work.

### Step 4: Test the Integration

1. Open `index.html` in your browser
2. Add items to cart
3. Click "Proceed to Checkout"
4. Fill in customer details
5. Select delivery method
6. If "Door-to-Door Courier" is selected, the address form will appear
7. Start typing an address - you'll see autocomplete suggestions
8. Click "Proceed to Payment"
9. You'll be redirected to Yoco's payment page

## 🗺️ Google Maps API (Optional but Recommended)

The address autocomplete works with a fallback system:

### Without Google Maps API:
- ✅ Still works with built-in South African cities/suburbs list
- ✅ Manual address entry available

### With Google Maps API (Better Experience):
1. Get API key from: https://console.cloud.google.com/
2. Enable "Places API" in Google Cloud Console
3. In `checkout.html` line 9, uncomment and add your key:
   ```html
   <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_ACTUAL_API_KEY&libraries=places&components=country:za" async defer></script>
   ```

## 🌐 Deploying to Production

### Backend Deployment Options:

#### Option 1: Railway (Easiest)
1. Go to https://railway.app/
2. Sign up/login
3. Click "New Project" → "Deploy from GitHub repo"
4. Connect your repository
5. Add environment variable: `YOCO_SECRET_KEY=your_yoco_secret_key_here`
6. Deploy automatically

#### Option 2: Heroku
1. Install Heroku CLI
2. Run:
   ```bash
   heroku create your-app-name
   heroku config:set YOCO_SECRET_KEY=your_yoco_secret_key_here
   git push heroku main
   ```

#### Option 3: Your Own Server
1. Upload files to your server
2. Run `npm install`
3. Use PM2 to keep server running:
   ```bash
   npm install -g pm2
   pm2 start server.js
   pm2 save
   ```

### Update Frontend After Deployment

Once backend is deployed, update `checkout.html` line 138:

```javascript
backendUrl: 'https://your-deployed-backend.com/api/create-yoco-checkout'
```

## 🔒 Security Notes

- ✅ Secret key is stored in `.env` (not in code)
- ✅ `.env` is in `.gitignore` (won't be committed)
- ✅ Backend handles all sensitive operations
- ✅ Frontend only uses public key for display

## 🧪 Testing Checklist

- [ ] Backend server starts without errors
- [ ] Can add items to cart
- [ ] Cart totals calculate correctly
- [ ] Checkout form validates correctly
- [ ] Address autocomplete works (with or without Google Maps)
- [ ] Payment redirects to Yoco
- [ ] Success page displays after payment

## 🐛 Troubleshooting

**Backend won't start:**
- Check if port 3000 is available
- Verify Node.js is installed: `node --version`
- Check `.env` file exists and has correct format

**Payment fails:**
- Ensure backend server is running
- Check browser console for errors
- Verify Yoco keys are correct
- Check backend terminal for error messages

**Address autocomplete not working:**
- Check browser console for errors
- Fallback will work even without Google Maps API
- Try typing city names like "Johannesburg" or "Cape Town"

## 📞 Support

If you encounter issues:
1. Check the browser console (F12)
2. Check the backend terminal for errors
3. Verify all files are in the correct location

---

**You're all set!** 🎉 Start the backend server and test your payment flow!



