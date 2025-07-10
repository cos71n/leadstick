# Rate Limiting Configuration

## Overview
Rate limiting has been implemented to prevent automated abuse and spam submissions. The system uses **in-memory IP-based tracking** with progressive delays and works standalone without external dependencies.

## Configuration Required

### Zero External Dependencies ✅
This rate limiting system is completely self-contained and requires **no additional setup**:
- ✅ No KV namespace required
- ✅ No Durable Objects needed  
- ✅ No additional environment variables
- ✅ Works out of the box on any Cloudflare Worker

### Environment Variables (Optional)
The following environment variables are used for email functionality:
- `RESEND_API_KEY` - For email notifications (existing)
- `LEAD_EMAIL_RECIPIENT` - Email destination (existing)

## Rate Limiting Rules

### Limits
- **5 submissions per IP per hour**
- **Progressive delays** after 3 submissions:
  - 4th submission: 30 second delay
  - 5th submission: 60 second delay
  - 6th+ submission: Blocked until next hour

### Response Headers
- `X-RateLimit-Limit`: Maximum submissions per hour (5)
- `X-RateLimit-Remaining`: Remaining submissions for current hour
- `X-RateLimit-Reset`: Timestamp when limit resets (Unix timestamp)
- `Retry-After`: Seconds to wait before next submission (429 responses only)

### Error Responses
- **429 Too Many Requests**: Rate limit exceeded
- **400 Bad Request**: Validation failed (spam detection)

## Frontend Handling
The widget automatically handles rate limiting errors by:
1. Showing user-friendly delay messages
2. Displaying alternative contact methods (phone button)
3. Providing clear retry timing information

## Monitoring
All rate limit violations are logged with:
- Client IP address
- User agent
- Timestamp
- Violation reason
- Remaining quota

## Testing
To test rate limiting:
1. Submit the form 5 times within an hour from the same IP
2. 6th submission should be blocked with 429 error
3. Check browser network tab for rate limit headers
4. Verify user-friendly error messages in the widget

## Deployment
Deploy with:
```bash
npm run deploy
```

No additional setup required - rate limiting works immediately after deployment.

## How It Works (Technical Details)

### In-Memory Storage
- Uses a JavaScript `Map` to store rate limit data per IP address
- Automatically cleans up old data to prevent memory leaks
- Survives for the lifetime of the worker instance

### Data Structure
```javascript
{
  "192.168.1.1": {
    windows: {
      "444234": 3,  // Hour window -> submission count
      "444235": 2   // Next hour window -> submission count
    },
    lastSubmission: 1640995200000,  // Unix timestamp
    lastCleanup: 1640995200000      // Last cleanup time
  }
}
```

### Memory Management
- Automatically removes data older than 3 hours
- Periodic cleanup runs on 10% of requests
- Limits memory usage even under heavy load

### Limitations
- **Worker Restart**: Rate limit data is lost when worker restarts (typically every few hours)
- **Multiple Instances**: Each worker instance has its own rate limit state
- **High Traffic**: May need Durable Objects for sites with >1000 submissions/hour

### For High-Volume Sites
If you need persistent rate limiting across worker restarts, consider upgrading to:
- **Cloudflare Durable Objects** (paid feature)
- **External Redis** (requires additional setup)
- **Database-backed storage** (requires additional setup)

The current implementation is perfect for most use cases and provides excellent protection without complexity.