"use client"

import React, { useState, FormEvent, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { MessageCircle, Phone, X, Wrench, CornerDownLeft } from "lucide-react"
import { ChatBubble, ChatBubbleAvatar, ChatBubbleMessage } from "@/components/ui/chat-bubble"
import { ChatInput } from "@/components/ui/chat-input"
import { ChatMessageList } from "@/components/ui/chat-message-list"
import {
  // ExpandableChat,
  ExpandableChatHeader,
  ExpandableChatBody,
  ExpandableChatFooter,
} from "@/components/ui/expandable-chat"
import {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/ui/stepper"
import { useQuoteChat } from "@/contexts/quote-chat-context"
import { cn } from "@/lib/utils"

type ChatStep = 'location' | 'service' | 'contact' | 'final' | 'complete'

interface LeadData {
  location: string
  service: string
  name: string
  phone: string
  email: string
  finalMessage: string
}

const SERVICES = [
  "Car Check - Pre Purchase Inspection",
  "Oil & Brake Service", 
  "Logbook Service",
  "Battery Change",
  "Breakdown Service",
  "General Mechanic"
]

// Define the steps for the stepper
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

export function QuoteChat() {
  const { isOpen, toggleChat } = useQuoteChat()
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Border Mobile Mechanic"
  const businessPhone = process.env.NEXT_PUBLIC_BUSINESS_PHONE || "0468 358 074"
  
  const [currentStep, setCurrentStep] = useState<ChatStep>('location')
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
      content: "Hi, Ben here. Let me know a little about your car. Your message comes straight to my phone and I'll send your quote ASAP",
      sender: "ai",
    },
    {
      id: 2,
      content: "📍 What's your location/suburb?",
      sender: "ai",
    },
  ])

  const [input, setInput] = useState("")

  // Reset chat when opened
  useEffect(() => {
    if (isOpen) {
      // Reset to initial state when chat is opened
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
          content: "Hi, Ben here. Let me know a little about your car. Your message comes straight to my phone and I'll send your quote ASAP",
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
  }, [isOpen, businessName])

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
          addMessage("Last one: anything else I should know? If you know the Make and Model of your car please include it too (Optional)", 'ai')
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
      case 'location': return "e.g. Tweed Heads, Burleigh, Helensvale..."
      case 'contact': 
        if (!leadData.name) return "Enter your full name"
        if (!leadData.phone) return "Enter your phone number"
        return ""
      case 'final': return "e.g. Toyota Camry, strange noise when braking..."
      default: return "Type your message..."
    }
  }

  // Helper function to get current step number for stepper
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

  // Helper function to check if a step is completed
  const isStepCompleted = (stepNumber: number) => {
    switch (stepNumber) {
      case 1: return !!leadData.location
      case 2: return !!leadData.service
      case 3: return !!leadData.phone // Contact is complete when we have phone (no email needed)
      case 4: return currentStep === 'complete'
      default: return false
    }
  }

  return (
    <ExpandableChatWithControl
      isOpen={isOpen}
      onToggle={toggleChat}
      size="lg"
      position="bottom-right"
      icon={<MessageCircle className="h-6 w-6" />}
    >
      <ExpandableChatHeader className="flex-col text-center justify-center">
        <div className="flex items-center gap-2 justify-center mb-2 mt-4">
          <Wrench className="h-5 w-5 text-hero" />
          <h1 className="text-xl font-semibold">Get A Quick Quote</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Quick 4-step process to get your quote
        </p>
        
        {/* Progress indicator - Replace dots with stepper */}
        <div className="w-full mb-4">
          <Stepper value={getCurrentStepNumber()} className="w-full">
            {QUOTE_STEPS.map(({ step, title, description }) => (
              <StepperItem 
                key={step} 
                step={step} 
                completed={isStepCompleted(step)}
                className="relative flex-1 !flex-col"
              >
                <StepperTrigger asChild className="flex-col gap-1 cursor-default">
                  <div className="flex flex-col items-center gap-1">
                    <StepperIndicator className="data-[state=active]:bg-hero data-[state=completed]:bg-hero" />
                    <div className="space-y-0.5 text-center">
                      <StepperTitle className="text-xs">{title}</StepperTitle>
                      <StepperDescription className="text-xs max-sm:hidden">{description}</StepperDescription>
                    </div>
                  </div>
                </StepperTrigger>
                {step < QUOTE_STEPS.length && (
                  <StepperSeparator className="absolute inset-x-0 left-[calc(50%+0.75rem+0.125rem)] top-3 -order-1 m-0 -translate-y-1/2 group-data-[orientation=horizontal]/stepper:w-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=horizontal]/stepper:flex-none group-data-[state=completed]/step:bg-hero" />
                )}
              </StepperItem>
            ))}
          </Stepper>
        </div>
      </ExpandableChatHeader>

      <ExpandableChatBody>
        <ChatMessageList>
          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              variant={message.sender === "user" ? "sent" : "received"}
            >
              <ChatBubbleAvatar
                className={cn(
                  "h-8 w-8 shrink-0",
                  message.sender === "user" && "[&>span]:text-xs [&>span]:font-medium"
                )}
                src={
                  message.sender === "user"
                    ? undefined
                    : "https://pub-dde82a4c37944e70932bfac79eb42fc2.r2.dev/border-mobile-mechanical/border-icon.png"
                }
                fallback={message.sender === "user" ? "You" : "BMM"}
              />
              <ChatBubbleMessage
                variant={message.sender === "user" ? "sent" : "received"}
              >
                {message.content === "PHONE_BUTTON" ? (
                  <div className="flex flex-col gap-2">
                    <p>Or call me directly for immediate assistance!</p>
                    <Button 
                      size="sm"
                      onClick={() => window.open(`tel:${businessPhone}`, '_self')}
                      className="bg-hero hover:bg-hero/90 text-hero-foreground flex items-center gap-2 w-fit"
                    >
                      <Phone className="h-4 w-4" />
                      {businessPhone}
                    </Button>
                  </div>
                ) : (
                  <div style={{ whiteSpace: 'pre-line' }}>{message.content}</div>
                )}
              </ChatBubbleMessage>
            </ChatBubble>
          ))}

          {/* Service selection buttons */}
          {currentStep === 'service' && (
            <div className="flex flex-col gap-2 px-4">
              {SERVICES.map((service) => (
                <Button
                  key={service}
                  variant="outline"
                  size="sm"
                  onClick={() => handleServiceSelect(service)}
                  className="text-left justify-start text-xs h-auto py-2 whitespace-normal"
                >
                  {service}
                </Button>
              ))}
            </div>
          )}
        </ChatMessageList>
      </ExpandableChatBody>

      {currentStep !== 'complete' && (
        <ExpandableChatFooter>
          <form
            onSubmit={handleSubmit}
            className="relative rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring p-1"
          >
            <ChatInput
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onSubmit={() => handleSubmit()}
              placeholder={getInputPlaceholder()}
              className="min-h-12 resize-none rounded-lg bg-background border-0 p-3 shadow-none focus-visible:ring-0"
              disabled={currentStep === 'service'}
            />
            <div className="flex items-center p-3 pt-0 justify-between">
              {currentStep === 'final' && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={handleSkipFinal}
                  className="text-xs"
                >
                  Skip
                </Button>
              )}
              <Button 
                type="submit" 
                size="sm" 
                className="ml-auto gap-1.5 bg-hero hover:bg-hero/90"
                disabled={currentStep === 'service' || !input.trim()}
              >
                Send
                <CornerDownLeft className="size-3.5" />
              </Button>
            </div>
          </form>
        </ExpandableChatFooter>
      )}
    </ExpandableChatWithControl>
  )
}

// Custom wrapper component to control ExpandableChat externally
function ExpandableChatWithControl({ 
  isOpen, 
  onToggle, 
  children, 
  ...props 
}: {
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  size?: "sm" | "md" | "lg" | "xl" | "full"
  position?: "bottom-right" | "bottom-left"
  icon?: React.ReactNode
}) {
  return (
    <>
      {/* Mobile: Full-width sticky bottom button - only show when chat is closed */}
      {!isOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
          <Button
            onClick={onToggle}
            className="w-full h-14 rounded-none bg-hero hover:bg-hero/90 text-hero-foreground flex items-center justify-center gap-2 text-lg font-medium shadow-lg border-t"
          >
            <MessageCircle className="h-5 w-5" />
            Get Quick Quote
          </Button>
        </div>
      )}

      {/* Desktop: Floating chat bubble */}
      <div className={`fixed ${props.position === "bottom-left" ? "bottom-5 left-5" : "bottom-5 right-5"} z-50 hidden md:block`}>
        <div
          className={`flex flex-col bg-background border sm:rounded-lg shadow-md overflow-hidden transition-all duration-250 ease-out sm:absolute sm:w-[90vw] sm:h-[80vh] fixed inset-0 w-full h-full sm:inset-auto ${
            props.position === "bottom-left" ? "sm:bottom-[calc(100%+10px)] sm:left-0" : "sm:bottom-[calc(100%+10px)] sm:right-0"
          } ${
            props.size === "lg" ? "sm:max-w-lg sm:max-h-[700px]" : "sm:max-w-md sm:max-h-[600px]"
          } ${
            isOpen 
              ? "pointer-events-auto opacity-100 visible scale-100 translate-y-0" 
              : "pointer-events-none opacity-0 invisible scale-100 sm:translate-y-5"
          }`}
        >
          {children}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 sm:hidden"
            onClick={onToggle}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="default"
          onClick={onToggle}
          className="w-14 h-14 rounded-full shadow-md flex items-center justify-center hover:shadow-lg hover:shadow-black/30 transition-all duration-300 bg-hero hover:bg-hero/90 text-white"
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            props.icon || <MessageCircle className="h-6 w-6" />
          )}
        </Button>
      </div>

      {/* Chat overlay for mobile - full screen below header when open */}
      {isOpen && (
        <div className="fixed top-16 left-0 right-0 bottom-0 z-40 md:hidden bg-background">
          <div className="flex flex-col bg-background h-full overflow-hidden">
            {children}
            <Button
              variant="ghost"
              size="lg"
              className="absolute top-2 right-2"
              onClick={onToggle}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
} 