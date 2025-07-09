// Hardcoded configuration for MVP testing
export const CONFIG = {
  business: {
    name: "Stone Quoter",
    phone: "0424 166 346",
    email: "leads@quickservicepro.com",
    agentName: "Matt",
    // Inline SVG icon for service business
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
  apiEndpoint: "https://api.leadstick.com/submit"
} 