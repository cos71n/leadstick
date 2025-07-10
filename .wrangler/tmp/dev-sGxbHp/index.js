var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-KdPBvS/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// worker/index.js
var worker_default = {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({
        error: "Method not allowed",
        message: "Only POST requests are supported"
      }), {
        status: 405,
        headers: corsHeaders
      });
    }
    try {
      const leadData = await request.json();
      const requiredFields = ["location", "service", "name", "phone"];
      const missingFields = requiredFields.filter((field) => !leadData[field]);
      if (missingFields.length > 0) {
        return new Response(JSON.stringify({
          error: "Missing required fields",
          missingFields
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      const leadId = generateLeadId();
      const processedLead = {
        ...leadData,
        id: leadId,
        processedAt: (/* @__PURE__ */ new Date()).toISOString(),
        ipAddress: request.headers.get("CF-Connecting-IP") || "unknown",
        userAgent: request.headers.get("User-Agent") || "unknown",
        country: request.cf?.country || "unknown"
      };
      const [emailResult, analyticsResult] = await Promise.allSettled([
        sendEmailNotification(processedLead, env),
        trackGA4Event(processedLead, env)
      ]);
      console.log("Email result:", emailResult);
      console.log("Analytics result:", analyticsResult);
      return new Response(JSON.stringify({
        success: true,
        leadId,
        message: "Lead submitted successfully",
        email: emailResult.status === "fulfilled" ? "sent" : "failed",
        analytics: analyticsResult.status === "fulfilled" ? "tracked" : "failed"
      }), {
        headers: corsHeaders
      });
    } catch (error) {
      console.error("Error processing lead:", error);
      return new Response(JSON.stringify({
        error: "Internal server error",
        message: "Failed to process lead submission"
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};
async function sendEmailNotification(leadData, env) {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }
  const emailHtml = generateEmailTemplate(leadData);
  const emailPayload = {
    from: "LeadStick <noreply@leadstick.com>",
    to: ["leads@quickservicepro.com"],
    // Update with actual recipient
    subject: `\u{1F3AF} New Lead: ${leadData.service} in ${leadData.location}`,
    html: emailHtml
  };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(emailPayload)
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }
  return await response.json();
}
__name(sendEmailNotification, "sendEmailNotification");
async function trackGA4Event(leadData, env) {
  if (!env.GA4_MEASUREMENT_ID || !env.GA4_API_SECRET) {
    console.warn("GA4 tracking not configured");
    return { skipped: true };
  }
  const ga4Payload = {
    client_id: leadData.id,
    // Use lead ID as client ID
    events: [{
      name: "leadstick_server_conversion",
      params: {
        business_name: leadData.business || "Stone Quoter",
        service_selected: leadData.service,
        location: leadData.location,
        lead_source: "leadstick-widget",
        lead_id: leadData.id,
        value: 100,
        // Estimated lead value
        currency: "USD",
        country: leadData.country
      }
    }]
  };
  const ga4Url = `https://www.google-analytics.com/mp/collect?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`;
  const response = await fetch(ga4Url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(ga4Payload)
  });
  if (!response.ok) {
    throw new Error(`GA4 tracking failed: ${response.status}`);
  }
  return { tracked: true };
}
__name(trackGA4Event, "trackGA4Event");
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
        <h1>\u{1F3AF} New Lead from Your Website!</h1>
        <p>A potential customer has submitted a quote request through your LeadStick widget.</p>
      </div>
      
      <div class="content">
        <div class="field">
          <span class="label">\u{1F4CD} Location:</span>
          <span class="value">${leadData.location}</span>
        </div>
        
        <div class="field">
          <span class="label">\u{1F527} Project:</span>
          <span class="value">${leadData.service}</span>
        </div>
        
        <div class="field">
          <span class="label">\u{1F464} Name:</span>
          <span class="value">${leadData.name}</span>
        </div>
        
        <div class="field">
          <span class="label">\u{1F4F1} Phone:</span>
          <span class="value"><a href="tel:${leadData.phone}">${leadData.phone}</a></span>
        </div>
        
        ${leadData.email ? `
        <div class="field">
          <span class="label">\u{1F4E7} Email:</span>
          <span class="value"><a href="mailto:${leadData.email}">${leadData.email}</a></span>
        </div>
        ` : ""}
        
        ${leadData.finalMessage ? `
        <div class="field">
          <span class="label">\u{1F4AC} Message:</span>
          <span class="value">${leadData.finalMessage}</span>
        </div>
        ` : ""}
        
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
__name(generateEmailTemplate, "generateEmailTemplate");
function generateLeadId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `lead_${timestamp}_${random}`;
}
__name(generateLeadId, "generateLeadId");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-KdPBvS/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-KdPBvS/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
