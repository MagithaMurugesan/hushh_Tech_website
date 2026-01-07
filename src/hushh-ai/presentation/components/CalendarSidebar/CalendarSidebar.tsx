/**
 * CalendarSidebar Component
 * Main sidebar container with state management and API integration
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box, useBreakpointValue } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  CalendarSidebarProps,
  CalendarMessage,
  ConversationState,
} from './types';
import {
  SIDEBAR_THEME,
  SIDEBAR_DIMENSIONS,
  SIDEBAR_ANIMATION,
} from './types';
import {
  GREETING_MESSAGES,
  getQuickActionsForState,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  LOADING_MESSAGES,
  FOLLOWUP_MESSAGES,
  MAX_MESSAGES_PER_SESSION,
  SCROLL_BEHAVIOR,
} from './constants';
import { CalendarSidebarHeader } from './CalendarSidebarHeader';
import { CalendarChatMessages } from './CalendarChatMessages';
import { CalendarInputArea } from './CalendarInputArea';
import config from '../../../../resources/config/config';

export const CalendarSidebar: React.FC<CalendarSidebarProps> = ({
  isOpen,
  onClose,
  userEmail,
}) => {
  // State
  const [messages, setMessages] = useState<CalendarMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState>('INITIAL');
  const [sessionEventCount, setSessionEventCount] = useState(0);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mobile detection
  const isMobile = useBreakpointValue({ base: true, md: false });

  // Send greeting on open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      sendGreeting();
    }
  }, [isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: SCROLL_BEHAVIOR });
  }, [messages]);

  /**
   * Send greeting message
   */
  const sendGreeting = () => {
    const greeting = GREETING_MESSAGES[Math.floor(Math.random() * GREETING_MESSAGES.length)];
    setMessages([
      {
        id: 'greeting-' + Date.now(),
        role: 'assistant',
        content: greeting,
        timestamp: new Date(),
      },
    ]);
    setConversationState('INITIAL');
  };

  /**
   * Handle sending a message
   */
  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    // Add user message
    const userMessage: CalendarMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage].slice(-MAX_MESSAGES_PER_SESSION));
    setInputValue('');
    setIsLoading(true);
    setConversationState('CREATING_EVENT');

    // Add loading message
    const loadingMessage: CalendarMessage = {
      id: 'loading-' + Date.now(),
      role: 'assistant',
      content: LOADING_MESSAGES.processing,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, loadingMessage]);

    try {
      const supabaseUrl = config.SUPABASE_URL;
      const supabaseKey = config.SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/hushh-ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          message,
          chatId: null, // No chat ID for session-based
          userId: userEmail,
          mediaUrls: [],
          history: messages
            .slice(-5)
            .map((m) => ({ role: m.role, content: m.content })),
          isCalendarSidebar: true, // Flag for edge function
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to schedule meeting');
      }

      // Check for calendar event metadata
      const calendarEventHeader = response.headers.get('X-Calendar-Event');
      const calendarEventDataHeader = response.headers.get('X-Calendar-Event-Data');

      let calendarEvent = undefined;
      if (calendarEventHeader === 'created' && calendarEventDataHeader) {
        try {
          calendarEvent = JSON.parse(calendarEventDataHeader);
        } catch (e) {
          console.error('Failed to parse calendar event:', e);
        }
      }

      // Stream AI response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;

          // Update streaming message
          setMessages((prev) => {
            const withoutLoading = prev.filter((m) => m.id !== 'loading-' + Date.now());
            const lastMessage = withoutLoading[withoutLoading.length - 1];

            if (lastMessage?.id === 'streaming') {
              return [
                ...withoutLoading.slice(0, -1),
                { ...lastMessage, content: fullContent },
              ];
            } else {
              return [
                ...withoutLoading,
                {
                  id: 'streaming',
                  role: 'assistant',
                  content: fullContent,
                  timestamp: new Date(),
                },
              ];
            }
          });
        }
      }

      // Remove loading message and finalize
      setMessages((prev) => {
        const withoutLoadingAndStreaming = prev.filter(
          (m) => !m.id.startsWith('loading-') && m.id !== 'streaming'
        );

        // Add AI response
        const aiMessage: CalendarMessage = {
          id: 'assistant-' + Date.now(),
          role: 'assistant',
          content: fullContent || (calendarEvent ? SUCCESS_MESSAGES.default : "I'll help you schedule that meeting."),
          timestamp: new Date(),
          metadata: calendarEvent ? { calendarEvent } : undefined,
        };

        const newMessages = [...withoutLoadingAndStreaming, aiMessage];

        // Add follow-up message if event was created
        if (calendarEvent) {
          const followupMessage: CalendarMessage = {
            id: 'followup-' + Date.now(),
            role: 'assistant',
            content: FOLLOWUP_MESSAGES.scheduleAnother,
            timestamp: new Date(),
          };
          newMessages.push(followupMessage);
        }

        return newMessages.slice(-MAX_MESSAGES_PER_SESSION);
      });

      if (calendarEvent) {
        setConversationState('EVENT_CREATED');
        setSessionEventCount((prev) => prev + 1);
      } else {
        setConversationState('AWAITING_DETAILS');
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Calendar sidebar error:', error);

      // Remove loading message and show error
      setMessages((prev) => {
        const withoutLoadingAndStreaming = prev.filter(
          (m) => !m.id.startsWith('loading-') && m.id !== 'streaming'
        );

        return [
          ...withoutLoadingAndStreaming,
          {
            id: 'error-' + Date.now(),
            role: 'assistant',
            content: ERROR_MESSAGES.apiFailure,
            timestamp: new Date(),
          },
        ];
      });

      setConversationState('ERROR');
      setIsLoading(false);
    }
  };

  /**
   * Handle quick action click
   */
  const handleQuickAction = (action: string) => {
    if (action === 'CLOSE_SIDEBAR') {
      handleClose();
    } else if (action === 'RESET_AND_SCHEDULE') {
      // Reset conversation
      setMessages([]);
      setConversationState('INITIAL');
      setInputValue('');
      sendGreeting();
    } else if (action === 'RETRY_LAST_REQUEST') {
      const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
      if (lastUserMessage) {
        handleSendMessage(lastUserMessage.content);
      }
    } else {
      // Regular message action
      handleSendMessage(action);
    }
  };

  /**
   * Handle sidebar close
   */
  const handleClose = () => {
    // Clear state on close (session-based)
    setMessages([]);
    setInputValue('');
    setConversationState('INITIAL');
    setSessionEventCount(0);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#000000',
              zIndex: 999,
              display: isMobile ? 'none' : 'block', // Hide backdrop on mobile
            }}
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{
              duration: SIDEBAR_ANIMATION.duration,
              ease: SIDEBAR_ANIMATION.ease,
            }}
            drag={isMobile ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, info) => {
              if (isMobile && info.offset.y > 100) {
                handleClose();
              }
            }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: isMobile ? '100vw' : SIDEBAR_DIMENSIONS.width,
              maxWidth: SIDEBAR_DIMENSIONS.maxWidth,
              height: '100vh',
              backgroundColor: SIDEBAR_THEME.background,
              boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.1)',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <CalendarSidebarHeader onClose={handleClose} />
            <CalendarChatMessages
              messages={messages}
              messagesEndRef={messagesEndRef}
              isLoading={isLoading}
            />
            <CalendarInputArea
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSendMessage}
              isLoading={isLoading}
              quickActions={getQuickActionsForState(conversationState)}
              onQuickAction={handleQuickAction}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
