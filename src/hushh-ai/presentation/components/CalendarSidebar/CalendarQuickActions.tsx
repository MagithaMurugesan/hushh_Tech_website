/**
 * CalendarQuickActions Component
 * Context-aware quick action buttons that change based on conversation state
 */

import React from 'react';
import { Button, HStack, Wrap, WrapItem } from '@chakra-ui/react';
import type { CalendarQuickActionsProps } from './types';
import { SIDEBAR_THEME } from './types';

export const CalendarQuickActions: React.FC<CalendarQuickActionsProps> = ({
  actions,
  onActionClick,
  isDisabled = false,
}) => {
  if (actions.length === 0) {
    return null;
  }

  return (
    <Wrap spacing={2} mb={3}>
      {actions.map((action) => (
        <WrapItem key={action.id}>
          <Button
            size="sm"
            variant={action.variant === 'primary' ? 'solid' : 'outline'}
            bg={action.variant === 'primary' ? SIDEBAR_THEME.accent : 'transparent'}
            color={action.variant === 'primary' ? 'white' : SIDEBAR_THEME.text}
            borderColor={SIDEBAR_THEME.border}
            _hover={{
              bg: action.variant === 'primary'
                ? '#B45309'
                : SIDEBAR_THEME.hover,
            }}
            onClick={() => onActionClick(action.value)}
            isDisabled={isDisabled}
            fontSize="sm"
            fontWeight="500"
            px={4}
            py={2}
            borderRadius="lg"
          >
            {action.label}
          </Button>
        </WrapItem>
      ))}
    </Wrap>
  );
};
