/**
 * Step 11 — Investment Summary
 * Premium Hushh design matching Step 1-9.
 * Share class cards, edit modal, recurring investment config.
 * Logic stays in logic.ts — zero logic changes.
 */
import {
  useStep11Logic,
  SHARE_CLASSES,
  FREQUENCY_OPTIONS,
  AMOUNT_PRESETS,
  DAY_OPTIONS,
  DISPLAY_STEP,
  PROG_TOTAL,
  PROG_PCT,
  formatCurrency,
  formatFullCurrency,
  parseFormattedNumber,
  type RecurringFrequency,
} from './logic';
import HushhTechBackHeader from '../../../components/hushh-tech-back-header/HushhTechBackHeader';
import HushhTechCta, {
  HushhTechCtaVariant,
} from '../../../components/hushh-tech-cta/HushhTechCta';

export default function OnboardingStep11() {
  const {
    loading,
    error,
    shareUnits,
    frequency,
    investmentDay,
    selectedAmount,
    customAmount,
    customAmountError,
    showRecurringEditor,
    isModalOpen,
    localShareUnits,
    savingModal,
    totalInvestment,
    modalTotalInvestment,
    hasModalChanges,
    hasAnyUnits,
    recurringAmount,
    isFormValid,
    recurringSummaryTitle,
    recurringSummarySubtitle,
    getUnits,
    getModalUnits,
    getUnitsSummary,
    handleBack,
    handleSkip,
    handleContinue,
    handleOpenModal,
    handleCloseModal,
    handleIncrement,
    handleDecrement,
    handleSaveChanges,
    handleAmountClick,
    handleCustomAmountChange,
    setFrequency,
    setInvestmentDay,
    setShowRecurringEditor,
  } = useStep11Logic();

  return (
    <div className="bg-white text-gray-900 min-h-screen antialiased flex flex-col selection:bg-hushh-blue selection:text-white">
      {/* ═══ Header ═══ */}
      <HushhTechBackHeader onBackClick={handleBack} rightLabel="FAQs" />

      <main className="px-6 flex-grow max-w-md mx-auto w-full pb-48">
        {/* ── Progress Bar ── */}
        <div className="py-4">
          <div className="flex justify-between text-[11px] font-semibold tracking-wide text-gray-500 mb-3">
            <span>Step {DISPLAY_STEP}/{PROG_TOTAL}</span>
            <span>{PROG_PCT}% Complete</span>
          </div>
          <div className="h-0.5 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-hushh-blue transition-all duration-500" style={{ width: `${PROG_PCT}%` }} />
          </div>
        </div>

        {/* ── Title Section ── */}
        <section className="py-8">
          <h3 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase mb-4 font-medium">Investment</h3>
          <h1
            className="text-[2.75rem] leading-[1.1] font-normal text-black tracking-tight font-serif"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Your
            <br />
            <span className="text-gray-400 italic font-light">Summary</span>
          </h1>
          <p className="text-sm text-gray-500 mt-4 leading-relaxed font-light">
            Review your share class allocation and set up recurring investments.
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

        {/* ── Share Class Units Section ── */}
        <section className="space-y-0 mb-6">
          <div className="py-4">
            <h3 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase font-medium">Share Class Units</h3>
          </div>

          {SHARE_CLASSES.map((shareClass) => {
            const units = getUnits(shareClass.id);
            const subtotal = units * shareClass.unitPrice;
            const hasUnits = units > 0;

            return (
              <div key={shareClass.id} className="py-5 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${hasUnits ? 'bg-hushh-blue' : 'bg-gray-100'}`}>
                    <span className={`material-symbols-outlined text-lg ${hasUnits ? 'text-white' : 'text-gray-400'}`} style={{ fontVariationSettings: "'wght' 400" }}>
                      monitoring
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{shareClass.name}</span>
                      {hasUnits && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-ios-green/10 text-ios-green border border-ios-green/20">Active</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 font-medium">
                      {formatCurrency(shareClass.unitPrice)}/unit · {units} {units === 1 ? 'unit' : 'units'}
                      {hasUnits && ` · ${formatCurrency(subtotal)}`}
                    </span>
                  </div>
                  {hasUnits && (
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(subtotal)}</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Edit link */}
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 py-4 text-gray-900 font-semibold text-sm lowercase hover:text-black transition-colors"
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'wght' 500" }}>edit</span>
            <span>Edit Share Allocation</span>
          </button>
        </section>

        {/* ── Total Investment Card ── */}
        <section className="mb-8">
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
            <div className="flex flex-col items-center text-center gap-2">
              <span className="text-[10px] tracking-[0.2em] text-gray-400 uppercase font-medium">Total Investment</span>
              <span className="text-4xl font-bold text-black tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                {hasAnyUnits ? formatFullCurrency(totalInvestment) : '$0'}
              </span>
              {hasAnyUnits && (
                <>
                  <div className="h-px w-12 bg-gray-300 my-1" />
                  <span className="text-xs text-gray-500 font-medium">{getUnitsSummary()}</span>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── Info Note ── */}
        <div className="mb-8 flex items-start gap-3 py-4 px-1">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-gray-500 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>info</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed font-light pt-2">
            We are currently accepting investments of $1 million or greater for Hushh Fund A.
          </p>
        </div>

        {/* ── Recurring Investment Section ── */}
        <section className="space-y-0 mb-6">
          <div className="py-4">
            <h3 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase font-medium">Recurring Investment</h3>
          </div>

          {/* Collapsed summary + edit */}
          <div className="py-5 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-gray-700 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>schedule</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-gray-900 block">{recurringSummaryTitle}</span>
                <span className="text-xs text-gray-500 font-medium">{recurringSummarySubtitle}</span>
              </div>
              <button
                onClick={() => setShowRecurringEditor((prev) => !prev)}
                className="text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                {showRecurringEditor ? 'Hide' : 'Edit'}
              </button>
            </div>
          </div>

          {showRecurringEditor && (
            <>
              {/* Frequency */}
              <div className="py-5 border-b border-gray-200">
                <span className="text-sm font-semibold text-gray-900 block mb-4">Frequency</span>
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {FREQUENCY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFrequency(option.value as RecurringFrequency)}
                      className={`h-11 rounded-xl text-xs font-semibold transition-all lowercase ${
                        frequency === option.value
                          ? 'bg-hushh-blue text-white'
                          : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {/* Investment Day — overlay select */}
                <div className="relative py-4 border border-gray-200 rounded-xl cursor-pointer">
                  <div className="flex items-center gap-3 px-4 pointer-events-none">
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] tracking-[0.2em] text-gray-400 uppercase font-medium block mb-0.5">Investment Day</span>
                      <span className="text-sm text-gray-900 font-medium">
                        {DAY_OPTIONS.find(o => o.value === investmentDay)?.label || 'Select day'}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-gray-400 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>expand_more</span>
                  </div>
                  <select
                    value={investmentDay}
                    onChange={(e) => setInvestmentDay(e.target.value)}
                    aria-label="Investment day"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  >
                    {DAY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Recurring Amount */}
              <div className="py-5 border-b border-gray-200">
                <span className="text-sm font-semibold text-gray-900 block mb-4">Recurring Amount</span>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {AMOUNT_PRESETS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => handleAmountClick(amount)}
                      className={`relative py-3 rounded-xl text-sm font-bold transition-all lowercase ${
                        selectedAmount === amount
                          ? 'bg-hushh-blue text-white'
                          : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      ${amount.toLocaleString()}
                      {selectedAmount === amount && (
                        <div className="absolute -top-1.5 -right-1.5 bg-hushh-blue text-white rounded-full w-5 h-5 flex items-center justify-center">
                          <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}>check</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <span className={`absolute inset-y-0 left-0 pl-4 flex items-center font-medium text-lg ${customAmountError ? 'text-red-400' : 'text-gray-400'}`}>$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customAmount}
                      onChange={handleCustomAmountChange}
                      placeholder="other amount"
                      className={`w-full h-12 rounded-xl border bg-white text-gray-900 pl-8 pr-4 text-lg font-bold outline-none transition-all placeholder:text-gray-300 lowercase ${
                        customAmountError
                          ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                          : 'border-gray-200 focus:border-hushh-blue focus:ring-1 focus:ring-hushh-blue'
                      }`}
                    />
                  </div>
                  {customAmountError && <p className="text-red-500 text-xs font-medium px-1">{customAmountError}</p>}
                  {!customAmountError && customAmount && (
                    <p className="text-ios-green text-xs font-medium px-1">Amount: ${parseFormattedNumber(customAmount).toLocaleString()}</p>
                  )}
                  {!customAmount && selectedAmount === null && (
                    <p className="text-gray-400 text-xs px-1 font-light">Leave empty to set recurring later.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        {/* ── CTAs ── */}
        <section className="pb-12 space-y-3">
          <HushhTechCta variant={HushhTechCtaVariant.BLACK} onClick={handleContinue} disabled={!isFormValid || loading}>
            {loading ? 'Saving...' : 'Continue'}
          </HushhTechCta>
          <HushhTechCta variant={HushhTechCtaVariant.WHITE} onClick={handleSkip}>
            Skip for Now
          </HushhTechCta>
        </section>

        {/* ── Trust Badge ── */}
        <section className="flex flex-col items-center justify-center text-center gap-2 pb-8">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px] text-hushh-blue">verified</span>
            <span className="text-[10px] text-gray-500 tracking-wide uppercase font-medium">SEC Registered Fund</span>
          </div>
          <p className="text-[10px] text-gray-400 font-light max-w-xs">
            Hushh Fund A is a registered investment vehicle.
          </p>
        </section>
      </main>

      {/* ═══ Edit Share Class Modal ═══ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50">
          <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl animate-slide-up max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <header className="flex items-center justify-between px-6 h-14 border-b border-gray-200 bg-white sticky top-0 z-10">
              <button onClick={handleCloseModal} className="text-sm font-medium text-gray-500">Cancel</button>
              <h2 className="text-sm font-semibold text-black">Edit Allocation</h2>
              <button
                onClick={handleSaveChanges}
                disabled={!hasModalChanges || savingModal}
                className={`text-sm font-semibold ${hasModalChanges ? 'text-hushh-blue' : 'text-gray-300'}`}
              >
                {savingModal ? '...' : 'Done'}
              </button>
            </header>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 pb-48">
              <div className="space-y-0">
                {SHARE_CLASSES.map((shareClass) => {
                  const units = getModalUnits(shareClass.id);
                  const subtotal = units * shareClass.unitPrice;

                  return (
                    <div key={shareClass.id} className="py-5 border-b border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="text-sm font-semibold text-gray-900 block">{shareClass.name}</span>
                          <span className="text-xs text-gray-500 font-medium">{formatCurrency(shareClass.unitPrice)}/unit</span>
                        </div>
                        {shareClass.badge && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-gray-100 text-gray-600 border border-gray-200">{shareClass.badge}</span>
                        )}
                      </div>

                      {/* Unit controls */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-medium">
                          {units > 0 ? formatCurrency(subtotal) : 'No units'}
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleDecrement(shareClass.id)}
                            disabled={units === 0}
                            className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
                              units === 0 ? 'border-gray-200 text-gray-300' : 'border-gray-300 text-gray-600 hover:bg-gray-50 active:scale-95'
                            }`}
                            aria-label="Decrease units"
                          >
                            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'wght' 500" }}>remove</span>
                          </button>
                          <span className="text-xl font-bold text-gray-900 min-w-[40px] text-center">{units}</span>
                          <button
                            onClick={() => handleIncrement(shareClass.id)}
                            className="w-9 h-9 rounded-full border border-black text-black hover:bg-gray-50 flex items-center justify-center active:scale-95 transition-all"
                            aria-label="Increase units"
                          >
                            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'wght' 500" }}>add</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Total */}
              <div className="mt-6 bg-gray-50 rounded-2xl p-5 border border-gray-200">
                <div className="flex flex-col items-center text-center gap-1">
                  <span className="text-[10px] tracking-[0.2em] text-gray-400 uppercase font-medium">Total Investment</span>
                  <span className="text-2xl font-bold text-black tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                    {formatFullCurrency(modalTotalInvestment)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animation */}
      <style>{`
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </div>
  );
}
