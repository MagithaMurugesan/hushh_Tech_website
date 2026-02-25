/**
 * HushhUserProfile — Refined 2.0 Design
 * Aligned with onboarding steps 1-9 design language.
 * Uses same wrapper, header, CTA, spacing patterns.
 */
import React from "react";
import { useHushhUserProfileLogic } from "./logic";
import { Copy, Check } from "lucide-react";
import { FaApple } from "react-icons/fa";
import { SiGooglepay } from "react-icons/si";
import HushhTechBackHeader from "../../components/hushh-tech-back-header/HushhTechBackHeader";
import HushhTechCta, { HushhTechCtaVariant } from "../../components/hushh-tech-cta/HushhTechCta";
import NWSScoreBadge from "../../components/profile/NWSScoreBadge";

/* ── tiny reusable row (settings-style) ── */
const FieldRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="group flex items-center justify-between border-b border-gray-200 py-4 hover:bg-gray-50/50 transition-colors">
    <span className="text-sm text-gray-500 font-light lowercase">{label}</span>
    <div className="flex items-center gap-2 text-right">{children}</div>
  </div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-4 mt-2 font-medium">{children}</p>
);

/* inline input class */
const inlineInput = "text-right text-sm font-medium bg-transparent border-none focus:ring-0 p-0 text-black";

/* ── page ── */
const HushhUserProfilePage: React.FC = () => {
  const {
    form, investorProfile, loading, hasOnboardingData,
    isApplePassLoading, isGooglePassLoading, nwsResult, nwsLoading,
    hasCopied, onCopy, profileUrl, navigate,
    handleChange, handleSubmit, handleBack, handleSave,
    handleAppleWalletPass, handleGoogleWalletPass, COUNTRIES,
  } = useHushhUserProfileLogic();

  const firstName = form.name?.split(" ")[0] || "investor";

  return (
    <div className="bg-white text-gray-900 min-h-screen antialiased flex flex-col selection:bg-black selection:text-white">
      {/* ═══ Header ═══ */}
      <HushhTechBackHeader onBackClick={handleBack} rightLabel="FAQs" />

      <main className="px-6 flex-grow max-w-md mx-auto w-full pb-48">
        {/* ── Hero ── */}
        <section className="py-8">
          <div className="inline-block px-3 py-1 mb-4 border border-gray-200 rounded-full">
            <span className="text-[10px] tracking-widest uppercase font-medium text-gray-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-black rounded-full" />
              premium member
            </span>
          </div>
          <h1
            className="text-[2.25rem] leading-[1.15] font-medium text-black tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            investor profile
          </h1>
          <p className="text-gray-500 text-sm font-light mt-2 lowercase">
            welcome back, {firstName}
          </p>
        </section>

        {/* ── NWS strip ── */}
        <section className="mb-10 border-t border-b border-gray-200 py-4 flex justify-between items-center">
          <span
            className="text-lg italic text-gray-400 lowercase"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            nws
          </span>
          {nwsResult ? (
            <NWSScoreBadge result={nwsResult} loading={nwsLoading} size="sm" />
          ) : (
            <span className="font-mono text-xs text-gray-300 uppercase tracking-wider">
              no data available
            </span>
          )}
        </section>

        {/* ── AI section ── */}
        <section className="mb-12">
          <h2
            className="text-xl font-medium text-black tracking-tight lowercase mb-3"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            ai-powered profile intelligence
          </h2>
          <p className="text-gray-500 text-sm font-light mb-6 leading-relaxed lowercase">
            hushh ai automatically detects your investment preferences and risk
            appetite to tailor opportunities specifically for you.
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-black text-white py-3.5 px-6 flex items-center justify-between group hover:bg-black/90 transition-all disabled:opacity-50"
          >
            <span className="text-sm font-medium lowercase">
              {loading
                ? "generating..."
                : investorProfile
                ? "update profile"
                : hasOnboardingData
                ? "enhance with ai"
                : "generate investor profile"}
            </span>
            <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">
              auto_awesome
            </span>
          </button>
        </section>

        {/* ── Your Hushh Profile ── */}
        <section className="mb-12">
          <div className="mb-8">
            <h2
              className="text-2xl font-medium text-black tracking-tight lowercase mb-2"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              your hushh profile
            </h2>
            <p className="text-gray-500 text-xs leading-relaxed lowercase">
              review and update your details to keep your investor profile complete.
            </p>
          </div>

          {/* personal information */}
          <div className="py-1">
            <SectionLabel>Personal Information</SectionLabel>
            <FieldRow label="full name">
              <input type="text" value={form.name} onChange={(e) => handleChange("name", e.target.value)} className={`${inlineInput} w-1/2`} placeholder="Your Name" />
            </FieldRow>
            <FieldRow label="email address">
              <input type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} className={`${inlineInput} w-2/3`} placeholder="you@email.com" />
            </FieldRow>
            <FieldRow label="phone">
              <div className="flex items-center gap-1">
                <select value={form.phoneCountryCode} onChange={(e) => handleChange("phoneCountryCode", e.target.value)} className="appearance-none bg-transparent border-none focus:ring-0 p-0 text-sm font-medium text-black text-right">
                  <option value="+1">+1</option>
                  <option value="+44">+44</option>
                  <option value="+91">+91</option>
                </select>
                <input type="tel" value={form.phoneNumber} onChange={(e) => handleChange("phoneNumber", e.target.value)} className={`${inlineInput} w-28`} placeholder="98765 43210" />
                <span className="material-symbols-outlined text-gray-300 text-lg">chevron_right</span>
              </div>
            </FieldRow>
            <FieldRow label="age">
              <input type="number" value={form.age} onChange={(e) => handleChange("age", e.target.value)} className={`${inlineInput} w-20`} placeholder="34" />
            </FieldRow>
          </div>

          {/* investment details */}
          <div className="py-8">
            <SectionLabel>Investment Details</SectionLabel>
            <FieldRow label="organisation">
              <input type="text" value={form.organisation} onChange={(e) => handleChange("organisation", e.target.value)} className={`${inlineInput} w-1/2`} placeholder="Company Name" />
            </FieldRow>
            <FieldRow label="account type">
              <div className="flex items-center gap-2">
                <select value={form.accountType} onChange={(e) => handleChange("accountType", e.target.value)} className="appearance-none bg-transparent border-none focus:ring-0 p-0 text-sm font-medium text-black text-right cursor-pointer">
                  <option value="" disabled>Select</option>
                  <option value="individual">Individual</option>
                  <option value="joint">Joint</option>
                  <option value="retirement">Retirement (IRA)</option>
                  <option value="trust">Trust</option>
                </select>
                <span className="material-symbols-outlined text-gray-300 text-lg">expand_more</span>
              </div>
            </FieldRow>
            <FieldRow label="account structure">
              <div className="flex items-center gap-2">
                <select value={form.accountStructure} onChange={(e) => handleChange("accountStructure", e.target.value)} className="appearance-none bg-transparent border-none focus:ring-0 p-0 text-sm font-medium text-black text-right cursor-pointer">
                  <option value="" disabled>Select</option>
                  <option value="discretionary">Discretionary</option>
                  <option value="non-discretionary">Non-Discretionary</option>
                </select>
                <span className="material-symbols-outlined text-gray-300 text-lg">expand_more</span>
              </div>
            </FieldRow>
            <FieldRow label="selected fund">
              <div className="flex items-center gap-2">
                <select value={form.selectedFund} onChange={(e) => handleChange("selectedFund", e.target.value)} className="appearance-none bg-transparent border-none focus:ring-0 p-0 text-sm font-medium text-black text-right cursor-pointer">
                  <option value="" disabled>Choose</option>
                  <option value="hushh_fund_a">Fund A</option>
                  <option value="hushh_fund_b">Fund B</option>
                  <option value="hushh_fund_c">Fund C</option>
                </select>
                <span className="material-symbols-outlined text-gray-300 text-lg">expand_more</span>
              </div>
            </FieldRow>
            <FieldRow label="initial investment">
              <input
                type="text"
                value={form.initialInvestmentAmount ? `$${Number(form.initialInvestmentAmount).toLocaleString()}` : ""}
                onChange={(e) => { const raw = e.target.value.replace(/[^0-9]/g, ""); handleChange("initialInvestmentAmount", raw); }}
                className={`${inlineInput} w-1/2`}
                placeholder="$50,000"
              />
            </FieldRow>
          </div>

          {/* legal & residential */}
          <div className="py-2">
            <SectionLabel>Legal &amp; Residential</SectionLabel>
            <FieldRow label="country">
              <div className="flex items-center gap-2">
                <select value={form.citizenshipCountry} onChange={(e) => handleChange("citizenshipCountry", e.target.value)} className="appearance-none bg-transparent border-none focus:ring-0 p-0 text-sm font-medium text-black text-right cursor-pointer">
                  <option value="" disabled>Select</option>
                  {COUNTRIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
                <span className="material-symbols-outlined text-gray-300 text-lg">expand_more</span>
              </div>
            </FieldRow>
            <FieldRow label="state">
              <div className="flex items-center gap-2">
                <input type="text" value={form.state} onChange={(e) => handleChange("state", e.target.value)} className={`${inlineInput} w-28`} placeholder="State" />
                <span className="material-symbols-outlined text-gray-300 text-lg">expand_more</span>
              </div>
            </FieldRow>
            <FieldRow label="address">
              <input type="text" value={form.addressLine1} onChange={(e) => handleChange("addressLine1", e.target.value)} className={`${inlineInput} w-2/3 truncate`} placeholder="Street address" />
            </FieldRow>
            <FieldRow label="city">
              <input type="text" value={form.city} onChange={(e) => handleChange("city", e.target.value)} className={`${inlineInput} w-28`} placeholder="City" />
            </FieldRow>
            <FieldRow label="zip code">
              <input type="text" value={form.zipCode} onChange={(e) => handleChange("zipCode", e.target.value)} className={`${inlineInput} w-20`} placeholder="560001" />
            </FieldRow>
          </div>
        </section>

        {/* ── Profile link + Wallet ── */}
        <section className="mb-12 border-t border-gray-200 pt-8">
          <div className="flex items-center justify-between py-3 mb-6">
            <span className="text-sm text-gray-500 font-light lowercase">profile link</span>
            <button type="button" onClick={onCopy} className="flex items-center gap-2 text-black cursor-pointer">
              <span className="text-xs font-medium lowercase truncate max-w-[160px]">{profileUrl || "hushhtech.com/investor/..."}</span>
              {hasCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={handleAppleWalletPass} disabled={isApplePassLoading} className="border border-black py-3 px-4 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50">
              <FaApple className="text-lg" />
              <span className="text-xs font-medium lowercase">{isApplePassLoading ? "loading..." : "apple wallet"}</span>
            </button>
            <button type="button" onClick={handleGoogleWalletPass} disabled={isGooglePassLoading} className="border border-black py-3 px-4 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50">
              <SiGooglepay className="text-lg" />
              <span className="text-xs font-medium lowercase">{isGooglePassLoading ? "loading..." : "google wallet"}</span>
            </button>
          </div>
        </section>

        {/* ── CTAs — Save & Go Home (matches step pattern) ── */}
        <section className="pb-12 space-y-3">
          <HushhTechCta variant={HushhTechCtaVariant.BLACK} onClick={handleSave} disabled={loading}>
            {loading ? "saving..." : "save changes"}
          </HushhTechCta>
          <HushhTechCta variant={HushhTechCtaVariant.WHITE} onClick={() => navigate("/")}>
            go to home
          </HushhTechCta>
        </section>
      </main>
    </div>
  );
};

export default HushhUserProfilePage;
