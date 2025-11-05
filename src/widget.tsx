import { h, Fragment } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import { render } from 'preact'
import { CONFIG as DEFAULT_CONFIG } from './config'

// Global gtag function for GA4 tracking
declare global {
  function gtag(...args: any[]): void
}

// Utility function to darken a hex color
function darkenColor(hex: string, amount: number): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Darken by reducing each component
  const newR = Math.max(0, Math.floor(r * (1 - amount)));
  const newG = Math.max(0, Math.floor(g * (1 - amount)));
  const newB = Math.max(0, Math.floor(b * (1 - amount)));
  
  // Convert back to hex
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
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
  firstName: string
  lastName: string
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
}) => {
  // Helper function to determine input mode based on current question type
  const getInputMode = (): 'text' | 'tel' | 'email' => {
    if (currentStep !== 'contact') return 'text';

    const questions = (CONFIG.flow || []).filter((item: any) => item.type === 'question');
    const contactQuestions = questions.filter((q: any) =>
      q.questionType && ['firstName', 'lastName', 'name', 'phone', 'email'].includes(q.questionType)
    );

    // Count how many contact fields we've already filled
    let filledCount = 0;
    if (leadData.name) filledCount++;
    if (leadData.firstName) filledCount++;
    if (leadData.lastName) filledCount++;
    if (leadData.phone) filledCount++;
    if (leadData.email) filledCount++;

    // Determine input mode based on current contact question
    if (filledCount < contactQuestions.length) {
      const currentContactQuestion = contactQuestions[filledCount];
      if (currentContactQuestion && currentContactQuestion.questionType) {
        if (currentContactQuestion.questionType === 'phone') return 'tel';
        if (currentContactQuestion.questionType === 'email') return 'email';
      }
    }

    return 'text';
  };

  return (
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
        inputMode={getInputMode()}
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
  );
}

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
        CONFIG.business.avatar ? (
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
              const firstInitial = CONFIG.business.agentName?.charAt(0)?.toUpperCase() || 'A';
              e.currentTarget.parentElement.innerHTML = `<span style="color: ${CONFIG.theme.primary}; font-weight: bold; font-size: 14px;">${firstInitial}</span>`;
            }}
          />
        ) : (
          <span style={{ color: CONFIG.theme.primary, fontWeight: 'bold', fontSize: '14px' }}>
            {CONFIG.business.agentName?.charAt(0)?.toUpperCase() || 'A'}
          </span>
        )
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
      {message.content.startsWith("PHONE_BUTTON") ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0 }}>
            {message.content.includes(':') 
              ? message.content.split(':')[1] 
              : "Or call me directly for immediate assistance!"
            }
          </p>
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

// Default fallback steps configuration
const DEFAULT_QUOTE_STEPS = [
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

// Generate quote steps from flow configuration
function getQuoteSteps(CONFIG: any) {
  // Extract signposts from flow structure
  const signposts = (CONFIG.flow || []).filter((item: any) => item.type === 'signpost');
  
  // If no signposts are configured, use default steps
  if (signposts.length === 0) {
    return DEFAULT_QUOTE_STEPS;
  }
  
  // Convert signposts to quote steps format
  return signposts.map((signpost: any, index: number) => ({
    step: index + 1,
    title: signpost.heading || signpost.title || `Step ${index + 1}`,
    description: signpost.subheading || signpost.description || '',
    chatStep: index === 0 ? 'location' as ChatStep : 
              index === 1 ? 'service' as ChatStep : 
              'contact' as ChatStep,
    signpostId: signpost.id
  }));
}

// Get questions from flow configuration
function getQuestionsFromFlow(CONFIG: any) {
  if (!CONFIG.flow) return [];
  return CONFIG.flow.filter((item: any) => item.type === 'question');
}

// Get questions in order from flow configuration
function getOrderedQuestions(CONFIG: any) {
  if (!CONFIG.flow) return [];
  return CONFIG.flow.filter((item: any) => item.type === 'question').map((item: any) => item.question);
}

// Get specific question by index in the flow
function getQuestionByIndex(CONFIG: any, index: number) {
  const questions = getOrderedQuestions(CONFIG);
  return questions[index] || null;
}

// Consolidated Widget Component
function LeadStickWidget({ CONFIG: dynamicConfig }: { CONFIG: any }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [currentStep, setCurrentStep] = useState<ChatStep>('location')
  const desktopChatBodyRef = useRef<HTMLDivElement>(null)
  const mobileChatBodyRef = useRef<HTMLDivElement>(null)
  const [leadData, setLeadData] = useState<LeadData>({
    location: '',
    service: '',
    name: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    finalMessage: '',
    website: '', // Honeypot field
    formOpenTime: Date.now() // Track when form was opened
  })
  
  // Initialize attribution tracking
  const attributionTracker = AttributionTracker.getInstance()
  
  // Helper function to substitute [Agent Name] placeholder with actual agent name
  const substituteAgentName = (message: string): string => {
    return message.replace(/\[Agent Name\]/g, dynamicConfig.business.agentName);
  };

  const [messages, setMessages] = useState(() => {
    const welcomeMessage = dynamicConfig.messages?.welcome 
      ? substituteAgentName(dynamicConfig.messages.welcome)
      : `Hi, ${dynamicConfig.business.agentName} here. Let me know a little about your project. Your message comes straight to my phone and I'll send your quote ASAP`;
    
    // Extract the first question from the flow
    const questions = (dynamicConfig.flow || []).filter((item: any) => item.type === 'question');
    const firstQuestion = questions.length > 0 ? questions[0].question : "📍 First, what's your location/suburb?";
    
    return [
      {
        id: 1,
        content: welcomeMessage,
        sender: "ai",
      },
      {
        id: 2,
        content: firstQuestion,
        sender: "ai",
      },
    ];
  })

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
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        finalMessage: '',
        website: '', // Reset honeypot
        formOpenTime: Date.now() // Track new session time
      })
      const welcomeMessage = dynamicConfig.messages?.welcome 
        ? substituteAgentName(dynamicConfig.messages.welcome)
        : `Hi, ${dynamicConfig.business.agentName} here. Let me know a little about your project. Your message comes straight to my phone and I'll send your quote ASAP`;
      // Extract the first question from the flow
      const questions = (dynamicConfig.flow || []).filter((item: any) => item.type === 'question');
      const firstQuestion = questions.length > 0 ? questions[0].question : "📍 First, what's your location/suburb?";
      
      setMessages([
        {
          id: 1,
          content: welcomeMessage,
          sender: "ai",
        },
        {
          id: 2,
          content: firstQuestion,
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
    
    if (type === 'name') {
      if (trimmed.length < 2) {
        return { valid: false, error: 'Please enter your full name' }
      }
    }
    
    if (type === 'firstName') {
      if (trimmed.length < 1) {
        return { valid: false, error: 'Please enter your first name' }
      }
    }
    
    if (type === 'lastName') {
      if (trimmed.length < 1) {
        return { valid: false, error: 'Please enter your last name' }
      }
    }
    
    return { valid: true }
  }

  const handleSubmit = (e?: Event) => {
    e?.preventDefault()
    if (!input.trim()) return

    const userInput = input.trim()
    
    // Validate input based on current step and determine what field we're currently asking for
    let validationType = 'general'
    if (currentStep === 'contact') {
      // Get all contact questions from the flow to determine the current field type
      const questions = getQuestionsFromFlow(dynamicConfig);
      const contactQuestions = questions.filter(q => 
        q.questionType && ['firstName', 'lastName', 'name', 'phone', 'email'].includes(q.questionType)
      );
      
      // Count how many contact fields we've already filled
      let filledCount = 0;
      if (leadData.name) filledCount++;
      if (leadData.firstName) filledCount++;
      if (leadData.lastName) filledCount++;
      if (leadData.phone) filledCount++;
      if (leadData.email) filledCount++;
      
      // Determine validation type based on current contact question
      if (filledCount < contactQuestions.length) {
        const currentContactQuestion = contactQuestions[filledCount];
        if (currentContactQuestion && currentContactQuestion.questionType) {
          validationType = currentContactQuestion.questionType;
        } else {
          // Fallback to question content analysis
          const allQuestions = questions.slice(2); // Skip location and service questions
          const currentQuestion = allQuestions[filledCount];
          
          if (currentQuestion && currentQuestion.question) {
            const questionText = currentQuestion.question.toLowerCase();
            if (questionText.includes('first name') || questionText.includes('firstname')) {
              validationType = 'firstName';
            } else if (questionText.includes('last name') || questionText.includes('lastname')) {
              validationType = 'lastName';
            } else if (questionText.includes('name')) {
              validationType = 'name';
            } else if (questionText.includes('phone') || questionText.includes('number') || currentQuestion.question.includes('📱')) {
              validationType = 'phone';
            } else if (questionText.includes('email') || currentQuestion.question.includes('✉️')) {
              validationType = 'email';
            } else {
              validationType = 'name'; // Default first contact field
            }
          }
        }
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
        // Use second question from flow (index 1)
        const secondQuestion = getQuestionByIndex(dynamicConfig, 1);
        if (secondQuestion) {
          addMessage(secondQuestion, 'ai')
        }
        setCurrentStep('service')
        break

      case 'service':
        setLeadData(prev => ({ ...prev, service: userInput }))
        // Use third question from flow (index 2)
        const thirdQuestion = getQuestionByIndex(dynamicConfig, 2);
        if (thirdQuestion) {
          addMessage(thirdQuestion, 'ai')
        }
        setCurrentStep('contact')
        break

      case 'contact':
        // Determine which contact field to fill based on validation type
        if (validationType === 'firstName') {
          setLeadData(prev => ({ ...prev, firstName: userInput }))
        } else if (validationType === 'lastName') {
          setLeadData(prev => ({ ...prev, lastName: userInput }))
        } else if (validationType === 'name') {
          setLeadData(prev => ({ ...prev, name: userInput }))
        } else if (validationType === 'phone') {
          setLeadData(prev => ({ ...prev, phone: userInput }))
        } else if (validationType === 'email') {
          setLeadData(prev => ({ ...prev, email: userInput }))
        }
        
        // Check if we have all required contact fields
        const questions = getQuestionsFromFlow(dynamicConfig);
        const contactQuestions = questions.filter(q => 
          q.questionType && ['firstName', 'lastName', 'name', 'phone', 'email'].includes(q.questionType)
        );
        
        // Count filled fields after this input
        let filledCount = 0;
        const updatedLeadData = { ...leadData };
        if (validationType === 'firstName') updatedLeadData.firstName = userInput;
        if (validationType === 'lastName') updatedLeadData.lastName = userInput;
        if (validationType === 'name') updatedLeadData.name = userInput;
        if (validationType === 'phone') updatedLeadData.phone = userInput;
        if (validationType === 'email') updatedLeadData.email = userInput;
        
        if (updatedLeadData.name) filledCount++;
        if (updatedLeadData.firstName) filledCount++;
        if (updatedLeadData.lastName) filledCount++;
        if (updatedLeadData.phone) filledCount++;
        if (updatedLeadData.email) filledCount++;
        
        if (filledCount < contactQuestions.length) {
          // Ask next contact question
          const nextContactQuestion = contactQuestions[filledCount];
          if (nextContactQuestion && nextContactQuestion.question) {
            addMessage(nextContactQuestion.question, 'ai')
          }
        } else {
          // All contact fields filled, complete the conversation
          const displayName = updatedLeadData.name || 
                             (updatedLeadData.firstName + (updatedLeadData.lastName ? ' ' + updatedLeadData.lastName : ''));
          
          const completionMessage = dynamicConfig.messages?.completion 
            ? substituteAgentName(dynamicConfig.messages.completion)
            : "Perfect! I've got all your details. I'll get back to you ASAP.";
          addMessage(completionMessage, 'ai')
          
          // Build dynamic summary based on what was actually submitted
          const questions = getQuestionsFromFlow(dynamicConfig);
          let summaryParts = [];
          
          // Add location if submitted
          if (leadData.location) {
            const locationQuestion = questions.find(q => 
              q.question && (
                q.question.toLowerCase().includes('location') || 
                q.question.toLowerCase().includes('suburb') ||
                q.question.includes('📍')
              )
            );
            const locationLabel = locationQuestion ? locationQuestion.question.replace(/[?!.]/g, '') : 'Location';
            summaryParts.push(`${locationLabel}: ${leadData.location}`);
          }
          
          // Add service if submitted  
          if (leadData.service) {
            const serviceQuestion = questions.find(q => 
              q.question && (
                q.question.toLowerCase().includes('project') || 
                q.question.toLowerCase().includes('service') ||
                q.question.toLowerCase().includes('work')
              )
            );
            const serviceLabel = serviceQuestion ? serviceQuestion.question.replace(/[?!.]/g, '') : 'Project';
            summaryParts.push(`${serviceLabel}: ${leadData.service}`);
          }
          
          // Add contact fields that were submitted
          if (updatedLeadData.name) {
            summaryParts.push(`Name: ${updatedLeadData.name}`);
          } else if (updatedLeadData.firstName || updatedLeadData.lastName) {
            const fullName = (updatedLeadData.firstName + ' ' + updatedLeadData.lastName).trim();
            summaryParts.push(`Name: ${fullName}`);
          }
          
          if (updatedLeadData.phone) {
            const phoneQuestion = questions.find(q => 
              q.question && (
                q.question.toLowerCase().includes('phone') || 
                q.question.toLowerCase().includes('number') ||
                q.question.includes('📱')
              )
            );
            const phoneLabel = phoneQuestion ? phoneQuestion.question.replace(/[?!.]/g, '') : 'Phone';
            summaryParts.push(`${phoneLabel}: ${updatedLeadData.phone}`);
          }
          
          if (updatedLeadData.email) {
            const emailQuestion = questions.find(q => 
              q.question && (
                q.question.toLowerCase().includes('email') ||
                q.question.includes('✉️')
              )
            );
            const emailLabel = emailQuestion ? emailQuestion.question.replace(/[?!.]/g, '') : 'Email';
            summaryParts.push(`${emailLabel}: ${updatedLeadData.email}`);
          }
          
          // Create summary message
          const summaryMessage = summaryParts.length > 0 
            ? `📋 Summary:\n${summaryParts.join('\n')}`
            : '📋 Summary: All details collected';
            
          addMessage(summaryMessage, 'ai')
          const phoneButtonMessage = dynamicConfig.messages?.phoneButton 
            ? substituteAgentName(dynamicConfig.messages.phoneButton)
            : "Or call me directly for immediate assistance!";
          addMessage(`PHONE_BUTTON:${phoneButtonMessage}`, 'ai')
          setCurrentStep('complete')
        }
        break
    }
  }



  const getInputPlaceholder = () => {
    const questions = getQuestionsFromFlow(dynamicConfig);
    
    switch (currentStep) {
      case 'location': 
        // Use the first question's placeholder if available
        if (questions[0] && questions[0].placeholder) {
          return questions[0].placeholder;
        }
        return "e.g. Burleigh, Mermaid Waters, Tweed Heads..."
        
      case 'service': 
        // Use the second question's placeholder if available  
        if (questions[1] && questions[1].placeholder) {
          return questions[1].placeholder;
        }
        return "Tell me about your stone project..."
        
      case 'contact': 
        const contactQuestions = questions.filter(q => 
          q.questionType && ['firstName', 'lastName', 'name', 'phone', 'email'].includes(q.questionType)
        );
        
        // Count how many contact fields we've already filled
        let filledCount = 0;
        if (leadData.name) filledCount++;
        if (leadData.firstName) filledCount++;
        if (leadData.lastName) filledCount++;
        if (leadData.phone) filledCount++;
        if (leadData.email) filledCount++;
        
        // Determine placeholder based on current contact question
        if (filledCount < contactQuestions.length) {
          const currentContactQuestion = contactQuestions[filledCount];
          if (currentContactQuestion) {
            // First try to use the configured placeholder
            if (currentContactQuestion.placeholder) {
              return currentContactQuestion.placeholder;
            }
            
            // Fall back to questionType-based placeholders
            if (currentContactQuestion.questionType) {
              switch (currentContactQuestion.questionType) {
                case 'firstName': return "Enter your first name"
                case 'lastName': return "Enter your last name"
                case 'name': return "Enter your full name"
                case 'phone': return "Enter your phone number"
                case 'email': return "Enter your email address"
                default: return "Type your response..."
              }
            }
          } else {
            // Fallback to question content analysis
            const allQuestions = questions.slice(2); // Skip location and service questions
            const currentQuestion = allQuestions[filledCount];
            
            if (currentQuestion) {
              // First try to use the configured placeholder
              if (currentQuestion.placeholder) {
                return currentQuestion.placeholder;
              }
              
              // Fall back to question content analysis
              if (currentQuestion.question) {
                const questionText = currentQuestion.question.toLowerCase();
                if (questionText.includes('first name') || questionText.includes('firstname')) {
                  return "Enter your first name";
                } else if (questionText.includes('last name') || questionText.includes('lastname')) {
                  return "Enter your last name";
                } else if (questionText.includes('name')) {
                  return "Enter your full name";
                } else if (questionText.includes('phone') || questionText.includes('number') || currentQuestion.question.includes('📱')) {
                  return "Enter your phone number";
                } else if (questionText.includes('email') || currentQuestion.question.includes('✉️')) {
                  return "Enter your email address";
                }
              }
            }
          }
        }
        return "Type your response..."
      default: return "Type your message..."
    }
  }

  // Get questions grouped by signpost
  const getQuestionsBySignpost = () => {
    if (!dynamicConfig.flow || !dynamicConfig.signposts) return {};
    
    const grouped: {[key: string]: any[]} = {};
    
    // Group questions by signpost
    dynamicConfig.flow.forEach((question: any) => {
      const signpostId = question.signpostId || 'ungrouped';
      if (!grouped[signpostId]) {
        grouped[signpostId] = [];
      }
      grouped[signpostId].push(question);
    });
    
    return grouped;
  }

  // Get current signpost step based on which questions have been answered
  const getCurrentStepNumber = () => {
    const steps = getQuoteSteps(dynamicConfig);
    
    // If using default steps, use original logic
    if (!dynamicConfig.signposts || dynamicConfig.signposts.length === 0) {
      const stepMap = {
        'location': 1,
        'service': 2,
        'contact': 3,
        'complete': 3
      }
      return stepMap[currentStep]
    }
    
    if (currentStep === 'complete') return steps.length;
    
    // For dynamic signposts, determine step based on signpost completion
    const questionsBySignpost = getQuestionsBySignpost();
    const answeredQuestions = new Set();
    
    // Track which questions have been answered based on form data
    if (leadData.location) answeredQuestions.add('location');
    if (leadData.service) answeredQuestions.add('service');
    if (leadData.name) answeredQuestions.add('name');
    if (leadData.phone) answeredQuestions.add('phone');
    if (leadData.email) answeredQuestions.add('email');
    
    // Find which signpost we're currently on
    for (let i = 0; i < dynamicConfig.signposts.length; i++) {
      const signpost = dynamicConfig.signposts[i];
      const signpostQuestions = questionsBySignpost[signpost.id] || [];
      
      // Check if all questions in this signpost are answered
      const allAnswered = signpostQuestions.every((q: any) => 
        answeredQuestions.has(q.type) || answeredQuestions.has(q.id)
      );
      
      if (!allAnswered) {
        return i + 1; // Return 1-based step number
      }
    }
    
    return steps.length; // All signposts completed
  }

  const isStepCompleted = (stepNumber: number) => {
    const steps = getQuoteSteps(dynamicConfig);
    
    // If using default steps, use original logic
    if (!dynamicConfig.signposts || dynamicConfig.signposts.length === 0) {
      switch (stepNumber) {
        case 1: return !!leadData.location
        case 2: return !!leadData.service
        case 3: return currentStep === 'complete'
        default: return false
      }
    }
    
    // For dynamic signposts, check if step is completed
    if (currentStep === 'complete') return true;
    
    const currentStepNumber = getCurrentStepNumber();
    return stepNumber < currentStepNumber;
  }

  const submitLead = async () => {
    console.log('[Widget] submitLead() called');
    console.log('[Widget] Full leadData:', leadData);
    
    try {
      // Spam prevention checks
      // 1. Check honeypot field
      if (leadData.website && leadData.website.trim() !== '') {
        console.warn('[Widget] Honeypot field filled - likely spam')
        // Silently fail for bots
        return
      }
      
      // 2. Check time-based validation (minimum 5 seconds)
      const timeElapsed = Date.now() - (leadData.formOpenTime || Date.now())
      console.log('[Widget] Time elapsed:', timeElapsed);
      
      if (timeElapsed < 5000) {
        console.warn('[Widget] Form submitted too quickly - likely spam')
        addMessage('Please take your time to fill out the form properly.', 'ai')
        return
      }
      
      // Get attribution data
      const attribution = attributionTracker.getAttributionData()
      console.log('[Widget] Attribution data:', attribution);

      const requestData = {
        ...leadData,
        attribution,
        business: dynamicConfig.business.name,
        timestamp: new Date().toISOString(),
        source: 'leadstick-widget',
        siteId: dynamicConfig.siteId,
        // Include submission time for server-side validation
        submissionTime: timeElapsed
      };

      console.log('[Widget] About to submit to API:', dynamicConfig.apiEndpoint);
      console.log('[Widget] Request data:', requestData);

      // Submit to API with attribution data
      const response = await fetch(dynamicConfig.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      })

      console.log('[Widget] API response status:', response.status);
      console.log('[Widget] API response:', response);

      if (!response.ok) {
        console.error('[Widget] API request failed with status:', response.status);
        const errorData = await response.json().catch(() => null)
        console.error('[Widget] Error data:', errorData);

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

      const responseData = await response.json();
      console.log('[Widget] API response data:', responseData);
      console.log('[Widget] Lead submission completed successfully!');

      // Track GA4 event and Google Ads conversion AFTER successful API response
      if (typeof gtag !== 'undefined') {
        console.log('[Widget] Sending GA4 event');
        gtag('event', 'leadstick_completed', {
          business_name: dynamicConfig.business.name,
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

        // Track Google Ads conversion if configured
        if (dynamicConfig.googleAds?.conversionId && dynamicConfig.googleAds?.conversionLabel) {
          console.log('[Widget] Sending Google Ads conversion event');
          gtag('event', 'conversion', {
            'send_to': `${dynamicConfig.googleAds.conversionId}/${dynamicConfig.googleAds.conversionLabel}`,
            'transaction_id': attribution.sessionId
          })
        }
      }
      
    } catch (error) {
      console.error('[Widget] Error submitting lead:', error)
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
    console.log('[Widget] useEffect triggered - currentStep:', currentStep);
    console.log('[Widget] leadData:', leadData);
    
    // Submit when we reach the complete step - let the API validate what's required
    if (currentStep === 'complete') {
      console.log('[Widget] Reached complete step, calling submitLead()');
      submitLead()
    } else {
      console.log('[Widget] Not at complete step yet, currentStep:', currentStep);
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
      backgroundColor: dynamicConfig.theme.primary,
      color: 'white'
    },
    indicatorCompleted: {
      backgroundColor: dynamicConfig.theme.primary,
      color: 'white'
    },
    title: {
      fontSize: '12px',
      fontWeight: '500',
      textAlign: 'center' as const
    },
    description: {
      fontSize: '12px',
      color: dynamicConfig.theme.muted,
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
      backgroundColor: dynamicConfig.theme.primary
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
              backgroundColor: dynamicConfig.theme.primary,
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
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = dynamicConfig.theme.primaryHover}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = dynamicConfig.theme.primary}
          >
            <MessageCircleIcon />
            Get Quick Quote
          </button>
        </div>
      )}

      {/* Desktop: Floating chat bubble or bar */}
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
            backgroundColor: dynamicConfig.theme.background,
            border: '1px solid ' + dynamicConfig.theme.border,
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
            borderBottom: '1px solid ' + dynamicConfig.theme.border
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
                color: dynamicConfig.theme.text
              }}>Get A Quick Quote</h1>
            </div>
            <p style={{
              fontSize: '14px',
              color: dynamicConfig.theme.muted,
              marginBottom: '12px',
              margin: 0
            }}>
              Quick 3-step process to get your quote
            </p>
            
            {/* Progress Stepper */}
            <div style={{ width: '100%', marginBottom: '16px' }}>
              <div style={stepperStyles.container}>
                {getQuoteSteps(dynamicConfig).map(({ step, title, description }, index) => {
                  const isActive = getCurrentStepNumber() === step
                  const isCompleted = isStepCompleted(step)
                  const isLast = index === getQuoteSteps(dynamicConfig).length - 1

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
              <ChatMessage key={message.id} message={message} CONFIG={dynamicConfig} />
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
              CONFIG={dynamicConfig}
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
              href={`https://postclick.io?utm_source=leadstick_widget&utm_medium=powered_by&utm_campaign=widget_footer&utm_content=${encodeURIComponent(window.location.hostname)}`}
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
              onMouseOver={(e) => e.currentTarget.style.color = dynamicConfig.theme.primary}
              onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}
            >
              Powered by <span style={{ fontWeight: '500' }}>Postclick</span>
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
              display: isMobile ? 'block' : 'none',
              color: dynamicConfig.theme.text,
              borderRadius: '4px',
              transition: 'background-color 0.2s, color 0.2s'
            }}
            onMouseOver={(e: MouseEvent) => {
              const target = e.currentTarget as HTMLButtonElement
              target.style.backgroundColor = dynamicConfig.theme.primary
              target.style.color = 'white'
            }}
            onMouseOut={(e: MouseEvent) => {
              const target = e.currentTarget as HTMLButtonElement
              target.style.backgroundColor = 'transparent'
              target.style.color = dynamicConfig.theme.text
            }}
          >
            <XIcon />
          </button>
        </div>

        {/* Toggle Button or Floating Bar */}
        {!isOpen && dynamicConfig.desktopStyle === 'bar' ? (
          // Floating Bar
          <button
            onClick={toggleChat}
            style={{
              backgroundColor: dynamicConfig.theme.primary,
              color: 'white',
              padding: '12px 24px',
              borderRadius: '24px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontSize: '16px',
              fontWeight: '500',
              maxWidth: '300px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              border: 'none',
              pointerEvents: 'auto'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.2)'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.backgroundColor = dynamicConfig.theme.primaryHover
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.backgroundColor = dynamicConfig.theme.primary
            }}
          >
            {dynamicConfig.barText.substring(0, dynamicConfig.barTextMaxLength)}
          </button>
        ) : (
          // Floating Bubble
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
              backgroundColor: dynamicConfig.theme.primary,
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
              e.currentTarget.style.backgroundColor = dynamicConfig.theme.primaryHover
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              e.currentTarget.style.backgroundColor = dynamicConfig.theme.primary
            }}
          >
            {isOpen ? <XIcon /> : <MessageCircleIcon />}
          </button>
        )}
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
          backgroundColor: dynamicConfig.theme.background,
          pointerEvents: 'auto'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: dynamicConfig.theme.background,
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
              borderBottom: '1px solid ' + dynamicConfig.theme.border,
              position: 'relative'
            }}>
              {/* Tap To Call Button */}
              <button
                onClick={() => {
                  // Track GA4 event
                  if (typeof gtag !== 'undefined') {
                    gtag('event', 'leadstick_phone_tapped', {
                      business_name: dynamicConfig.business.name,
                      phone_number: dynamicConfig.business.phone,
                      source: 'mobile_chat_header',
                      page_url: window.location.href,
                      timestamp: new Date().toISOString()
                    })
                  }
                  window.open(`tel:${dynamicConfig.business.phone}`, '_self')
                }}
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  backgroundColor: 'transparent',
                  border: '1px solid ' + dynamicConfig.theme.border,
                  borderRadius: '6px',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: dynamicConfig.theme.primary,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = dynamicConfig.theme.primary
                  e.currentTarget.style.color = 'white'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = dynamicConfig.theme.primary
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
                  color: dynamicConfig.theme.text,
                  borderRadius: '4px',
                  transition: 'background-color 0.2s, color 0.2s'
                }}
                onMouseOver={(e: MouseEvent) => {
                  const target = e.currentTarget as HTMLButtonElement
                  target.style.backgroundColor = dynamicConfig.theme.primary
                  target.style.color = 'white'
                }}
                onMouseOut={(e: MouseEvent) => {
                  const target = e.currentTarget as HTMLButtonElement
                  target.style.backgroundColor = 'transparent'
                  target.style.color = dynamicConfig.theme.text
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
                  color: dynamicConfig.theme.text
                }}>Get A Quick Quote</h1>
              </div>
              <p style={{
                fontSize: '14px',
                color: dynamicConfig.theme.muted,
                marginBottom: '12px',
                margin: 0
              }}>
                Quick 3-step process to get your quote
              </p>
              
              {/* Progress Stepper - Mobile */}
              <div style={{ width: '100%', marginBottom: '16px' }}>
                <div style={stepperStyles.container}>
                  {getQuoteSteps(dynamicConfig).map(({ step, title, description }, index) => {
                    const isActive = getCurrentStepNumber() === step
                    const isCompleted = isStepCompleted(step)
                    const isLast = index === getQuoteSteps(dynamicConfig).length - 1

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
                <ChatMessage key={message.id} message={message} CONFIG={dynamicConfig} />
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
                CONFIG={dynamicConfig}
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
                href={`https://postclick.io?utm_source=leadstick_widget&utm_medium=powered_by&utm_campaign=widget_footer&utm_content=${encodeURIComponent(window.location.hostname)}`}
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
                onMouseOver={(e) => e.currentTarget.style.color = dynamicConfig.theme.primary}
                onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}
              >
                Powered by <span style={{ fontWeight: '500' }}>Postclick</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </Fragment>
  )
}

// Initialize widget when script loads
export async function initLeadStick(options?: { siteId?: string }) {
  let finalConfig = DEFAULT_CONFIG; // Default config as fallback
  
  // Get API URL from window.leadstickConfig if available
  const leadstickConfig = (window as any).leadstickConfig;
  const apiUrl = leadstickConfig?.apiUrl || DEFAULT_CONFIG.apiEndpoint;
  
  // If siteId provided, fetch configuration from API
  if (options?.siteId) {
    try {
      const response = await fetch(`${apiUrl}/api/config/${options.siteId}`);
      if (response.ok) {
        const customConfig = await response.json();
        // Merge with default config, prioritizing custom config
        const mergedTheme = { ...DEFAULT_CONFIG.theme, ...(customConfig.theme || {}) };
        
        // If primaryHover is not provided but primary is, generate a darker hover color
        if (customConfig.theme?.primary && !customConfig.theme?.primaryHover) {
          mergedTheme.primaryHover = darkenColor(customConfig.theme.primary, 0.1);
        }
        
        finalConfig = {
          ...DEFAULT_CONFIG,
          ...customConfig,
          business: { ...DEFAULT_CONFIG.business, ...(customConfig.business || {}) },
          theme: mergedTheme,
          apiEndpoint: apiUrl, // Use the API URL from leadstickConfig
          siteId: options.siteId
        };
      } else {
        console.warn(`LeadStick: Could not load config for siteId '${options.siteId}', using default config`);
      }
    } catch (error) {
      console.warn('LeadStick: Failed to fetch configuration, using default config:', error);
    }
  }
  
  // Track GA4 widget opened event
  if (typeof gtag !== 'undefined') {
    gtag('event', 'leadstick_started', {
      business_name: finalConfig.business.name,
      widget_version: '1.0.0',
      page_url: window.location.href,
      device_type: window.innerWidth < 768 ? 'mobile' : 'desktop',
      site_id: finalConfig.siteId || 'default'
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
  container.style.pointerEvents = 'none'
  container.style.top = '0'
  container.style.left = '0'
  container.style.width = '100%'
  container.style.height = '100%'
  
  // Create shadow DOM for complete CSS isolation
  const shadowRoot = container.attachShadow({ mode: 'open' })
  
  // Create shadow container
  const shadowContainer = document.createElement('div')
  shadowContainer.style.position = 'fixed'
  shadowContainer.style.top = '0'
  shadowContainer.style.left = '0'
  shadowContainer.style.width = '100%'
  shadowContainer.style.height = '100%'
  shadowContainer.style.pointerEvents = 'none'
  shadowContainer.style.zIndex = '999999'
  
  // Add CSS reset and base styles to shadow DOM
  const style = document.createElement('style')
  style.textContent = `
    /* CSS Reset for complete isolation */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    /* Prevent host site styles from leaking in */
    :host {
      all: initial;
      display: block;
    }
    
    /* Base typography reset */
    h1, h2, h3, h4, h5, h6 {
      font-weight: 600;
      line-height: 1.2;
    }
    
    p {
      line-height: 1.5;
    }
    
    button {
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      color: inherit;
      background: none;
      border: none;
      padding: 0;
      margin: 0;
      cursor: pointer;
    }
    
    input, textarea {
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      color: inherit;
      background: none;
      border: none;
      padding: 0;
      margin: 0;
      outline: none;
    }
    
    a {
      color: inherit;
      text-decoration: none;
    }
    
    /* Ensure proper text rendering */
    html, body {
      text-rendering: optimizeLegibility;
      -webkit-text-size-adjust: 100%;
      -moz-text-size-adjust: 100%;
      text-size-adjust: 100%;
    }
  `
  
  shadowRoot.appendChild(style)
  shadowRoot.appendChild(shadowContainer)
  
  // Allow pointer events only on interactive elements
  container.addEventListener('click', (e) => {
    if (e.target === container) {
      e.stopPropagation()
    }
  })

  document.body.appendChild(container)

  // Render the Preact widget inside shadow DOM with dynamic config
  render(h(LeadStickWidget, { CONFIG: finalConfig }), shadowContainer)
}

// Auto-initialize if script is loaded (with global config if available)
if (typeof window !== 'undefined') {
  // Make initLeadStick globally available
  (window as any).LeadStick = { init: initLeadStick };
  
  // Check for window.leadstickConfig and auto-initialize with siteId
  const leadstickConfig = (window as any).leadstickConfig;
  if (leadstickConfig && leadstickConfig.siteId) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => initLeadStick({ siteId: leadstickConfig.siteId }))
    } else {
      initLeadStick({ siteId: leadstickConfig.siteId })
    }
  } else {
    // Fallback to default config if no leadstickConfig found
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => initLeadStick())
    } else {
      initLeadStick()
    }
  }
}

export default LeadStickWidget 