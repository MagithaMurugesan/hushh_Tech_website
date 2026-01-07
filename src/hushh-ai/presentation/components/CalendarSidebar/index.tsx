/**
 * CalendarSidebar Module
 * Export barrel for all calendar sidebar components
 */

export { CalendarSidebar } from './CalendarSidebar';
export { CalendarSidebarHeader } from './CalendarSidebarHeader';
export { CalendarSidebarTrigger } from './CalendarSidebarTrigger';
export { CalendarChatMessages } from './CalendarChatMessages';
export { CalendarInputArea } from './CalendarInputArea';
export { CalendarQuickActions } from './CalendarQuickActions';

export type {
  CalendarSidebarProps,
  CalendarSidebarHeaderProps,
  CalendarSidebarTriggerProps,
  CalendarChatMessagesProps,
  CalendarInputAreaProps,
  CalendarQuickActionsProps,
  CalendarMessage,
  QuickAction,
  ConversationState,
} from './types';

export {
  SIDEBAR_THEME,
  SIDEBAR_DIMENSIONS,
  SIDEBAR_ANIMATION,
} from './types';

export {
  GREETING_MESSAGES,
  QUICK_ACTIONS,
  getQuickActionsForState,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  LOADING_MESSAGES,
  PROMPT_MESSAGES,
  FOLLOWUP_MESSAGES,
  hasCalendarIntent,
  isValidEmail,
  extractEmails,
} from './constants';
