"use client"

import { createContext, useContext, useState, ReactNode } from "react"

interface QuoteChatContextType {
  isOpen: boolean
  openChat: () => void
  closeChat: () => void
  toggleChat: () => void
}

const QuoteChatContext = createContext<QuoteChatContextType | undefined>(undefined)

export function QuoteChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const openChat = () => setIsOpen(true)
  const closeChat = () => setIsOpen(false)
  const toggleChat = () => setIsOpen(!isOpen)

  return (
    <QuoteChatContext.Provider value={{ isOpen, openChat, closeChat, toggleChat }}>
      {children}
    </QuoteChatContext.Provider>
  )
}

export function useQuoteChat() {
  const context = useContext(QuoteChatContext)
  if (context === undefined) {
    throw new Error("useQuoteChat must be used within a QuoteChatProvider")
  }
  return context
} 