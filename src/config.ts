// Hardcoded configuration for MVP testing
export const CONFIG = {
  business: {
    name: "Stone Quoter",
    phone: "0424 166 346",
    email: "leads@quickservicepro.com",
    agentName: "Matt",
    // Simple avatar - either use image URL or fallback to initials
    avatar: "/matt-profile.png", // Will fallback to "M" if image fails to load
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjMjU2M2ViIi8+Cjwvc3ZnPgo="
  },
  services: [
    "Burleigh",
    "Mermaid Waters",
    "Tweed Heads",
    "Surfers Paradise",
    "Broadbeach",
    "Currumbin"
  ],
  theme: {
    primary: "rgb(246, 165, 96)",
    primaryHover: "rgb(236, 145, 76)",
    secondary: "#f3f4f6",
    background: "#ffffff",
    text: "#1f2937",
    muted: "#6b7280",
    border: "#e5e7eb"
  },
  ga4: {
    measurementId: "G-XXXXXXXXXX" // Will be configured during deployment
  },
  googleAds: {
    conversionId: "", // e.g., "AW-123456789"
    conversionLabel: "", // e.g., "AbC-D_efG-h12_34-567"
    phoneConversionLabel: "", // Separate conversion label for phone click tracking
    enableCallForwarding: false // Enable Google forwarding number swap
  },
  metaAds: {
    pixelId: "",
    eventName: "Lead", // Lead, CompleteRegistration, Contact, SubmitApplication, or custom
    enablePixel: false
  },
  apiEndpoint: "https://leadstick-api.attribution.workers.dev",
  siteId: "", // Default empty siteId
  // New desktop widget style configuration
  desktopStyle: 'bubble' as 'bubble' | 'bar', // Default to bubble for backward compatibility
  barText: 'Get A Quick Quote', // Default text for floating bar
  barTextMaxLength: 30, // Character limit for bar text
  attentionWobble: false, // Subtle shake animation to attract attention
  attentionGlint: false, // Glint/shine effect across the button
  // Font, weight, and icon settings per device
  buttonFont: {
    desktop: { family: 'System Default', weight: '500' },
    mobile: { family: 'System Default', weight: '500' }
  },
  buttonIcon: {
    desktop: { icon: 'message-circle', show: true },
    mobile: { icon: 'message-circle', show: true }
  }
} 