/**
 * Step 13 — Bank Details
 * Premium Hushh design matching Step 1-11.
 * Bank form, Plaid account selector, country overlay select.
 * Logic stays in logic.ts — zero logic changes.
 */
import {
  useStep13Logic,
  SHARE_CLASSES,
  COUNTRIES,
  formatCurrency,
} from './logic';
import HushhTechBackHeader from '../../../components/hushh-tech-back-header/HushhTechBackHeader';
import HushhTechCta, {
  HushhTechCtaVariant,
} from '../../../components/hushh-tech-cta/HushhTechCta';
import { getOnboardingDisplayMeta } from '../../../services/onboarding/flow';

const DISPLAY_META = getOnboardingDisplayMeta('/onboarding/step-10');
const PROGRESS_PCT = Math.round((DISPLAY_META.displayStep / DISPLAY_META.totalSteps) * 100);

export default function OnboardingStep13() {
  const {
    loading,
    pageLoading,
    error,
    autoFillMessage,
    plaidAccounts,
    selectedAccountIdx,
    plaidInstitutionName,
    bankName,
    accountHolderName,
    accountNumber,
    confirmAccountNumber,
    routingNumber,
    bankCity,
    bankCountry,
    accountType,
    formattedOnboardingAccountType,
    touched,
    shareUnits,
    totalInvestment,
    hasAnyUnits,
    bankNameError,
    accountHolderNameError,
    accountNumberError,
    confirmAccountNumberError,
    routingNumberError,
    isFormValid,
    getUnits,
    handleBlur,
    handleBack,
    handleSkip,
    handleContinue,
    setBankName,
    setAccountHolderName,
    setAccountNumber,
    setConfirmAccountNumber,
    setRoutingNumber,
    setBankCity,
    setAccountType,
    setSelectedAccountIdx,
    applyAccountSelection,
    userModifiedFields,
  } = useStep13Logic();

  return (
    <div className="bg-white text-gray-900 min-h-screen antialiased flex flex-col selection:bg-hushh-blue selection:text-white">
      {/* ═══ Header ═══ */}
      <HushhTechBackHeader onBackClick={handleBack} rightLabel="FAQs" />

      <main className="px-6 flex-grow max-w-md mx-auto w-full pb-48">
        {/* ── Progress Bar ── */}
        <div className="py-4">
          <div className="flex justify-between text-[11px] font-semibold tracking-wide text-gray-500 mb-3">
            <span>Step {DISPLAY_META.displayStep}/{DISPLAY_META.totalSteps}</span>
            <span>{PROGRESS_PCT}% Complete</span>
          </div>
          <div className="h-0.5 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-hushh-blue" style={{ width: `${PROGRESS_PCT}%` }} />
          </div>
        </div>

        {/* ── Title Section ── */}
        <section className="py-8">
          <h3 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase mb-4 font-medium">Final Step</h3>
          <h1
            className="text-[2.75rem] leading-[1.1] font-normal text-black tracking-tight font-serif"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Bank
            <br />
            <span className="text-gray-400 italic font-light">Details</span>
          </h1>
          <p className="text-sm text-gray-500 mt-4 leading-relaxed font-light">
            Provide your banking information for investment transfers securely.
          </p>
        </section>

        {/* ── Page Loading Shimmer ── */}
        {pageLoading && (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl border-b border-gray-200" />
            ))}
            <p className="text-center text-xs text-gray-400 font-light pt-4">Loading your data...</p>
          </div>
        )}

        {/* ── Form Content ── */}
        {!pageLoading && (
          <>
            {/* Error */}
            {error && (
              <div className="mb-6 flex items-center gap-3 py-4 px-1 border-b border-red-100">
                <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-red-500 text-lg" style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}>error</span>
                </div>
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}

            {/* Plaid Auto-Fill Banner */}
            {autoFillMessage && (
              <div className="mb-6 flex items-center gap-3 py-4 px-1 border-b border-ios-green/20">
                <div className="w-10 h-10 rounded-full bg-ios-green/10 border border-ios-green/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-ios-green text-lg" style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}>check_circle</span>
                </div>
                <p className="text-sm font-medium text-gray-700">{autoFillMessage}</p>
              </div>
            )}

            {/* Multi-Account Selector */}
            {plaidAccounts.length > 1 && (
              <section className="mb-6">
                <div className="py-4">
                  <h3 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase font-medium">
                    {plaidInstitutionName ? `${plaidInstitutionName} — ` : ''}Select Account
                  </h3>
                </div>
                <div className="space-y-2">
                  {plaidAccounts.map((acct, idx) => {
                    const isSelected = idx === selectedAccountIdx;
                    return (
                      <button
                        key={acct.accountId || idx}
                        type="button"
                        onClick={() => {
                          setSelectedAccountIdx(idx);
                          userModifiedFields.current.delete('accountNumber');
                          userModifiedFields.current.delete('confirmAccountNumber');
                          userModifiedFields.current.delete('routingNumber');
                          userModifiedFields.current.delete('accountType');
                          applyAccountSelection(acct);
                        }}
                        className={`w-full flex items-center gap-4 py-4 px-1 border-b transition-all text-left ${
                          isSelected ? 'border-black' : 'border-gray-200'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-hushh-blue' : 'bg-gray-100'}`}>
                          <span className={`material-symbols-outlined text-lg ${isSelected ? 'text-white' : 'text-gray-400'}`} style={{ fontVariationSettings: "'wght' 400" }}>account_balance</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-gray-900 block truncate">{acct.name}</span>
                          <span className="text-xs text-gray-500 font-medium">{acct.subtype} · ····{acct.mask}</span>
                        </div>
                        {isSelected && (
                          <span className="material-symbols-outlined text-hushh-blue text-lg" style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}>check_circle</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Investment Amount Card */}
            {hasAnyUnits && (
              <section className="mb-8">
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                  <div className="flex flex-col items-center text-center gap-2">
                    <span className="text-[10px] tracking-[0.2em] text-gray-400 uppercase font-medium">Investment Amount</span>
                    <span className="text-3xl font-bold text-black tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {formatCurrency(totalInvestment)}
                    </span>
                    <div className="flex flex-wrap gap-2 mt-2 justify-center">
                      {SHARE_CLASSES.map((sc) => {
                        const units = getUnits(sc.id);
                        if (units === 0) return null;
                        return (
                          <span key={sc.id} className="px-2 py-0.5 text-[10px] font-semibold rounded bg-gray-100 text-gray-600 border border-gray-200">
                            {sc.name} · {units}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ── Banking Information ── */}
            <section className="space-y-0 mb-6">
              <div className="py-4">
                <h3 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase font-medium">Banking Information</h3>
              </div>

              {/* Bank Name */}
              <div className="py-5 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-gray-700 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>account_balance</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-sm font-semibold text-gray-900 block mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => { userModifiedFields.current.add('bankName'); setBankName(e.target.value); }}
                      onBlur={() => handleBlur('bankName')}
                      placeholder="Enter bank name"
                      className="w-full text-sm text-gray-700 font-medium bg-transparent border-none outline-none p-0 placeholder-gray-400 focus:ring-0"
                    />
                  </div>
                </div>
                {touched.bankName && bankNameError && <p className="text-xs text-red-500 font-medium mt-2 pl-14">{bankNameError}</p>}
              </div>

              {/* Account Holder Name */}
              <div className="py-5 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-gray-700 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>person</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-sm font-semibold text-gray-900 block mb-1">Account Holder Name</label>
                    <input
                      type="text"
                      value={accountHolderName}
                      onChange={(e) => setAccountHolderName(e.target.value)}
                      onBlur={() => handleBlur('accountHolderName')}
                      placeholder="As it appears on your account"
                      className="w-full text-sm text-gray-700 font-medium bg-transparent border-none outline-none p-0 placeholder-gray-400 focus:ring-0"
                    />
                  </div>
                </div>
                {touched.accountHolderName && accountHolderNameError && <p className="text-xs text-red-500 font-medium mt-2 pl-14">{accountHolderNameError}</p>}
              </div>

              {/* Account Type */}
              <div className="py-5 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-gray-700 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>credit_card</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-gray-900 block mb-1">Account Type</span>
                    <span className="text-sm text-gray-700 font-medium">{formattedOnboardingAccountType}</span>
                  </div>
                  <span className="material-symbols-outlined text-gray-400 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>chevron_right</span>
                </div>
              </div>

              <div className="py-5 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-gray-700 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>public</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-gray-900 block mb-1">Country</span>
                    <span className="text-sm text-gray-700 font-medium">
                      {COUNTRIES.find(c => c.code === bankCountry)?.name || bankCountry}
                    </span>
                    <span className="text-xs text-gray-400 font-medium block mt-1">
                      Derived from your verified residence details
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Account Details ── */}
            <section className="space-y-0 mb-6">
              <div className="py-4">
                <h3 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase font-medium">Account Details</h3>
              </div>

              {/* Routing Number */}
              <div className="py-5 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-gray-700 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>tag</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-sm font-semibold text-gray-900 block mb-1">Routing Number</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={routingNumber}
                      onChange={(e) => { userModifiedFields.current.add('routingNumber'); setRoutingNumber(e.target.value.replace(/\D/g, '').slice(0, bankCountry === 'US' ? 9 : 15)); }}
                      onBlur={() => handleBlur('routingNumber')}
                      placeholder={bankCountry === 'US' ? '9 digits' : 'enter routing number'}
                      maxLength={bankCountry === 'US' ? 9 : 15}
                      className="w-full text-sm text-gray-700 font-medium font-mono tracking-wider bg-transparent border-none outline-none p-0 placeholder-gray-400 focus:ring-0"
                    />
                  </div>
                </div>
                {touched.routingNumber && routingNumberError && <p className="text-xs text-red-500 font-medium mt-2 pl-14">{routingNumberError}</p>}
              </div>

              {/* Account Number */}
              <div className="py-5 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-gray-700 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>pin</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-sm font-semibold text-gray-900 block mb-1">Account Number</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={accountNumber}
                      onChange={(e) => { userModifiedFields.current.add('accountNumber'); setAccountNumber(e.target.value.replace(/\D/g, '')); }}
                      onBlur={() => handleBlur('accountNumber')}
                      placeholder="enter account number"
                      className="w-full text-sm text-gray-700 font-medium font-mono tracking-wider bg-transparent border-none outline-none p-0 placeholder-gray-400 focus:ring-0"
                    />
                  </div>
                </div>
                {touched.accountNumber && accountNumberError && <p className="text-xs text-red-500 font-medium mt-2 pl-14">{accountNumberError}</p>}
              </div>

              {/* Confirm Account Number */}
              <div className="py-5 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-gray-700 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>verified</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-sm font-semibold text-gray-900 block mb-1">Confirm Account Number</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={confirmAccountNumber}
                      onChange={(e) => { userModifiedFields.current.add('confirmAccountNumber'); setConfirmAccountNumber(e.target.value.replace(/\D/g, '')); }}
                      onBlur={() => handleBlur('confirmAccountNumber')}
                      placeholder="re-enter account number"
                      className="w-full text-sm text-gray-700 font-medium font-mono tracking-wider bg-transparent border-none outline-none p-0 placeholder-gray-400 focus:ring-0"
                    />
                  </div>
                </div>
                {touched.confirmAccountNumber && confirmAccountNumberError && <p className="text-xs text-red-500 font-medium mt-2 pl-14">{confirmAccountNumberError}</p>}
              </div>

              {/* Info note */}
              <div className="flex items-start gap-3 py-4 px-1">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-gray-500 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>info</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed font-light pt-2">
                  Routing number can be found on the bottom left of your check. Ensure the holder name matches your ID exactly.
                </p>
              </div>
            </section>

            {/* ── CTAs ── */}
            <section className="pb-12 space-y-3">
              <HushhTechCta variant={HushhTechCtaVariant.BLACK} onClick={handleContinue} disabled={loading || !isFormValid()}>
                {loading ? 'Saving...' : 'Complete Setup'}
              </HushhTechCta>
              <HushhTechCta variant={HushhTechCtaVariant.WHITE} onClick={handleSkip}>
                I'll Do This Later
              </HushhTechCta>
            </section>

            {/* ── Trust Badge ── */}
            <section className="flex flex-col items-center justify-center text-center gap-2 pb-8">
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px] text-hushh-blue">lock</span>
                <span className="text-[10px] text-gray-500 tracking-wide uppercase font-medium">Bank-Level Security</span>
              </div>
              <p className="text-[10px] text-gray-400 font-light max-w-xs">
                Your data is encrypted with 256-bit SSL security.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
