import React from 'react';
import ReactDOM from 'react-dom/client';
import { LeadStickWidget } from './components/LeadStickWidget';
import './styles/leadstick.css';

export interface LeadStickConfig {
  // Business Configuration
  businessName: string;
  businessPhone: string;
  businessLogo?: string;
  agentName?: string;
  agentAvatar?: string;
  
  // Appearance
  primaryColor?: string;
  position?: 'bottom-right' | 'bottom-left';
  size?: 'sm' | 'md' | 'lg';
  mobileSticky?: boolean;
  
  // Services & Flow
  services?: string[];
  locations?: string[];
  customFields?: Array<{
    id: string;
    label: string;
    type: 'text' | 'select' | 'tel' | 'email';
    required?: boolean;
    options?: string[];
  }>;
  
  // API & Callbacks
  onLeadSubmit?: (leadData: any) => void | Promise<void>;
  apiEndpoint?: string;
  apiKey?: string;
  
  // Analytics
  trackingId?: string;
  debug?: boolean;
}

// Browser global initialization
declare global {
  interface Window {
    LeadStick: {
      init: (config: LeadStickConfig) => void;
      destroy: () => void;
      open: () => void;
      close: () => void;
    };
  }
}

class LeadStick {
  private root: ReactDOM.Root | null = null;
  private container: HTMLElement | null = null;
  
  init(config: LeadStickConfig) {
    // Create or get container
    this.container = document.getElementById('leadstick-root') || this.createContainer();
    
    // Create React root and render
    this.root = ReactDOM.createRoot(this.container);
    this.root.render(
      <React.StrictMode>
        <LeadStickWidget {...config} />
      </React.StrictMode>
    );
  }
  
  destroy() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }
  }
  
  private createContainer(): HTMLElement {
    const div = document.createElement('div');
    div.id = 'leadstick-root';
    div.className = 'leadstick-container';
    document.body.appendChild(div);
    return div;
  }
}

// Initialize global instance
if (typeof window !== 'undefined') {
  window.LeadStick = new LeadStick();
}

// Export for module usage
export { LeadStickWidget, LeadStick };
export default LeadStick;
