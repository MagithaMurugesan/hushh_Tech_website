/**
 * CalendarSidebar Types
 * TypeScript interfaces and types for the Calendar Scheduling Sidebar
 */

import type { CalendarEventMetadata } from '../../../core/types';

/**
 * Message in the calendar sidebar conversation
 */
export interface CalendarMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    calendarEvent?: CalendarEventMetadata;
    quickActions?: QuickAction[];
  };
}

/**
 * Quick action button configuration
 */
export interface QuickAction {
  id: string;
  label: string;
  value: string;
  variant?: 'primary' | 'secondary';
}

/**
 * Conversation state machine
 */
export type ConversationState =
  | 'INITIAL'           // Just opened, showing greeting
  | 'AWAITING_DETAILS'  // User typing/selecting options
  | 'CREATING_EVENT'    // API call in progress
  | 'EVENT_CREATED'     // Success, showing calendar card
  | 'ERROR';            // Something failed

/**
 * Props for CalendarSidebar component
 */
export interface CalendarSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

/**
 * Props for CalendarSidebarHeader component
 */
export interface CalendarSidebarHeaderProps {
  onClose: () => void;
}

/**
 * Props for CalendarChatMessages component
 */
export interface CalendarChatMessagesProps {
  messages: CalendarMessage[];
  messagesEndRef: React.RefObject<HTMLDivElement>;
  isLoading?: boolean;
}

/**
 * Props for CalendarInputArea component
 */
export interface CalendarInputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  isLoading: boolean;
  quickActions: QuickAction[];
  onQuickAction: (action: string) => void;
}

/**
 * Props for CalendarQuickActions component
 */
export interface CalendarQuickActionsProps {
  actions: QuickAction[];
  onActionClick: (action: string) => void;
  isDisabled?: boolean;
}

/**
 * Props for CalendarSidebarTrigger component
 */
export interface CalendarSidebarTriggerProps {
  onClick: () => void;
}

/**
 * Theme colors for sidebar (Claude-style)
 */
export const SIDEBAR_THEME = {
  background: '#FAF9F7',
  surface: '#FFFFFF',
  accent: '#D97706',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  hover: '#F3F4F6',
  error: '#EF4444',
  success: '#10B981',
} as const;

/**
 * Sidebar dimensions
 */
export const SIDEBAR_DIMENSIONS = {
  width: '480px',
  maxWidth: '100vw',
  mobileBreakpoint: 768, // Chakra UI 'md' breakpoint
} as const;

/**
 * Animation configuration
 */
export const SIDEBAR_ANIMATION = {
  duration: 0.3,
  ease: [0.4, 0.0, 0.2, 1] as [number, number, number, number],
} as const;
