/**
 * Home Page — UI / Presentation
 * Follows the same design language as onboarding steps 1-8,
 * profile page, login/signup — Playfair Display headings,
 * font-medium weight, max-w-md centered layout.
 *
 * Apple iOS Core App Colors:
 * - System Blue (#0066CC) for interactive elements
 * - System Green (#34C759) for success/verified
 * - Athens Gray (#F5F5F7) for card backgrounds
 * - Shark (#1D1D1F) for dark surfaces
 *
 * Typography: Proper English capitalization (sentence/title case).
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

/* ── Consistent heading style (same as onboarding/profile) ── */
const playfair = { fontFamily: "'Playfair Display', serif" };

export default function HomePage() {
  const { session, primaryCTA, onNavigate } = useHomeLogic();

  return (
    <div
      data-page="home"
      className="bg-white antialiased text-gray-900 min-h-screen flex flex-col relative selection:bg-hushh-blue selection:text-white"
    >
      {/* ═══ Header (fixed to top with ticker) ═══ */}
      <HushhTechHeader />

      {/* ═══ Main Content — max-w-md centered like all other pages ═══ */}
      <main className="flex-1 px-6 pb-32 flex flex-col gap-12 pt-4 max-w-md mx-auto w-full">

        {/* ── Hero ── */}
        <section className="py-4">
          <div className="inline-block px-3 py-1 mb-5 border border-hushh-blue/20 rounded-full bg-hushh-blue/5">
            <span className="text-[10px] tracking-widest uppercase font-medium text-hushh-blue flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-hushh-blue rounded-full" />
              AI-Powered Investing
            </span>
          </div>
          <h1
            className="text-[2.75rem] leading-[1.1] font-normal text-black tracking-tight font-serif"
            style={playfair}
          >
            Investing in <br /> the{" "}
            <span className="text-gray-400 italic font-light">Future.</span>
          </h1>
          <p className="text-gray-500 text-sm font-light mt-3 leading-relaxed max-w-sm">
            The world's first AI-powered Berkshire Hathaway. Merging rigorous
            data science with human wisdom.
          </p>
        </section>

        {/* ── Feature Cards (AI-Powered / Human-Led) ── */}
        <section className="grid grid-cols-2 gap-4">
          <div className="bg-ios-gray-bg p-5 rounded-2xl border border-gray-200/60 flex flex-col justify-between min-h-[180px] hover:border-hushh-blue/30 transition-colors">
            <span className="material-symbols-outlined thin-icon text-3xl mb-4 text-hushh-blue">
              neurology
            </span>
            <div>
              <h3
                className="text-lg font-medium mb-1 font-serif"
                style={playfair}
              >
                AI-Powered
              </h3>
              <p className="text-xs text-gray-500 font-light leading-relaxed">
                Institutional analytics processing millions of signals.
              </p>
            </div>
          </div>
          <div className="bg-ios-gray-bg p-5 rounded-2xl border border-gray-200/60 flex flex-col justify-between min-h-[180px] hover:border-hushh-blue/30 transition-colors">
            <span className="material-symbols-outlined thin-icon text-3xl mb-4 text-ios-dark">
              supervised_user_circle
            </span>
            <div>
              <h3
                className="text-lg font-medium mb-1 font-serif"
                style={playfair}
              >
                Human-Led
              </h3>
              <p className="text-xs text-gray-500 font-light leading-relaxed">
                Seasoned oversight ensuring long-term strategic vision.
              </p>
            </div>
          </div>
        </section>

        {/* ── Primary CTAs ── */}
        <section className="flex flex-col gap-3">
          <HushhTechCta
            onClick={primaryCTA.action}
            disabled={primaryCTA.loading}
            variant={HushhTechCtaVariant.BLACK}
          >
            {primaryCTA.text}
            <span className="material-symbols-outlined thin-icon text-lg">arrow_forward</span>
          </HushhTechCta>
          <HushhTechCta
            onClick={() => onNavigate("/discover-fund-a")}
            variant={HushhTechCtaVariant.WHITE}
          >
            Discover Fund A
          </HushhTechCta>
        </section>

        {/* ── Trust strip ── */}
        <section className="border-t border-b border-gray-100 py-5 flex justify-center items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined thin-icon text-lg text-ios-green">
              verified_user
            </span>
            <span className="text-[10px] font-medium tracking-widest uppercase text-gray-400">
              SEC Registered
            </span>
          </div>
          <div className="w-1 h-1 bg-gray-300 rounded-full" />
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined thin-icon text-lg text-hushh-blue">
              lock
            </span>
            <span className="text-[10px] font-medium tracking-widest uppercase text-gray-400">
              Bank Level Security
            </span>
          </div>
        </section>

        {/* ── The Hushh Advantage ── */}
        <section>
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-2 font-medium">Why Hushh</p>
          <h2
            className="text-2xl font-medium mb-8 tracking-tight font-serif"
            style={playfair}
          >
            The Hushh Advantage
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10">
            {[
              { icon: "analytics", color: "text-hushh-blue", bg: "bg-hushh-blue/10", title: "Data Driven", desc: "Decisions based on facts, not emotions." },
              { icon: "savings", color: "text-ios-green", bg: "bg-ios-green/10", title: "Low Fees", desc: "More of your returns stay in your pocket." },
              { icon: "workspace_premium", color: "text-ios-yellow", bg: "bg-ios-yellow/10", title: "Expert Vetted", desc: "Top-tier financial minds at work." },
              { icon: "autorenew", color: "text-hushh-blue", bg: "bg-hushh-blue/10", title: "Automated", desc: "Set it and forget it peace of mind." },
            ].map((item) => (
              <div key={item.icon} className="flex flex-col items-center text-center gap-3">
                <div className={`w-12 h-12 rounded-full border border-gray-200/60 flex items-center justify-center ${item.bg}`}>
                  <span className={`material-symbols-outlined thin-icon ${item.color}`}>{item.icon}</span>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1">{item.title}</h4>
                  <p className="text-[11px] text-gray-500 font-light max-w-[120px] mx-auto">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Fund A Card ── */}
        <section className="relative mt-4">
          <div className="bg-ios-dark text-white p-8 rounded-2xl relative overflow-hidden shadow-2xl">
            {/* Glow effects — Apple blue accent */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-hushh-blue/15 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-hushh-blue/5 to-transparent" />

            <div className="relative z-10 flex flex-col gap-6">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-medium tracking-widest uppercase text-white/50 mb-1 block">
                    Flagship Product
                  </span>
                  <h2
                    className="text-3xl font-medium font-serif"
                    style={playfair}
                  >
                    Fund A
                  </h2>
                </div>
                <span className="bg-hushh-blue/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border border-hushh-blue/30 text-hushh-blue">
                  High Growth
                </span>
              </div>

              <div className="space-y-4 my-2">
                <div>
                  <span className="text-xs text-white/50 block mb-1">Target Net IRR</span>
                  <span className="text-[48px] font-serif font-light tracking-tighter text-ios-green leading-none" style={playfair}>
                    18-23%
                  </span>
                </div>
                <div>
                  <span className="text-xs text-white/50 block mb-1">Inception Year</span>
                  <span className="font-serif text-[36px] leading-none" style={playfair}>2024</span>
                </div>
              </div>

              <div
                className="pt-4 border-t border-white/10 flex items-center justify-between group cursor-pointer"
                onClick={() => onNavigate("/discover-fund-a")}
                role="button"
                tabIndex={0}
                aria-label="View performance details"
                onKeyDown={(e) => { if (e.key === 'Enter') onNavigate("/discover-fund-a"); }}
              >
                <span className="text-xs font-medium tracking-wide uppercase text-hushh-blue">
                  Performance Details
                </span>
                <span className="material-symbols-outlined thin-icon text-sm text-hushh-blue group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Feature Grid ── */}
        <section>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: "rocket_launch", color: "text-hushh-blue", title: "High Growth", desc: "Accelerated returns strategy" },
              { icon: "pie_chart", color: "text-ios-yellow", title: "Diversified", desc: "Multi-sector allocation" },
              { icon: "trending_up", color: "text-ios-green", title: "Liquid", desc: "Quarterly redemption windows" },
              { icon: "security", color: "text-hushh-blue", title: "Secure", desc: "Regulated custodian assets" },
            ].map((item) => (
              <div key={item.icon} className="bg-ios-gray-bg border border-gray-200/60 p-4 rounded-2xl hover:border-hushh-blue/30 transition-colors">
                <span className={`material-symbols-outlined thin-icon ${item.color} mb-2`}>
                  {item.icon}
                </span>
                <h5 className="font-medium text-sm">{item.title}</h5>
                <p className="text-[10px] text-gray-500 font-light">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Bottom CTAs ── */}
        <section className="flex flex-col gap-3 py-6">
          <HushhTechCta
            onClick={() => onNavigate("/discover-fund-a")}
            variant={HushhTechCtaVariant.BLACK}
          >
            Explore Our Approach
            <span className="material-symbols-outlined thin-icon text-lg">arrow_right_alt</span>
          </HushhTechCta>
          <HushhTechCta
            onClick={() => onNavigate("/community")}
            variant={HushhTechCtaVariant.WHITE}
          >
            Learn More
          </HushhTechCta>
        </section>

        {/* ── Disclaimer ── */}
        <footer className="mb-8">
          <p
            className="text-[10px] text-gray-400 text-center leading-relaxed italic max-w-xs mx-auto font-serif"
            style={playfair}
          >
            Investing involves risk, including possible loss of principal. Past
            performance does not guarantee future results. Hushh Technologies is
            an SEC registered investment advisor.
          </p>
        </footer>
      </main>

      {/* ═══ Footer Nav ═══ */}
      <HushhTechFooter activeTab={HushhFooterTab.HOME} />
    </div>
  );
}
