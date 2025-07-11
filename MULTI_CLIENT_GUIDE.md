# LeadStick Multi-Client Configuration Guide

## Quick Start for MVP Testing

This guide shows how to deploy LeadStick on multiple client websites with custom configurations.

## Current Implementation

### 1. Configuration Storage
Each client's configuration is stored in Cloudflare KV with the key format: `client_config_{siteId}`

### 2. Available Test Configurations

#### Plumber (Blue Theme)
- **Site ID**: `plumber-joe`
- **Email**: joe@plumbingservices.com
- **Questions**: Location → Issue Type → Urgency → Contact

#### Landscaper (Green Theme)
- **Site ID**: `green-thumb-landscaping`
- **Email**: info@greenthumblandscaping.com
- **Questions**: Property Type → Services (multi) → Budget → Timeline → Contact

#### Dentist (Cyan Theme)
- **Site ID**: `smile-dental-clinic`
- **Email**: appointments@smiledentalclinic.com
- **Questions**: Treatment → Insurance → Availability (multi) → Contact

### 3. Testing the Configurations

View live configurations:
```bash
# Plumber config
curl https://leadstick-api.attribution.workers.dev/api/config/plumber-joe

# Landscaper config
curl https://leadstick-api.attribution.workers.dev/api/config/green-thumb-landscaping

# Dentist config
curl https://leadstick-api.attribution.workers.dev/api/config/smile-dental-clinic
```

### 4. Widget Integration

For the widget to use these configurations, you need to update the widget code to:

1. Accept a `siteId` parameter during initialization
2. Fetch the configuration from the API
3. Use the fetched config instead of hardcoded values

Example integration:
```html
<script src="https://cdn.leadstick.com/widget.js"></script>
<script>
  LeadStick.init({ 
    siteId: 'plumber-joe'  // This determines which config to load
  });
</script>
```

## Adding New Clients

### 1. Create Configuration File
Create a JSON file following the schema:
```json
{
  "siteId": "unique-client-id",
  "business": {
    "name": "Business Name",
    "email": "recipient@email.com",
    "phone": "Phone Number",
    "agentName": "Agent Name",
    "avatar": "/path/to/avatar.png"
  },
  "theme": {
    "primary": "#hex-color",
    "primaryHover": "#hex-color",
    // ... other theme colors
  },
  "flow": [
    {
      "id": "step-id",
      "type": "text|select|multiselect|contact",
      "question": "Your question here?",
      "options": ["Option 1", "Option 2"], // for select types
      "validation": {
        "required": true
      }
    }
  ],
  "messages": {
    "welcome": "Welcome message",
    "complete": "Completion message",
    "phoneButton": "Phone button text"
  }
}
```

### 2. Upload to Cloudflare KV
```bash
npx wrangler kv key put --binding="LEADSTICK_CONFIGS" --remote \
  "client_config_your-site-id" \
  "$(cat path/to/config.json)"
```

### 3. Test the Configuration
```bash
curl https://leadstick-api.attribution.workers.dev/api/config/your-site-id
```

## Email Routing

When a lead is submitted:
1. The widget includes the `siteId` in the submission
2. The worker fetches the client config from KV
3. The email is sent to the address in `business.email`
4. If config not found, falls back to default recipient

## Testing Tool

Open `test-multi-client.html` in a browser to:
- Switch between different client configurations
- See the configuration JSON
- View the integration code
- Test the widget with different configs

## Next Steps for Full Implementation

To complete the multi-client system, the widget needs to be updated to:

1. **Accept siteId parameter**:
   ```javascript
   export function initLeadStick(config) {
     const { siteId } = config || {};
     // Store siteId for later use
   }
   ```

2. **Fetch configuration on load**:
   ```javascript
   const response = await fetch(`${API_URL}/api/config/${siteId}`);
   const config = await response.json();
   ```

3. **Use dynamic configuration**:
   - Replace hardcoded business info with config values
   - Apply theme colors dynamically
   - Build question flow from config.flow array
   - Use custom messages

4. **Include siteId in submissions**:
   ```javascript
   const leadData = {
     ...formData,
     siteId: config.siteId
   };
   ```

This approach allows you to manage multiple clients without code changes or separate deployments!