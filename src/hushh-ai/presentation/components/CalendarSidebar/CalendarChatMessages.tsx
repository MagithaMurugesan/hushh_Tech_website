/**
 * CalendarChatMessages Component
 * Displays the conversation messages with calendar event cards
 */

import React from 'react';
import { Box, Text, VStack, HStack, Avatar, Spinner } from '@chakra-ui/react';
import type { CalendarChatMessagesProps, CalendarMessage } from './types';
import { SIDEBAR_THEME, SIDEBAR_DIMENSIONS } from './types';
import { CalendarEventCard } from '../CalendarEventCard';
import { CalendarEventErrorBoundary } from '../CalendarEventErrorBoundary';

export const CalendarChatMessages: React.FC<CalendarChatMessagesProps> = ({
  messages,
  messagesEndRef,
  isLoading = false,
}) => {
  return (
    <Box
      flex="1"
      overflowY="auto"
      px={6}
      py={4}
      bg={SIDEBAR_THEME.background}
      css={{
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          background: SIDEBAR_THEME.border,
          borderRadius: '3px',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: SIDEBAR_THEME.textSecondary,
        },
      }}
    >
      <VStack spacing={4} align="stretch">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Typing Indicator */}
        {isLoading && (
          <HStack spacing={3} alignItems="flex-start">
            <Avatar size="sm" name="Hushh" bg={SIDEBAR_THEME.accent} color="white" />
            <Box
              bg={SIDEBAR_THEME.surface}
              borderRadius="lg"
              px={4}
              py={3}
              maxW="80%"
              border={`1px solid ${SIDEBAR_THEME.border}`}
            >
              <HStack spacing={2}>
                <Spinner size="xs" color={SIDEBAR_THEME.accent} />
                <Text fontSize="sm" color={SIDEBAR_THEME.textSecondary}>
                  Hushh is thinking...
                </Text>
              </HStack>
            </Box>
          </HStack>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </VStack>
    </Box>
  );
};

/**
 * Individual message bubble component
 */
const MessageBubble: React.FC<{ message: CalendarMessage }> = ({ message }) => {
  const isAssistant = message.role === 'assistant';

  return (
    <HStack
      spacing={3}
      alignItems="flex-start"
      justifyContent={isAssistant ? 'flex-start' : 'flex-end'}
    >
      {isAssistant && (
        <Avatar size="sm" name="Hushh" bg={SIDEBAR_THEME.accent} color="white" />
      )}

      <VStack align={isAssistant ? 'flex-start' : 'flex-end'} spacing={2} maxW="80%">
        {/* Message Content */}
        <Box
          bg={isAssistant ? SIDEBAR_THEME.surface : SIDEBAR_THEME.accent}
          color={isAssistant ? SIDEBAR_THEME.text : 'white'}
          borderRadius="lg"
          px={4}
          py={3}
          border={isAssistant ? `1px solid ${SIDEBAR_THEME.border}` : 'none'}
          boxShadow={isAssistant ? 'none' : 'sm'}
        >
          <Text fontSize="sm" whiteSpace="pre-wrap">
            {message.content}
          </Text>
        </Box>

        {/* Calendar Event Card */}
        {message.metadata?.calendarEvent && (
          <Box width="100%" maxW="450px" minW="280px">
            <CalendarEventErrorBoundary>
              <CalendarEventCard event={message.metadata.calendarEvent} />
            </CalendarEventErrorBoundary>
          </Box>
        )}

        {/* Timestamp */}
        <Text fontSize="xs" color={SIDEBAR_THEME.textSecondary}>
          {formatTimestamp(message.timestamp)}
        </Text>
      </VStack>

      {!isAssistant && (
        <Avatar
          size="sm"
          name="You"
          bg={SIDEBAR_THEME.textSecondary}
          color="white"
        />
      )}
    </HStack>
  );
};

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) {
    return 'Just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}
