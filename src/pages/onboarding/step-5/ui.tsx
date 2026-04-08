/**
 * Step 7 — Enter Your Full Legal Name
 * Premium Hushh design matching Step 1/2/4/5.
 * Logic stays in logic.ts — zero logic changes.
 * Uses HushhTechBackHeader + HushhTechCta reusable components.
 */
import {
  useStep7Logic,
  DISPLAY_STEP,
  TOTAL_STEPS,
  PROGRESS_PCT,
} from "./logic";
import HushhTechBackHeader from "../../../components/hushh-tech-back-header/HushhTechBackHeader";
import HushhTechCta, {
  HushhTechCtaVariant,
} from "../../../components/hushh-tech-cta/HushhTechCta";

export default function OnboardingStep7() {
  const {
    firstName,
    lastName,
    isLoading,
    error,
    isValid,
    isPreFilledFromBank,
    handleFirstNameChange,
    handleLastNameChange,
    handleContinue,
    handleBack,
    handleSkip,
  } = useStep7Logic();

  return (
    <div className="bg-white text-gray-900 min-h-screen antialiased flex flex-col selection:bg-hushh-blue selection:text-white">
      {/* ═══ Header ═══ */}
      <HushhTechBackHeader onBackClick={handleBack} rightLabel="FAQs" />

      <main className="px-6 flex-grow max-w-md mx-auto w-full pb-48">
        {/* ── Progress Bar ── */}
        <div className="py-4">
          <div className="flex justify-between text-[11px] font-semibold tracking-wide text-gray-500 mb-3">
            <span>
              Step {DISPLAY_STEP}/{TOTAL_STEPS}
            </span>
            <span>{PROGRESS_PCT}% Complete</span>
          </div>
          <div className="h-0.5 w-full bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-hushh-blue transition-all duration-500"
              style={{ width: `${PROGRESS_PCT}%` }}
            />
          </div>
        </div>

        {/* ── Title Section ── */}
        <section className="py-8">
          <h3 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase mb-4 font-medium">
            Identity Verification
          </h3>
          <h1
            className="text-[2.75rem] leading-[1.1] font-normal text-black tracking-tight font-serif"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Enter Your Full
            <br />
            <span className="text-gray-400 italic font-light">
              Legal Name
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-4 leading-relaxed font-light">
            We are required to collect this info for verification purposes.
          </p>
        </section>

        {/* ── Error ── */}
        {error && (
          <div className="mb-6 flex items-center gap-3 py-4 px-1 border-b border-red-100">
            <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-red-500 text-lg"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}
              >
                error
              </span>
            </div>
            <p className="text-sm font-medium text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* ── Name Fields ── */}
        <section className="space-y-0 mb-8">
          {/* First Name */}
          <div className="py-5 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-gray-700 text-lg"
                  style={{ fontVariationSettings: "'wght' 400" }}
                >
                  person
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <label
                  htmlFor="firstName"
                  className="text-sm font-semibold text-gray-900 block mb-1"
                >
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => handleFirstNameChange(e.target.value)}
                  placeholder="Required"
                  className="w-full text-sm text-gray-700 font-medium bg-transparent border-none outline-none p-0 placeholder-gray-400 focus:ring-0"
                  autoComplete="given-name"
                />
              </div>
            </div>
          </div>

          {/* Last Name */}
          <div className="py-5 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-gray-700 text-lg"
                  style={{ fontVariationSettings: "'wght' 400" }}
                >
                  badge
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <label
                  htmlFor="lastName"
                  className="text-sm font-semibold text-gray-900 block mb-1"
                >
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => handleLastNameChange(e.target.value)}
                  placeholder="Required"
                  className="w-full text-sm text-gray-700 font-medium bg-transparent border-none outline-none p-0 placeholder-gray-400 focus:ring-0"
                  autoComplete="family-name"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Pre-filled from bank badge */}
        {isPreFilledFromBank && (
          <div className="flex items-center justify-center gap-1.5 mb-4">
            <span
              className="material-symbols-outlined text-green-600 text-xs"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 400" }}
            >
              verified
            </span>
            <span className="text-[10px] text-ios-green font-medium">
              Pre-filled from your bank · tap to edit
            </span>
          </div>
        )}

        {/* Helper text */}
        <p className="text-[11px] text-gray-400 text-center font-light mb-8">
          Make sure this matches your government ID.
        </p>

        {/* ── CTAs — Continue & Skip ── */}
        <section className="pb-12 space-y-3">
          <HushhTechCta
            variant={HushhTechCtaVariant.BLACK}
            onClick={handleContinue}
            disabled={!isValid || isLoading}
          >
            {isLoading ? "Saving..." : "Continue"}
          </HushhTechCta>

          <HushhTechCta
            variant={HushhTechCtaVariant.WHITE}
            onClick={handleSkip}
          >
            Skip
          </HushhTechCta>
        </section>

        {/* ── Trust Badges ── */}
        <section className="flex flex-col items-center justify-center text-center gap-2 pb-8">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px] text-hushh-blue">
              lock
            </span>
            <span className="text-[10px] text-gray-500 tracking-wide uppercase font-medium">
              256 Bit Encryption
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}
