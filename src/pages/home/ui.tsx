/**
 * Home Page — UI / Presentation
 * Ditto match of the provided HTML design.
 * Uses reusable components: HushhTechHeader, HushhTechFooter, HushhTechCta.
 * Logic stays in logic.ts — zero changes there.
 */
import { useHomeLogic } from "./logic";
import HushhTechHeader from "../../components/hushh-tech-header/HushhTechHeader";
import HushhTechFooter, {
  HushhFooterTab,
} from "../../components/hushh-tech-footer/HushhTechFooter";
import HushhTechCta, {
  HushhTechCtaVariant,
} from "../../components/hushh-tech-cta/HushhTechCta";

export default function HomePage() {
  const { session, primaryCTA, onNavigate } = useHomeLogic();

  return (
    <div className="bg-white font-sans antialiased text-black min-h-screen flex flex-col relative">
      {/* ═══ Header ═══ */}
      <HushhTechHeader
        fixed={false}
        className="sticky top-0 z-50 border-b border-transparent"
      />

      {/* ═══ Main Content ═══ */}
      <main className="flex-1 px-6 pb-40">
        {/* Hero Section */}
        <div className="pt-10 pb-16">
          <h1
            className="font-serif text-[3.25rem] leading-[1.1] text-black lowercase mb-6 tracking-tight"
          >
            investing in
            <br />
            the future
          </h1>
          <p className="text-[#666666] text-sm font-normal lowercase tracking-wide max-w-xs leading-relaxed">
            the ai-powered berkshire hathaway designed for the modern era.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-4 mb-20">
          <HushhTechCta
            variant={HushhTechCtaVariant.BLACK}
            onClick={primaryCTA.action}
            disabled={primaryCTA.loading}
            className="h-14 text-sm tracking-wide uppercase"
          >
            {primaryCTA.loading ? "loading..." : "view your profile"}
          </HushhTechCta>

          <HushhTechCta
            variant={HushhTechCtaVariant.WHITE}
            onClick={() => onNavigate("/discover-fund-a")}
            className="h-14 text-sm tracking-wide uppercase"
          >
            discover fund a
          </HushhTechCta>
        </div>

        {/* Feature Rows */}
        <div className="mb-20 space-y-8">
          {/* AI-Powered */}
          <div
            className="flex items-center justify-between group cursor-pointer"
            onClick={() => onNavigate("/ai-powered-berkshire")}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-black font-light">
                  smart_toy
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-serif text-xl lowercase text-black">
                  ai-powered
                </span>
                <span className="text-xs text-[#666666] font-light mt-1">
                  algorithmic precision
                </span>
              </div>
            </div>
            <span className="material-symbols-outlined text-[#9CA3AF] font-light group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-[#E5E7EB]/50" />

          {/* Human-Led */}
          <div
            className="flex items-center justify-between group cursor-pointer"
            onClick={() => onNavigate("/discover-fund-a")}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-black font-light">
                  groups
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-serif text-xl lowercase text-black">
                  human-led
                </span>
                <span className="text-xs text-[#666666] font-light mt-1">
                  expert oversight
                </span>
              </div>
            </div>
            <span className="material-symbols-outlined text-[#9CA3AF] font-light group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="flex items-center justify-center gap-8 mb-20">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[1.1rem] text-[#666666]">
              verified_user
            </span>
            <span className="text-[10px] text-[#666666] lowercase tracking-widest">
              sec registered
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[1.1rem] text-[#666666]">
              lock
            </span>
            <span className="text-[10px] text-[#666666] lowercase tracking-widest">
              bank level security
            </span>
          </div>
        </div>

        {/* The Hushh Advantage */}
        <div className="mb-20">
          <h3
            className="font-serif text-2xl text-black lowercase mb-10 text-center"
          >
            the hushh advantage
          </h3>
          <div className="flex justify-between px-2">
            {[
              { icon: "analytics", label: "data\ndriven" },
              { icon: "percent", label: "low\nfees" },
              { icon: "workspace_premium", label: "expert\nvetted" },
              { icon: "autorenew", label: "fully\nautomated" },
            ].map((item) => (
              <div
                key={item.icon}
                className="flex flex-col items-center gap-3"
              >
                <div className="w-14 h-14 border border-[#E5E7EB] rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-black font-light text-2xl">
                    {item.icon}
                  </span>
                </div>
                <span className="text-[10px] text-[#666666] tracking-wide text-center w-16 leading-tight whitespace-pre-line">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Fund A Section */}
        <div className="mb-12">
          <div className="border-t border-black mb-8" />

          <div className="flex items-start justify-between mb-8">
            <div>
              <h2
                className="font-serif text-3xl text-black lowercase mb-2"
              >
                fund a
              </h2>
              <span className="inline-block px-2 py-1 border border-black text-[10px] uppercase tracking-wider font-medium">
                high growth
              </span>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-[#666666] mb-1">
                target net irr
              </p>
              <p className="font-serif text-3xl">
                18-23%
              </p>
            </div>
          </div>

          <div className="space-y-0">
            {[
              "diversified portfolio",
              "secure assets",
              "quarterly liquidity",
            ].map((item, i, arr) => (
              <div
                key={item}
                className={`flex items-center justify-between py-4 group cursor-pointer ${
                  i < arr.length - 1 ? "border-b border-[#E5E7EB]" : "border-b border-[#E5E7EB]"
                }`}
                onClick={() => onNavigate("/discover-fund-a")}
              >
                <span className="text-sm text-[#666666] font-light">
                  {item}
                </span>
                <span className="material-symbols-outlined text-[#9CA3AF] text-lg group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mb-8">
          <p className="text-[10px] text-[#9CA3AF] leading-relaxed text-center px-4">
            Investing involves risk, including loss of principal. Past
            performance does not guarantee future results. Please read the
            offering circular before investing.
          </p>
        </div>
      </main>

      {/* ═══ Footer ═══ */}
      <HushhTechFooter
        activeTab={HushhFooterTab.HOME}
        onTabChange={(tab) => {
          if (tab === HushhFooterTab.HOME) onNavigate("/");
          if (tab === HushhFooterTab.FUND_A) onNavigate("/discover-fund-a");
          if (tab === HushhFooterTab.COMMUNITY) onNavigate("/");
          if (tab === HushhFooterTab.PROFILE)
            onNavigate(session ? "/hushh-user-profile" : "/login");
        }}
        onLogoClick={() => onNavigate("/")}
      />
    </div>
  );
}
