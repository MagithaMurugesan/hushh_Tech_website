/**
 * Step 9 — SSN + Date of Birth
 * Premium Hushh design. Overlay select pattern for reliable mobile taps.
 */
import {
  useStep9Logic,
  PROGRESS_PCT,
  DISPLAY_STEP,
  TOTAL_STEPS,
  MONTH_NAMES,
} from "./logic";
import HushhTechBackHeader from "../../../components/hushh-tech-back-header/HushhTechBackHeader";
import HushhTechCta, {
  HushhTechCtaVariant,
} from "../../../components/hushh-tech-cta/HushhTechCta";

export default function OnboardingStep9() {
  const {
    ssn,
    dobMonth,
    setDobMonth,
    dobDay,
    setDobDay,
    dobYear,
    setDobYear,
    loading,
    error,
    showInfo,
    isFormValid,
    isUnder18,
    ageError,
    yearOptions,
    dayOptions,
    handleSSNChange,
    handleContinue,
    handleSkip,
    handleBack,
    handleShowInfoToggle,
  } = useStep9Logic();

  return (
    <div className="bg-white text-gray-900 min-h-screen antialiased flex flex-col selection:bg-hushh-blue selection:text-white">
      {/* ═══ Header ═══ */}
      <HushhTechBackHeader onBackClick={handleBack} rightLabel="FAQs" />

      <main className="px-6 flex-grow max-w-md mx-auto w-full pb-48">
        {/* ── Progress Bar ── */}
        <div className="py-4">
          <div className="flex justify-between text-[11px] font-semibold tracking-wide text-gray-500 mb-3">
            <span>Step {DISPLAY_STEP}/{TOTAL_STEPS}</span>
            <span>{PROGRESS_PCT}% Complete</span>
          </div>
          <div className="h-0.5 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-hushh-blue transition-all duration-500" style={{ width: `${PROGRESS_PCT}%` }} />
          </div>
        </div>

        {/* ── Title Section ── */}
        <section className="py-8">
          <h3 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase mb-4 font-medium">Verification</h3>
          <h1 className="text-[2.75rem] leading-[1.1] font-normal text-black tracking-tight font-serif" style={{ fontFamily: "'Playfair Display', serif" }}>
            A Few More<br />
            <span className="text-gray-400 italic font-light">Details</span>
          </h1>
          <p className="text-sm text-gray-500 mt-4 leading-relaxed font-light">
            Federal law requires us to collect this info for tax reporting.
          </p>
        </section>

        {/* ── Error ── */}
        {error && (
          <div className="mb-6 flex items-center gap-3 py-4 px-1 border-b border-red-100">
            <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-red-500 text-lg" style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}>error</span>
            </div>
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        )}

        {/* ── SSN Section ── */}
        <section className="space-y-0 mb-6">
          <div className="py-5 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-gray-700 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>lock</span>
              </div>
              <div className="flex-1 min-w-0">
                <label htmlFor="ssn" className="text-sm font-semibold text-gray-900 block mb-1">Social Security Number</label>
                <input
                  id="ssn"
                  type="text"
                  value={ssn}
                  onChange={handleSSNChange}
                  placeholder="000-00-0000"
                  maxLength={11}
                  inputMode="numeric"
                  className="w-full text-sm text-gray-700 font-medium bg-transparent border-none outline-none p-0 placeholder-gray-400 focus:ring-0 tracking-widest"
                />
              </div>
            </div>
          </div>

          {/* Why SSN Info */}
          <details className="group border-b border-gray-200" open={showInfo} onToggle={(e) => handleShowInfoToggle((e.target as HTMLDetailsElement).open)}>
            <summary className="py-5 flex items-center gap-4 cursor-pointer list-none">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-gray-200 transition-colors">
                <span className="material-symbols-outlined text-gray-700 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>info</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Why do we need your SSN?</p>
                <p className="text-xs text-gray-500 font-medium">Tap to learn more</p>
              </div>
              <span className="material-symbols-outlined text-gray-400 text-lg transition-transform group-open:rotate-180" style={{ fontVariationSettings: "'wght' 400" }}>expand_more</span>
            </summary>
            <div className="pl-14 pb-5 pr-4">
              <p className="text-xs text-gray-500 leading-relaxed font-light">
                We are required by federal law to collect this information to prevent fraud and verify your identity before opening an investment account.
              </p>
            </div>
          </details>
        </section>

        {/* ── Date of Birth Section ── */}
        <section className="space-y-0 mb-6">
          <div className="py-4">
            <h3 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase font-medium">Date of Birth</h3>
          </div>

          {/* Month — overlay select */}
          <div className="relative py-5 border-b border-gray-200 cursor-pointer">
            <div className="flex items-center gap-4 pointer-events-none">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-gray-700 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>calendar_month</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-gray-900 block mb-1">Month</span>
                <span className="text-sm text-gray-700 font-medium">
                  {dobMonth ? MONTH_NAMES[parseInt(dobMonth) - 1] : 'Select month'}
                </span>
              </div>
              <span className="material-symbols-outlined text-gray-400 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>expand_more</span>
            </div>
            <select
              value={dobMonth}
              onChange={(e) => setDobMonth(e.target.value)}
              aria-label="Birth month"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              <option value="" disabled>Select month</option>
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={String(idx + 1).padStart(2, "0")}>{name}</option>
              ))}
            </select>
          </div>

          {/* Day — overlay select */}
          <div className="relative py-5 border-b border-gray-200 cursor-pointer">
            <div className="flex items-center gap-4 pointer-events-none">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-gray-700 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>today</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-gray-900 block mb-1">Day</span>
                <span className="text-sm text-gray-700 font-medium">
                  {dobDay ? parseInt(dobDay) : 'Select day'}
                </span>
              </div>
              <span className="material-symbols-outlined text-gray-400 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>expand_more</span>
            </div>
            <select
              value={dobDay}
              onChange={(e) => setDobDay(e.target.value)}
              aria-label="Birth day"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              <option value="" disabled>Select day</option>
              {dayOptions.map((d) => (
                <option key={d} value={d}>{parseInt(d)}</option>
              ))}
            </select>
          </div>

          {/* Year — overlay select */}
          <div className="relative py-5 border-b border-gray-200 cursor-pointer">
            <div className="flex items-center gap-4 pointer-events-none">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-gray-700 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>event</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-gray-900 block mb-1">Year</span>
                <span className="text-sm text-gray-700 font-medium">
                  {dobYear || 'Select year'}
                </span>
              </div>
              <span className="material-symbols-outlined text-gray-400 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>expand_more</span>
            </div>
            <select
              value={dobYear}
              onChange={(e) => setDobYear(e.target.value)}
              aria-label="Birth year"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              <option value="" disabled>Select year</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* 18+ age warning */}
          {isUnder18 && ageError && (
            <div className="flex items-center gap-3 py-4 px-1">
              <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-500 text-lg" style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}>error</span>
              </div>
              <p className="text-sm font-medium text-red-600">{ageError}</p>
            </div>
          )}

          {/* Confirmation when all selected and 18+ */}
          {isFormValid && (
            <div className="flex items-center gap-3 py-4 px-1">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-ios-green text-lg" style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}>check</span>
              </div>
              <p className="text-sm font-medium text-gray-700">
                {MONTH_NAMES[parseInt(dobMonth) - 1]} {parseInt(dobDay)}, {dobYear}
              </p>
            </div>
          )}
        </section>

        {/* ── CTAs ── */}
        <section className="pb-12 space-y-3">
          <HushhTechCta variant={HushhTechCtaVariant.BLACK} onClick={handleContinue} disabled={!isFormValid || loading}>
            {loading ? "Saving..." : "Continue"}
          </HushhTechCta>
          <HushhTechCta variant={HushhTechCtaVariant.WHITE} onClick={handleSkip}>
            Skip SSN
          </HushhTechCta>
        </section>

        {/* ── Trust Badges ── */}
        <section className="flex flex-col items-center justify-center text-center gap-2 pb-8">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px] text-hushh-blue">lock</span>
            <span className="text-[10px] text-gray-500 tracking-wide uppercase font-medium">256 Bit Encryption</span>
          </div>
          <p className="text-[10px] text-gray-400 font-light max-w-xs">
            Your SSN is encrypted end-to-end and never stored in plain text.
          </p>
        </section>
      </main>
    </div>
  );
}
