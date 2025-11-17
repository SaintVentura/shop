# ✅ Testing Your Email Setup

## Step 1: Wait for Render to Redeploy

After adding `RESEND_API_KEY` to Render:
- Render should automatically redeploy (usually takes 2-3 minutes)
- Check your Render dashboard to see if deployment is complete
- Status should show "Live" when ready

## Step 2: Test the Email Endpoint

Once deployed, test it using one of these methods:

### Option A: Test via Browser/Postman
Visit or POST to:
```
https://saint-ventura-backend.onrender.com/api/test-email
```

### Option B: Test via Newsletter Subscription
1. Go to your website
2. Scroll to the newsletter section
3. Enter an email and click "Subscribe"
4. Check Render logs to see if email was sent

### Option C: Test via Contact Form
1. Go to your website's contact section
2. Fill out and submit the contact form
3. Check Render logs to see if email was sent

## Step 3: Check Render Logs

1. Go to https://dashboard.render.com/
2. Click your `saint-ventura-backend` service
3. Click the **"Logs"** tab
4. Look for one of these messages:

**✅ Success:**
```
✅ Email sent successfully to customersupport@saintventura.co.za via Resend API. Message ID: re_...
```

**❌ If you see errors:**
- Check that `RESEND_API_KEY` is correctly set in Render
- Make sure the API key starts with `re_`
- Verify there are no extra spaces in the environment variable

## Step 4: Check Your Email Inbox

Check `customersupport@saintventura.co.za` inbox for:
- Newsletter subscription emails
- Contact form submissions
- Order confirmations

## Troubleshooting

If emails still don't work:

1. **Check API Key Format:**
   - Should start with `re_`
   - No quotes or spaces
   - Full key copied from Resend dashboard

2. **Check Render Logs:**
   - Look for "Resend API error" messages
   - Check if it's falling back to SMTP

3. **Verify Resend Account:**
   - Make sure your Resend account is verified
   - Check if you've hit the free tier limit (3,000/month)

4. **Force Redeploy:**
   - In Render dashboard, click "Manual Deploy"
   - Select "Deploy latest commit"

## Expected Behavior

Once working, you should see in logs:
- `✅ Email sent successfully to customersupport@saintventura.co.za via Resend API`
- No more "Connection timeout" errors
- Fast response times (emails send in background)

---

**That's it!** Your emails should now work reliably on Render! 🎉

