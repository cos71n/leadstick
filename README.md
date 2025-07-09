# 🎯 LeadStick

> Smart lead generation chat widget for service businesses

![Version](https://img.shields.io/npm/v/leadstick)
![License](https://img.shields.io/npm/l/leadstick)
![Size](https://img.shields.io/bundlephobia/minzip/leadstick)

LeadStick is a lightweight, customizable chat widget that helps service businesses capture leads through an intelligent conversational interface.

## ✨ Features

- 📱 **Mobile-First Design** - Sticky bottom bar on mobile, floating bubble on desktop
- 🎯 **Smart Lead Qualification** - Multi-step flow to capture quality leads
- 🎨 **Fully Customizable** - Match your brand with custom colors and styling
- 📊 **Built-in Analytics** - Track conversions and user behavior
- 🔒 **Privacy-First** - No cookies, GDPR compliant
- ⚡ **Lightweight** - <50KB gzipped

## 🚀 Quick Start

### CDN Installation (Easiest)

```html
<script src="https://unpkg.com/leadstick@latest/dist/leadstick.umd.js"></script>
<link rel="stylesheet" href="https://unpkg.com/leadstick@latest/dist/leadstick.css">

<script>
  LeadStick.init({
    businessName: 'Your Business Name',
    businessPhone: '123-456-7890',
    services: ['Service 1', 'Service 2', 'Service 3'],
    primaryColor: '#your-brand-color'
  });
</script>
```

### NPM Installation

```bash
npm install leadstick
```

```javascript
import LeadStick from 'leadstick';
import 'leadstick/dist/leadstick.css';

LeadStick.init({
  businessName: 'Your Business Name',
  businessPhone: '123-456-7890',
  services: ['Service 1', 'Service 2', 'Service 3']
});
```

## 📖 Configuration Options

```javascript
LeadStick.init({
  // Required
  businessName: 'Your Business',
  businessPhone: '123-456-7890',
  
  // Appearance
  primaryColor: '#10b981',
  position: 'bottom-right', // or 'bottom-left'
  size: 'md', // 'sm', 'md', 'lg'
  
  // Business Details
  agentName: 'Sarah',
  agentAvatar: 'https://your-avatar-url.jpg',
  
  // Services & Locations
  services: ['Service 1', 'Service 2'],
  locations: ['City 1', 'City 2'],
  
  // Callbacks
  onLeadSubmit: async (leadData) => {
    // Handle lead submission
    console.log('New lead:', leadData);
  },
  
  // API Integration
  apiEndpoint: 'https://your-api.com/leads',
  apiKey: 'your-api-key'
});
```

## 🛠️ API Methods

```javascript
// Open the chat widget
LeadStick.open();

// Close the chat widget
LeadStick.close();

// Destroy the widget
LeadStick.destroy();
```

## 📊 Lead Data Structure

```javascript
{
  location: "Customer's location",
  service: "Selected service",
  name: "Customer name",
  phone: "Phone number",
  message: "Optional message",
  timestamp: "2024-01-01T00:00:00Z",
  source: "leadstick-widget"
}
```

## 🎨 Customization

### CSS Variables

```css
:root {
  --leadstick-primary: #10b981;
  --leadstick-primary-hover: #059669;
  --leadstick-text: #1f2937;
  --leadstick-bg: #ffffff;
  --leadstick-border: #e5e7eb;
}
```

## 📄 License

MIT © LeadStick

---

Built with ❤️ for service businesses
