/**
 * Fund A — Discover Page (Revamped 2.0)
 * Matches onboarding step 1-8 design language.
 * Uses HushhTechBackHeader + HushhTechCta reusable components.
 * All content pulled from logic.ts — zero data here.
 */
import React from "react";
import { useDiscoverFundALogic } from "./logic";
import HushhTechBackHeader from "../../components/hushh-tech-back-header/HushhTechBackHeader";
import HushhTechCta, {
  HushhTechCtaVariant,
} from "../../components/hushh-tech-cta/HushhTechCta";

/* ── tiny reusable card ── */
const InfoCard = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 transition-all hover:shadow-sm">
    <h3 className="text-sm font-semibold text-black lowercase tracking-wide mb-2">
      {title}
    </h3>
    <p className="text-xs text-gray-500 font-light leading-relaxed lowercase">
      {description}
    </p>
  </div>
);

/* ── section label ── */
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-4 mt-8 font-medium">
    {children}
  </p>
);

const FundA = () => {
  const {
    heroTitle,
    heroSubtitle,
    heroDescription,
    targetIRRLabel,
    targetIRRValue,
    targetIRRPeriod,
    targetIRRDisclaimer,
    philosophySectionTitle,
    philosophyCards,
    edgeSectionTitle,
    sellTheWallHref,
    edgeCards,
    assetFocusSectionTitle,
    assetFocusDescription,
    assetPillars,
    alphaStackSectionTitle,
    alphaStackSubtitle,
    alphaStackRows,
    riskSectionTitle,
    riskCards,
    keyTermsSectionTitle,
    keyTermsSubtitle,
    keyTerms,
    shareClasses,
    joinSectionTitle,
    joinSectionDescription,
    joinButtonLabel,
    handleCompleteProfile,
  } = useDiscoverFundALogic();

  return (
    <div className="bg-white text-gray-900 min-h-screen antialiased flex flex-col selection:bg-black selection:text-white">
      {/* ═══ Header — back + hamburger ═══ */}
      <HushhTechBackHeader
        onBackClick={() => window.history.back()}
        rightType="hamburger"
      />

      <main className="px-6 flex-grow max-w-md mx-auto w-full pb-24">
        {/* ── Hero ── */}
        <section className="py-8">
          <div className="inline-block px-3 py-1 mb-4 border border-gray-200 rounded-full">
            <span className="text-[10px] tracking-widest uppercase font-medium text-gray-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-black rounded-full" />
              investment opportunity
            </span>
          </div>

          <h1
            className="text-[2rem] leading-[1.15] font-medium text-black tracking-tight lowercase"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {heroTitle}
          </h1>

          <h2
            className="text-[2.25rem] leading-[1.1] font-medium tracking-tight lowercase mt-1"
            style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a1a" }}
          >
            {heroSubtitle}
          </h2>

          <p className="text-gray-500 text-sm font-light mt-4 leading-relaxed lowercase">
            {heroDescription}
          </p>
        </section>

        {/* ── Target IRR Card ── */}
        <section className="mb-10">
          <div className="bg-black rounded-2xl p-6 text-white text-center">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-2 font-medium">
              {targetIRRLabel}
            </p>
            <p
              className="text-5xl font-medium mb-1"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {targetIRRValue}
            </p>
            <p className="text-sm text-gray-300 lowercase mb-3">
              {targetIRRPeriod}
            </p>
            <p className="text-[10px] text-gray-500 italic max-w-[240px] mx-auto">
              {targetIRRDisclaimer}
            </p>
          </div>
        </section>

        {/* ── Investment Philosophy ── */}
        <section className="mb-10">
          <SectionLabel>{philosophySectionTitle}</SectionLabel>
          <div className="space-y-3">
            {philosophyCards.map((card) => (
              <InfoCard
                key={card.title}
                title={card.title}
                description={card.description}
              />
            ))}
          </div>
        </section>

        {/* ── Sell the Wall Framework ── */}
        <section className="mb-10">
          <SectionLabel>
            {edgeSectionTitle}{" "}
            <a
              href={sellTheWallHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-black underline hover:no-underline"
            >
              "sell the wall"
            </a>{" "}
            options framework
          </SectionLabel>
          <div className="space-y-3">
            {edgeCards.map((card) => (
              <InfoCard
                key={card.title}
                title={card.title}
                description={card.description}
              />
            ))}
          </div>
        </section>

        {/* ── Asset Focus ── */}
        <section className="mb-10">
          <SectionLabel>{assetFocusSectionTitle}</SectionLabel>
          <p className="text-xs text-gray-500 font-light leading-relaxed lowercase mb-4">
            {assetFocusDescription}
          </p>
          <div className="space-y-3">
            {assetPillars.map((pillar) => (
              <InfoCard
                key={pillar.title}
                title={pillar.title}
                description={pillar.description}
              />
            ))}
          </div>
        </section>

        {/* ── Targeted Alpha Stack ── */}
        <section className="mb-10">
          <SectionLabel>{alphaStackSectionTitle}</SectionLabel>
          <p className="text-[10px] text-gray-400 italic lowercase mb-4">
            {alphaStackSubtitle}
          </p>

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {alphaStackRows.map((row, index) => (
              <div
                key={row.label}
                className={`flex justify-between items-center px-5 py-4 ${
                  index < alphaStackRows.length - 1
                    ? "border-b border-gray-100"
                    : ""
                } ${row.isTotalRow ? "bg-black text-white" : ""}`}
              >
                <span
                  className={`text-sm font-medium lowercase ${
                    row.isTotalRow ? "text-white" : "text-gray-900"
                  }`}
                >
                  {row.label}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    row.isTotalRow ? "text-white" : "text-black"
                  }`}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Risk Management ── */}
        <section className="mb-10">
          <SectionLabel>{riskSectionTitle}</SectionLabel>
          <div className="space-y-3">
            {riskCards.map((card) => (
              <InfoCard
                key={card.title}
                title={card.title}
                description={card.description}
              />
            ))}
          </div>
        </section>

        {/* ── Key Terms ── */}
        <section className="mb-10">
          <SectionLabel>{keyTermsSectionTitle}</SectionLabel>
          <p className="text-[10px] text-gray-400 italic lowercase mb-4">
            {keyTermsSubtitle}
          </p>

          <div className="space-y-4">
            {keyTerms.slice(0, 2).map((term) => (
              <div key={term.title} className="py-2">
                <h3 className="text-sm font-semibold text-black lowercase mb-1">
                  {term.title}
                </h3>
                <p className="text-xs text-gray-500 font-light leading-relaxed lowercase">
                  {term.content}
                </p>
              </div>
            ))}
          </div>

          {/* Share Classes Table */}
          <div className="mt-6 border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-black text-white px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest font-medium text-gray-400">
                share classes
              </p>
            </div>
            {shareClasses.map((sc, index) => (
              <div
                key={sc.shareClass}
                className={`px-4 py-3 ${
                  index < shareClasses.length - 1
                    ? "border-b border-gray-100"
                    : ""
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-semibold text-black lowercase">
                    {sc.shareClass}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    min {sc.minInvestment}
                  </span>
                </div>
                <div className="flex gap-4 text-[10px] text-gray-400">
                  <span>mgmt: {sc.managementFee}</span>
                  <span>perf: {sc.performanceFee}</span>
                  <span>hurdle: {sc.hurdleRate}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Remaining terms */}
          <div className="space-y-4 mt-6">
            {keyTerms.slice(2).map((term) => (
              <div key={term.title} className="py-2">
                <h3 className="text-sm font-semibold text-black lowercase mb-1">
                  {term.title}
                </h3>
                <p className="text-xs text-gray-500 font-light leading-relaxed lowercase">
                  {term.content}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Join / CTA ── */}
        <section className="mb-12 border-t border-gray-200 pt-8">
          <h2
            className="text-2xl font-medium text-black tracking-tight lowercase mb-3"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {joinSectionTitle}
          </h2>
          <p className="text-sm text-gray-500 font-light leading-relaxed lowercase mb-8">
            {joinSectionDescription}
          </p>

          <div className="space-y-3">
            <HushhTechCta
              variant={HushhTechCtaVariant.BLACK}
              onClick={handleCompleteProfile}
            >
              {joinButtonLabel}
              <span className="material-symbols-outlined text-lg">
                arrow_forward
              </span>
            </HushhTechCta>
            <HushhTechCta
              variant={HushhTechCtaVariant.WHITE}
              onClick={() => window.history.back()}
            >
              go back
            </HushhTechCta>
          </div>
        </section>
      </main>
    </div>
  );
};

export default FundA;
