import { Progress } from '../ui/progress';

const DEFAULT_ONBOARDING_VISIBLE_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13];

export function OnboardingStepProgress({
  currentStep,
  totalSteps = 13,
  heading = 'Onboarding progress',
  displayStep,
  visibleSteps,
}: OnboardingStepProgressProps) {
  const resolvedVisibleSteps = resolveVisibleSteps(visibleSteps, totalSteps);
  const safeTotal = resolvedVisibleSteps.length;
  const safeStep = resolveDisplayStep({
    currentStep,
    displayStep,
    resolvedVisibleSteps,
  });
  const progressPercentage = Math.round((safeStep / safeTotal) * 100);

  return (
    <section className="px-4 pb-3 sm:px-6 sm:pb-4" aria-label="Onboarding step progress">
      <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 p-2.5 shadow-[0_8px_18px_rgba(43,140,238,0.1)] sm:p-3.5">
        <div className="pointer-events-none absolute -right-6 -top-8 h-16 w-16 rounded-full bg-[#2b8cee]/14 blur-2xl" />
        <div className="pointer-events-none absolute -left-8 -bottom-10 h-14 w-14 rounded-full bg-cyan-300/14 blur-2xl" />

        <div className="relative">
          <p className="min-w-0 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-[10px]">
            {heading}
          </p>

          <Progress
            value={progressPercentage}
            className="mt-2 h-1.5 bg-slate-100 ring-1 ring-[#2b8cee]/10 sm:h-2"
            indicatorClassName="bg-gradient-to-r from-[#2b8cee] via-[#3a9dff] to-cyan-400"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercentage}
            aria-label={`${progressPercentage} percent complete`}
          />

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-[#1f6cc7] sm:text-xs">
              {progressPercentage}% complete
            </span>
            <span className="text-[10px] font-semibold text-slate-500 sm:text-xs">
              Step {safeStep}/{safeTotal}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function resolveVisibleSteps(
  visibleSteps: OnboardingStepProgressProps['visibleSteps'],
  totalSteps: number,
): number[] {
  if (Array.isArray(visibleSteps)) {
    const sanitized = Array.from(
      new Set(
        visibleSteps
          .map((value) => Math.floor(value))
          .filter((value) => Number.isFinite(value) && value > 0),
      ),
    ).sort((a, b) => a - b);

    if (sanitized.length > 0) {
      return sanitized;
    }
  }

  if (typeof visibleSteps === 'number' && Number.isFinite(visibleSteps)) {
    const count = Math.max(1, Math.floor(visibleSteps));
    return Array.from({ length: count }, (_, index) => index + 1);
  }

  if (totalSteps === 13) {
    return DEFAULT_ONBOARDING_VISIBLE_STEPS;
  }

  const safeTotal = Math.max(1, Math.floor(totalSteps));
  return Array.from({ length: safeTotal }, (_, index) => index + 1);
}

function resolveDisplayStep({
  currentStep,
  displayStep,
  resolvedVisibleSteps,
}: {
  currentStep: number;
  displayStep?: number;
  resolvedVisibleSteps: number[];
}): number {
  const maxStep = resolvedVisibleSteps.length;

  if (typeof displayStep === 'number' && Number.isFinite(displayStep)) {
    return Math.min(Math.max(1, Math.floor(displayStep)), maxStep);
  }

  const mappedIndex = resolvedVisibleSteps.indexOf(currentStep);
  if (mappedIndex !== -1) {
    return mappedIndex + 1;
  }

  return Math.min(Math.max(1, Math.floor(currentStep)), maxStep);
}

interface OnboardingStepProgressProps {
  currentStep: number;
  totalSteps?: number;
  heading?: string;
  displayStep?: number;
  visibleSteps?: number[] | number;
}
