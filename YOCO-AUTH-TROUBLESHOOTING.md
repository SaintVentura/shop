# Yoco API Authentication Troubleshooting

## Current Error
**Status:** 401 Unauthorized  
**Message:** "The provided credentials are invalid."

## Possible Causes & Solutions

### 1. API Key Format Issues

**Check your API key:**
- Should start with `sk_live_` for live transactions
- Should start with `sk_test_` for test transactions
- Should be the full key without any extra spaces or quotes

**Your current key format:**
```
your_yoco_secret_key_here
```

### 2. Verify API Key in Yoco Dashboard

1. Log into your Yoco account
2. Go to Settings → API Keys
3. Verify that your live secret key matches exactly what's in your `.env` file
4. Make sure you're copying the **Secret Key** (not the Public Key)

### 3. Common Issues

**Issue:** Key has extra spaces or quotes
- **Solution:** Remove any quotes or spaces around the key in `.env` file
- Format should be: `YOCO_SECRET_KEY=your_yoco_secret_key_here` (no quotes needed)

**Issue:** Using test key for live transactions
- **Solution:** Make sure you're using a live key (starts with `sk_live_`) for production

**Issue:** Key is truncated or incomplete
- **Solution:** Copy the full key from Yoco dashboard

**Issue:** Key is for a different Yoco account
- **Solution:** Verify you're using keys from the correct Yoco account

### 4. Test Your API Key

You can test if your API key works by making a simple request:

```bash
curl -X POST https://api.yoco.com/v1/checkouts \
  -H "Authorization: Bearer YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "currency": "ZAR",
    "successUrl": "https://example.com/success",
    "cancelUrl": "https://example.com/cancel"
  }'
```

### 5. Contact Yoco Support

If none of the above works, contact Yoco support:

1. **Email:** support@yoco.com
2. **Phone:** Check Yoco website for support number
3. **Dashboard:** Use the support/help section in your Yoco dashboard

**Information to provide:**
- Your Yoco account email
- Error message: "401 Unauthorized - The provided credentials are invalid"
- API endpoint: `https://api.yoco.com/v1/checkouts`
- That you're using Bearer token authentication
- Request them to verify your API key is active and has correct permissions

### 6. Check Server Logs

View detailed error logs:
```bash
npm run pm2:logs
```

Look for:
- API key format in logs
- Exact error message from Yoco
- Request URL being used

## Next Steps

1. ✅ Verify API key in Yoco dashboard
2. ✅ Check `.env` file for correct format (no quotes, no spaces)
3. ✅ Restart server: `npm run pm2:restart`
4. ✅ Test payment again
5. ✅ If still failing, contact Yoco support with the error details

