/**
 * Step 4 — Confirm Your Residence
 * Premium Hushh design matching Step 1 & Step 2.
 * Logic stays in logic.ts — zero logic changes.
 * Uses HushhTechBackHeader + HushhTechCta reusable components.
 */
import {
  useStep4Logic,
  countries,
  CURRENT_STEP,
  TOTAL_STEPS,
  PROGRESS_PCT,
} from "./logic";
import HushhTechBackHeader from "../../../components/hushh-tech-back-header/HushhTechBackHeader";
import HushhTechCta, {
  HushhTechCtaVariant,
} from "../../../components/hushh-tech-cta/HushhTechCta";
import PermissionHelpModal from "../../../components/PermissionHelpModal";

export default function OnboardingStep4() {
  const s = useStep4Logic();

  return (
    <div className="bg-white text-gray-900 min-h-screen antialiased flex flex-col selection:bg-hushh-blue selection:text-white relative overflow-hidden">
      {/* ═══ Background layer (blurs when location modal is open) ═══ */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          s.showLocationModal
            ? "scale-[0.98] blur-[2px] opacity-40 pointer-events-none select-none"
            : ""
        }`}
      >
        {/* ═══ Header ═══ */}
        <HushhTechBackHeader onBackClick={s.handleBack} rightLabel="FAQs" />

        <main className="px-6 flex-grow max-w-md mx-auto w-full pb-48">
          {/* ── Progress Bar ── */}
          <div className="py-4">
            <div className="flex justify-between text-[11px] font-semibold tracking-wide text-gray-500 mb-3">
              <span>
                Step {CURRENT_STEP}/{TOTAL_STEPS}
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
              Verification
            </h3>
            <h1
              className="text-[2.75rem] leading-[1.1] font-normal text-black tracking-tight font-serif"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Confirm Your
              <br />
              <span className="text-gray-400 italic font-light">
                Residence
              </span>
            </h1>
            <p className="text-sm text-gray-500 mt-4 leading-relaxed font-light">
              We need to know where you live and pay taxes to open your
              investment account. Your current location helps with context,
              but you must confirm citizenship and residence yourself.
            </p>
          </section>

          {/* ── Status Banners ── */}
          {s.locationStatus === "detecting" && (
            <div className="flex items-center gap-3 py-4 px-1 mb-4 border-b border-gray-100">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <div className="animate-spin h-5 w-5 border-2 border-hushh-blue border-t-transparent rounded-full" />
              </div>
              <p className="text-sm font-medium text-gray-700">
                Detecting your location...
              </p>
            </div>
          )}

          {s.isSuccessStatus && (
            <div className="flex items-center gap-4 py-5 px-1 mb-6 border-b border-gray-100">
              <div className="w-10 h-10 rounded-full bg-ios-green/10 border border-ios-green/20 flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-ios-green text-lg"
                  style={{
                    fontVariationSettings: "'FILL' 1, 'wght' 600",
                  }}
                >
                  check
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Location Detected
                </p>
                <p className="text-xs text-gray-500 font-medium">
                  {s.detectedLocation}
                </p>
              </div>
            </div>
          )}

          {s.isErrorStatus && (
            <div className="mb-6">
              <div className="flex items-center justify-between py-4 px-1 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                    <span
                      className="material-symbols-outlined text-red-500 text-lg"
                      style={{
                        fontVariationSettings: "'FILL' 1, 'wght' 600",
                      }}
                    >
                      error
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-700">
                    {s.locationStatus === "denied"
                      ? "Location access denied"
                      : "Could not detect location"}
                  </p>
                </div>
                <button
                  onClick={s.handleRetry}
                  className="text-black text-xs font-bold uppercase tracking-wide shrink-0 hover:underline"
                >
                  Retry
                </button>
              </div>
              {s.locationStatus === "denied" && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    s.setShowPermissionHelp(true);
                  }}
                  className="mt-2 ml-14 text-[11px] font-semibold text-gray-500 hover:text-hushh-blue transition-colors underline"
                >
                  How to enable location
                </button>
              )}
            </div>
          )}

          {/* ── Country Selection ── */}
          {s.shouldShowForm && (
            <section className="space-y-2 mb-8">
              {/* Citizenship Country */}
              <div className="py-5 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <span
                      className="material-symbols-outlined text-gray-700 text-lg"
                      style={{ fontVariationSettings: "'wght' 400" }}
                    >
                      flag
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 mb-0.5">
                      Country of Citizenship
                    </p>
                    <div className="relative">
                      <select
                        value={s.citizenshipCountry}
                        onChange={(e) =>
                          s.handleCitizenshipChange(e.target.value)
                        }
                        disabled={s.isDetectingLocation}
                        className="w-full text-xs text-gray-500 font-medium bg-transparent border-none outline-none cursor-pointer appearance-none pr-6 p-0"
                        aria-label="Select citizenship country"
                      >
                        <option disabled value="">
                          Select Country
                        </option>
                        {countries.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 text-base pointer-events-none">
                        expand_more
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Residence Country */}
              <div className="py-5 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <span
                      className="material-symbols-outlined text-gray-700 text-lg"
                      style={{ fontVariationSettings: "'wght' 400" }}
                    >
                      home
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 mb-0.5">
                      Country of Residence
                    </p>
                    <div className="relative">
                      <select
                        value={s.residenceCountry}
                        onChange={(e) =>
                          s.handleResidenceChange(e.target.value)
                        }
                        disabled={s.isDetectingLocation}
                        className="w-full text-xs text-gray-500 font-medium bg-transparent border-none outline-none cursor-pointer appearance-none pr-6 p-0"
                        aria-label="Select residence country"
                      >
                        <option disabled value="">
                          Select Country
                        </option>
                        {countries.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 text-base pointer-events-none">
                        expand_more
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirm manual selection */}
              {!s.locationDetected &&
                s.canConfirmSelection &&
                !s.userConfirmedManual && (
                  <div className="pt-4">
                    <button
                      onClick={s.handleConfirmManualSelection}
                      className="w-full py-3 text-xs font-bold uppercase tracking-widest text-hushh-blue border border-hushh-blue rounded-2xl hover:bg-hushh-blue hover:text-white transition-all active:scale-[0.98]"
                    >
                      Confirm Selection
                    </button>
                  </div>
                )}
            </section>
          )}

          {/* ── Detect Location Button ── */}
          {!s.showLocationModal &&
            !s.isDetectingLocation && (
              <div className="py-5 border-b border-gray-200 mb-8">
                <button
                  onClick={s.handleAllowLocation}
                  className="flex items-center gap-4 w-full text-left group"
                  aria-label="Refresh current location"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-gray-200 transition-colors">
                    <span
                      className="material-symbols-outlined text-gray-700 text-lg"
                      style={{ fontVariationSettings: "'wght' 400" }}
                    >
                      my_location
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Refresh Current Location
                    </p>
                    <p className="text-xs text-gray-500 font-medium">
                      Re-check your live location using GPS
                    </p>
                  </div>
                </button>
              </div>
            )}

          {/* ── CTAs — Continue & Skip ── */}
          <section className="pb-12 space-y-3 mt-4">
            <HushhTechCta
              variant={HushhTechCtaVariant.BLACK}
              onClick={s.handleContinue}
              disabled={
                !s.canContinue || s.isLoading || s.isDetectingLocation
              }
            >
              {s.isDetectingLocation
                ? "Detecting..."
                : s.isLoading
                ? "Saving..."
                : "Continue"}
            </HushhTechCta>

            <HushhTechCta
              variant={HushhTechCtaVariant.WHITE}
              onClick={s.handleSkip}
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

      {/* ═══ Location Permission Modal — Premium Design ═══ */}
      {s.showLocationModal && (
        <>
          {/* Dark glass overlay */}
          <div className="fixed inset-0 z-40 bg-white/60 backdrop-blur-sm" />

          {/* Modal card */}
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
            <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.04)] p-8 flex flex-col items-center text-center border border-gray-100/50">
              {/* Location icon in circle */}
              <div className="mb-8">
                <div className="w-20 h-20 rounded-full border border-gray-200 bg-white flex items-center justify-center shadow-sm">
                  <span
                    className="material-symbols-outlined text-black text-[2rem]"
                    style={{ fontVariationSettings: "'wght' 200" }}
                  >
                    location_on
                  </span>
                </div>
              </div>

              {/* Heading & description */}
              <div className="space-y-4 mb-10 px-2">
                <h2
                  className="text-[1.75rem] leading-[1.2] text-black tracking-tight font-serif"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Enable Location Access
                </h2>
                <p className="text-gray-500 text-[0.85rem] leading-relaxed font-light max-w-[90%] mx-auto">
                  Hushh uses your location to automatically determine your
                  country and streamline the secure verification process.
                </p>
              </div>

              {/* Action buttons */}
              <div className="w-full space-y-4">
                {/* Allow while using app — primary black */}
                <button
                  onClick={s.handleAllowLocation}
                  className="w-full h-12 bg-hushh-blue text-white font-medium text-[0.8rem] flex items-center justify-center shadow-lg hover:shadow-xl transition-all active:scale-[0.99] border border-hushh-blue rounded-2xl hover:bg-hushh-blue/90"
                >
                  Allow while using app
                </button>

                {/* Allow once — outlined */}
                <button
                  onClick={s.handleAllowLocation}
                  className="w-full h-12 border border-gray-200 bg-white text-black font-medium text-[0.8rem] rounded-2xl hover:bg-gray-50 transition-colors active:scale-[0.99]"
                >
                  Allow once
                </button>

                {/* Don't allow — text link */}
                <div className="pt-2">
                  <button
                    onClick={s.handleDontAllow}
                    className="text-xs font-medium text-gray-400 hover:text-black transition-colors"
                  >
                    Don&apos;t allow
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ Permission Help Modal ═══ */}
      <PermissionHelpModal
        isOpen={s.showPermissionHelp}
        onClose={() => s.setShowPermissionHelp(false)}
      />
    </div>
  );
}
