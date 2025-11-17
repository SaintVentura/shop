# 🔐 Resend Domain Verification Setup

## Why Verify Your Domain?

Resend's free tier only allows sending test emails to your own email address. To send emails to `customersupport@saintventura.co.za` and other recipients, you need to verify your domain.

## ✅ Step-by-Step Domain Verification

### Step 1: Add Domain in Resend

1. Go to https://resend.com/domains
2. Click **"Add Domain"**
3. Enter: `saintventura.co.za`
4. Click **"Add Domain"**

### Step 2: Add DNS Records

Resend will show you DNS records to add. You need to add these to your domain's DNS settings:

**Example DNS Records (Resend will give you exact values):**

1. **SPF Record** (TXT):
   ```
   v=spf1 include:_spf.resend.com ~all
   ```

2. **DKIM Record** (TXT):
   ```
   (Resend will provide a long string here)
   ```

3. **DMARC Record** (TXT) - Optional but recommended:
   ```
   v=DMARC1; p=none; rua=mailto:dmarc@saintventura.co.za
   ```

### Step 3: Add DNS Records to Your Domain

1. Log into your domain registrar (where you bought `saintventura.co.za`)
2. Go to DNS Management / DNS Settings
3. Add the TXT records that Resend provided
4. Save changes

### Step 4: Wait for Verification

- DNS changes can take 5 minutes to 48 hours (usually 10-30 minutes)
- Check Resend dashboard - it will show "Verified" when ready
- You'll get an email when verification is complete

### Step 5: Update Environment Variable (Optional)

Once verified, you can optionally set a custom `from` email in Render:

1. Go to Render dashboard → Your service → Environment
2. Add environment variable:
   - **Key:** `RESEND_FROM_EMAIL`
   - **Value:** `Saint Ventura <noreply@saintventura.co.za>`
3. Save (will auto-redeploy)

**Note:** The code already uses `noreply@saintventura.co.za` by default, so this step is optional.

## 🎯 Quick Alternative (If DNS is Complex)

If you can't modify DNS right now, you can temporarily:

1. Use your verified email address (`neomashego@saintventura.co.za`) as the recipient
2. Or verify the domain properly (recommended)

## ✅ After Verification

Once your domain is verified:
- ✅ Can send to any email address
- ✅ Emails come from `@saintventura.co.za`
- ✅ Better email deliverability
- ✅ Professional appearance

## 🧪 Test After Verification

1. Try subscribing to newsletter on your website
2. Check `customersupport@saintventura.co.za` inbox
3. Check Render logs for: `✅ Email sent successfully via Resend API`

---

**Need Help?** If you're not sure how to add DNS records, contact your domain registrar's support or check their documentation.

