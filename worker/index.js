/**
 * LeadStick API - Cloudflare Worker
 * Handles lead submissions, email notifications, and server-side analytics
 */

export default {
  async fetch(request, env, ctx) {
    // CORS headers for widget requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ 
        error: 'Method not allowed',
        message: 'Only POST requests are supported'
      }), { 
        status: 405, 
        headers: corsHeaders 
      });
    }

    try {
      // Parse the incoming lead data
      const leadData = await request.json();
      
      // Validate required fields
      const requiredFields = ['location', 'service', 'name', 'phone'];
      const missingFields = requiredFields.filter(field => !leadData[field]);
      
      if (missingFields.length > 0) {
        return new Response(JSON.stringify({
          error: 'Missing required fields',
          missingFields
        }), { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      // Generate unique lead ID
      const leadId = generateLeadId();
      
      // Add metadata
      const processedLead = {
        ...leadData,
        id: leadId,
        processedAt: new Date().toISOString(),
        ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown',
        country: request.cf?.country || 'unknown'
      };

      // Process the lead (send email + track analytics)
      const [emailResult, analyticsResult] = await Promise.allSettled([
        sendEmailNotification(processedLead, env),
        trackGA4Event(processedLead, env)
      ]);

      // Log results (for debugging)
      console.log('Email result:', emailResult);
      console.log('Analytics result:', analyticsResult);

      // Return success response
      return new Response(JSON.stringify({
        success: true,
        leadId,
        message: 'Lead submitted successfully',
        email: emailResult.status === 'fulfilled' ? 'sent' : 'failed',
        analytics: analyticsResult.status === 'fulfilled' ? 'tracked' : 'failed'
      }), { 
        headers: corsHeaders 
      });

    } catch (error) {
      console.error('Error processing lead:', error);
      
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: 'Failed to process lead submission'
      }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  }
};

/**
 * Send email notification via Resend
 */
async function sendEmailNotification(leadData, env) {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const emailHtml = generateEmailTemplate(leadData);
  
  const emailPayload = {
    from: 'LeadStick <noreply@leadstick.com>',
    to: ['leads@quickservicepro.com'], // Update with actual recipient
    subject: `🎯 New Lead: ${leadData.service} in ${leadData.location}`,
    html: emailHtml
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailPayload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return await response.json();
}

/**
 * Track server-side GA4 event
 */
async function trackGA4Event(leadData, env) {
  if (!env.GA4_MEASUREMENT_ID || !env.GA4_API_SECRET) {
    console.warn('GA4 tracking not configured');
    return { skipped: true };
  }

  const ga4Payload = {
    client_id: leadData.id, // Use lead ID as client ID
    events: [{
      name: 'leadstick_server_conversion',
      params: {
        business_name: leadData.business || 'Stone Quoter',
        service_selected: leadData.service,
        location: leadData.location,
        lead_source: 'leadstick-widget',
        lead_id: leadData.id,
        value: 100, // Estimated lead value
        currency: 'USD',
        country: leadData.country
      }
    }]
  };

  const ga4Url = `https://www.google-analytics.com/mp/collect?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`;
  
  const response = await fetch(ga4Url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(ga4Payload)
  });

  if (!response.ok) {
    throw new Error(`GA4 tracking failed: ${response.status}`);
  }

  return { tracked: true };
}

/**
 * Generate HTML email template
 */
function generateEmailTemplate(leadData) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Lead from LeadStick</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: rgb(246, 165, 96); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .field { margin: 10px 0; }
        .label { font-weight: bold; color: #333; }
        .value { color: #666; margin-left: 10px; }
        .footer { margin-top: 20px; padding: 15px; background: #e5e7eb; border-radius: 4px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎯 New Lead from Your Website!</h1>
        <p>A potential customer has submitted a quote request through your LeadStick widget.</p>
      </div>
      
      <div class="content">
        <div class="field">
          <span class="label">📍 Location:</span>
          <span class="value">${leadData.location}</span>
        </div>
        
        <div class="field">
          <span class="label">🔧 Project:</span>
          <span class="value">${leadData.service}</span>
        </div>
        
        <div class="field">
          <span class="label">👤 Name:</span>
          <span class="value">${leadData.name}</span>
        </div>
        
        <div class="field">
          <span class="label">📱 Phone:</span>
          <span class="value"><a href="tel:${leadData.phone}">${leadData.phone}</a></span>
        </div>
        
        ${leadData.email ? `
        <div class="field">
          <span class="label">📧 Email:</span>
          <span class="value"><a href="mailto:${leadData.email}">${leadData.email}</a></span>
        </div>
        ` : ''}
        
        ${leadData.finalMessage ? `
        <div class="field">
          <span class="label">💬 Message:</span>
          <span class="value">${leadData.finalMessage}</span>
        </div>
        ` : ''}
        
        <div class="footer">
          <strong>Lead Details:</strong><br>
          Lead ID: ${leadData.id}<br>
          Submitted: ${new Date(leadData.processedAt).toLocaleString()}<br>
          IP: ${leadData.ipAddress}<br>
          Country: ${leadData.country}<br>
          Source: LeadStick Widget
        </div>
      </div>
      
      <div class="footer">
        <p><strong>Next Steps:</strong></p>
        <ol>
          <li>Call ${leadData.name} at <a href="tel:${leadData.phone}">${leadData.phone}</a></li>
          <li>Discuss their ${leadData.service} project in ${leadData.location}</li>
          <li>Provide quote and follow up</li>
        </ol>
        
        <p><small>This email was generated by LeadStick - your automated lead generation system.</small></p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate unique lead ID
 */
function generateLeadId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `lead_${timestamp}_${random}`;
}