import { describe, expect, it } from 'vitest';

import {
  CANONICAL_ONBOARDING_ROUTES,
  TOTAL_VISIBLE_ONBOARDING_STEPS,
  getCanonicalOnboardingRoute,
  getContinueOnboardingCta,
  getOnboardingDisplayMeta,
} from '../src/services/onboarding/flow';

describe('onboarding flow mapping', () => {
  it('defines a canonical 11-step route order with no visible gaps', () => {
    expect(TOTAL_VISIBLE_ONBOARDING_STEPS).toBe(11);
    expect(CANONICAL_ONBOARDING_ROUTES).toEqual([
      '/onboarding/step-1',
      '/onboarding/step-2',
      '/onboarding/step-3',
      '/onboarding/step-4',
      '/onboarding/step-5',
      '/onboarding/step-7',
      '/onboarding/step-8',
      '/onboarding/step-9',
      '/onboarding/step-10',
      '/onboarding/step-11',
      '/onboarding/step-12',
    ]);
  });

  it('maps persisted raw steps to canonical routes', () => {
    expect(getCanonicalOnboardingRoute(9)).toBe('/onboarding/step-9');
    expect(getCanonicalOnboardingRoute(10)).toBe('/onboarding/step-10');
    expect(getCanonicalOnboardingRoute(11)).toBe('/onboarding/step-10');
    expect(getCanonicalOnboardingRoute(12)).toBe('/onboarding/step-11');
    expect(getCanonicalOnboardingRoute(13)).toBe('/onboarding/step-12');
  });

  it('normalizes legacy step routes to the visible step metadata', () => {
    expect(getOnboardingDisplayMeta('/onboarding/step-13')).toEqual({
      route: '/onboarding/step-12',
      displayStep: 11,
      totalSteps: 11,
    });

    expect(getOnboardingDisplayMeta('/onboarding/step-6')).toEqual({
      route: '/onboarding/step-5',
      displayStep: 5,
      totalSteps: 11,
    });
  });

  it('builds continue CTA text from the visible step number', () => {
    expect(getContinueOnboardingCta(12)).toEqual({
      route: '/onboarding/step-11',
      text: 'Continue Onboarding (Step 10)',
    });

    expect(getContinueOnboardingCta(13)).toEqual({
      route: '/onboarding/step-12',
      text: 'Continue Onboarding (Step 11)',
    });
  });
});
