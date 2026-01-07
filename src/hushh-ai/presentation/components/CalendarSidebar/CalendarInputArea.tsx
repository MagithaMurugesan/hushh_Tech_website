/**
 * CalendarInputArea Component
 * Input field with send button and quick actions
 */

import React, { KeyboardEvent } from 'react';
import {
  Box,
  Input,
  IconButton,
  HStack,
  VStack,
  Spinner,
} from '@chakra-ui/react';
import type { CalendarInputAreaProps } from './types';
import { SIDEBAR_THEME } from './types';
import { CalendarQuickActions } from './CalendarQuickActions';

export const CalendarInputArea: React.FC<CalendarInputAreaProps> = ({
  value,
  onChange,
  onSend,
  isLoading,
  quickActions,
  onQuickAction,
}) => {
  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (value.trim() && !isLoading) {
      onSend(value);
    }
  };

  return (
    <Box
      px={6}
      py={4}
      borderTop={`1px solid ${SIDEBAR_THEME.border}`}
      bg={SIDEBAR_THEME.surface}
    >
      <VStack spacing={3} align="stretch">
        {/* Quick Actions */}
        {quickActions.length > 0 && (
          <CalendarQuickActions
            actions={quickActions}
            onActionClick={onQuickAction}
            isDisabled={isLoading}
          />
        )}

        {/* Input Field */}
        <HStack spacing={2}>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            isDisabled={isLoading}
            bg={SIDEBAR_THEME.background}
            border={`1px solid ${SIDEBAR_THEME.border}`}
            _focus={{
              borderColor: SIDEBAR_THEME.accent,
              boxShadow: `0 0 0 1px ${SIDEBAR_THEME.accent}`,
            }}
            _hover={{
              borderColor: SIDEBAR_THEME.accent,
            }}
            fontSize="sm"
            size="md"
            autoFocus
          />

          <IconButton
            aria-label="Send message"
            icon={isLoading ? <Spinner size="sm" /> : <SendIcon />}
            onClick={handleSend}
            isDisabled={!value.trim() || isLoading}
            bg={SIDEBAR_THEME.accent}
            color="white"
            _hover={{ bg: '#B45309' }}
            _active={{ bg: '#92400E' }}
            _disabled={{
              bg: SIDEBAR_THEME.border,
              cursor: 'not-allowed',
              opacity: 0.6,
            }}
            size="md"
          />
        </HStack>
      </VStack>
    </Box>
  );
};

/**
 * Send icon SVG
 */
const SendIcon: React.FC = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
