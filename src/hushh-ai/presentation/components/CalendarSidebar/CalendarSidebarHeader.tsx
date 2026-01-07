/**
 * CalendarSidebarHeader Component
 * Header section with title and close button
 */

import React from 'react';
import { Box, IconButton, Text, HStack } from '@chakra-ui/react';
import type { CalendarSidebarHeaderProps } from './types';
import { SIDEBAR_THEME } from './types';

export const CalendarSidebarHeader: React.FC<CalendarSidebarHeaderProps> = ({ onClose }) => {
  return (
    <Box
      px={6}
      py={4}
      borderBottom={`1px solid ${SIDEBAR_THEME.border}`}
      bg={SIDEBAR_THEME.surface}
    >
      <HStack justifyContent="space-between" alignItems="center">
        <HStack spacing={2}>
          <Text fontSize="lg" fontWeight="600" color={SIDEBAR_THEME.text}>
            🗓️ Hushh Calendar
          </Text>
        </HStack>

        <IconButton
          aria-label="Close sidebar"
          icon={<CloseIcon />}
          variant="ghost"
          size="sm"
          onClick={onClose}
          _hover={{ bg: SIDEBAR_THEME.hover }}
          color={SIDEBAR_THEME.textSecondary}
        />
      </HStack>
    </Box>
  );
};

/**
 * Close icon SVG
 */
const CloseIcon: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
