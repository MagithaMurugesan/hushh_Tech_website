/**
 * Fund A — Discover Page (Revamped 3.0)
 * Pixel-perfect alignment with hushh-user-profile + step 1-8 design.
 * Uses same wrapper, header, CTA, FieldRow, SectionLabel patterns.
 * All content from logic.ts — zero data here.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { useDiscoverFundALogic } from "./logic";
import HushhTechBackHeader from "../../components/hushh-tech-back-header/HushhTechBackHeader";
import HushhTechCta, {
  HushhTechCtaVariant,
} from "../../components/hushh-tech-cta/HushhTechCta";
import HushhTechFooter, {
  HushhFooterTab,
} from "../../components/hushh-tech-footer/HushhTechFooter";

/* ── settings-style row (same as profile page) ── */
const FieldRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="group flex items-center justify-between border-b border-gray-200 py-4 hover:bg-gray-50/50 transition-colors -mx-6 px-6">
    <span className="text-sm text-gray-500 font-light lowercase">{label}</span>
    <div className="flex items-center gap-2 text-right">{children}</div>
  </div>
);

/* ── section label (same as profile page) ── */
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-medium mt-10 mb-2">
    {children}
  </p>
);

/* ── card with icon (same as step-2 cards) ── */
const FeatureCard = ({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) => (
  <div className="flex items-start gap-4 border border-gray-200 rounded-2xl p-5 hover:border-gray-300 hover:bg-gray-50/50 transition-all">
    <div className="w-11 h-11 rounded-full border border-gray-200 flex items-center justify-center shrink-0 bg-white">
      <span className="material-symbols-outlined text-gray-700 !text-[1.15rem]">
        {icon}
      </span>
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="text-[13px] font-semibold text-black lowercase leading-snug mb-1">
        {title}
      </h3>
      <p className="text-[11px] text-gray-400 font-light leading-relaxed lowercase">
        {description}
      </p>
    </div>
  </div>
);

/* ── icon map for cards ── */
const PHILOSOPHY_ICONS: Record<string, string> = {
  "Options Intelligence": "psychology",
  "AI-Enhanced Research": "neurology",
  "Risk-First Architecture": "shield",
  "Concentrated Conviction": "target",
};

const EDGE_ICONS: Record<string, string> = {
  "Volatility Harvesting": "trending_up",
  "Asymmetric Returns": "rocket_launch",
  "Income Generation": "payments",
  "Downside Protection": "security",
};

const ASSET_ICONS: Record<string, string> = {
  "U.S. Large-Cap Equities": "account_balance",
  "Strategic Options Overlay": "tune",
  "Cash & Equivalents": "savings",
};

const RISK_ICONS: Record<string, string> = {
  "Position Limits": "pie_chart",
  "Hedging Framework": "shield",
  "Drawdown Protocols": "trending_down",
  "Liquidity Management": "water_drop",
};

const FundA = () => {
  const navigate = useNavigate();
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
      {/* ═══ Header ═══ */}
      <HushhTechBackHeader
        onBackClick={() => navigate("/")}
        rightType="hamburger"
      />

      {/* ═══ Main ═══ */}
      <main className="px-6 flex-grow max-w-md mx-auto w-full pb-32">
        {/* ── Hero ── */}
        <section className="pt-6 pb-8">
          {/* pill badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-black rounded-full" />
            <span className="text-[10px] tracking-[0.15em] uppercase font-medium text-gray-500">
              flagship fund
            </span>
          </div>

          <h1
            className="text-[28px] leading-[1.15] font-medium text-black tracking-tight lowercase mb-1"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {heroTitle}
          </h1>
          <h2
            className="text-[32px] leading-[1.1] font-medium text-black tracking-tight lowercase"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {heroSubtitle}
          </h2>

          <p className="text-[13px] text-gray-400 font-light mt-4 leading-relaxed lowercase max-w-xs">
            {heroDescription}
          </p>
        </section>

        {/* ── Target IRR (premium black card — like step-1 share class) ── */}
        <section className="mb-8">
          <div className="bg-black rounded-2xl p-6 text-center relative overflow-hidden">
            {/* subtle glow */}
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
            <div className="relative z-10">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-3 font-medium">
                {targetIRRLabel}
              </p>
              <p
                className="text-[48px] leading-none font-medium text-white mb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {targetIRRValue}
              </p>
              <p className="text-[13px] text-gray-400 lowercase mb-4">
                {targetIRRPeriod}
              </p>
              <p className="text-[9px] text-gray-600 italic max-w-[220px] mx-auto leading-relaxed">
                {targetIRRDisclaimer}
              </p>
            </div>
          </div>
        </section>

        {/* ── Investment Philosophy ── */}
        <SectionLabel>{philosophySectionTitle}</SectionLabel>
        <div className="space-y-3 mb-2">
          {philosophyCards.map((card) => (
            <FeatureCard
              key={card.title}
              icon={PHILOSOPHY_ICONS[card.title] || "lightbulb"}
              title={card.title}
              description={card.description}
            />
          ))}
        </div>

        {/* ── Sell the Wall Framework ── */}
        <SectionLabel>
          our edge —{" "}
          <a
            href={sellTheWallHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-black underline decoration-gray-300 hover:decoration-black transition-colors"
          >
            sell the wall
          </a>{" "}
          framework
        </SectionLabel>
        <div className="space-y-3 mb-2">
          {edgeCards.map((card) => (
            <FeatureCard
              key={card.title}
              icon={EDGE_ICONS[card.title] || "auto_awesome"}
              title={card.title}
              description={card.description}
            />
          ))}
        </div>

        {/* ── Asset Focus ── */}
        <SectionLabel>{assetFocusSectionTitle}</SectionLabel>
        <p className="text-[11px] text-gray-400 font-light leading-relaxed lowercase mb-4">
          {assetFocusDescription}
        </p>
        <div className="space-y-3 mb-2">
          {assetPillars.map((pillar) => (
            <FeatureCard
              key={pillar.title}
              icon={ASSET_ICONS[pillar.title] || "category"}
              title={pillar.title}
              description={pillar.description}
            />
          ))}
        </div>

        {/* ── Targeted Alpha Stack (FieldRow style) ── */}
        <SectionLabel>{alphaStackSectionTitle}</SectionLabel>
        <p className="text-[10px] text-gray-400 italic lowercase mb-1">
          {alphaStackSubtitle}
        </p>
        <div className="mb-2">
          {alphaStackRows.map((row) =>
            row.isTotalRow ? (
              <div
                key={row.label}
                className="flex items-center justify-between bg-black text-white rounded-2xl px-6 py-4 mt-3"
              >
                <span className="text-sm font-semibold lowercase">
                  {row.label}
                </span>
                <span
                  className="text-xl font-medium"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {row.value}
                </span>
              </div>
            ) : (
              <FieldRow key={row.label} label={row.label}>
                <span className="text-sm font-semibold text-black">
                  {row.value}
                </span>
              </FieldRow>
            )
          )}
        </div>

        {/* ── Risk Management ── */}
        <SectionLabel>{riskSectionTitle}</SectionLabel>
        <div className="space-y-3 mb-2">
          {riskCards.map((card) => (
            <FeatureCard
              key={card.title}
              icon={RISK_ICONS[card.title] || "security"}
              title={card.title}
              description={card.description}
            />
          ))}
        </div>

        {/* ── Key Terms (FieldRow style) ── */}
        <SectionLabel>{keyTermsSectionTitle}</SectionLabel>
        <p className="text-[10px] text-gray-400 italic lowercase mb-1">
          {keyTermsSubtitle}
        </p>

        {/* First terms as FieldRows */}
        <div className="mb-4">
          {keyTerms.slice(0, 2).map((term) => (
            <FieldRow key={term.title} label={term.title}>
              <span className="text-[12px] font-medium text-black max-w-[180px] text-right lowercase leading-snug">
                {term.content}
              </span>
            </FieldRow>
          ))}
        </div>

        {/* Share Classes (compact cards) */}
        <SectionLabel>share classes</SectionLabel>
        <div className="space-y-3 mb-4">
          {shareClasses.map((sc) => (
            <div
              key={sc.shareClass}
              className="border border-gray-200 rounded-2xl p-5 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center">
                    <span className="material-symbols-outlined text-white !text-[0.9rem]">
                      account_balance_wallet
                    </span>
                  </div>
                  <span className="text-[13px] font-semibold text-black lowercase">
                    {sc.shareClass}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  min {sc.minInvestment}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-0.5">
                    mgmt
                  </p>
                  <p className="text-[12px] font-semibold text-black">
                    {sc.managementFee}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-0.5">
                    perf
                  </p>
                  <p className="text-[12px] font-semibold text-black">
                    {sc.performanceFee}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-widest text-gray-400 mb-0.5">
                    hurdle
                  </p>
                  <p className="text-[12px] font-semibold text-black">
                    {sc.hurdleRate}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Remaining terms */}
        <div className="mb-6">
          {keyTerms.slice(2).map((term) => (
            <FieldRow key={term.title} label={term.title}>
              <span className="text-[12px] font-medium text-black max-w-[180px] text-right lowercase leading-snug">
                {term.content}
              </span>
            </FieldRow>
          ))}
        </div>

        {/* ── Join / CTA ── */}
        <section className="border-t border-gray-200 pt-8 mb-8">
          <h2
            className="text-[22px] font-medium text-black tracking-tight lowercase mb-2"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {joinSectionTitle}
          </h2>
          <p className="text-[13px] text-gray-400 font-light leading-relaxed lowercase mb-8 max-w-xs">
            {joinSectionDescription}
          </p>

          <div className="space-y-3">
            <HushhTechCta
              variant={HushhTechCtaVariant.BLACK}
              onClick={handleCompleteProfile}
            >
              {joinButtonLabel}
              <span className="material-symbols-outlined !text-[1.1rem]">
                arrow_forward
              </span>
            </HushhTechCta>
            <HushhTechCta
              variant={HushhTechCtaVariant.WHITE}
              onClick={() => navigate("/")}
            >
              back to home
            </HushhTechCta>
          </div>
        </section>

        {/* ── Disclaimer ── */}
        <p className="text-[9px] text-gray-400 text-center leading-relaxed italic max-w-xs mx-auto mb-4">
          investing involves risk, including possible loss of principal. past
          performance does not guarantee future results. hushh technologies is an
          sec registered investment advisor.
        </p>
      </main>

      {/* ═══ Footer Nav ═══ */}
      <HushhTechFooter
        activeTab={HushhFooterTab.FUND_A}
        onTabChange={(tab) => {
          if (tab === HushhFooterTab.HOME) navigate("/");
          if (tab === HushhFooterTab.FUND_A) navigate("/discover-fund-a");
          if (tab === HushhFooterTab.COMMUNITY) navigate("/community");
          if (tab === HushhFooterTab.PROFILE) navigate("/profile");
        }}
      />
    </div>
  );
};

export default FundA;
