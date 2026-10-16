# Handoff Summary: Google Sheets Webhook Integration Debugging

**Date:** 2026-07-04  
**Status:** INCOMPLETE - Still not working

---

## Goal
Complete end-to-end integration so that when users submit the pop-up order form on the barefoot-shoes-app (Vercel deployment), the order data is automatically appended to the Google Sheet "הזמנות" tab via a webhook.

---

## What Works
- Vercel app is deployed at `https://barefoot-shoes-app.vercel.app` with slug "barefoot"
- Frontend form submission POSTs to `/api/orders` endpoint successfully
- Orders are created locally with ID format (e.g., ORD-169240)
- Apps Script Web App is deployed and has the correct doPost function
- Apps Script logs show that doPost is being called

---

## Issues Identified

### Issue 1: Webhook URL Not Persisting (KV Storage Problem)
**Symptom:** After registering webhook URL via curl, subsequent GET requests to `/api/google-sheets/config?passcode=1234` return empty `webhookUrl`

**Root Cause:** Vercel serverless functions have ephemeral storage. Local file writes don't persist between invocations.

**Solution Attempted:**
- Set up Upstash Redis integration in Vercel
- Added environment variables to Vercel (Production & Preview environments only):
  - `KV_REST_API_URL`: The Redis connection URL
  - `KV_REST_API_TOKEN`: The authentication token (password from Redis URL)
- Redeployed the app

**Current Status:** STILL NOT WORKING
- When we tested `/api/google-sheets/config?passcode=1234` today, it returned empty webhookUrl
- This indicates the KV storage is still not connecting properly

### Issue 2: Apps Script doPost Receives Undefined Event Parameter
**Symptom:** Apps Script logs showed `doPost called. e exists: false`

**Impact:** Even if webhook URL is registered, the order data isn't being received by Apps Script

**Attempted Fix:** Added validation in Apps Script to check if `e` and `e.postData` exist before accessing them
- Code was updated and redeployed to new URL: `https://script.google.com/macros/s/AKfycbz8VkHVHRYWier_BUqq3LmDsqwwuph4d_O4IlwNeivJac9GoJUi1pVoDLDLErgIWxEB/exec`

**Current Status:** Needs re-testing once webhook URL persists

### Issue 3: Google Sheet Not Receiving Orders
**Symptom:** No new rows appear in "הזמנות" sheet when forms are submitted

**Root Causes:**
1. Webhook URL not persisting (Issue 1)
2. Apps Script event parameter undefined (Issue 2)

---

## What Was Done This Session
1. Identified that @vercel/kv package requires TWO environment variables: `KV_REST_API_URL` AND `KV_REST_API_TOKEN`
2. User added both variables to Vercel (noted they only added to Production & Preview, not Development)
3. User redeployed the app
4. Tested `/api/google-sheets/config?passcode=1234` and confirmed webhookUrl is still empty
5. Concluded the KV storage is still not properly connecting

---

## Next Steps to Debug

### Immediate Actions:
1. **Verify environment variables are actually set:**
   - Go to Vercel project → Settings → Environment Variables
   - Confirm `KV_REST_API_URL` and `KV_REST_API_TOKEN` are both present
   - Verify they have the correct values from Upstash Redis

2. **Check if there's an additional token variable needed:**
   - The @vercel/kv library might also need a `KV_REST_API_READ_ONLY_TOKEN`
   - Check Upstash dashboard for all required credentials

3. **Enable logging to see what's happening:**
   - Add console.log statements in `api/google-sheets/config.ts` to log:
     - The value of `process.env.KV_REST_API_URL` (just log that it exists, not the actual URL for security)
     - Any errors from `kv.set()` and `kv.get()` operations
   - Redeploy and check Vercel Function Logs for these messages

4. **Try using the Upstash REST API directly:**
   - Instead of @vercel/kv, try making a direct HTTP request to the Upstash REST API
   - This would help determine if the problem is with @vercel/kv or with the connection itself

### Testing Plan Once KV Works:
1. Re-register the webhook URL: 
   ```bash
   curl -X POST https://barefoot-shoes-app.vercel.app/api/google-sheets/config \
     -H 'Content-Type: application/json' \
     -H 'x-admin-passcode: 1234' \
     -d '{"webhookUrl":"https://script.google.com/macros/s/AKfycbz8VkHVHRYWier_BUqq3LmDsqwwuph4d_O4IlwNeivJac9GoJUi1pVoDLDLErgIWxEB/exec"}'
   ```

2. Verify it persists by running GET request

3. Submit a test order via the frontend form

4. Check Google Sheet "הזמנות" tab for the new row

5. Check Apps Script execution logs for success or error messages

---

## Key Files
- **Frontend form:** `src/App.tsx` (order submission at line ~606)
- **API endpoint:** `api/orders/index.ts` (POST handler creates order, calls webhook)
- **Config endpoint:** `api/google-sheets/config.ts` (GET/POST for webhook URL management)
- **Apps Script:** `apps-script/קוד.js` (Web App endpoint that receives webhook POST)

---

## Environment Info
- Vercel project slug: `barefoot`
- Vercel URL: `https://barefoot-shoes-app.vercel.app`
- Redis provider: Upstash (via Vercel Marketplace)
- Redis database: redis-camel-flower
- Apps Script Web App URL: `https://script.google.com/macros/s/AKfycbz8VkHVHRYWier_BUqq3LmDsqwwuph4d_O4IlwNeivJac9GoJUi1pVoDLDLErgIWxEB/exec`
