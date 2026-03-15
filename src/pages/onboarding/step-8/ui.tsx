/**
 * Step 8 — Enter Your Address
 * Premium Hushh design matching Step 1/2/4/5/7.
 * Logic stays in logic.ts — zero logic changes.
 * Uses HushhTechBackHeader + HushhTechCta reusable components.
 */
import {
  useStep8Logic,
  PROGRESS_PCT,
  DISPLAY_STEP,
  TOTAL_STEPS,
} from "./logic";
import { SearchableSelect } from "../../../components/onboarding/SearchableSelect";
import HushhTechBackHeader from "../../../components/hushh-tech-back-header/HushhTechBackHeader";
import HushhTechCta, {
  HushhTechCtaVariant,
} from "../../../components/hushh-tech-cta/HushhTechCta";

export default function OnboardingStep8() {
  const {
    addressLine1,
    zipCode,
    loading,
    isDetecting,
    detectionStatus,
    error,
    touched,
    errors,
    isValid,
    dropdowns,
    handleBack,
    handleSkip,
    handleContinue,
    handleDetectClick,
    handleBlur,
    handleAddressLine1Change,
    handleZipCodeChange,
  } = useStep8Logic();

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
            Residence
          </h3>
          <h1
            className="text-[2.75rem] leading-[1.1] font-normal text-black tracking-tight font-serif"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Enter Your
            <br />
            <span className="text-gray-400 italic font-light">Address</span>
          </h1>
          <p className="text-sm text-gray-500 mt-4 leading-relaxed font-light">
            Please provide your primary residence address.
          </p>
        </section>

        {/* ── Detection Status ── */}
        {(isDetecting || detectionStatus) && (
          <div className="flex items-center gap-3 py-4 px-1 mb-4 border-b border-gray-100">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              {isDetecting ? (
                <div className="animate-spin h-5 w-5 border-2 border-hushh-blue border-t-transparent rounded-full" />
              ) : (
                <span
                  className="material-symbols-outlined text-ios-green text-lg"
                  style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}
                >
                  check
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-gray-700">
              {detectionStatus}
            </p>
          </div>
        )}

        {/* ── Use Current Location ── */}
        <div className="py-5 border-b border-gray-200 mb-6">
          <button
            type="button"
            onClick={handleDetectClick}
            disabled={isDetecting}
            className="flex items-center gap-4 w-full text-left group disabled:opacity-50"
            aria-label="Use my current location"
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
                Use My Current Location
              </p>
              <p className="text-xs text-gray-500 font-medium">
                Auto-fill address using GPS
              </p>
            </div>
          </button>
        </div>

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

        {/* ── Address Fields ── */}
        <section className="space-y-0 mb-6">
          {/* Address Line 1 */}
          <div className="py-5 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-gray-700 text-lg"
                  style={{ fontVariationSettings: "'wght' 400" }}
                >
                  location_on
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <label
                  htmlFor="addressLine1"
                  className="text-sm font-semibold text-gray-900 block mb-1"
                >
                  Address Line 1
                </label>
                <input
                  id="addressLine1"
                  type="text"
                  value={addressLine1}
                  onChange={(e) => handleAddressLine1Change(e.target.value)}
                  onBlur={() => handleBlur("addressLine1", addressLine1)}
                  placeholder="Street address, apt, suite, bldg"
                  className="w-full text-sm text-gray-700 font-medium bg-transparent border-none outline-none p-0 placeholder-gray-400 focus:ring-0"
                  autoComplete="address-line1"
                />
              </div>
            </div>
          </div>
          {touched.addressLine1 && errors.addressLine1 && (
            <p className="text-xs text-red-500 pl-14 py-1">
              {errors.addressLine1}
            </p>
          )}
        </section>

        {/* ── ZIP / Country / State / City ── */}
        <section className="space-y-0 mb-6">
          {/* ZIP Code — moved above Country */}
          <div className="py-5 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-gray-700 text-lg"
                  style={{ fontVariationSettings: "'wght' 400" }}
                >
                  pin
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <label
                  htmlFor="zipCode"
                  className="text-sm font-semibold text-gray-900 block mb-1"
                >
                  ZIP / Postal Code
                </label>
                <input
                  id="zipCode"
                  type="text"
                  value={zipCode}
                  inputMode="text"
                  onChange={(e) => handleZipCodeChange(e.target.value)}
                  onBlur={() => handleBlur("zipCode", zipCode)}
                  placeholder="e.g. 10001"
                  className="w-full text-sm text-gray-700 font-medium bg-transparent border-none outline-none p-0 placeholder-gray-400 focus:ring-0"
                  autoComplete="postal-code"
                />
              </div>
            </div>
          </div>
          {touched.zipCode && errors.zipCode ? (
            <p className="text-xs text-red-500 pl-14 py-1">
              {errors.zipCode}
            </p>
          ) : (
            <p className="text-[10px] text-gray-400 pl-14 pt-1 pb-2 font-light">
              Supports numeric and alphanumeric codes based on region.
            </p>
          )}

          {/* Country */}
          <div className="border-b border-gray-200">
            <SearchableSelect
              id="country"
              label="Country"
              value={dropdowns.country}
              options={dropdowns.countries.map((c) => ({
                value: c.isoCode,
                label: c.name,
              }))}
              onChange={dropdowns.setCountry}
              placeholder="Search country..."
              required
              autoComplete="country"
            />
          </div>

          {/* State */}
          <div className="border-b border-gray-200">
            <SearchableSelect
              id="state"
              label="State / Province"
              value={dropdowns.state}
              options={dropdowns.states.map((s) => ({
                value: s.isoCode,
                label: s.name,
              }))}
              onChange={dropdowns.setState}
              placeholder="Search state..."
              disabled={!dropdowns.country}
              loading={dropdowns.loadingStates}
              loadError={dropdowns.statesError}
              onRetry={dropdowns.retryStates}
              required
              autoComplete="address-level1"
            />
          </div>

          {/* City */}
          <div className="border-b border-gray-200">
            <SearchableSelect
              id="city"
              label="City"
              value={dropdowns.city}
              options={dropdowns.cities.map((c) => ({
                value: c.name,
                label: c.name,
              }))}
              onChange={dropdowns.setCity}
              placeholder="Search city..."
              disabled={!dropdowns.state}
              loading={dropdowns.loadingCities}
              loadError={dropdowns.citiesError}
              onRetry={dropdowns.retryCities}
              required
              autoComplete="address-level2"
            />
          </div>

        </section>

        {/* ── CTAs — Continue & Skip ── */}
        <section className="pb-12 space-y-3">
          <HushhTechCta
            variant={HushhTechCtaVariant.BLACK}
            onClick={handleContinue}
            disabled={!isValid || loading}
          >
            {loading ? "Saving..." : "Continue"}
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
