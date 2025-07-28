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

// Generate random 6-character Site ID
function generateSiteId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Enhanced validation function for admin inputs
function validateAdminInput(input, type, required = true) {
  const errors = [];
  
  // Required field validation
  if (required && (!input || input.trim() === '')) {
    errors.push(`${type} is required`);
    return { isValid: false, errors, sanitized: '' };
  }
  
  // Skip further validation for optional empty fields
  if (!required && (!input || input.trim() === '')) {
    return { isValid: true, errors: [], sanitized: '' };
  }
  
  const value = input.trim();
  
  // Type-specific validation
  switch (type) {
    case 'siteId':
      if (value.length < 3) errors.push('Site ID must be at least 3 characters');
      if (value.length > 50) errors.push('Site ID must be less than 50 characters');
      if (!/^[a-zA-Z0-9-_]+$/.test(value)) errors.push('Site ID can only contain letters, numbers, hyphens, and underscores');
      break;
      
    case 'businessName':
      if (value.length < 2) errors.push('Business name must be at least 2 characters');
      if (value.length > 100) errors.push('Business name must be less than 100 characters');
      break;
      
    case 'email':
      // Support multiple email addresses separated by commas
      const emails = value.split(',').map(email => email.trim());
      for (const email of emails) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push(`Please enter a valid email address: ${email}`);
        }
      }
      if (value.length > 300) errors.push('Email field must be less than 300 characters');
      break;
      
    case 'agentName':
      if (value.length > 50) errors.push('Agent name must be less than 50 characters');
      break;
      
    case 'phone':
      if (!/^[\d\s\-\+\(\)\.]+$/.test(value)) errors.push('Please enter a valid phone number');
      if (value.length > 20) errors.push('Phone number must be less than 20 characters');
      break;
      
    case 'avatar':
      if (value.length > 200) errors.push('Avatar URL must be less than 200 characters');
      // Basic URL validation
      if (value && !/^https?:\/\/.+/.test(value)) errors.push('Avatar must be a valid HTTPS URL');
      break;
      
    case 'barText':
      if (value.length > 30) errors.push('Bar text must be less than 30 characters');
      break;
      
    case 'message':
      if (value.length > 500) errors.push('Message must be less than 500 characters');
      // Skip the common security validation for messages - allow apostrophes and other content
      return {
        isValid: errors.length === 0,
        errors,
        sanitized: sanitizeInput(value, 500)
      };
      
    default:
      // Apply security validation for non-message types
      const dangerousChars = /<|>|;|--|\/\*|\*\/|script|javascript:|data:|vbscript:|onload|onerror|eval|expression/i;
      if (dangerousChars.test(value)) {
        errors.push(`${type} contains invalid characters`);
      }
      if (value.length > 500) errors.push(`${type} is too long (max 500 characters)`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: sanitizeInput(value, type === 'email' ? 100 : (type === 'siteId' ? 50 : 500))
  };
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
  
  // Handle firstName/lastName or combined name
  let fullName = '';
  if (leadData.name) {
    fullName = leadData.name;
  } else if (leadData.firstName || leadData.lastName) {
    fullName = (sanitizeInput(leadData.firstName || '', 50) + ' ' + sanitizeInput(leadData.lastName || '', 50)).trim();
  }
  
  // Sanitize all inputs
  const sanitized = {
    name: sanitizeInput(fullName, 100),
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
    submissionTime: leadData.submissionTime,
    // Include attribution data for email tracking
    attribution: leadData.attribution || null
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
function logAdminOperation(operation, details = {}) {
  const timestamp = new Date().toISOString();
  
  console.log(`[ADMIN AUDIT] ${timestamp} - ${operation}`, {
    operation,
    ...details
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Generate cryptographically secure nonce for CSP
    const nonceBytes = new Uint8Array(16); // 128 bits
    crypto.getRandomValues(nonceBytes);
    const nonce = Array.from(nonceBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Environment-based CORS configuration
    const allowedOrigins = env.ADMIN_ALLOWED_ORIGINS 
      ? env.ADMIN_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : ['https://leadstick-dashboard.pages.dev']; // Fallback for production safety
    
    const origin = request.headers.get('Origin');
    const isAdminRequest = url.pathname.startsWith('/admin/');
    
    let corsHeaders = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'nonce-${nonce}'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self';`,
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
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
        // Rate limiting for admin authentication
        const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
        const rateLimitKey = `admin_auth_rate_limit_${clientIP}`;
        
        // Check for account lockout first
        const lockoutKey = `admin_lockout_${clientIP}`;
        const lockoutData = await env.LEADSTICK_CONFIGS.get(lockoutKey, 'json');
        
        if (lockoutData && lockoutData.lockedUntil > now) {
          const timeRemaining = Math.ceil((lockoutData.lockedUntil - now) / 1000 / 60);
          logAdminOperation('ACCOUNT_LOCKED', { clientIP, attemptsBeforeLockout: lockoutData.attempts });
          
          return new Response(JSON.stringify({ 
            error: `Account temporarily locked due to repeated failed attempts. Please try again in ${timeRemaining} minutes.` 
          }), { 
            status: 423, // 423 Locked
            headers: {
              ...corsHeaders,
              'Retry-After': Math.ceil((lockoutData.lockedUntil - now) / 1000).toString()
            }
          });
        }

        // Check current attempt count
        const attemptData = await env.LEADSTICK_CONFIGS.get(rateLimitKey, 'json');
        const now = Date.now();
        const windowMs = 15 * 60 * 1000; // 15 minutes
        const maxAttempts = 5; // Maximum 5 attempts per 15 minutes
        const lockoutAttempts = 10; // Lockout after 10 failed attempts
        
        let attempts = 0;
        let totalFailedAttempts = 0;
        let windowStart = now;
        
        if (attemptData) {
          attempts = attemptData.attempts || 0;
          totalFailedAttempts = attemptData.totalFailedAttempts || 0;
          windowStart = attemptData.windowStart || now;
          
          // Reset window if expired
          if (now - windowStart > windowMs) {
            attempts = 0;
            windowStart = now;
          }
        }
        
        // Block if too many attempts in current window
        if (attempts >= maxAttempts) {
          const timeRemaining = Math.ceil((windowStart + windowMs - now) / 1000 / 60);
          logAdminOperation('RATE_LIMITED', { clientIP, attempts, totalFailedAttempts });
          
          return new Response(JSON.stringify({ 
            error: `Too many authentication attempts. Please try again in ${timeRemaining} minutes.` 
          }), { 
            status: 429, 
            headers: {
              ...corsHeaders,
              'Retry-After': Math.ceil((windowStart + windowMs - now) / 1000).toString()
            }
          });
        }
        
        const { password } = await request.json();
        
        // Enhanced input validation for authentication
        if (!password) {
          return new Response(JSON.stringify({ 
            error: 'Password required' 
          }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }
        
        // Validate password input
        if (typeof password !== 'string') {
          return new Response(JSON.stringify({ 
            error: 'Invalid password format' 
          }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }
        
        // Length validation
        if (password.length < 8 || password.length > 128) {
          return new Response(JSON.stringify({ 
            error: 'Invalid password length' 
          }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }
        
        // Security validation - prevent injection attempts
        const dangerousChars = /<|>|'|"|;|--|\/\*|\*\/|script|select|insert|update|delete|drop|union|exec/i;
        if (dangerousChars.test(password)) {
          return new Response(JSON.stringify({ 
            error: 'Invalid password format' 
          }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        // Get admin password hash and salt from environment
        const adminPasswordHash = env.ADMIN_PASSWORD_HASH;
        const adminPasswordSalt = env.ADMIN_PASSWORD_SALT;
        
        if (!adminPasswordHash || !adminPasswordSalt) {
          console.error('ADMIN_PASSWORD_HASH or ADMIN_PASSWORD_SALT not configured');
          return new Response(JSON.stringify({ 
            error: 'Authentication system not properly configured' 
          }), { 
            status: 500, 
            headers: corsHeaders 
          });
        }
        
        // Hash the provided password with salt using PBKDF2
        const encoder = new TextEncoder();
        const passwordData = encoder.encode(password);
        const saltData = encoder.encode(adminPasswordSalt);
        
        // Import password as key material
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          passwordData,
          'PBKDF2',
          false,
          ['deriveBits']
        );
        
        // Derive key using PBKDF2 with 100,000 iterations
        const derivedKey = await crypto.subtle.deriveBits(
          {
            name: 'PBKDF2',
            salt: saltData,
            iterations: 100000,
            hash: 'SHA-256'
          },
          keyMaterial,
          256 // 32 bytes = 256 bits
        );
        
        const hashArray = Array.from(new Uint8Array(derivedKey));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        if (hashHex !== adminPasswordHash) {
          // Increment failed attempt counters
          attempts++;
          totalFailedAttempts++;
          
          // Check if we should trigger account lockout
          if (totalFailedAttempts >= lockoutAttempts) {
            const lockoutDuration = 60 * 60 * 1000; // 1 hour lockout
            const lockedUntil = now + lockoutDuration;
            
            // Set account lockout
            await env.LEADSTICK_CONFIGS.put(lockoutKey, JSON.stringify({
              lockedUntil,
              attempts: totalFailedAttempts,
              lockoutTime: now
            }), { expirationTtl: Math.ceil(lockoutDuration / 1000) });
            
            // Clear rate limit data since we're now locked
            await env.LEADSTICK_CONFIGS.delete(rateLimitKey);
            
            logAdminOperation('ACCOUNT_LOCKOUT_TRIGGERED', { 
              clientIP, 
              totalFailedAttempts,
              lockoutDurationMinutes: 60
            });
            
            return new Response(JSON.stringify({ 
              error: 'Account locked due to too many failed attempts. Please try again in 1 hour.' 
            }), { 
              status: 423, // 423 Locked
              headers: {
                ...corsHeaders,
                'Retry-After': '3600' // 1 hour
              }
            });
          }
          
          // Update attempt counter
          await env.LEADSTICK_CONFIGS.put(rateLimitKey, JSON.stringify({
            attempts,
            totalFailedAttempts,
            windowStart
          }), { expirationTtl: Math.ceil(windowMs / 1000) });
          
          logAdminOperation('FAILED_LOGIN_ATTEMPT', { 
            clientIP, 
            attempts, 
            totalFailedAttempts,
            attemptsUntilLockout: lockoutAttempts - totalFailedAttempts
          });
          
          return new Response(JSON.stringify({ 
            error: 'Invalid credentials' 
          }), { 
            status: 401, 
            headers: corsHeaders 
          });
        }
        
        // Generate cryptographically secure session token with high entropy
        const randomBytes = new Uint8Array(32); // 256 bits of entropy
        crypto.getRandomValues(randomBytes);
        const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        
        const sessionData = [
          randomHex,
          crypto.randomUUID(),
          env.SESSION_SECRET || 'default-secret',
          Date.now().toString(),
          Math.random().toString(36), // Additional entropy
          performance.now().toString() // High precision timestamp
        ].join('|');
        
        const sessionTokenBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sessionData));
        const sessionToken = Array.from(new Uint8Array(sessionTokenBuffer))
          .map(b => b.toString(16).padStart(2, '0')).join('');
        const sessionKey = `admin_session_${sessionToken}`;
        
        // Generate CSRF token
        const csrfToken = crypto.randomUUID();
        
        // Store session in KV with 2 hour expiration
        await env.LEADSTICK_CONFIGS.put(sessionKey, JSON.stringify({
          createdAt: new Date().toISOString(),
          csrfToken: csrfToken
        }), { expirationTtl: 7200 }); // 2 hours
        
        // Clear rate limit counter and any lockout on successful login
        await env.LEADSTICK_CONFIGS.delete(rateLimitKey);
        await env.LEADSTICK_CONFIGS.delete(lockoutKey);
        
        logAdminOperation('SUCCESSFUL_LOGIN', { clientIP });
        
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

    // Route: POST /admin/verify-session - Verify admin session
    if (request.method === 'POST' && url.pathname === '/admin/verify-session') {
      try {
        const authResult = await authenticateAdmin(request, env);
        if (!authResult.valid) {
          return new Response(JSON.stringify({ 
            valid: false,
            error: authResult.error || 'Invalid session'
          }), { 
            status: 401, 
            headers: corsHeaders 
          });
        }
        
        // Session is valid, return session info
        return new Response(JSON.stringify({ 
          valid: true,
          sessionInfo: {
            createdAt: authResult.session.createdAt,
            csrfToken: authResult.session.csrfToken
          }
        }), { 
          headers: corsHeaders 
        });
        
      } catch (error) {
        console.error('Session verification error:', error);
        return new Response(JSON.stringify({ 
          valid: false,
          error: 'Session verification failed' 
        }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // Route: GET /admin/nonce - Get CSP nonce for admin dashboard
    if (request.method === 'GET' && url.pathname === '/admin/nonce') {
      return new Response(JSON.stringify({ 
        nonce: nonce,
        timestamp: Date.now()
      }), { 
        headers: corsHeaders 
      });
    }

    // Route: POST /admin/upload-avatar - Upload avatar to R2
    if (request.method === 'POST' && url.pathname === '/admin/upload-avatar') {
      // Check authentication with CSRF
      const authResult = await authenticateAdmin(request, env, true);
      if (!authResult.valid) {
        logAdminOperation('UNAUTHORIZED_ACCESS_ATTEMPT', { 
          endpoint: '/admin/upload-avatar',
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
        console.log('[Avatar Upload] Parsing form data...');
        const formData = await request.formData();
        const avatarFile = formData.get('avatar');
        const siteId = formData.get('siteId');
        
        console.log('[Avatar Upload] Form data parsed:', {
          hasAvatarFile: !!avatarFile,
          avatarFileName: avatarFile?.name,
          avatarFileSize: avatarFile?.size,
          avatarFileType: avatarFile?.type,
          siteId: siteId
        });

        if (!avatarFile || !siteId) {
          console.log('[Avatar Upload] Missing required fields');
          return new Response(JSON.stringify({
            error: 'Missing avatar file or siteId'
          }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        // Validate file type and size
        if (!avatarFile.type.match(/^image\/(png|jpeg|jpg)$/)) {
          return new Response(JSON.stringify({
            error: 'Invalid file type. Only PNG and JPG are allowed.'
          }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        if (avatarFile.size > 2 * 1024 * 1024) { // 2MB limit
          return new Response(JSON.stringify({
            error: 'File too large. Maximum size is 2MB.'
          }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        // Generate unique filename
        const fileExtension = avatarFile.name.split('.').pop() || 'png';
        const fileName = `avatars/${siteId}_${Date.now()}.${fileExtension}`;

        // Upload to R2
        console.log('[Avatar Upload] R2 bucket available:', !!env.R2_BUCKET);
        console.log('[Avatar Upload] Generated filename:', fileName);
        
        if (env.R2_BUCKET) {
          console.log('[Avatar Upload] Converting file to array buffer...');
          const arrayBuffer = await avatarFile.arrayBuffer();
          console.log('[Avatar Upload] Array buffer size:', arrayBuffer.byteLength);
          
          console.log('[Avatar Upload] Uploading to R2...');
          await env.R2_BUCKET.put(fileName, arrayBuffer, {
            httpMetadata: {
              contentType: avatarFile.type,
            },
          });
          console.log('[Avatar Upload] R2 upload successful');

          // Return the public URL
          const avatarUrl = `https://pub-2cf19529958742fea36d2ac68c558716.r2.dev/${fileName}`;
          console.log('[Avatar Upload] Generated public URL:', avatarUrl);
          
          // Update client configuration with new avatar URL
          try {
            const configKey = `client_config_${siteId}`;
            const existingConfig = await env.LEADSTICK_CONFIGS.get(configKey, 'json');
            
            if (existingConfig) {
              // Update existing config with new avatar
              existingConfig.business = existingConfig.business || {};
              existingConfig.business.avatar = avatarUrl;
              
              await env.LEADSTICK_CONFIGS.put(configKey, JSON.stringify(existingConfig));
              console.log('[Avatar Upload] Client config updated with new avatar URL');
            } else {
              console.log('[Avatar Upload] No existing config found for siteId:', siteId);
            }
          } catch (configError) {
            console.error('[Avatar Upload] Failed to update client config:', configError);
            // Continue anyway - avatar was uploaded successfully
          }
          
          return new Response(JSON.stringify({
            success: true,
            avatarUrl: avatarUrl
          }), { 
            headers: corsHeaders 
          });
        } else {
          console.log('[Avatar Upload] R2 bucket not configured');
          return new Response(JSON.stringify({
            error: 'File storage not configured'
          }), { 
            status: 500, 
            headers: corsHeaders 
          });
        }

      } catch (error) {
        console.error('Avatar upload error:', error);
        return new Response(JSON.stringify({
          error: 'Upload failed'
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

      // Validate siteId parameter
      const siteIdValidation = validateAdminInput(siteId, 'siteId', true);
      if (!siteIdValidation.isValid) {
        return new Response(JSON.stringify({ 
          error: 'Invalid Site ID format'
        }), { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      try {
        // Fetch config from KV
        const configKey = `client_config_${siteIdValidation.sanitized}`;
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
        logAdminOperation('UNAUTHORIZED_ACCESS_ATTEMPT', { 
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

      logAdminOperation('LIST_CLIENTS');
      
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
              businessName: config.business?.name || '',
              email: config.business?.email || '',
              emailSubject: config.business?.emailSubject || '',
              agentName: config.business?.agentName || '',
              phone: config.business?.phone || '',
              avatar: config.business?.avatar || '',
              theme: config.theme?.primary || '#3b82f6',
              desktopStyle: config.desktopStyle || 'bubble',
              barText: config.barText || 'Get A Quick Quote',
              showPhoneCta: config.showPhoneCta !== false,
              questions: config.flow || [],
              messages: config.messages || {},
              lastModified: key.metadata?.lastModified || new Date().toISOString()
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
        logAdminOperation('UNAUTHORIZED_ACCESS_ATTEMPT', { 
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
        
        // Enhanced validation for client data
        const validationErrors = [];
        
        // Generate random Site ID
        let generatedSiteId;
        let configKey;
        let existing;
        let attempts = 0;
        const maxAttempts = 10;
        
        // Keep generating until we find a unique Site ID
        do {
          generatedSiteId = generateSiteId();
          configKey = `client_config_${generatedSiteId}`;
          existing = await env.LEADSTICK_CONFIGS.get(configKey);
          attempts++;
        } while (existing && attempts < maxAttempts);
        
        if (existing) {
          return new Response(JSON.stringify({ 
            error: 'Failed to generate unique Site ID after multiple attempts' 
          }), { 
            status: 500, 
            headers: corsHeaders 
          });
        }
        
        // Validate required fields (no Site ID validation needed)
        const businessNameValidation = validateAdminInput(clientData.business?.name, 'businessName', true);
        const emailValidation = validateAdminInput(clientData.business?.email, 'email', true);
        
        // Validate optional fields
        const emailSubjectValidation = validateAdminInput(clientData.business?.emailSubject, 'message', false);
        const phoneValidation = validateAdminInput(clientData.business?.phone, 'phone', false);
        const agentNameValidation = validateAdminInput(clientData.business?.agentName, 'agentName', false);
        const avatarValidation = validateAdminInput(clientData.business?.avatar, 'avatar', false);
        
        // Collect all validation errors
        [businessNameValidation, emailValidation, emailSubjectValidation, phoneValidation, agentNameValidation, avatarValidation]
          .forEach(validation => {
            if (!validation.isValid) {
              validationErrors.push(...validation.errors);
            }
          });
        
        if (validationErrors.length > 0) {
          return new Response(JSON.stringify({ 
            error: 'Validation failed',
            details: validationErrors
          }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }
        
        // Validate and sanitize theme, message, and desktop style data
        let sanitizedTheme = {};
        let sanitizedMessages = {};
        let sanitizedFlow = [];
        let sanitizedDesktopStyle = 'bubble'; // Default
        let sanitizedBarText = 'Get A Quick Quote'; // Default
        
        if (clientData.theme && typeof clientData.theme === 'object') {
          // Validate theme colors
          if (clientData.theme.primary && !/^#[0-9A-Fa-f]{6}$/.test(clientData.theme.primary)) {
            validationErrors.push('Invalid primary theme color format');
          } else {
            sanitizedTheme.primary = clientData.theme.primary;
          }
        }
        
        if (clientData.messages && typeof clientData.messages === 'object') {
          // Validate message content
          Object.keys(clientData.messages).forEach(key => {
            const messageValidation = validateAdminInput(clientData.messages[key], 'message', false);
            if (!messageValidation.isValid) {
              validationErrors.push(`Invalid message content for ${key}`);
            } else {
              sanitizedMessages[key] = messageValidation.sanitized;
            }
          });
        }
        
        if (clientData.flow && Array.isArray(clientData.flow)) {
          sanitizedFlow = clientData.flow.slice(0, 20); // Limit to 20 flow items
        }

        // Validate desktop style configuration
        if (clientData.desktopStyle) {
          if (['bubble', 'bar'].includes(clientData.desktopStyle)) {
            sanitizedDesktopStyle = clientData.desktopStyle;
          } else {
            validationErrors.push('Invalid desktop style. Must be "bubble" or "bar"');
          }
        }

        // Validate bar text configuration
        if (clientData.barText !== undefined) {
          const barTextValidation = validateAdminInput(clientData.barText, 'barText', false);
          if (!barTextValidation.isValid) {
            validationErrors.push('Invalid bar text format');
          } else if (barTextValidation.sanitized.length > 30) {
            validationErrors.push('Bar text must be 30 characters or less');
          } else {
            sanitizedBarText = barTextValidation.sanitized || 'Get A Quick Quote';
          }
        }
        
        if (validationErrors.length > 0) {
          return new Response(JSON.stringify({ 
            error: 'Validation failed',
            details: validationErrors
          }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }
        
        // Validate showPhoneCta boolean
        let sanitizedShowPhoneCta = true; // Default to true
        if (clientData.showPhoneCta !== undefined) {
          sanitizedShowPhoneCta = Boolean(clientData.showPhoneCta);
        }

        // Create sanitized client data
        const sanitizedClientData = {
          siteId: generatedSiteId,
          business: {
            name: businessNameValidation.sanitized,
            email: emailValidation.sanitized,
            emailSubject: emailSubjectValidation.sanitized || '',
            phone: phoneValidation.sanitized,
            agentName: agentNameValidation.sanitized,
            avatar: avatarValidation.sanitized
          },
          theme: sanitizedTheme,
          messages: sanitizedMessages,
          flow: sanitizedFlow,
          desktopStyle: sanitizedDesktopStyle,
          barText: sanitizedBarText,
          barTextMaxLength: 30,
          showPhoneCta: sanitizedShowPhoneCta
        };

        // Save to KV
        await env.LEADSTICK_CONFIGS.put(configKey, JSON.stringify(sanitizedClientData));
        
        logAdminOperation('CREATE_CLIENT', { 
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
        logAdminOperation('UNAUTHORIZED_ACCESS_ATTEMPT', { 
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

      // Validate siteId parameter to prevent IDOR attacks
      const siteIdValidation = validateAdminInput(siteId, 'siteId', true);
      if (!siteIdValidation.isValid) {
        return new Response(JSON.stringify({ 
          error: 'Invalid Site ID format',
          details: siteIdValidation.errors
        }), { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      try {
        const clientData = await request.json();
        const configKey = `client_config_${siteIdValidation.sanitized}`;
        
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
        
        // Enhanced validation for client update data
        const validationErrors = [];
        
        // Validate business fields (all optional for updates)
        const businessNameValidation = validateAdminInput(clientData.business?.name, 'businessName', false);
        const emailValidation = validateAdminInput(clientData.business?.email, 'email', false);
        const emailSubjectValidation = validateAdminInput(clientData.business?.emailSubject, 'message', false);
        const phoneValidation = validateAdminInput(clientData.business?.phone, 'phone', false);
        const agentNameValidation = validateAdminInput(clientData.business?.agentName, 'agentName', false);
        const avatarValidation = validateAdminInput(clientData.business?.avatar, 'avatar', false);
        
        // Collect validation errors
        [businessNameValidation, emailValidation, emailSubjectValidation, phoneValidation, agentNameValidation, avatarValidation]
          .forEach(validation => {
            if (!validation.isValid) {
              validationErrors.push(...validation.errors);
            }
          });
        
        // Validate theme, message, and desktop style data
        let sanitizedTheme = {};
        let sanitizedMessages = {};
        let sanitizedFlow = [];
        let sanitizedDesktopStyle = 'bubble'; // Default
        let sanitizedBarText = 'Get A Quick Quote'; // Default
        
        if (clientData.theme && typeof clientData.theme === 'object') {
          if (clientData.theme.primary && !/^#[0-9A-Fa-f]{6}$/.test(clientData.theme.primary)) {
            validationErrors.push('Invalid primary theme color format');
          } else {
            sanitizedTheme.primary = clientData.theme.primary;
          }
        }
        
        if (clientData.messages && typeof clientData.messages === 'object') {
          Object.keys(clientData.messages).forEach(key => {
            const messageValidation = validateAdminInput(clientData.messages[key], 'message', false);
            if (!messageValidation.isValid) {
              validationErrors.push(`Invalid message content for ${key}`);
            } else {
              sanitizedMessages[key] = messageValidation.sanitized;
            }
          });
        }
        
        if (clientData.flow && Array.isArray(clientData.flow)) {
          sanitizedFlow = clientData.flow.slice(0, 20);
        }

        // Validate desktop style configuration
        if (clientData.desktopStyle) {
          if (['bubble', 'bar'].includes(clientData.desktopStyle)) {
            sanitizedDesktopStyle = clientData.desktopStyle;
          } else {
            validationErrors.push('Invalid desktop style. Must be "bubble" or "bar"');
          }
        }

        // Validate bar text configuration
        if (clientData.barText !== undefined) {
          const barTextValidation = validateAdminInput(clientData.barText, 'barText', false);
          if (!barTextValidation.isValid) {
            validationErrors.push('Invalid bar text format');
          } else if (barTextValidation.sanitized.length > 30) {
            validationErrors.push('Bar text must be 30 characters or less');
          } else {
            sanitizedBarText = barTextValidation.sanitized || 'Get A Quick Quote';
          }
        }
        
        if (validationErrors.length > 0) {
          return new Response(JSON.stringify({ 
            error: 'Validation failed',
            details: validationErrors
          }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }
        
        // Create sanitized client data
        const sanitizedClientData = {
          siteId: siteIdValidation.sanitized,
          business: {
            name: businessNameValidation.sanitized || '',
            email: emailValidation.sanitized || '',
            emailSubject: emailSubjectValidation.sanitized || '',
            phone: phoneValidation.sanitized || '',
            agentName: agentNameValidation.sanitized || '',
            avatar: avatarValidation.sanitized || ''
          },
          theme: sanitizedTheme,
          messages: sanitizedMessages,
          flow: sanitizedFlow,
          desktopStyle: sanitizedDesktopStyle,
          barText: sanitizedBarText,
          barTextMaxLength: 30
        };
        
        // Save updated config
        await env.LEADSTICK_CONFIGS.put(configKey, JSON.stringify(sanitizedClientData));
        
        logAdminOperation('UPDATE_CLIENT', { 
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
        logAdminOperation('UNAUTHORIZED_ACCESS_ATTEMPT', { 
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

      // Validate siteId parameter to prevent IDOR attacks
      const siteIdValidation = validateAdminInput(siteId, 'siteId', true);
      if (!siteIdValidation.isValid) {
        return new Response(JSON.stringify({ 
          error: 'Invalid Site ID format',
          details: siteIdValidation.errors
        }), { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      try {
        const configKey = `client_config_${siteIdValidation.sanitized}`;
        
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
        
        logAdminOperation('DELETE_CLIENT', { 
          siteId: siteIdValidation.sanitized
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
      console.log('[Lead Submission] Received POST request to /');
      
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
          reason: rateLimitResult.reason,
          remaining: rateLimitResult.remaining,
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
      console.log('[Lead Submission] Received lead data:', {
        hasName: !!leadData.name,
        hasFirstName: !!leadData.firstName,
        hasLastName: !!leadData.lastName,
        hasPhone: !!leadData.phone,
        hasEmail: !!leadData.email,
        hasLocation: !!leadData.location,
        hasService: !!leadData.service,
        source: leadData.source,
        siteId: leadData.siteId
      });
      
      // Validate and sanitize lead data
      const { sanitized, errors, isSpam } = validateAndSanitizeLead(leadData);
      
      if (errors.length > 0) {
        // Log spam attempts for monitoring
        if (isSpam) {
          console.warn('Spam attempt blocked:', {
            reason: errors[0],
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
      let customSubject = '';
      if (sanitized.siteId) {
        try {
          const configKey = `client_config_${sanitized.siteId}`;
          const config = await env.LEADSTICK_CONFIGS.get(configKey, 'json');
          if (config && config.business) {
            if (config.business.email) {
              recipientEmail = config.business.email;
            }
            if (config.business.emailSubject) {
              customSubject = config.business.emailSubject;
            }
          }
        } catch (error) {
          console.warn('Failed to fetch client config:', error);
        }
      }

      // Parse multiple email addresses (comma-separated)
      const emailList = recipientEmail.split(',').map(email => email.trim()).filter(email => email);
      console.log('Parsed email list:', emailList);

      // Send email via Resend
      const emailSent = await sendEmail(sanitized, leadId, emailList, env, customSubject);
      
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
async function sendEmail(lead, leadId, emailList, env, customSubject = '') {
  if (!env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured');
    return false;
  }

  if (!emailList || emailList.length === 0) {
    console.warn('No email recipients provided');
    return false;
  }

  console.log('Sending email to recipients:', emailList);
  console.log('Attribution data being passed to email:', lead.attribution);

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
              <tr><td style="font-weight: 600; width: 80px; color: #374151;">Source:</td><td style="color: #6b7280;">${escapeHtml(touch.source || 'direct')}</td></tr>
              <tr><td style="font-weight: 600; color: #374151;">Medium:</td><td style="color: #6b7280;">${escapeHtml(touch.medium || 'direct')}</td></tr>
              ${touch.campaign ? `<tr><td style="font-weight: 600; color: #374151;">Campaign:</td><td style="color: #6b7280;">${escapeHtml(touch.campaign)}</td></tr>` : ''}
              ${touch.content ? `<tr><td style="font-weight: 600; color: #374151;">Ad Content:</td><td style="color: #6b7280;">${escapeHtml(touch.content)}</td></tr>` : ''}
              ${touch.term ? `<tr><td style="font-weight: 600; color: #374151;">Keyword:</td><td style="color: #6b7280;">${escapeHtml(touch.term)}</td></tr>` : ''}
              ${touch.gclid ? `<tr><td style="font-weight: 600; color: #374151;">Google ID:</td><td style="color: #6b7280; font-family: monospace; font-size: 11px;">${escapeHtml(touch.gclid.substring(0, 20))}...</td></tr>` : ''}
              ${touch.fbclid ? `<tr><td style="font-weight: 600; color: #374151;">Facebook ID:</td><td style="color: #6b7280; font-family: monospace; font-size: 11px;">${escapeHtml(touch.fbclid.substring(0, 20))}...</td></tr>` : ''}
              ${touch.landingPage ? `<tr><td style="font-weight: 600; color: #374151;">Landing Page:</td><td style="color: #6b7280; word-break: break-all;">${escapeHtml(touch.landingPage)}</td></tr>` : ''}
              ${touch.referrer ? `<tr><td style="font-weight: 600; color: #374151;">Referrer:</td><td style="color: #6b7280; word-break: break-all;">${escapeHtml(touch.referrer)}</td></tr>` : ''}
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
          ${sessionId ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;"><strong>Session ID:</strong> ${escapeHtml(sessionId)}</p>` : ''}
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

    // Process custom subject if provided, otherwise use default
    let subject = '';
    if (customSubject) {
      // Replace {name} variable in custom subject
      subject = customSubject.replace(/{name}/g, escapeHtml(lead.name || 'Customer'));
    } else {
      // Improved default subject line
      subject = `🎯 New Lead from ${escapeHtml(lead.name || 'Website')}`;
    }

    const emailPayload = {
      from: env.LEAD_EMAIL_FROM || 'LeadStick <noreply@leadstick.com>',
      to: emailList,
      subject: subject,
    };

    console.log('Email payload being sent to Resend:', JSON.stringify(emailPayload, null, 2));

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...emailPayload,
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
                    <span style="color: #78350f;">${escapeHtml(metrics.timeToConvert)}</span>
                  </div>
                  <div style="display: flex; align-items: flex-start;">
                    <span style="font-weight: 600; color: #92400e; width: 140px; display: inline-block; flex-shrink: 0;">Landing Page:</span>
                    <a href="${escapeHtml(metrics.landingPage)}" style="color: #3b82f6; text-decoration: none; word-break: break-all; font-size: 13px;">${escapeHtml(metrics.landingPage)}</a>
                  </div>
                  <div style="display: flex; align-items: center;">
                    <span style="font-weight: 600; color: #92400e; width: 140px; display: inline-block;">Session ID:</span>
                    <span style="color: #78350f; font-family: monospace; font-size: 12px;">${escapeHtml(metrics.sessionId)}</span>
                  </div>
                </div>
              </div>
              ` : ''}

              <!-- Marketing Insight -->
              <div style="background: #d1fae5; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
                <h4 style="margin: 0 0 8px 0; color: #065f46; font-size: 14px; font-weight: 600; display: flex; align-items: center;">
                  💡 Marketing Insight:
                </h4>
                <p style="margin: 0; color: #047857; font-size: 14px;">${escapeHtml(marketingInsight)}</p>
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resend API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        emailList: emailList,
        emailListLength: emailList.length
      });
      return false;
    }
    
    const responseData = await response.json();
    console.log('Email sent successfully:', responseData);
    return true;
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