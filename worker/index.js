/**
 * LeadStick API - Clean Cloudflare Worker
 * Simple, secure form processing with email delivery
 */

// Input sanitization and validation functions
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePhone(phone) {
  const phoneRegex = /^[\d\s\-\+\(\)\.]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

function sanitizeInput(input, maxLength = 500) {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength);
}

// Persistent rate limiting using Cloudflare KV
// This approach persists across worker restarts and provides robust protection
async function checkRateLimit(clientIP, env) {
  const currentTime = Date.now();
  const timeWindow = Math.floor(currentTime / (1000 * 60 * 60)); // 1 hour windows
  const rateLimitKey = `rate_limit_${clientIP}`;
  
  try {
    // Get existing rate limit data from KV
    const existingData = await env.LEADSTICK_CONFIGS.get(rateLimitKey);
    let ipData = existingData ? JSON.parse(existingData) : { 
      windows: {}, 
      lastSubmission: 0 
    };
    
    // Clean up old windows (older than 3 hours)
    const threeHoursAgo = timeWindow - 3;
    for (const window of Object.keys(ipData.windows)) {
      if (parseInt(window) < threeHoursAgo) {
        delete ipData.windows[window];
      }
    }
    
    // Get current window count
    const windowCount = ipData.windows[timeWindow] || 0;
    
    // Check hourly limit
    if (windowCount >= 5) {
      return { 
        allowed: false, 
        remaining: 0, 
        resetTime: (timeWindow + 1) * 1000 * 60 * 60, // Next hour
        reason: 'hourly_limit_exceeded'
      };
    }
    
    // Check progressive delay
    const timeSinceLastSubmission = currentTime - ipData.lastSubmission;
    const requiredDelay = Math.min(windowCount * 30000, 300000); // 30s * attempts, max 5 minutes
    
    if (windowCount >= 3 && timeSinceLastSubmission < requiredDelay) {
      return { 
        allowed: false, 
        remaining: 5 - windowCount,
        retryAfter: Math.ceil((requiredDelay - timeSinceLastSubmission) / 1000),
        reason: 'progressive_delay'
      };
    }
    
    return { 
      allowed: true, 
      remaining: 5 - windowCount,
      count: windowCount
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow the request if KV is unavailable
    return { 
      allowed: true, 
      remaining: 5,
      count: 0
    };
  }
}

async function updateRateLimit(clientIP, env) {
  const currentTime = Date.now();
  const timeWindow = Math.floor(currentTime / (1000 * 60 * 60)); // 1 hour windows
  const rateLimitKey = `rate_limit_${clientIP}`;
  
  try {
    // Get existing rate limit data from KV
    const existingData = await env.LEADSTICK_CONFIGS.get(rateLimitKey);
    let ipData = existingData ? JSON.parse(existingData) : { 
      windows: {}, 
      lastSubmission: 0 
    };
    
    // Increment count for current window
    ipData.windows[timeWindow] = (ipData.windows[timeWindow] || 0) + 1;
    ipData.lastSubmission = currentTime;
    
    // Clean up old windows (older than 3 hours)
    const threeHoursAgo = timeWindow - 3;
    for (const window of Object.keys(ipData.windows)) {
      if (parseInt(window) < threeHoursAgo) {
        delete ipData.windows[window];
      }
    }
    
    // Store updated data in KV with 4 hour expiration
    await env.LEADSTICK_CONFIGS.put(
      rateLimitKey, 
      JSON.stringify(ipData), 
      { expirationTtl: 14400 } // 4 hours
    );
  } catch (error) {
    console.error('Rate limit update failed:', error);
    // Continue processing even if rate limit update fails
  }
}

function validateAndSanitizeLead(leadData) {
  const errors = [];
  
  // Spam prevention: Check honeypot field
  if (leadData.website && leadData.website.trim() !== '') {
    errors.push('Invalid form submission detected');
    return { sanitized: null, errors, isSpam: true };
  }
  
  // Spam prevention: Check submission time (minimum 5 seconds)
  if (leadData.submissionTime && leadData.submissionTime < 5000) {
    errors.push('Form submitted too quickly. Please take your time.');
    return { sanitized: null, errors, isSpam: true };
  }
  
  // Sanitize all inputs
  const sanitized = {
    name: sanitizeInput(leadData.name, 100),
    phone: sanitizeInput(leadData.phone, 20),
    email: sanitizeInput(leadData.email, 100),
    location: sanitizeInput(leadData.location, 200),
    service: sanitizeInput(leadData.service, 500),
    finalMessage: sanitizeInput(leadData.finalMessage, 1000),
    business: sanitizeInput(leadData.business, 100),
    source: sanitizeInput(leadData.source, 50),
    siteId: sanitizeInput(leadData.siteId, 50),
    // Include honeypot and submission time for logging (but not for email)
    website: sanitizeInput(leadData.website || '', 100),
    submissionTime: leadData.submissionTime
  };
  
  // Validate required fields
  if (!sanitized.name) errors.push('Name is required');
  if (!sanitized.phone) errors.push('Phone is required');
  if (!sanitized.email) errors.push('Email is required');
  if (!sanitized.location) errors.push('Location is required');
  if (!sanitized.service) errors.push('Service is required');
  
  // Validate email format
  if (sanitized.email && !validateEmail(sanitized.email)) {
    errors.push('Invalid email format');
  }
  
  // Validate phone format
  if (sanitized.phone && !validatePhone(sanitized.phone)) {
    errors.push('Invalid phone number format');
  }
  
  // Additional spam checks
  // Check for suspicious patterns in name field
  const suspiciousPatterns = [
    /https?:\/\//i,  // URLs
    /www\./i,        // Website patterns
    /\.(com|net|org|biz)/i,  // Domain extensions
    /(.)\1{4,}/,     // Repeated characters (5 or more)
    /<[^>]*>/,       // HTML tags
  ];
  
  if (sanitized.name && suspiciousPatterns.some(pattern => pattern.test(sanitized.name))) {
    errors.push('Invalid name format');
  }
  
  if (sanitized.service && suspiciousPatterns.some(pattern => pattern.test(sanitized.service))) {
    errors.push('Invalid service description');
  }
  
  return { sanitized, errors, isSpam: false };
}

// Authentication middleware
async function authenticateAdmin(request, env, requireCsrf = false) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, session: null };
  }
  
  const token = authHeader.substring(7); // Remove "Bearer " prefix
  
  // Only accept session tokens (no more API key fallback)
  const sessionKey = `admin_session_${token}`;
  const sessionData = await env.LEADSTICK_CONFIGS.get(sessionKey);
  
  if (!sessionData) {
    return { valid: false, session: null };
  }
  
  const session = JSON.parse(sessionData);
  
  // CSRF validation for state-changing operations
  if (requireCsrf) {
    const csrfToken = request.headers.get('X-CSRF-Token');
    if (!csrfToken || csrfToken !== session.csrfToken) {
      return { valid: false, session: null, error: 'Invalid CSRF token' };
    }
  }
  
  return { valid: true, session: session };
}

// Enhanced logging for admin operations
function logAdminOperation(request, operation, details = {}) {
  const timestamp = new Date().toISOString();
  const ip = request.headers.get('CF-Connecting-IP') || 
            request.headers.get('X-Forwarded-For') || 
            'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  
  console.log(`[ADMIN AUDIT] ${timestamp} - ${operation}`, {
    ip,
    userAgent,
    operation,
    ...details
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Enhanced CORS headers - restrict to admin dashboard domain
    const allowedOrigins = [
      'https://leadstick-dashboard.pages.dev',
      'http://localhost:3000', // For development
      'http://127.0.0.1:3000'  // For development
    ];
    
    const origin = request.headers.get('Origin');
    const isAdminRequest = url.pathname.startsWith('/admin/');
    
    let corsHeaders = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
    
    // Restrict CORS for admin endpoints
    if (isAdminRequest) {
      if (origin && allowedOrigins.includes(origin)) {
        corsHeaders['Access-Control-Allow-Origin'] = origin;
        corsHeaders['Access-Control-Allow-Credentials'] = 'true';
      } else {
        // Reject unauthorized origins for admin endpoints
        return new Response(JSON.stringify({ 
          error: 'Access denied: Invalid origin' 
        }), { 
          status: 403, 
          headers: {
            'Content-Type': 'application/json',
            'X-Content-Type-Options': 'nosniff'
          }
        });
      }
    } else {
      // Public endpoints allow all origins for widget functionality
      corsHeaders['Access-Control-Allow-Origin'] = '*';
    }

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route: POST /admin/auth - Authenticate admin and get session token
    if (request.method === 'POST' && url.pathname === '/admin/auth') {
      try {
        const { password } = await request.json();
        
        if (!password) {
          return new Response(JSON.stringify({ 
            error: 'Password required' 
          }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        // Hash the provided password and compare with stored hash
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Get admin password hash from environment
        const adminPasswordHash = env.ADMIN_PASSWORD_HASH;
        
        if (!adminPasswordHash) {
          console.error('ADMIN_PASSWORD_HASH not configured');
          return new Response(JSON.stringify({ 
            error: 'Authentication system not properly configured' 
          }), { 
            status: 500, 
            headers: corsHeaders 
          });
        }
        
        if (hashHex !== adminPasswordHash) {
          logAdminOperation(request, 'FAILED_LOGIN_ATTEMPT');
          return new Response(JSON.stringify({ 
            error: 'Invalid credentials' 
          }), { 
            status: 401, 
            headers: corsHeaders 
          });
        }
        
        // Generate cryptographically secure session token
        const sessionData = crypto.randomUUID() + env.SESSION_SECRET + Date.now();
        const sessionTokenBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sessionData));
        const sessionToken = Array.from(new Uint8Array(sessionTokenBuffer))
          .map(b => b.toString(16).padStart(2, '0')).join('');
        const sessionKey = `admin_session_${sessionToken}`;
        
        // Generate CSRF token
        const csrfToken = crypto.randomUUID();
        
        // Store session in KV with 2 hour expiration
        await env.LEADSTICK_CONFIGS.put(sessionKey, JSON.stringify({
          createdAt: new Date().toISOString(),
          ip: request.headers.get('CF-Connecting-IP') || 'unknown',
          userAgent: request.headers.get('User-Agent') || 'unknown',
          csrfToken: csrfToken
        }), { expirationTtl: 7200 }); // 2 hours
        
        logAdminOperation(request, 'SUCCESSFUL_LOGIN');
        
        return new Response(JSON.stringify({ 
          success: true,
          token: sessionToken,
          csrfToken: csrfToken,
          expiresIn: 7200
        }), { 
          headers: corsHeaders 
        });
        
      } catch (error) {
        console.error('Authentication error:', error);
        return new Response(JSON.stringify({ 
          error: 'Authentication failed' 
        }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // Route: GET /api/config/:siteId
    if (request.method === 'GET' && url.pathname.startsWith('/api/config/')) {
      const siteId = url.pathname.split('/')[3];
      
      if (!siteId) {
        return new Response(JSON.stringify({ 
          error: 'Site ID required' 
        }), { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      try {
        // Fetch config from KV
        const configKey = `client_config_${siteId}`;
        const config = await env.LEADSTICK_CONFIGS.get(configKey, 'json');
        
        if (!config) {
          return new Response(JSON.stringify({ 
            error: 'Configuration not found' 
          }), { 
            status: 404, 
            headers: corsHeaders 
          });
        }

        return new Response(JSON.stringify(config), { 
          headers: corsHeaders 
        });
      } catch (error) {
        console.error('Error fetching config:', error);
        return new Response(JSON.stringify({ 
          error: 'Internal server error' 
        }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // Route: GET /admin/clients - List all clients
    if (request.method === 'GET' && url.pathname === '/admin/clients') {
      // Check authentication
      const authResult = await authenticateAdmin(request, env);
      if (!authResult.valid) {
        logAdminOperation(request, 'UNAUTHORIZED_ACCESS_ATTEMPT', { 
          endpoint: '/admin/clients',
          method: 'GET'
        });
        return new Response(JSON.stringify({ 
          error: authResult.error || 'Unauthorized. Valid session required.' 
        }), { 
          status: 401, 
          headers: corsHeaders 
        });
      }

      logAdminOperation(request, 'LIST_CLIENTS');
      
      try {
        // List all client configs from KV
        const list = await env.LEADSTICK_CONFIGS.list({ prefix: 'client_config_' });
        const clients = [];
        
        // Fetch each client config
        for (const key of list.keys) {
          const config = await env.LEADSTICK_CONFIGS.get(key.name, 'json');
          if (config) {
            clients.push({
              siteId: config.siteId,
              businessName: config.business?.name || 'Unknown',
              email: config.business?.email || 'No email',
              agentName: config.business?.agentName || 'Unknown',
              theme: config.theme?.primary || '#3b82f6',
              lastModified: key.metadata?.lastModified || 'Unknown'
            });
          }
        }
        
        return new Response(JSON.stringify({ clients }), { 
          headers: corsHeaders 
        });
      } catch (error) {
        console.error('Error listing clients:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to list clients' 
        }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // Route: POST /admin/clients - Create new client
    if (request.method === 'POST' && url.pathname === '/admin/clients') {
      // Check authentication with CSRF
      const authResult = await authenticateAdmin(request, env, true);
      if (!authResult.valid) {
        logAdminOperation(request, 'UNAUTHORIZED_ACCESS_ATTEMPT', { 
          endpoint: '/admin/clients',
          method: 'POST'
        });
        return new Response(JSON.stringify({ 
          error: authResult.error || 'Unauthorized. Valid session required.' 
        }), { 
          status: 401, 
          headers: corsHeaders 
        });
      }

      try {
        const clientData = await request.json();
        
        // Validate required fields
        if (!clientData.siteId || !clientData.business?.name || !clientData.business?.email) {
          return new Response(JSON.stringify({ 
            error: 'Missing required fields: siteId, business.name, business.email' 
          }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }
        
        // Check if client already exists
        const configKey = `client_config_${clientData.siteId}`;
        const existing = await env.LEADSTICK_CONFIGS.get(configKey);
        if (existing) {
          return new Response(JSON.stringify({ 
            error: 'Client with this Site ID already exists' 
          }), { 
            status: 409, 
            headers: corsHeaders 
          });
        }
        
        // Sanitize and validate input
        const sanitizedClientData = {
          siteId: sanitizeInput(clientData.siteId, 50),
          business: {
            name: sanitizeInput(clientData.business.name, 100),
            email: sanitizeInput(clientData.business.email, 100),
            phone: sanitizeInput(clientData.business.phone || '', 20),
            agentName: sanitizeInput(clientData.business.agentName || '', 50),
            avatar: sanitizeInput(clientData.business.avatar || '', 200)
          },
          theme: clientData.theme || {},
          messages: clientData.messages || {},
          flow: clientData.flow || []
        };

        // Save to KV
        await env.LEADSTICK_CONFIGS.put(configKey, JSON.stringify(sanitizedClientData));
        
        logAdminOperation(request, 'CREATE_CLIENT', { 
          siteId: sanitizedClientData.siteId,
          businessName: sanitizedClientData.business.name 
        });
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Client created successfully' 
        }), { 
          headers: corsHeaders 
        });
      } catch (error) {
        console.error('Error creating client:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to create client' 
        }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // Route: PUT /admin/clients/:siteId - Update client
    if (request.method === 'PUT' && url.pathname.startsWith('/admin/clients/')) {
      // Check authentication with CSRF
      const authResult = await authenticateAdmin(request, env, true);
      if (!authResult.valid) {
        logAdminOperation(request, 'UNAUTHORIZED_ACCESS_ATTEMPT', { 
          endpoint: url.pathname,
          method: 'PUT'
        });
        return new Response(JSON.stringify({ 
          error: authResult.error || 'Unauthorized. Valid session required.' 
        }), { 
          status: 401, 
          headers: corsHeaders 
        });
      }

      const siteId = url.pathname.split('/')[3];
      
      if (!siteId) {
        return new Response(JSON.stringify({ 
          error: 'Site ID required' 
        }), { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      try {
        const clientData = await request.json();
        const configKey = `client_config_${siteId}`;
        
        // Check if client exists
        const existing = await env.LEADSTICK_CONFIGS.get(configKey);
        if (!existing) {
          return new Response(JSON.stringify({ 
            error: 'Client not found' 
          }), { 
            status: 404, 
            headers: corsHeaders 
          });
        }
        
        // Sanitize and validate input
        const sanitizedClientData = {
          siteId: sanitizeInput(siteId, 50),
          business: {
            name: sanitizeInput(clientData.business?.name || '', 100),
            email: sanitizeInput(clientData.business?.email || '', 100),
            phone: sanitizeInput(clientData.business?.phone || '', 20),
            agentName: sanitizeInput(clientData.business?.agentName || '', 50),
            avatar: sanitizeInput(clientData.business?.avatar || '', 200)
          },
          theme: clientData.theme || {},
          messages: clientData.messages || {},
          flow: clientData.flow || []
        };
        
        // Save updated config
        await env.LEADSTICK_CONFIGS.put(configKey, JSON.stringify(sanitizedClientData));
        
        logAdminOperation(request, 'UPDATE_CLIENT', { 
          siteId: sanitizedClientData.siteId,
          businessName: sanitizedClientData.business.name 
        });
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Client updated successfully' 
        }), { 
          headers: corsHeaders 
        });
      } catch (error) {
        console.error('Error updating client:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to update client' 
        }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // Route: DELETE /admin/clients/:siteId - Delete client
    if (request.method === 'DELETE' && url.pathname.startsWith('/admin/clients/')) {
      // Check authentication with CSRF
      const authResult = await authenticateAdmin(request, env, true);
      if (!authResult.valid) {
        logAdminOperation(request, 'UNAUTHORIZED_ACCESS_ATTEMPT', { 
          endpoint: url.pathname,
          method: 'DELETE'
        });
        return new Response(JSON.stringify({ 
          error: authResult.error || 'Unauthorized. Valid session required.' 
        }), { 
          status: 401, 
          headers: corsHeaders 
        });
      }

      const siteId = url.pathname.split('/')[3];
      
      if (!siteId) {
        return new Response(JSON.stringify({ 
          error: 'Site ID required' 
        }), { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      try {
        const configKey = `client_config_${siteId}`;
        
        // Check if client exists
        const existing = await env.LEADSTICK_CONFIGS.get(configKey);
        if (!existing) {
          return new Response(JSON.stringify({ 
            error: 'Client not found' 
          }), { 
            status: 404, 
            headers: corsHeaders 
          });
        }
        
        // Delete from KV
        await env.LEADSTICK_CONFIGS.delete(configKey);
        
        logAdminOperation(request, 'DELETE_CLIENT', { 
          siteId: sanitizeInput(siteId, 50)
        });
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Client deleted successfully' 
        }), { 
          headers: corsHeaders 
        });
      } catch (error) {
        console.error('Error deleting client:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to delete client' 
        }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // Route: POST / (lead submission)
    if (request.method === 'POST' && url.pathname === '/') {
      try {
      // Get client IP for rate limiting
      const clientIP = request.headers.get('CF-Connecting-IP') || 
                      request.headers.get('X-Forwarded-For') || 
                      request.headers.get('X-Real-IP') || 
                      'unknown';
      
      // Check rate limit before processing
      const rateLimitResult = await checkRateLimit(clientIP, env);
      
      if (!rateLimitResult.allowed) {
        // Log rate limit violations
        console.warn('Rate limit exceeded:', {
          ip: clientIP,
          reason: rateLimitResult.reason,
          remaining: rateLimitResult.remaining,
          userAgent: request.headers.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
        
        const rateLimitHeaders = {
          ...corsHeaders,
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() || '3600'
        };
        
        if (rateLimitResult.resetTime) {
          rateLimitHeaders['X-RateLimit-Reset'] = rateLimitResult.resetTime.toString();
        }
        
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          message: rateLimitResult.reason === 'progressive_delay' 
            ? `Please wait ${rateLimitResult.retryAfter} seconds before submitting again.`
            : 'Too many submissions. Please try again later.',
          retryAfter: rateLimitResult.retryAfter,
          resetTime: rateLimitResult.resetTime
        }), { 
          status: 429, 
          headers: rateLimitHeaders 
        });
      }
      
      // Parse lead data
      const leadData = await request.json();
      
      // Validate and sanitize lead data
      const { sanitized, errors, isSpam } = validateAndSanitizeLead(leadData);
      
      if (errors.length > 0) {
        // Log spam attempts for monitoring
        if (isSpam) {
          console.warn('Spam attempt blocked:', {
            reason: errors[0],
            ip: clientIP,
            userAgent: request.headers.get('User-Agent'),
            timestamp: new Date().toISOString()
          });
        }
        
        return new Response(JSON.stringify({
          error: 'Validation failed',
          details: errors
        }), { 
          status: 400, 
          headers: corsHeaders 
        });
      }
      
      // Update rate limit counter after successful validation
      await updateRateLimit(clientIP, env);

      // Generate lead ID
      const leadId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Get configuration for email recipient (if siteId provided)
      let recipientEmail = env.LEAD_EMAIL_RECIPIENT || 'leads@example.com';
      if (sanitized.siteId) {
        try {
          const configKey = `client_config_${sanitized.siteId}`;
          const config = await env.LEADSTICK_CONFIGS.get(configKey, 'json');
          if (config && config.business && config.business.email) {
            recipientEmail = config.business.email;
          }
        } catch (error) {
          console.warn('Failed to fetch client config:', error);
        }
      }

      // Send email via Resend
      const emailSent = await sendEmail(sanitized, leadId, recipientEmail, env);
      
      // Track in GA4 (optional)
      await trackGA4Event(sanitized, leadId, env);

      // Add rate limit headers to successful responses
      const successHeaders = {
        ...corsHeaders,
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': (rateLimitResult.remaining - 1).toString()
      };

      return new Response(JSON.stringify({
        success: true,
        leadId,
        email: emailSent ? 'sent' : 'failed'
      }), { 
        headers: successHeaders 
      });

      } catch (error) {
        console.error('Error processing lead:', error);
        
        return new Response(JSON.stringify({
          error: 'Internal server error'
        }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // Default 404 for unknown routes
    return new Response(JSON.stringify({ 
      error: 'Not found' 
    }), { 
      status: 404, 
      headers: corsHeaders 
    });
  }
};

// Send email notification
async function sendEmail(lead, leadId, recipientEmail, env) {
  if (!env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured');
    return false;
  }

  try {
    // Format attribution data for email display
    const formatAttribution = (attribution) => {
      if (!attribution) return '';
      
      const { firstTouch, lastTouch, sessionId } = attribution;
      
      const formatTouch = (touch, type) => {
        if (!touch) return '';
        
        return `
          <div style="background: ${type === 'first' ? '#fef3c7' : '#dbeafe'}; padding: 16px; border-radius: 8px; margin: 12px 0; border-left: 4px solid ${type === 'first' ? '#f59e0b' : '#3b82f6'};">
            <h4 style="margin: 0 0 8px 0; color: ${type === 'first' ? '#92400e' : '#1e40af'}; font-size: 14px; font-weight: 600;">
              ${type === 'first' ? '🎯 First Touch Attribution' : '🔄 Last Touch Attribution'}
            </h4>
            <table style="width: 100%; font-size: 13px; line-height: 1.4;">
              <tr><td style="font-weight: 600; width: 80px; color: #374151;">Source:</td><td style="color: #6b7280;">${touch.source || 'direct'}</td></tr>
              <tr><td style="font-weight: 600; color: #374151;">Medium:</td><td style="color: #6b7280;">${touch.medium || 'direct'}</td></tr>
              ${touch.campaign ? `<tr><td style="font-weight: 600; color: #374151;">Campaign:</td><td style="color: #6b7280;">${touch.campaign}</td></tr>` : ''}
              ${touch.content ? `<tr><td style="font-weight: 600; color: #374151;">Ad Content:</td><td style="color: #6b7280;">${touch.content}</td></tr>` : ''}
              ${touch.term ? `<tr><td style="font-weight: 600; color: #374151;">Keyword:</td><td style="color: #6b7280;">${touch.term}</td></tr>` : ''}
              ${touch.gclid ? `<tr><td style="font-weight: 600; color: #374151;">Google ID:</td><td style="color: #6b7280; font-family: monospace; font-size: 11px;">${touch.gclid.substring(0, 20)}...</td></tr>` : ''}
              ${touch.fbclid ? `<tr><td style="font-weight: 600; color: #374151;">Facebook ID:</td><td style="color: #6b7280; font-family: monospace; font-size: 11px;">${touch.fbclid.substring(0, 20)}...</td></tr>` : ''}
              ${touch.landingPage ? `<tr><td style="font-weight: 600; color: #374151;">Landing Page:</td><td style="color: #6b7280; word-break: break-all;">${touch.landingPage}</td></tr>` : ''}
              ${touch.referrer ? `<tr><td style="font-weight: 600; color: #374151;">Referrer:</td><td style="color: #6b7280; word-break: break-all;">${touch.referrer}</td></tr>` : ''}
            </table>
          </div>
        `;
      };
      
      return `
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 16px; display: flex; align-items: center;">
            📊 Lead Source Attribution
          </h3>
          ${formatTouch(firstTouch, 'first')}
          ${formatTouch(lastTouch, 'last')}
          ${sessionId ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;"><strong>Session ID:</strong> ${sessionId}</p>` : ''}
        </div>
      `;
    };

    // Calculate conversion metrics
    const calculateConversionMetrics = (attribution, leadTimestamp) => {
      if (!attribution || !attribution.firstTouch) return null;
      
      const firstTouchTime = new Date(attribution.firstTouch.timestamp || Date.now());
      const conversionTime = new Date(leadTimestamp || Date.now());
      const timeDiffMs = conversionTime.getTime() - firstTouchTime.getTime();
      const timeDiffDays = Math.floor(timeDiffMs / (1000 * 60 * 60 * 24));
      const timeDiffHours = Math.floor((timeDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const timeDiffMinutes = Math.floor((timeDiffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      let timeToConvert = 'immediate';
      if (timeDiffDays > 0) {
        timeToConvert = `${timeDiffDays} day${timeDiffDays > 1 ? 's' : ''} nurture cycle`;
      } else if (timeDiffHours > 0) {
        timeToConvert = `${timeDiffHours} hour${timeDiffHours > 1 ? 's' : ''} consideration`;
      } else if (timeDiffMinutes > 5) {
        timeToConvert = `${timeDiffMinutes} minute${timeDiffMinutes > 1 ? 's' : ''} evaluation`;
      } else {
        timeToConvert = 'immediate converter';
      }
      
      // Get landing page with UTM parameters
      const landingPage = attribution.firstTouch.landingPage || attribution.lastTouch.landingPage || 'direct visit';
      
      return {
        timeToConvert,
        landingPage,
        sessionId: attribution.sessionId,
        isQuickConverter: timeDiffHours < 24
      };
    };

    // Generate marketing insight
    const getMarketingInsight = (metrics, attribution) => {
      if (!metrics) return 'Follow up promptly for best conversion results.';
      
      if (metrics.isQuickConverter) {
        return 'Quick converter - follow up within 24 hours for best results.';
      } else if (attribution && attribution.firstTouch.source === 'google' && attribution.firstTouch.medium === 'cpc') {
        return 'Paid search lead - high intent, prioritize immediate contact.';
      } else if (attribution && attribution.firstTouch.source === 'direct') {
        return 'Direct visitor - likely familiar with your brand, warm lead.';
      } else {
        return 'Nurtured lead - maintain consistent follow-up schedule.';
      }
    };

    const metrics = calculateConversionMetrics(lead.attribution, lead.timestamp);
    const marketingInsight = getMarketingInsight(metrics, lead.attribution);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: env.LEAD_EMAIL_FROM || 'LeadStick <noreply@leadstick.com>',
        to: [recipientEmail],
        subject: `New Lead: ${escapeHtml(lead.service)} in ${escapeHtml(lead.location)}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: white;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 24px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600; display: flex; align-items: center;">
                🎯 New Lead from Your Website!
              </h1>
              <p style="margin: 8px 0 0 0; color: #fed7aa; font-size: 14px;">
                A potential customer has submitted a quote request through your LeadStick widget.
              </p>
            </div>

            <!-- Lead Details -->
            <div style="padding: 24px; background: white;">
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #f97316; margin-bottom: 20px;">
                <h2 style="margin: 0 0 16px 0; color: #374151; font-size: 18px;">💼 Lead Details</h2>
                <div style="display: grid; gap: 12px;">
                  <div style="display: flex; align-items: center;">
                    <span style="font-weight: 600; color: #374151; width: 100px; display: inline-block;">📍 Location:</span>
                    <span style="color: #6b7280;">${escapeHtml(lead.location)}</span>
                  </div>
                  <div style="display: flex; align-items: center;">
                    <span style="font-weight: 600; color: #374151; width: 100px; display: inline-block;">🔧 Project:</span>
                    <span style="color: #6b7280;">${escapeHtml(lead.service)}</span>
                  </div>
                  <div style="display: flex; align-items: center;">
                    <span style="font-weight: 600; color: #374151; width: 100px; display: inline-block;">👤 Name:</span>
                    <span style="color: #6b7280;">${escapeHtml(lead.name)}</span>
                  </div>
                  <div style="display: flex; align-items: center;">
                    <span style="font-weight: 600; color: #374151; width: 100px; display: inline-block;">📱 Phone:</span>
                    <a href="tel:${escapeHtml(lead.phone)}" style="color: #f97316; text-decoration: none; font-weight: 600;">${escapeHtml(lead.phone)}</a>
                  </div>
                  ${lead.email ? `
                  <div style="display: flex; align-items: center;">
                    <span style="font-weight: 600; color: #374151; width: 100px; display: inline-block;">✉️ Email:</span>
                    <a href="mailto:${escapeHtml(lead.email)}" style="color: #f97316; text-decoration: none;">${escapeHtml(lead.email)}</a>
                  </div>
                  ` : ''}
                </div>
              </div>

              ${formatAttribution(lead.attribution)}

              ${metrics ? `
              <!-- Conversion Metrics -->
              <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px; display: flex; align-items: center;">
                  📈 Conversion Metrics
                </h3>
                <div style="display: grid; gap: 8px;">
                  <div style="display: flex; align-items: center;">
                    <span style="font-weight: 600; color: #92400e; width: 140px; display: inline-block;">Time to Convert:</span>
                    <span style="color: #78350f;">${metrics.timeToConvert}</span>
                  </div>
                  <div style="display: flex; align-items: flex-start;">
                    <span style="font-weight: 600; color: #92400e; width: 140px; display: inline-block; flex-shrink: 0;">Landing Page:</span>
                    <a href="${metrics.landingPage}" style="color: #3b82f6; text-decoration: none; word-break: break-all; font-size: 13px;">${metrics.landingPage}</a>
                  </div>
                  <div style="display: flex; align-items: center;">
                    <span style="font-weight: 600; color: #92400e; width: 140px; display: inline-block;">Session ID:</span>
                    <span style="color: #78350f; font-family: monospace; font-size: 12px;">${metrics.sessionId}</span>
                  </div>
                </div>
              </div>
              ` : ''}

              <!-- Marketing Insight -->
              <div style="background: #d1fae5; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
                <h4 style="margin: 0 0 8px 0; color: #065f46; font-size: 14px; font-weight: 600; display: flex; align-items: center;">
                  💡 Marketing Insight:
                </h4>
                <p style="margin: 0; color: #047857; font-size: 14px;">${marketingInsight}</p>
              </div>

              <!-- Footer -->
              <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 20px;">
                <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                  <strong>Lead ID:</strong> ${escapeHtml(leadId)} | 
                  <strong>Submitted:</strong> ${escapeHtml(lead.timestamp || new Date().toISOString())} |
                  <strong>Source:</strong> ${escapeHtml(lead.source || 'leadstick-widget')}
                </p>
                <p style="margin: 8px 0 0 0; font-size: 11px; color: #9ca3af; text-align: center;">
                  Powered by <a href="https://leadstick.com" style="color: #f97316; text-decoration: none;">LeadStick</a>
                </p>
              </div>
            </div>
          </div>
        `
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
}

// Track GA4 event (optional)
async function trackGA4Event(lead, leadId, env) {
  if (!env.GA4_MEASUREMENT_ID || !env.GA4_API_SECRET) {
    return; // Skip if not configured
  }

  try {
    await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`, {
      method: 'POST',
      body: JSON.stringify({
        client_id: leadId,
        events: [{
          name: 'leadstick_conversion',
          params: {
            lead_id: escapeHtml(leadId),
            service: escapeHtml(lead.service),
            location: escapeHtml(lead.location),
            value: 100
          }
        }]
      })
    });
  } catch (error) {
    console.error('GA4 tracking failed:', error);
  }
}