# LeadStick Deployment Guide

## Prerequisites

1. **Cloudflare Account** - Free tier is sufficient
2. **Resend Account** - For email notifications
3. **GA4 Property** - For analytics tracking (optional)

## Setup Instructions

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### 2. Configure Environment Variables

Set these secrets in Cloudflare Dashboard or via CLI:

```bash
# Required for email notifications
wrangler secret put RESEND_API_KEY

# Optional for GA4 server-side tracking
wrangler secret put GA4_MEASUREMENT_ID
wrangler secret put GA4_API_SECRET
```

#### Getting API Keys:

**Resend API Key:**
1. Sign up at [resend.com](https://resend.com)
2. Go to API Keys section
3. Create new API key
4. Copy the key (starts with `re_`)

**GA4 Configuration:**
1. Go to GA4 Admin → Data Streams
2. Click your web stream → Measurement Protocol API secrets
3. Create new secret
4. Copy Measurement ID (G-XXXXXXXXXX) and API Secret

### 3. Deploy the Worker

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production  
npm run deploy:production
```

### 4. Update Widget Configuration

Update the API endpoint in `src/config.ts`:

```javascript
export const CONFIG = {
  // ... other config
  apiEndpoint: "https://leadstick-api.your-subdomain.workers.dev/submit"
}
```

### 5. Deploy Widget to R2

```bash
# Build the widget
npm run build

# Upload to R2 (configure bucket first)
wrangler r2 object put leadstick-bucket/leadstick.umd.js --file=dist/leadstick.umd.js
```

## Testing

### Local Development

```bash
# Start worker in dev mode
cd worker
npm run dev

# In another terminal, start widget dev server
npm run dev
```

### Test Lead Submission

1. Open widget in browser
2. Fill out the form completely
3. Submit lead
4. Check:
   - Console for success/error messages
   - Email inbox for notification
   - GA4 for server-side event

## Production Checklist

- [ ] Resend API key configured
- [ ] Email recipient address updated in worker
- [ ] GA4 tracking configured (optional)
- [ ] Worker deployed to production
- [ ] Widget API endpoint updated
- [ ] Widget deployed to R2/CDN
- [ ] Test end-to-end flow
- [ ] Monitor worker logs for errors

## Monitoring

```bash
# View real-time logs
wrangler tail

# View analytics in Cloudflare dashboard
# Workers & Pages → leadstick-api → Analytics
```

## Domain Setup (Optional)

For custom domain (e.g., `api.yourdomain.com`):

1. Add route in Cloudflare Dashboard
2. Update worker configuration
3. Update widget API endpoint
4. Test CORS settings

## Troubleshooting

**CORS Issues:**
- Check API endpoint URL
- Verify CORS headers in worker
- Test with browser dev tools

**Email Not Sending:**
- Verify Resend API key
- Check recipient email address
- Review worker logs for errors

**GA4 Not Tracking:**
- Verify measurement ID and API secret
- Check GA4 DebugView
- Ensure server-side tracking is enabled