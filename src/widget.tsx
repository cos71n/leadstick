import { h, Fragment } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import { render } from 'preact'
import { CONFIG } from './config'

// Global gtag function for GA4 tracking
declare global {
  function gtag(...args: any[]): void
}

// Types
type ChatStep = 'location' | 'service' | 'contact' | 'complete'

interface AttributionData {
  source: string
  medium: string
  campaign: string
  content: string
  term: string
  gclid: string
  fbclid: string
  msclkid: string
  ttclid: string
  landingPage: string
  referrer: string
  timestamp: string
}

interface LeadData {
  location: string
  service: string
  name: string
  phone: string
  email: string
  finalMessage: string
  attribution?: {
    firstTouch: AttributionData
    lastTouch: AttributionData
    sessionId: string
  }
  // Honeypot field - should remain empty
  website?: string
  // Time tracking for spam prevention
  formOpenTime?: number
}

// Inline SVG Icons
const MessageCircleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
  </svg>
)

const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
)

const XIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
)


const CornerDownLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9,10 4,15 9,20"/>
    <path d="M20,4v7a4,4 0 0,1 -4,4H4"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20,6 9,17 4,12"/>
  </svg>
)

// Chat Input Form Component
const ChatInputForm = ({ 
  input, 
  setInput, 
  leadData, 
  setLeadData, 
  handleSubmit, 
  getInputPlaceholder, 
  currentStep, 
  CONFIG,
  isMobile = false 
}: {
  input: string;
  setInput: (value: string) => void;
  leadData: LeadData;
  setLeadData: (updater: (prev: LeadData) => LeadData) => void;
  handleSubmit: (e?: Event) => void;
  getInputPlaceholder: () => string;
  currentStep: ChatStep;
  CONFIG: any;
  isMobile?: boolean;
}) => (
  <div style={{
    borderTop: '1px solid ' + CONFIG.theme.border,
    padding: '16px',
    paddingBottom: isMobile ? '32px' : '16px'
  }}>
    <form onSubmit={handleSubmit} style={{
      position: 'relative',
      borderRadius: '8px',
      border: '1px solid ' + CONFIG.theme.border,
      backgroundColor: CONFIG.theme.background,
      padding: '4px'
    }}>
      {/* Honeypot field - hidden from users but visible to bots */}
      <input
        type="text"
        name="website"
        value={leadData.website}
        onChange={(e) => setLeadData(prev => ({ ...prev, website: e.target.value }))}
        style={{
          position: 'absolute',
          left: '-9999px',
          width: '1px',
          height: '1px',
          overflow: 'hidden'
        }}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={getInputPlaceholder()}
        maxLength={500}
        inputMode={currentStep === 'contact' && leadData.name && !leadData.phone ? 'tel' : 'text'}
        style={{
          minHeight: '48px',
          resize: 'none',
          borderRadius: '8px',
          backgroundColor: CONFIG.theme.background,
          border: 'none',
          padding: '12px',
          boxShadow: 'none',
          outline: 'none',
          width: 'calc(100% - 8px)',
          fontSize: isMobile ? '16px' : '14px',
          fontFamily: 'inherit',
          boxSizing: 'border-box'
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && currentStep !== 'service') {
            e.preventDefault()
            handleSubmit()
          }
        }}
      />
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 12px 0',
        justifyContent: 'space-between'
      }}>
        <button
          type="submit"
          disabled={!input.trim()}
          style={{
            gap: '6px',
            backgroundColor: CONFIG.theme.primary,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: isMobile ? '12px 16px' : '8px 12px',
            fontSize: isMobile ? '16px' : '14px',
            display: 'flex',
            alignItems: 'center',
            cursor: !input.trim() ? 'not-allowed' : 'pointer',
            opacity: !input.trim() ? 0.5 : 1,
            pointerEvents: 'auto'
          }}
        >
          Send
          <CornerDownLeftIcon />
        </button>
      </div>
    </form>
  </div>
)

// Chat Message Component
const ChatMessage = ({ message, CONFIG }: { message: any; CONFIG: any }) => (
  <div style={{
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    marginBottom: '16px',
    flexDirection: message.sender === 'user' ? 'row-reverse' : 'row'
  }}>
    {/* Avatar */}
    <div style={{
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      backgroundColor: message.sender === 'ai' ? CONFIG.theme.primary : '#f3f4f6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      fontWeight: '600',
      color: message.sender === 'ai' ? 'white' : CONFIG.theme.muted,
      flexShrink: 0,
      overflow: 'hidden'
    }}>
      {message.sender === 'ai' ? (
        <img 
          src={CONFIG.business.avatar} 
          alt={CONFIG.business.agentName}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement.textContent = 'M';
          }}
        />
      ) : 'You'}
    </div>
    
    {/* Message */}
    <div style={{
      borderRadius: '8px',
      padding: '12px',
      backgroundColor: message.sender === 'user' ? CONFIG.theme.primary : '#f3f4f6',
      color: message.sender === 'user' ? 'white' : CONFIG.theme.text,
      maxWidth: '80%'
    }}>
      {message.content === "PHONE_BUTTON" ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0 }}>Or call me directly for immediate assistance!</p>
          <button
            onClick={() => window.open(`tel:${CONFIG.business.phone}`, '_self')}
            style={{
              backgroundColor: CONFIG.theme.primary,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              cursor: 'pointer',
              width: 'fit-content',
              pointerEvents: 'auto'
            }}
          >
            <PhoneIcon />
            {CONFIG.business.phone}
          </button>
        </div>
      ) : (
        <div style={{ whiteSpace: 'pre-line' }}>{message.content}</div>
      )}
    </div>
  </div>
)

// Attribution Tracking System
class AttributionTracker {
  private static instance: AttributionTracker
  private sessionId: string

  constructor() {
    this.sessionId = this.generateSessionId()
  }

  static getInstance(): AttributionTracker {
    if (!AttributionTracker.instance) {
      AttributionTracker.instance = new AttributionTracker()
    }
    return AttributionTracker.instance
  }

  private generateSessionId(): string {
    return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36)
  }

  private getUrlParam(name: string): string {
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get(name) || ''
  }

  private getSource(): string {
    const utmSource = this.getUrlParam('utm_source')
    if (utmSource) return utmSource

    const referrer = document.referrer
    if (!referrer) return 'direct'

    try {
      const referrerDomain = new URL(referrer).hostname.toLowerCase()
      const currentDomain = window.location.hostname.toLowerCase()
      
      if (referrerDomain === currentDomain) return 'internal'
      
      // Common referrer patterns
      if (referrerDomain.includes('google')) return 'google'
      if (referrerDomain.includes('facebook') || referrerDomain.includes('fb.')) return 'facebook'
      if (referrerDomain.includes('instagram')) return 'instagram'
      if (referrerDomain.includes('linkedin')) return 'linkedin'
      if (referrerDomain.includes('twitter') || referrerDomain.includes('t.co')) return 'twitter'
      if (referrerDomain.includes('youtube')) return 'youtube'
      if (referrerDomain.includes('bing')) return 'bing'
      if (referrerDomain.includes('yahoo')) return 'yahoo'
      
      return referrerDomain
    } catch {
      return 'unknown'
    }
  }

  private getMedium(): string {
    const utmMedium = this.getUrlParam('utm_medium')
    if (utmMedium) return utmMedium

    // Check for paid advertising IDs
    if (this.getUrlParam('gclid')) return 'cpc'
    if (this.getUrlParam('fbclid')) return 'social'
    if (this.getUrlParam('msclkid')) return 'cpc'
    if (this.getUrlParam('ttclid')) return 'social'

    const source = this.getSource()
    const referrer = document.referrer

    if (source === 'direct') return 'direct'
    if (source === 'internal') return 'internal'
    if (['google', 'bing', 'yahoo'].includes(source)) return 'organic'
    if (['facebook', 'instagram', 'linkedin', 'twitter', 'youtube'].includes(source)) return 'social'
    if (referrer) return 'referral'
    
    return 'unknown'
  }

  private captureCurrentSession(): AttributionData {
    return {
      source: this.getSource(),
      medium: this.getMedium(),
      campaign: this.getUrlParam('utm_campaign'),
      content: this.getUrlParam('utm_content'),
      term: this.getUrlParam('utm_term'),
      gclid: this.getUrlParam('gclid'),
      fbclid: this.getUrlParam('fbclid'),
      msclkid: this.getUrlParam('msclkid'),
      ttclid: this.getUrlParam('ttclid'),
      landingPage: window.location.href,
      referrer: document.referrer,
      timestamp: new Date().toISOString()
    }
  }

  private setCookie(name: string, value: string, days: number): void {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString()
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
  }

  private getCookie(name: string): string | null {
    const nameEQ = name + '='
    const ca = document.cookie.split(';')
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i]
      while (c.charAt(0) === ' ') c = c.substring(1, c.length)
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length, c.length))
      }
    }
    return null
  }

  public trackAttribution(): void {
    const currentSession = this.captureCurrentSession()
    
    // First touch (only set once per user)
    const existingFirstTouch = this.getCookie('leadstick_first_touch')
    if (!existingFirstTouch) {
      this.setCookie('leadstick_first_touch', JSON.stringify(currentSession), 90) // 90 days
    }
    
    // Last touch (always update)
    this.setCookie('leadstick_last_touch', JSON.stringify(currentSession), 90)
    
    // Session ID (for current session only)
    this.setCookie('leadstick_session_id', this.sessionId, 1) // 1 day
  }

  public getAttributionData(): { firstTouch: AttributionData; lastTouch: AttributionData; sessionId: string } {
    const firstTouchCookie = this.getCookie('leadstick_first_touch')
    const lastTouchCookie = this.getCookie('leadstick_last_touch')
    
    let firstTouch: AttributionData
    let lastTouch: AttributionData
    
    try {
      firstTouch = firstTouchCookie ? JSON.parse(firstTouchCookie) : this.captureCurrentSession()
      lastTouch = lastTouchCookie ? JSON.parse(lastTouchCookie) : this.captureCurrentSession()
    } catch {
      // Fallback if cookie parsing fails
      const currentSession = this.captureCurrentSession()
      firstTouch = currentSession
      lastTouch = currentSession
    }
    
    return {
      firstTouch,
      lastTouch,
      sessionId: this.sessionId
    }
  }
}

// Chat steps configuration
const QUOTE_STEPS = [
  {
    step: 1,
    title: "Location",
    description: "Where are you?",
    chatStep: 'location' as ChatStep,
  },
  {
    step: 2,
    title: "Project",
    description: "Tell us about it",
    chatStep: 'service' as ChatStep,
  },
  {
    step: 3,
    title: "Contact",
    description: "Your details",
    chatStep: 'contact' as ChatStep,
  },
]

// Consolidated Widget Component
function LeadStickWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [currentStep, setCurrentStep] = useState<ChatStep>('location')
  const desktopChatBodyRef = useRef<HTMLDivElement>(null)
  const mobileChatBodyRef = useRef<HTMLDivElement>(null)
  const [leadData, setLeadData] = useState<LeadData>({
    location: '',
    service: '',
    name: '',
    phone: '',
    email: '',
    finalMessage: '',
    website: '', // Honeypot field
    formOpenTime: Date.now() // Track when form was opened
  })
  
  // Initialize attribution tracking
  const attributionTracker = AttributionTracker.getInstance()
  
  const [messages, setMessages] = useState([
    {
      id: 1,
      content: `Hi, Matt here. Let me know a little about your stone project. Your message comes straight to my phone and I'll send your quote ASAP`,
      sender: "ai",
    },
    {
      id: 2,
      content: "📍 First, what's your location/suburb?",
      sender: "ai",
    },
  ])

  const [input, setInput] = useState("")

  const toggleChat = () => setIsOpen(!isOpen)

  // Detect mobile/desktop and track attribution
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    // Track attribution data on component mount
    attributionTracker.trackAttribution()
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Reset chat when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('location')
      setLeadData({
        location: '',
        service: '',
        name: '',
        phone: '',
        email: '',
        finalMessage: '',
        website: '', // Reset honeypot
        formOpenTime: Date.now() // Track new session time
      })
      setMessages([
        {
          id: 1,
          content: `Hi, Matt here. Let me know a little about your stone project. Your message comes straight to my phone and I'll send your quote ASAP`,
          sender: "ai",
        },
        {
          id: 2,
          content: "📍 First, what's your location/suburb?",
          sender: "ai",
        },
      ])
      setInput("")
    }
  }, [isOpen])

  const addMessage = (content: string, sender: 'user' | 'ai') => {
    setMessages(prev => [...prev, {
      id: prev.length + 1,
      content,
      sender
    }])
  }



  const validateInput = (input: string, type: string): { valid: boolean; error?: string } => {
    const trimmed = input.trim()
    
    if (!trimmed) {
      return { valid: false, error: 'This field is required' }
    }
    
    if (trimmed.length > 500) {
      return { valid: false, error: 'Input too long (max 500 characters)' }
    }
    
    if (type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(trimmed)) {
        return { valid: false, error: 'Please enter a valid email address' }
      }
    }
    
    if (type === 'phone') {
      const phoneRegex = /^[\d\s\-\+\(\)\.]+$/
      if (!phoneRegex.test(trimmed) || trimmed.replace(/\D/g, '').length < 10) {
        return { valid: false, error: 'Please enter a valid phone number' }
      }
    }
    
    return { valid: true }
  }

  const handleSubmit = (e?: Event) => {
    e?.preventDefault()
    if (!input.trim()) return

    const userInput = input.trim()
    
    // Validate input based on current step
    let validationType = 'general'
    if (currentStep === 'contact') {
      if (!leadData.name) {
        validationType = 'name'
      } else if (!leadData.phone) {
        validationType = 'phone'
      } else if (!leadData.email) {
        validationType = 'email'
      }
    }
    
    const validation = validateInput(userInput, validationType)
    if (!validation.valid) {
      addMessage(validation.error!, 'ai')
      return
    }
    
    addMessage(userInput, 'user')
    setInput("")

    switch (currentStep) {
      case 'location':
        setLeadData(prev => ({ ...prev, location: userInput }))
        addMessage("Perfect! Tell me about your project, the more details the better.", 'ai')
        setCurrentStep('service')
        break

      case 'service':
        setLeadData(prev => ({ ...prev, service: userInput }))
        addMessage("Great! Now I need your contact details.", 'ai')
        addMessage("👤 What's your name?", 'ai')
        setCurrentStep('contact')
        break

      case 'contact':
        if (!leadData.name) {
          setLeadData(prev => ({ ...prev, name: userInput }))
          addMessage("📱 What's your phone number?", 'ai')
        } else if (!leadData.phone) {
          setLeadData(prev => ({ ...prev, phone: userInput }))
          addMessage("✉️ What's your email address?", 'ai')
        } else if (!leadData.email) {
          setLeadData(prev => ({ ...prev, email: userInput }))
          addMessage("Perfect! I've got all your details. I'll get back to you ASAP.", 'ai')
          addMessage(`📋 Summary:\n📍 Location: ${leadData.location}\n🔧 Project: ${leadData.service}\n👤 Name: ${leadData.name}\n📱 Phone: ${leadData.phone}\n✉️ Email: ${userInput}`, 'ai')
          addMessage("PHONE_BUTTON", 'ai')
          setCurrentStep('complete')
        }
        break
    }
  }



  const getInputPlaceholder = () => {
    switch (currentStep) {
      case 'location': return "e.g. Burleigh, Mermaid Waters, Tweed Heads..."
      case 'service': return "Tell me about your stone project..."
      case 'contact': 
        if (!leadData.name) return "Enter your full name"
        if (!leadData.phone) return "Enter your phone number"
        if (!leadData.email) return "Enter your email address"
        return ""
      default: return "Type your message..."
    }
  }

  const getCurrentStepNumber = () => {
    const stepMap = {
      'location': 1,
      'service': 2,
      'contact': 3,
      'complete': 3
    }
    return stepMap[currentStep]
  }

  const isStepCompleted = (stepNumber: number) => {
    switch (stepNumber) {
      case 1: return !!leadData.location
      case 2: return !!leadData.service
      case 3: return currentStep === 'complete'
      default: return false
    }
  }

  const submitLead = async () => {
    try {
      // Spam prevention checks
      // 1. Check honeypot field
      if (leadData.website && leadData.website.trim() !== '') {
        console.warn('Honeypot field filled - likely spam')
        // Silently fail for bots
        return
      }
      
      // 2. Check time-based validation (minimum 5 seconds)
      const timeElapsed = Date.now() - (leadData.formOpenTime || Date.now())
      if (timeElapsed < 5000) {
        console.warn('Form submitted too quickly - likely spam')
        addMessage('Please take your time to fill out the form properly.', 'ai')
        return
      }
      
      // Get attribution data
      const attribution = attributionTracker.getAttributionData()
      
      // Track GA4 event with attribution
      if (typeof gtag !== 'undefined') {
        gtag('event', 'leadstick_completed', {
          business_name: CONFIG.business.name,
          service_selected: leadData.service,
          location: leadData.location,
          lead_source: 'leadstick-widget',
          first_touch_source: attribution.firstTouch.source,
          first_touch_medium: attribution.firstTouch.medium,
          last_touch_source: attribution.lastTouch.source,
          last_touch_medium: attribution.lastTouch.medium,
          session_id: attribution.sessionId,
          value: 100
        })
      }

      // Submit to API with attribution data
      const response = await fetch(CONFIG.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...leadData,
          attribution,
          business: CONFIG.business.name,
          timestamp: new Date().toISOString(),
          source: 'leadstick-widget',
          // Include submission time for server-side validation
          submissionTime: timeElapsed
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        
        if (response.status === 429) {
          // Rate limit exceeded - show user-friendly message
          const retryAfter = errorData?.retryAfter || 3600
          const minutes = Math.ceil(retryAfter / 60)
          
          if (retryAfter < 60) {
            addMessage(`Please wait ${retryAfter} seconds before submitting again.`, 'ai')
          } else if (minutes < 60) {
            addMessage(`You've reached the submission limit. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`, 'ai')
          } else {
            addMessage('You\'ve reached the submission limit. Please try again later or call us directly.', 'ai')
          }
          
          // Show phone button for immediate contact
          addMessage("PHONE_BUTTON", 'ai')
          return
        }
        
        throw new Error(errorData?.message || 'Failed to submit lead')
      }
    } catch (error) {
      console.error('Error submitting lead:', error)
      // Handle error gracefully - could show error message to user
    }
  }

  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    if (desktopChatBodyRef.current) {
      desktopChatBodyRef.current.scrollTop = desktopChatBodyRef.current.scrollHeight
    }
    if (mobileChatBodyRef.current) {
      mobileChatBodyRef.current.scrollTop = mobileChatBodyRef.current.scrollHeight
    }
  }, [messages])

  // Trigger lead submission when complete
  useEffect(() => {
    if (currentStep === 'complete' && leadData.location && leadData.service && leadData.name && leadData.phone && leadData.email) {
      submitLead()
    }
  }, [currentStep])

  const stepperStyles = {
    container: {
      display: 'flex',
      width: '100%',
      alignItems: 'center'
    },
    item: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      flex: 1,
      position: 'relative' as const,
      gap: '4px'
    },
    indicator: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      fontSize: '12px',
      fontWeight: '500',
      backgroundColor: '#f3f4f6',
      color: '#6b7280',
      transition: 'all 0.2s'
    },
    indicatorActive: {
      backgroundColor: CONFIG.theme.primary,
      color: 'white'
    },
    indicatorCompleted: {
      backgroundColor: CONFIG.theme.primary,
      color: 'white'
    },
    title: {
      fontSize: '12px',
      fontWeight: '500',
      textAlign: 'center' as const
    },
    description: {
      fontSize: '12px',
      color: CONFIG.theme.muted,
      textAlign: 'center' as const
    },
    separator: {
      position: 'absolute' as const,
      top: '12px',
      left: 'calc(50% + 12px + 2px)',
      right: 'calc(-50% + 12px + 2px)',
      height: '2px',
      backgroundColor: '#f3f4f6'
    },
    separatorCompleted: {
      backgroundColor: CONFIG.theme.primary
    }
  }

  return (
    <Fragment>
      {/* Mobile: Full-width sticky bottom button */}
      {!isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: isMobile ? 'block' : 'none'
        }}>
                      <button
            onClick={toggleChat}
            style={{
              width: '100%',
              height: '56px',
              border: 'none',
              borderRadius: 0,
              backgroundColor: CONFIG.theme.primary,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '18px',
              fontWeight: '500',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              borderTop: '1px solid #e5e7eb',
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = CONFIG.theme.primaryHover}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = CONFIG.theme.primary}
          >
            <MessageCircleIcon />
            Get Quick Quote
          </button>
        </div>
      )}

      {/* Desktop: Floating chat bubble */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 50,
        display: !isMobile ? 'block' : 'none'
      }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: CONFIG.theme.background,
            border: '1px solid ' + CONFIG.theme.border,
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            transition: 'all 0.25s ease-out',
            position: 'absolute',
            width: '90vw',
            height: '80vh',
            maxWidth: '512px',
            maxHeight: '700px',
            bottom: 'calc(100% + 10px)',
            right: 0,
            pointerEvents: 'auto',
            opacity: isOpen ? 1 : 0,
            visibility: isOpen ? 'visible' : 'hidden',
            transform: isOpen ? 'scale(1) translateY(0)' : 'scale(1) translateY(20px)'
          }}
        >
          {/* Chat Header */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            textAlign: 'center',
            justifyContent: 'center',
            padding: '16px',
            borderBottom: '1px solid ' + CONFIG.theme.border
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '8px',
              marginTop: '16px'
            }}>
              <h1 style={{
                fontSize: '20px',
                fontWeight: '600',
                margin: 0,
                color: CONFIG.theme.text
              }}>Get A Quick Quote</h1>
            </div>
            <p style={{
              fontSize: '14px',
              color: CONFIG.theme.muted,
              marginBottom: '12px',
              margin: 0
            }}>
              Quick 3-step process to get your quote
            </p>
            
            {/* Progress Stepper */}
            <div style={{ width: '100%', marginBottom: '16px' }}>
              <div style={stepperStyles.container}>
                {QUOTE_STEPS.map(({ step, title, description }, index) => {
                  const isActive = getCurrentStepNumber() === step
                  const isCompleted = isStepCompleted(step)
                  const isLast = index === QUOTE_STEPS.length - 1

                  return (
                    <div key={step} style={stepperStyles.item}>
                      <div style={{
                        ...stepperStyles.indicator,
                        ...(isActive ? stepperStyles.indicatorActive : {}),
                        ...(isCompleted ? stepperStyles.indicatorCompleted : {})
                      }}>
                        {isCompleted ? <CheckIcon /> : step}
                      </div>
                      <div style={stepperStyles.title}>{title}</div>
                      <div style={{
                        ...stepperStyles.description,
                        display: !isMobile ? 'block' : 'none'
                      }}>{description}</div>
                      {!isLast && (
                        <div style={{
                          ...stepperStyles.separator,
                          ...(isCompleted ? stepperStyles.separatorCompleted : {})
                        }} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Chat Body */}
          <div 
            ref={desktopChatBodyRef}
            style={{
              flexGrow: 1,
              overflowY: 'auto',
              padding: '16px'
            }}>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} CONFIG={CONFIG} />
            ))}


          </div>

          {/* Chat Footer */}
          {currentStep !== 'complete' && (
            <ChatInputForm
              input={input}
              setInput={setInput}
              leadData={leadData}
              setLeadData={setLeadData}
              handleSubmit={handleSubmit}
              getInputPlaceholder={getInputPlaceholder}
              currentStep={currentStep}
              CONFIG={CONFIG}
              isMobile={false}
            />
          )}

          {/* Powered by LeadStick branding */}
          <div style={{
            padding: '4px 16px 8px',
            textAlign: 'right',
            fontSize: '10px',
            color: '#9ca3af',
            pointerEvents: 'auto'
          }}>
            <a 
              href="https://leadstick.com" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                color: '#9ca3af',
                textDecoration: 'none',
                transition: 'color 0.2s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = CONFIG.theme.primary}
              onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}
            >
              Powered by <span style={{ fontWeight: '500' }}>LeadStick</span>
            </a>
          </div>

          {/* Close button for mobile */}
          <button
            onClick={toggleChat}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: isMobile ? 'block' : 'none'
            }}
          >
            <XIcon />
          </button>
        </div>

        {/* Toggle Button */}
        <button
          onClick={toggleChat}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s',
            backgroundColor: CONFIG.theme.primary,
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            pointerEvents: 'auto'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
            e.currentTarget.style.backgroundColor = CONFIG.theme.primaryHover
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            e.currentTarget.style.backgroundColor = CONFIG.theme.primary
          }}
        >
          {isOpen ? <XIcon /> : <MessageCircleIcon />}
        </button>
      </div>

      {/* Mobile Chat Overlay */}
      {isOpen && isMobile && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999999,
          backgroundColor: CONFIG.theme.background
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: CONFIG.theme.background,
            height: '100%',
            overflow: 'hidden'
          }}>
            {/* Mobile Header */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              textAlign: 'center',
              justifyContent: 'center',
              padding: '16px',
              borderBottom: '1px solid ' + CONFIG.theme.border,
              position: 'relative'
            }}>
              {/* Tap To Call Button */}
              <button
                onClick={() => {
                  // Track GA4 event
                  if (typeof gtag !== 'undefined') {
                    gtag('event', 'leadstick_phone_tapped', {
                      business_name: CONFIG.business.name,
                      phone_number: CONFIG.business.phone,
                      source: 'mobile_chat_header',
                      page_url: window.location.href,
                      timestamp: new Date().toISOString()
                    })
                  }
                  window.open(`tel:${CONFIG.business.phone}`, '_self')
                }}
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  backgroundColor: 'transparent',
                  border: '1px solid ' + CONFIG.theme.border,
                  borderRadius: '6px',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: CONFIG.theme.primary,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = CONFIG.theme.primary
                  e.currentTarget.style.color = 'white'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = CONFIG.theme.primary
                }}
              >
                <PhoneIcon />
                <span>Tap To Call</span>
              </button>
              
              {/* Close Button */}
              <button
                onClick={toggleChat}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  pointerEvents: 'auto',
                  color: '#000000'
                }}
              >
                <XIcon />
              </button>
              
              {/* Title Section with more breathing space */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '8px',
                marginTop: '32px'
              }}>
                <h1 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  margin: 0,
                  color: CONFIG.theme.text
                }}>Get A Quick Quote</h1>
              </div>
              <p style={{
                fontSize: '14px',
                color: CONFIG.theme.muted,
                marginBottom: '12px',
                margin: 0
              }}>
                Quick 3-step process to get your quote
              </p>
              
              {/* Progress Stepper - Mobile */}
              <div style={{ width: '100%', marginBottom: '16px' }}>
                <div style={stepperStyles.container}>
                  {QUOTE_STEPS.map(({ step, title, description }, index) => {
                    const isActive = getCurrentStepNumber() === step
                    const isCompleted = isStepCompleted(step)
                    const isLast = index === QUOTE_STEPS.length - 1

                    return (
                      <div key={step} style={stepperStyles.item}>
                        <div style={{
                          ...stepperStyles.indicator,
                          ...(isActive ? stepperStyles.indicatorActive : {}),
                          ...(isCompleted ? stepperStyles.indicatorCompleted : {})
                        }}>
                          {isCompleted ? <CheckIcon /> : step}
                        </div>
                        <div style={stepperStyles.title}>{title}</div>
                        {!isLast && (
                          <div style={{
                            ...stepperStyles.separator,
                            ...(isCompleted ? stepperStyles.separatorCompleted : {})
                          }} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Mobile Chat Body */}
            <div 
              ref={mobileChatBodyRef}
              style={{
                flexGrow: 1,
                overflowY: 'auto',
                padding: '16px'
              }}>
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} CONFIG={CONFIG} />
              ))}


            </div>

            {/* Mobile Chat Footer */}
            {currentStep !== 'complete' && (
              <ChatInputForm
                input={input}
                setInput={setInput}
                leadData={leadData}
                setLeadData={setLeadData}
                handleSubmit={handleSubmit}
                getInputPlaceholder={getInputPlaceholder}
                currentStep={currentStep}
                CONFIG={CONFIG}
                isMobile={true}
              />
            )}
            
            {/* Powered by LeadStick branding - Mobile */}
            <div style={{
              position: 'absolute',
              bottom: '4px',
              right: '8px',
              fontSize: '10px',
              color: '#9ca3af',
              pointerEvents: 'auto',
              background: 'rgba(255, 255, 255, 0.8)',
              padding: '2px 4px',
              borderRadius: '3px'
            }}>
              <a 
                href="https://leadstick.com" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  color: '#9ca3af',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onMouseOver={(e) => e.currentTarget.style.color = CONFIG.theme.primary}
                onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}
              >
                Powered by <span style={{ fontWeight: '500' }}>LeadStick</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </Fragment>
  )
}

// Initialize widget when script loads
export function initLeadStick() {
  // Track GA4 widget opened event
  if (typeof gtag !== 'undefined') {
    gtag('event', 'leadstick_started', {
      business_name: CONFIG.business.name,
      widget_version: '1.0.0',
      page_url: window.location.href,
      device_type: window.innerWidth < 768 ? 'mobile' : 'desktop'
    })
  }

  // Create container and render widget
  const existingContainer = document.getElementById('leadstick-root')
  if (existingContainer) {
    existingContainer.remove()
  }

  const container = document.createElement('div')
  container.id = 'leadstick-root'
  container.style.position = 'fixed'
  container.style.zIndex = '999999'
  container.style.pointerEvents = 'auto'
  container.style.top = '0'
  container.style.left = '0'
  container.style.width = '100%'
  container.style.height = '100%'
  
  // Allow pointer events only on interactive elements
  container.addEventListener('click', (e) => {
    if (e.target === container) {
      e.stopPropagation()
    }
  })

  document.body.appendChild(container)

  // Render the Preact widget
  render(h(LeadStickWidget, {}), container)
}

// Auto-initialize if script is loaded
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLeadStick)
  } else {
    initLeadStick()
  }
}

export default LeadStickWidget 