/**
 * CalendarSidebar Constants
 * Messages, quick actions, and configuration for the Calendar Scheduling Sidebar
 */

import type { QuickAction, ConversationState } from './types';

/**
 * Greeting messages shown when sidebar opens
 * Rotated randomly for variety
 */
export const GREETING_MESSAGES = [
  "Hi! I'm Hushh, your scheduling assistant. Tell me who you'd like to meet and when—I'll handle the rest! 📅",
  "Ready to schedule a meeting? Just tell me the details and I'll set it up! 📅",
  "Let's get your meeting on the calendar! Who and when? 📅",
  "Hi again! What meeting would you like to schedule? 📅",
];

/**
 * Quick actions shown for each conversation state
 * These change dynamically based on where the user is in the flow
 */
export const QUICK_ACTIONS: Record<ConversationState, QuickAction[]> = {
  INITIAL: [
    {
      id: 'qa-tomorrow-10',
      label: 'Tomorrow at 10 AM',
      value: 'Schedule a meeting tomorrow at 10 AM',
      variant: 'secondary',
    },
    {
      id: 'qa-next-monday',
      label: 'Next Monday',
      value: 'Schedule a meeting next Monday at 10 AM',
      variant: 'secondary',
    },
    {
      id: 'qa-in-1-hour',
      label: 'In 1 hour',
      value: 'Schedule a meeting starting in 1 hour',
      variant: 'secondary',
    },
  ],
  AWAITING_DETAILS: [
    {
      id: 'qa-30min',
      label: '30 min',
      value: '30 minutes',
      variant: 'secondary',
    },
    {
      id: 'qa-1hour',
      label: '1 hour',
      value: '1 hour',
      variant: 'secondary',
    },
    {
      id: 'qa-custom',
      label: 'Custom duration',
      value: 'Custom duration',
      variant: 'secondary',
    },
  ],
  CREATING_EVENT: [], // No actions while loading
  EVENT_CREATED: [
    {
      id: 'qa-schedule-another',
      label: 'Schedule Another',
      value: 'RESET_AND_SCHEDULE',
      variant: 'primary',
    },
    {
      id: 'qa-close',
      label: 'Close',
      value: 'CLOSE_SIDEBAR',
      variant: 'secondary',
    },
  ],
  ERROR: [
    {
      id: 'qa-retry',
      label: 'Retry',
      value: 'RETRY_LAST_REQUEST',
      variant: 'primary',
    },
    {
      id: 'qa-close-error',
      label: 'Close',
      value: 'CLOSE_SIDEBAR',
      variant: 'secondary',
    },
  ],
};

/**
 * Get quick actions for a specific conversation state
 */
export function getQuickActionsForState(state: ConversationState): QuickAction[] {
  return QUICK_ACTIONS[state] || [];
}

/**
 * Success messages shown after calendar event creation
 */
export const SUCCESS_MESSAGES = {
  default: "✅ Done! Your meeting is scheduled.",
  withAttendees: "✅ All set! Calendar invites sent to all attendees.",
  multipleEvents: (count: number) => `✅ That's meeting #${count} scheduled today! You're on a roll! 🎯`,
};

/**
 * Error messages for different failure scenarios
 */
export const ERROR_MESSAGES = {
  apiFailure: "❌ Oops, I couldn't connect to the calendar service right now. Please try again in a moment.",
  invalidEmail: (email: string) => `I noticed '${email}' doesn't look like a valid email address. Could you double-check that? 📧`,
  pastDate: "It looks like that time is in the past. Would you like to schedule it for tomorrow instead?",
  missingOrganizerEmail: "I need your @hushh.ai email to create the calendar event. It looks like you're not logged in with a Hushh email. Would you like to update your profile?",
  permissionDenied: "❌ I don't have permission to create calendar events for this email. Please contact support@hushh.ai to enable calendar integration.",
  networkError: "❌ Network error. Please check your internet connection and try again.",
  unknownError: "❌ Something went wrong. Please try again or contact support if the problem persists.",
};

/**
 * Loading messages shown during API calls
 */
export const LOADING_MESSAGES = {
  creating: "Creating your meeting... ⏳",
  scheduling: (attendee: string) => `Scheduling a meeting with ${attendee}... ⏳`,
  processing: "One moment... ⏳",
};

/**
 * Prompt messages for collecting details
 */
export const PROMPT_MESSAGES = {
  askTime: "Great! When would you like to meet? You can say something like 'tomorrow at 2 PM' or 'next Monday at 10 AM'.",
  askDuration: "Perfect! How long should the meeting be?",
  askAttendees: "Who would you like to meet with? (Enter one or more email addresses)",
  askTitle: "What's the meeting about? (This will be the meeting title)",
};

/**
 * Follow-up messages after successful creation
 */
export const FOLLOWUP_MESSAGES = {
  scheduleAnother: "Need to schedule another meeting? Just let me know!",
  anythingElse: "Anything else I can help schedule?",
};

/**
 * Calendar intent keywords for detection
 * Used to identify if user message is calendar-related
 */
export const CALENDAR_KEYWORDS = [
  'schedule',
  'meeting',
  'appointment',
  'calendar',
  'book',
  'event',
  'meet with',
  'meet',
  'call with',
  'call',
  'tomorrow',
  'next week',
  'pm',
  'am',
  '@',
  'remind',
  'reminder',
];

/**
 * Email validation regex
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Check if a message has calendar intent
 */
export function hasCalendarIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return CALENDAR_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Extract emails from a message
 * Finds all email addresses in text
 */
export function extractEmails(text: string): string[] {
  const emailPattern = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
  const matches = text.match(emailPattern) || [];
  return matches.filter(email => isValidEmail(email));
}

/**
 * Maximum messages to keep in session
 * Prevents memory leak in long sessions
 */
export const MAX_MESSAGES_PER_SESSION = 50;

/**
 * Debounce delay for input (milliseconds)
 */
export const INPUT_DEBOUNCE_MS = 300;

/**
 * Auto-scroll behavior
 */
export const SCROLL_BEHAVIOR: ScrollBehavior = 'smooth';

/**
 * Typing indicator delay (milliseconds)
 */
export const TYPING_INDICATOR_DELAY = 500;
