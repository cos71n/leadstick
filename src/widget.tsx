import React, { useState, useEffect, FormEvent, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { CONFIG } from './config'

// Global gtag function for GA4 tracking
declare global {
  function gtag(...args: any[]): void
}

// Types
type ChatStep = 'location' | 'service' | 'contact' | 'final' | 'complete'

interface LeadData {
  location: string
  service: string
  name: string
  phone: string
  email: string
  finalMessage: string
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

const WrenchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
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

// Utility function (replaces cn)
const classNames = (...classes: (string | undefined | false)[]) => {
  return classes.filter(Boolean).join(' ')
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
    title: "Service",
    description: "What do you need?",
    chatStep: 'service' as ChatStep,
  },
  {
    step: 3,
    title: "Contact",
    description: "Your details",
    chatStep: 'contact' as ChatStep,
  },
  {
    step: 4,
    title: "Complete",
    description: "Get your quote",
    chatStep: 'final' as ChatStep,
  },
]

// Consolidated Widget Component
function LeadStickWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [currentStep, setCurrentStep] = useState<ChatStep>('location')
  const chatBodyRef = useRef<HTMLDivElement>(null)
  const [leadData, setLeadData] = useState<LeadData>({
    location: '',
    service: '',
    name: '',
    phone: '',
    email: '',
    finalMessage: ''
  })
  
  const [messages, setMessages] = useState([
    {
      id: 1,
      content: `Hi, ${CONFIG.business.agentName} here. Let me know a little about what you need. Your message comes straight to my phone and I'll send your quote ASAP`,
      sender: "ai",
    },
    {
      id: 2,
      content: "📍 What's your location/suburb?",
      sender: "ai",
    },
  ])

  const [input, setInput] = useState("")

  const toggleChat = () => setIsOpen(!isOpen)

  // Detect mobile/desktop
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
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
        finalMessage: ''
      })
      setMessages([
        {
          id: 1,
          content: `Hi, ${CONFIG.business.agentName} here. Let me know a little about what you need. Your message comes straight to my phone and I'll send your quote ASAP`,
          sender: "ai",
        },
        {
          id: 2,
          content: "📍 What's your location/suburb?",
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

  const handleServiceSelect = (service: string) => {
    setLeadData(prev => ({ ...prev, service }))
    addMessage(service, 'user')
    addMessage("Great choice! Now I need your contact details.", 'ai')
    addMessage("👤 What's your name?", 'ai')
    setCurrentStep('contact')
  }

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!input.trim()) return

    const userInput = input.trim()
    addMessage(userInput, 'user')
    setInput("")

    switch (currentStep) {
      case 'location':
        setLeadData(prev => ({ ...prev, location: userInput }))
        addMessage("Perfect! Now, what service do you need?", 'ai')
        setCurrentStep('service')
        break

      case 'contact':
        if (!leadData.name) {
          setLeadData(prev => ({ ...prev, name: userInput }))
          addMessage("📱 What's your phone number?", 'ai')
        } else if (!leadData.phone) {
          setLeadData(prev => ({ ...prev, phone: userInput }))
          addMessage("Last one: anything else I should know? (Optional)", 'ai')
          setCurrentStep('final')
        }
        break

      case 'final':
        setLeadData(prev => ({ ...prev, finalMessage: userInput }))
        addMessage("Perfect! I've got your details. I'll get back to you ASAP.", 'ai')
        addMessage(`📋 Summary:\n📍 Location: ${leadData.location}\n🔧 Service: ${leadData.service}\n👤 Name: ${leadData.name}\n📱 Phone: ${leadData.phone}${userInput ? `\n💬 Message: ${userInput}` : ''}`, 'ai')
        addMessage("PHONE_BUTTON", 'ai')
        setCurrentStep('complete')
        break
    }
  }

  const handleSkipFinal = () => {
    addMessage("No additional message", 'user')
    addMessage("Perfect! I've got your details. I'll get back to you ASAP.", 'ai')
    addMessage(`📋 Summary:\n📍 Location: ${leadData.location}\n🔧 Service: ${leadData.service}\n👤 Name: ${leadData.name}\n📱 Phone: ${leadData.phone}`, 'ai')
    addMessage("PHONE_BUTTON", 'ai')
    setCurrentStep('complete')
  }

  const getInputPlaceholder = () => {
    switch (currentStep) {
      case 'location': return "e.g. New York, Los Angeles, Chicago..."
      case 'contact': 
        if (!leadData.name) return "Enter your full name"
        if (!leadData.phone) return "Enter your phone number"
        return ""
      case 'final': return "Any additional details or requirements..."
      default: return "Type your message..."
    }
  }

  const getCurrentStepNumber = () => {
    const stepMap = {
      'location': 1,
      'service': 2,
      'contact': 3,
      'final': 4,
      'complete': 4
    }
    return stepMap[currentStep]
  }

  const isStepCompleted = (stepNumber: number) => {
    switch (stepNumber) {
      case 1: return !!leadData.location
      case 2: return !!leadData.service
      case 3: return !!leadData.phone
      case 4: return currentStep === 'complete'
      default: return false
    }
  }

  const submitLead = async () => {
    try {
      // Track GA4 event
      if (typeof gtag !== 'undefined') {
        gtag('event', 'leadstick_completed', {
          business_name: CONFIG.business.name,
          service_selected: leadData.service,
          location: leadData.location,
          lead_source: 'leadstick-widget',
          value: 100
        })
      }

      // Submit to API
      const response = await fetch(CONFIG.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...leadData,
          business: CONFIG.business.name,
          timestamp: new Date().toISOString(),
          source: 'leadstick-widget'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to submit lead')
      }
    } catch (error) {
      console.error('Error submitting lead:', error)
      // Handle error gracefully - could show error message to user
    }
  }

  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight
    }
  }, [messages])

  // Trigger lead submission when complete
  useEffect(() => {
    if (currentStep === 'complete' && leadData.location && leadData.service && leadData.name && leadData.phone) {
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
    <>
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
              gap: '8px',
              justifyContent: 'center',
              marginBottom: '8px',
              marginTop: '16px'
            }}>
              <WrenchIcon />
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
              Quick 4-step process to get your quote
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
            ref={chatBodyRef}
            style={{
              flexGrow: 1,
              overflowY: 'auto',
              padding: '16px'
            }}>
            {messages.map((message) => (
              <div key={message.id} style={{
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
                  backgroundColor: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: CONFIG.theme.muted,
                  flexShrink: 0,
                  backgroundImage: message.sender === 'ai' ? `url(${CONFIG.avatarUrl})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}>
                  {message.sender === 'user' ? 'You' : ''}
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
                          width: 'fit-content'
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
            ))}

            {/* Service Selection Buttons */}
            {currentStep === 'service' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '0 16px'
              }}>
                {CONFIG.services.map((service) => (
                  <button
                    key={service}
                    onClick={() => handleServiceSelect(service)}
                    style={{
                      textAlign: 'left',
                      justifyContent: 'flex-start',
                      fontSize: '12px',
                      height: 'auto',
                      padding: '8px',
                      whiteSpace: 'normal',
                      border: '1px solid ' + CONFIG.theme.border,
                      borderRadius: '6px',
                      backgroundColor: CONFIG.theme.background,
                      color: CONFIG.theme.text,
                      cursor: 'pointer'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = CONFIG.theme.background}
                  >
                    {service}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chat Footer */}
          {currentStep !== 'complete' && (
            <div style={{
              borderTop: '1px solid ' + CONFIG.theme.border,
              padding: '16px'
            }}>
              <form onSubmit={handleSubmit} style={{
                position: 'relative',
                borderRadius: '8px',
                border: '1px solid ' + CONFIG.theme.border,
                backgroundColor: CONFIG.theme.background,
                padding: '4px'
              }}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={getInputPlaceholder()}
                  disabled={currentStep === 'service'}
                  style={{
                    minHeight: '48px',
                    resize: 'none',
                    borderRadius: '8px',
                    backgroundColor: CONFIG.theme.background,
                    border: 'none',
                    padding: '12px',
                    boxShadow: 'none',
                    outline: 'none',
                    width: '100%',
                    fontSize: '14px',
                    fontFamily: 'inherit'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
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
                  {currentStep === 'final' && (
                    <button
                      type="button"
                      onClick={handleSkipFinal}
                      style={{
                        fontSize: '12px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: CONFIG.theme.muted,
                        cursor: 'pointer'
                      }}
                    >
                      Skip
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={currentStep === 'service' || !input.trim()}
                    style={{
                      marginLeft: 'auto',
                      gap: '6px',
                      backgroundColor: CONFIG.theme.primary,
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: currentStep === 'service' || !input.trim() ? 'not-allowed' : 'pointer',
                      opacity: currentStep === 'service' || !input.trim() ? 0.5 : 1
                    }}
                  >
                    Send
                    <CornerDownLeftIcon />
                  </button>
                </div>
              </form>
            </div>
          )}

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
          top: '64px',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          backgroundColor: CONFIG.theme.background
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: CONFIG.theme.background,
            height: '100%',
            overflow: 'hidden'
          }}>
            {/* Mobile content would go here - same as desktop but adapted for mobile */}
            <button
              onClick={toggleChat}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '8px'
              }}
            >
              <XIcon />
            </button>
          </div>
        </div>
      )}
    </>
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

  // Render the React widget
  const root = createRoot(container)
  root.render(React.createElement(LeadStickWidget))
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