// Hardcoded configuration for MVP testing
export const CONFIG = {
  business: {
    name: "QuickService Pro",
    phone: "1-800-LEADSTICK",
    email: "leads@quickservicepro.com",
    agentName: "Sarah",
    // Inline SVG icon for service business
    logo: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjMjU2M2ViIi8+Cjwvc3ZnPgo="
  },
  services: [
    "Free Consultation",
    "Home Service Call",
    "Emergency Service",
    "Maintenance Check",
    "Installation Service",
    "Repair Service"
  ],
  theme: {
    primary: "#2563eb",
    primaryHover: "#1d4ed8",
    secondary: "#f3f4f6",
    background: "#ffffff",
    text: "#1f2937",
    muted: "#6b7280",
    border: "#e5e7eb"
  },
  ga4: {
    measurementId: "G-XXXXXXXXXX" // Will be configured during deployment
  },
  apiEndpoint: "https://api.leadstick.com/submit",
  avatarUrl: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=64&h=64&fit=crop&crop=face"
} 