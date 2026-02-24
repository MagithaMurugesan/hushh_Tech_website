/**
 * Step 1 — Fund A Allocation Tier
 * Matches the refined HTML design. Logic stays in logic.ts.
 * Uses HushhTechBackHeader + HushhTechCta reusable components.
 */
import {
  useStep1Logic,
  SHARE_CLASSES,
  TOTAL_STEPS,
  FREQ_OPTIONS,
  AMOUNT_PRESETS,
  formatCurrency,
} from "./logic";
import HushhTechBackHeader from "../../../components/hushh-tech-back-header/HushhTechBackHeader";
import HushhTechCta, {
  HushhTechCtaVariant,
} from "../../../components/hushh-tech-cta/HushhTechCta";

/** Icons for each share class */
const CLASS_ICONS: Record<string, string> = {
  class_a: "account_balance_wallet",
  class_b: "account_balance",
  class_c: "savings",
};

/** Tier descriptions */
const TIER_LABELS: Record<string, string> = {
  ultra: "ultra high net worth",
  premium: "high net worth",
  standard: "accredited investor",
};

const CURRENT_STEP = 1;
const PROGRESS_PCT = Math.round((CURRENT_STEP / TOTAL_STEPS) * 100);

export default function OnboardingStep1() {
  const {
    units,
    frequency,
    investmentDay,
    selectedAmount,
    customAmount,
    customAmountError,
    error,
    isLoading,
    hasSelection,
    handleUnitChange,
    handleAmountClick,
    handleCustomAmountChange,
    setFrequency,
    setInvestmentDay,
    handleNext,
    handleBack,
  } = useStep1Logic();

  return (
    <div className="bg-white text-gray-900 min-h-screen antialiased flex flex-col selection:bg-black selection:text-white">
      {/* ═══ Header ═══ */}
      <HushhTechBackHeader onBackClick={handleBack} rightLabel="FAQs" />

      <main className="px-6 flex-grow max-w-md mx-auto w-full pb-48">
        {/* ── Progress Bar ── */}
        <div className="py-4">
          <div className="flex justify-between text-[10px] font-medium tracking-wide text-gray-400 mb-3 lowercase">
            <span>step {CURRENT_STEP}/{TOTAL_STEPS}</span>
            <span>{PROGRESS_PCT}% complete</span>
          </div>
          <div className="h-0.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-black transition-all duration-500"
              style={{ width: `${PROGRESS_PCT}%` }}
            />
          </div>
        </div>

        {/* ── Title Section ── */}
        <section className="py-8">
          <h3 className="text-[11px] tracking-wide text-gray-400 lowercase mb-4 font-normal">
            institutional series
          </h3>
          <h1
            className="text-[2.75rem] leading-[1.1] font-normal text-black tracking-tight lowercase"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            hushh fund a <br />
            <span className="text-gray-400 font-normal opacity-60">
              multi-strategy alpha
            </span>
          </h1>
        </section>

        {/* ── Share Class Rows ── */}
        <section className="mt-4 mb-12 space-y-2">
          {SHARE_CLASSES.map((sc) => {
            const count = units[sc.id] || 0;
            const isActive = count > 0;
            return (
              <div
                key={sc.id}
                className="group py-5 border-b border-gray-100 flex items-center justify-between"
              >
                {/* Left: icon + name + tier */}
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center shrink-0 ${
                      isActive ? "bg-gray-50" : "bg-white"
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-gray-400 text-xl"
                      style={{ fontVariationSettings: "'wght' 200" }}
                    >
                      {CLASS_ICONS[sc.id] || "wallet"}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h2 className="text-base font-medium text-black lowercase">
                        {sc.name.toLowerCase()}
                      </h2>
                      {sc.id === "class_a" && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium lowercase rounded-sm">
                          recommended
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 lowercase leading-relaxed">
                      {TIER_LABELS[sc.tier] || sc.description}
                    </p>
                  </div>
                </div>

                {/* Right: price + stepper */}
                <div className="flex flex-col items-end gap-1">
                  <div className="text-right mb-1">
                    <span
                      className={`text-sm font-sans ${
                        isActive ? "text-black font-semibold" : "text-gray-500 font-medium"
                      }`}
                    >
                      {sc.displayPrice}
                    </span>{" "}
                    <span className="text-[10px] text-gray-400 lowercase">
                      /unit
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-3 rounded-full px-2 py-1 ${
                      isActive
                        ? "bg-gray-50"
                        : "opacity-40 group-hover:opacity-100 transition-opacity"
                    }`}
                  >
                    <button
                      onClick={() => handleUnitChange(sc.id, -1)}
                      className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-black transition"
                      aria-label={`Decrease ${sc.name}`}
                    >
                      <span className="material-symbols-outlined text-sm">
                        remove
                      </span>
                    </button>
                    <span
                      className={`font-mono text-sm w-3 text-center ${
                        isActive ? "text-black" : "text-gray-400"
                      }`}
                    >
                      {count}
                    </span>
                    <button
                      onClick={() => handleUnitChange(sc.id, 1)}
                      className="w-5 h-5 flex items-center justify-center rounded-full text-black hover:bg-gray-200 transition"
                      aria-label={`Increase ${sc.name}`}
                    >
                      <span className="material-symbols-outlined text-sm">
                        add
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* ── Recurring Investment ── */}
        <section className="mb-32">
          <div className="flex items-center justify-between mb-8">
            <h3
              className="text-xl text-black lowercase font-normal"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              recurring investment
            </h3>
            {/* Simple toggle visual (non-functional placeholder — logic handles state) */}
            <div className="relative inline-block w-10 align-middle select-none transition duration-200 ease-in">
              <input
                className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-200 checked:right-0 checked:border-black transition-all duration-300"
                id="recurring-toggle"
                type="checkbox"
                defaultChecked
              />
              <label
                className="toggle-label block overflow-hidden h-5 rounded-full bg-gray-100 cursor-pointer transition-colors duration-300"
                htmlFor="recurring-toggle"
              />
            </div>
          </div>

          <div className="space-y-0">
            {/* Frequency */}
            <div className="py-5 flex items-start justify-between group cursor-pointer border-b border-gray-50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                  <span
                    className="material-symbols-outlined text-gray-500 text-lg"
                    style={{ fontVariationSettings: "'wght' 200" }}
                  >
                    calendar_today
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-black lowercase mb-0.5">
                    frequency
                  </p>
                  <p className="text-xs text-gray-400 lowercase">
                    choose payment schedule
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-medium text-black lowercase">
                  {FREQ_OPTIONS.find((f) => f.value === frequency)?.label ||
                    "once a month"}
                </span>
                <span className="material-symbols-outlined text-black text-lg">
                  arrow_right_alt
                </span>
              </div>
            </div>

            {/* Day */}
            <div className="py-5 flex items-start justify-between group cursor-pointer border-b border-gray-50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                  <span
                    className="material-symbols-outlined text-gray-500 text-lg"
                    style={{ fontVariationSettings: "'wght' 200" }}
                  >
                    schedule
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-black lowercase mb-0.5">
                    day
                  </p>
                  <p className="text-xs text-gray-400 lowercase">
                    select debit date
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-medium text-black lowercase">
                  {investmentDay.toLowerCase().replace("of the", "of")}
                </span>
                <span className="material-symbols-outlined text-black text-lg">
                  arrow_right_alt
                </span>
              </div>
            </div>

            {/* Amount */}
            <div className="py-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                  <span
                    className="material-symbols-outlined text-gray-500 text-lg"
                    style={{ fontVariationSettings: "'wght' 200" }}
                  >
                    payments
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-black lowercase mb-0.5">
                    amount
                  </p>
                  <p className="text-xs text-gray-400 lowercase">
                    investment per cycle
                  </p>
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 pl-14">
                {AMOUNT_PRESETS.map((amt) => {
                  const isSelected = selectedAmount === amt;
                  return (
                    <button
                      key={amt}
                      onClick={() => handleAmountClick(amt)}
                      className={`flex-shrink-0 px-6 py-3 text-xs font-mono transition whitespace-nowrap lowercase ${
                        isSelected
                          ? "bg-black text-white shadow-md"
                          : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {formatCurrency(amt)}
                    </button>
                  );
                })}
              </div>

              {/* Custom amount input */}
              <div className="pl-14 mt-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    $
                  </span>
                  <input
                    type="text"
                    value={customAmount}
                    onChange={handleCustomAmountChange}
                    placeholder="Custom amount"
                    className="w-full pl-7 pr-4 py-3 bg-gray-50 text-sm font-mono text-black placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-black transition lowercase"
                  />
                </div>
                {customAmountError && (
                  <p className="text-xs text-red-500 mt-1">{customAmountError}</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Error message ── */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-xs text-center">
            {error}
          </div>
        )}

        {/* ── CTAs — Continue & Skip ── */}
        <section className="pb-12 space-y-3">
          <HushhTechCta
            variant={HushhTechCtaVariant.BLACK}
            onClick={handleNext}
            disabled={!hasSelection || isLoading}
          >
            {isLoading ? "Saving..." : "Continue"}
          </HushhTechCta>

          <HushhTechCta
            variant={HushhTechCtaVariant.WHITE}
            onClick={handleBack}
          >
            Skip
          </HushhTechCta>
        </section>

        {/* ── Trust Badges ── */}
        <section className="flex flex-col items-center justify-center text-center gap-2 pb-8">
          <div className="flex items-center gap-2 opacity-60">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[10px] text-gray-500">
                lock
              </span>
              <span className="text-[9px] text-gray-500 tracking-wide uppercase">
                256 bit encryption
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
