const TOTAL_VISIBLE_ONBOARDING_STEPS = 11;

const CANONICAL_STEP_ROUTE_BY_DISPLAY_STEP = {
  1: '/onboarding/step-1',
  2: '/onboarding/step-2',
  3: '/onboarding/step-3',
  4: '/onboarding/step-4',
  5: '/onboarding/step-5',
  6: '/onboarding/step-7',
  7: '/onboarding/step-8',
  8: '/onboarding/step-9',
  9: '/onboarding/step-10',
  10: '/onboarding/step-11',
  11: '/onboarding/step-12',
} as const;

export type CanonicalOnboardingRoute =
  (typeof CANONICAL_STEP_ROUTE_BY_DISPLAY_STEP)[keyof typeof CANONICAL_STEP_ROUTE_BY_DISPLAY_STEP];

export const CANONICAL_ONBOARDING_ROUTES = Object.values(
  CANONICAL_STEP_ROUTE_BY_DISPLAY_STEP
) as CanonicalOnboardingRoute[];

const DISPLAY_STEP_BY_ROUTE: Record<CanonicalOnboardingRoute, number> = {
  '/onboarding/step-1': 1,
  '/onboarding/step-2': 2,
  '/onboarding/step-3': 3,
  '/onboarding/step-4': 4,
  '/onboarding/step-5': 5,
  '/onboarding/step-7': 6,
  '/onboarding/step-8': 7,
  '/onboarding/step-9': 8,
  '/onboarding/step-10': 9,
  '/onboarding/step-11': 10,
  '/onboarding/step-12': 11,
};

const RAW_STEP_TO_ROUTE: Record<number, CanonicalOnboardingRoute> = {
  1: '/onboarding/step-1',
  2: '/onboarding/step-2',
  3: '/onboarding/step-3',
  4: '/onboarding/step-4',
  5: '/onboarding/step-5',
  6: '/onboarding/step-5',
  7: '/onboarding/step-7',
  8: '/onboarding/step-8',
  9: '/onboarding/step-9',
  10: '/onboarding/step-10',
  11: '/onboarding/step-10',
  12: '/onboarding/step-11',
  13: '/onboarding/step-12',
};

export const getCanonicalOnboardingRoute = (currentStep: number): CanonicalOnboardingRoute => {
  const normalizedStep = Number.isFinite(currentStep) ? Math.trunc(currentStep) : 1;
  return RAW_STEP_TO_ROUTE[normalizedStep] || '/onboarding/step-1';
};

const normalizeCompatibleOnboardingRoute = (route: string): CanonicalOnboardingRoute => {
  if (route === '/onboarding/step-6') return '/onboarding/step-5';
  if (route === '/onboarding/step-13') return '/onboarding/step-12';

  if (CANONICAL_ONBOARDING_ROUTES.includes(route as CanonicalOnboardingRoute)) {
    return route as CanonicalOnboardingRoute;
  }

  return '/onboarding/step-1';
};

export const getOnboardingDisplayMeta = (
  routeOrStep: string | number
): { route: CanonicalOnboardingRoute; displayStep: number; totalSteps: number } => {
  const route =
    typeof routeOrStep === 'number'
      ? getCanonicalOnboardingRoute(routeOrStep)
      : normalizeCompatibleOnboardingRoute(routeOrStep);

  return {
    route,
    displayStep: DISPLAY_STEP_BY_ROUTE[route],
    totalSteps: TOTAL_VISIBLE_ONBOARDING_STEPS,
  };
};

export const getContinueOnboardingCta = (
  currentStep: number
): { route: CanonicalOnboardingRoute; text: string } => {
  const { route, displayStep } = getOnboardingDisplayMeta(currentStep);
  return {
    route,
    text: `Continue Onboarding (Step ${displayStep})`,
  };
};

export { TOTAL_VISIBLE_ONBOARDING_STEPS };
