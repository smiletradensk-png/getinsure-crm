# GETINSURE CRM - Facebook Ads Integration Guide

## Overview
This CRM automatically syncs leads from Facebook Lead Ads directly into your app, just like Biziverse.

## Setup Instructions

### Step 1: Create Facebook App
1. Go to https://developers.facebook.com
2. Click "My Apps" → "Create App"
3. Select "Business" type
4. Fill in app details:
   - App Name: GETINSURE CRM
   - Contact Email: your@email.com

### Step 2: Add Products
1. In your Facebook App dashboard
2. Add "Webhooks" product
3. Add "Lead Ads" product

### Step 3: Configure Webhook
1. Go to Webhooks section
2. Click "Edit Subscription"
3. Callback URL: `https://your-backend-url.com/api/facebook/webhook`
4. Verify Token: `GETINSURE_CRM_TOKEN_2025`
5. Subscribe to field: `leadgen`

### Step 4: Page Subscription
1. In Webhooks section
2. Subscribe to your Facebook Page
3. Select permissions: `leads`

### Step 5: Test Integration
1. Create a test Lead Ad on Facebook
2. Submit test lead
3. Check your CRM - lead should appear automatically!

## Backend Webhook Endpoints

**Verification Endpoint (GET):**
```
GET /api/facebook/webhook
Query params:
- mode: "subscribe"
- verify_token: "GETINSURE_CRM_TOKEN_2025"
- challenge: "<facebook_challenge>"
```

**Receive Leads Endpoint (POST):**
```
POST /api/facebook/webhook
Body: Facebook webhook payload with lead data
```

## How It Works

1. User fills form on Facebook Lead Ad
2. Facebook sends webhook to your backend
3. Backend automatically creates lead in CRM
4. Lead appears in app with source "Facebook Ads"
5. Notification sent to your phone
6. You can immediately follow up!

## Webhook Payload Structure

Facebook sends this data:
```json
{
  "object": "page",
  "entry": [{
    "changes": [{
      "field": "leadgen",
      "value": {
        "leadgen_id": "123456789",
        "form": {
          "full_name": "John Doe",
          "phone_number": "9876543210",
          "city": "Mumbai"
        }
      }
    }]
  }]
}
```

## Security Notes

1. Verify Token is hardcoded: `GETINSURE_CRM_TOKEN_2025`
2. Change this in production for security
3. Facebook will verify this token during setup
4. All webhook requests are authenticated by Facebook

## Troubleshooting

**Webhook not receiving data?**
- Check Facebook App is in "Live" mode (not Development)
- Verify webhook URL is correct
- Check backend logs: `tail -f /var/log/supervisor/backend.out.log`

**Leads not appearing?**
- Check webhook is subscribed to correct page
- Verify 'leadgen' field is subscribed
- Test webhook manually from Facebook dashboard

**Testing Webhook Locally?**
- Use ngrok to expose local backend: `ngrok http 8001`
- Update webhook URL in Facebook to ngrok URL
- Create test lead ad and submit

## Production Deployment

For production, you need:
1. Public HTTPS URL for backend
2. SSL certificate (Let's Encrypt recommended)
3. Facebook App approved and in "Live" mode
4. Page access token with leads permission

## Biziverse-Style Features ✅

✅ Automatic lead sync from Facebook
✅ Source tracking (shows "Facebook Ads")
✅ Instant notifications
✅ No manual entry needed
✅ Real-time synchronization
✅ Professional webhook integration

Your CRM now has the same Facebook integration as Biziverse!
