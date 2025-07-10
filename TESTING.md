# LeadStick Testing Guide

## Local Development Testing

### 1. Start the Worker (Terminal 1)

```bash
npm run worker:dev
```

This will start the Cloudflare Worker at `http://localhost:8787`

### 2. Start the Widget Dev Server (Terminal 2)

```bash
npm run dev
```

This will start the widget at `http://localhost:5173`

### 3. Test API Endpoints (Terminal 3)

```bash
node test-worker.js
```

### 4. Test Full Widget Flow

1. Open `http://localhost:5173` in browser
2. Click the LeadStick widget button
3. Fill out the form:
   - Location: "Burleigh Heads"
   - Service: "Kitchen benchtop"
   - Name: "Test User"
   - Phone: "0412 345 678"
4. Submit the form
5. Check browser console for API responses
6. Check worker terminal for logs

## Expected Results

### Without API Keys (Local Testing)
- ✅ CORS headers work
- ✅ Lead validation works
- ✅ Form submission succeeds
- ⚠️ Email sending fails (no RESEND_API_KEY)
- ⚠️ GA4 tracking skipped (no GA4 credentials)

### With API Keys (Production)
- ✅ All of the above
- ✅ Email notification sent
- ✅ GA4 server-side event tracked

## Troubleshooting

### Widget Not Submitting
- Check browser console for CORS errors
- Verify worker is running on port 8787
- Check API endpoint in config.ts

### Worker Errors
- Check worker terminal output
- Verify worker/index.js syntax
- Test API with curl or test script

### Email Not Sending
- Verify RESEND_API_KEY is set
- Check recipient email in worker code
- Review Resend dashboard for errors

## Manual API Testing

```bash
# Test CORS
curl -X OPTIONS http://localhost:8787 \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST"

# Test lead submission
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{
    "location": "Test Location",
    "service": "Test Service", 
    "name": "Test Name",
    "phone": "0412345678"
  }'

# Test validation
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}'
```

## Production Testing

After deploying to Cloudflare:

1. Update config.ts with production worker URL
2. Rebuild and redeploy widget
3. Test on staging website
4. Verify email delivery
5. Check GA4 events in real-time view
6. Monitor worker analytics in Cloudflare dashboard