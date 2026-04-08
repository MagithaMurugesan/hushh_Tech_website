export const FINANCIAL_LINK_ROUTE = '/onboarding/financial-link' as const;

export type FinancialLinkStatus = 'pending' | 'completed' | 'skipped';

const TOTAL_VISIBLE_ONBOARDING_STEPS = 10;

const CANONICAL_STEP_ROUTE_BY_DISPLAY_STEP = {
  1: '/onboarding/step-1',
  2: '/onboarding/step-2',
  3: '/onboarding/step-3',
  4: '/onboarding/step-4',
  5: '/onboarding/step-5',
  6: '/onboarding/step-6',
  7: '/onboarding/step-7',
  8: '/onboarding/step-8',
  9: '/onboarding/step-9',
  10: '/onboarding/step-10',
} as const;

export type CanonicalOnboardingRoute =
  (typeof CANONICAL_STEP_ROUTE_BY_DISPLAY_STEP)[keyof typeof CANONICAL_STEP_ROUTE_BY_DISPLAY_STEP];

export type CanonicalIncompleteOnboardingRoute =
  | typeof FINANCIAL_LINK_ROUTE
  | CanonicalOnboardingRoute;

export const CANONICAL_ONBOARDING_ROUTES = Object.values(
  CANONICAL_STEP_ROUTE_BY_DISPLAY_STEP
) as CanonicalOnboardingRoute[];

const DISPLAY_STEP_BY_ROUTE: Record<CanonicalOnboardingRoute, number> = {
  '/onboarding/step-1': 1,
  '/onboarding/step-2': 2,
  '/onboarding/step-3': 3,
  '/onboarding/step-4': 4,
  '/onboarding/step-5': 5,
  '/onboarding/step-6': 6,
  '/onboarding/step-7': 7,
  '/onboarding/step-8': 8,
  '/onboarding/step-9': 9,
  '/onboarding/step-10': 10,
};

const RAW_STEP_TO_ROUTE: Record<number, CanonicalOnboardingRoute> = {
  1: '/onboarding/step-1',
  2: '/onboarding/step-2',
  3: '/onboarding/step-3',
  4: '/onboarding/step-3',
  5: '/onboarding/step-4',
  6: '/onboarding/step-4',
  7: '/onboarding/step-5',
  8: '/onboarding/step-6',
  9: '/onboarding/step-7',
  10: '/onboarding/step-8',
  11: '/onboarding/step-8',
  12: '/onboarding/step-9',
  13: '/onboarding/step-10',
};

export const getCanonicalOnboardingRoute = (currentStep: number): CanonicalOnboardingRoute => {
  const normalizedStep = Number.isFinite(currentStep) ? Math.trunc(currentStep) : 1;
  return RAW_STEP_TO_ROUTE[normalizedStep] || '/onboarding/step-1';
};

export const normalizeFinancialLinkStatus = (
  value: unknown,
  fallback: FinancialLinkStatus = 'pending'
): FinancialLinkStatus => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'completed' || normalized === 'skipped') {
    return normalized;
  }

  if (normalized === 'pending') {
    return 'pending';
  }

  return fallback;
};

export const resolveFinancialLinkStatus = (
  onboardingStatus: unknown,
  financialDataStatus?: unknown
): FinancialLinkStatus => {
  const normalizedOnboardingStatus = normalizeFinancialLinkStatus(onboardingStatus);
  if (normalizedOnboardingStatus !== 'pending') {
    return normalizedOnboardingStatus;
  }

  const normalizedFinancialStatus = String(financialDataStatus ?? '')
    .trim()
    .toLowerCase();

  if (normalizedFinancialStatus === 'complete' || normalizedFinancialStatus === 'partial') {
    return 'completed';
  }

  return 'pending';
};

export const hasClearedFinancialLink = (value: unknown): boolean =>
  normalizeFinancialLinkStatus(value) !== 'pending';

export const getCanonicalIncompleteOnboardingRoute = (): typeof FINANCIAL_LINK_ROUTE =>
  FINANCIAL_LINK_ROUTE;

export const getFinancialLinkContinuationRoute = (
  currentStep: number
): CanonicalOnboardingRoute => {
  const normalizedStep = Number.isFinite(currentStep) ? Math.trunc(currentStep) : 1;
  return getCanonicalOnboardingRoute(normalizedStep > 1 ? normalizedStep : 1);
};

export const normalizeLegacyOnboardingRedirectTarget = (target: string): string => {
  try {
    const parsed = new URL(target, 'https://hushh.local');
    if (parsed.pathname.toLowerCase() === '/investor-profile') {
      return FINANCIAL_LINK_ROUTE;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return target;
  }
};

const normalizeCompatibleOnboardingRoute = (route: string): CanonicalOnboardingRoute => {
  // All step-1 through step-10 are valid canonical routes now
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
