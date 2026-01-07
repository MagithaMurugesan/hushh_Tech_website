/**
 * CalendarSidebarTrigger Component
 * Button to open the calendar scheduling sidebar
 */

import React from 'react';
import { IconButton, Tooltip } from '@chakra-ui/react';
import type { CalendarSidebarTriggerProps } from './types';
import { SIDEBAR_THEME } from './types';

export const CalendarSidebarTrigger: React.FC<CalendarSidebarTriggerProps> = ({ onClick }) => {
  return (
    <Tooltip label="Schedule a meeting" placement="bottom" hasArrow>
      <IconButton
        aria-label="Open calendar scheduler"
        icon={<CalendarIcon />}
        variant="ghost"
        size="sm"
        onClick={onClick}
        _hover={{ bg: SIDEBAR_THEME.hover }}
        color={SIDEBAR_THEME.textSecondary}
        _active={{ bg: SIDEBAR_THEME.hover }}
      />
    </Tooltip>
  );
};

/**
 * Calendar icon SVG
 */
const CalendarIcon: React.FC = () => (
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
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
