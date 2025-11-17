# 🔧 Troubleshooting Guide

## Issue 1: Emails Show as Sent But Don't Arrive

### Possible Causes:

1. **Domain Not Verified in Resend**
   - Resend only allows sending to your own email until domain is verified
   - **Solution:** Verify `saintventura.co.za` at https://resend.com/domains
   - See `RESEND-DOMAIN-SETUP.md` for detailed steps

2. **Emails Going to Spam**
   - Check spam/junk folder in `customersupport@saintventura.co.za`
   - Mark as "Not Spam" if found
   - Add `noreply@saintventura.co.za` to contacts

3. **Resend Free Tier Limit**
   - Free tier: 3,000 emails/month
   - Check Resend dashboard for usage
   - Upgrade if needed

### How to Check:

1. **Check Render Logs:**
   - Look for: `✅ Email sent successfully via Resend API. Message ID: re_...`
   - If you see this, email was sent successfully

2. **Check Resend Dashboard:**
   - Go to https://resend.com/emails
   - See delivery status for each email
   - Check if emails are "Delivered" or "Bounced"

3. **Check Email Inbox:**
   - Check spam folder
   - Check all folders in `customersupport@saintventura.co.za`

## Issue 2: Payment Page Doesn't Load

### Possible Causes:

1. **Backend Not Responding**
   - Check Render logs for errors
   - Verify backend is running: https://saint-ventura-backend.onrender.com/health

2. **Invalid Response from Yoco**
   - Check browser console (F12) for errors
   - Check Render logs for Yoco API errors

3. **Redirect URL Issue**
   - Yoco might have changed their checkout URL format
   - Check Render logs for the redirect URL being used

### How to Debug:

1. **Open Browser Console (F12):**
   - Click "Proceed to Payment"
   - Look for console logs:
     - `Sending checkout request to: ...`
     - `Response status: ...`
     - `Backend response: ...`
     - `Redirecting to Yoco: ...`

2. **Check Render Logs:**
   - Look for:
     - `Yoco API attempt 1/3`
     - `Checkout session created: ...`
     - `Redirect URL: ...`

3. **Test Backend Directly:**
   ```bash
   curl -X POST https://saint-ventura-backend.onrender.com/api/create-yoco-checkout \
     -H "Content-Type: application/json" \
     -d '{"amountInCents":10000,"currency":"ZAR","successUrl":"https://saintventura.co.za/checkout-success.html","cancelUrl":"https://saintventura.co.za/index.html#checkout"}'
   ```

### Common Errors:

- **"Failed to fetch"** → Backend not reachable, check Render status
- **"401 Unauthorized"** → Yoco API key issue
- **"400 Bad Request"** → Invalid request data
- **No redirect URL** → Yoco API response format changed

## Quick Fixes:

### For Emails:
1. Verify domain in Resend (if not done)
2. Check spam folder
3. Check Resend dashboard for delivery status

### For Payments:
1. Check browser console for errors
2. Check Render logs for Yoco API errors
3. Verify Yoco API key is correct in Render environment variables
4. Test backend health endpoint

---

**Still having issues?** Check the logs and share the error messages for more specific help.

