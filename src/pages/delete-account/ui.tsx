/**
 * Delete Account Page — Aligned with onboarding step 1-8 design language.
 * Uses Playfair Display headings, lowercase, HushhTechCta, same spacing.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { useDeleteAccountLogic } from "./logic";
import HushhTechBackHeader from "../../components/hushh-tech-back-header/HushhTechBackHeader";
import HushhTechCta, {
  HushhTechCtaVariant,
} from "../../components/hushh-tech-cta/HushhTechCta";
import DeleteAccountModal from "../../components/DeleteAccountModal";
import { Helmet } from "react-helmet";

const DeleteAccountPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    isOpen,
    onOpen,
    onClose,
    isLoggedIn,
    isLoading,
    userEmail,
    handleAccountDeleted,
    handleLoginRedirect,
  } = useDeleteAccountLogic();

  return (
    <>
      <Helmet>
        <title>Delete Account - Hushh</title>
        <meta
          name="description"
          content="Delete your Hushh account and remove all your personal data from our systems."
        />
      </Helmet>

      <div className="bg-white text-gray-900 min-h-screen antialiased flex flex-col selection:bg-black selection:text-white">
        {/* ═══ Header ═══ */}
        <HushhTechBackHeader
          onBackClick={() => navigate(-1)}
          rightType="hamburger"
        />

        <main className="px-6 flex-grow max-w-md mx-auto w-full pb-16">
          {/* ── Title Section ── */}
          <section className="py-8">
            <h1
              className="text-[2.25rem] leading-[1.1] font-medium text-black tracking-tight lowercase"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              delete your <br />
              <span className="text-gray-400">account</span>
            </h1>
            <p className="text-gray-500 text-sm font-light mt-3 lowercase leading-relaxed">
              permanently remove your account and all associated data
            </p>
          </section>

          {/* ── Action Card ── */}
          <section className="mb-10 border border-red-200 bg-red-50/30 rounded-none p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
                <span className="ml-3 text-sm text-gray-500 lowercase">
                  checking session...
                </span>
              </div>
            ) : isLoggedIn ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <span
                      className="material-symbols-outlined text-red-600 text-lg"
                      style={{ fontVariationSettings: "'wght' 400" }}
                    >
                      warning
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 lowercase">
                      ready to delete?
                    </p>
                    {userEmail && (
                      <p className="text-xs text-gray-500 lowercase">
                        logged in as {userEmail}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed lowercase">
                  this action is permanent and cannot be undone. all your data,
                  investment info, and services will be removed.
                </p>
                <button
                  type="button"
                  onClick={onOpen}
                  className="w-full h-[52px] bg-red-600 text-white text-sm font-medium lowercase flex items-center justify-center gap-2 active:scale-[0.98] transition-transform hover:bg-red-700"
                >
                  <span className="material-symbols-outlined text-lg">
                    delete_forever
                  </span>
                  delete my account
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <span
                      className="material-symbols-outlined text-gray-600 text-lg"
                      style={{ fontVariationSettings: "'wght' 400" }}
                    >
                      lock
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 lowercase">
                      login required
                    </p>
                    <p className="text-xs text-gray-500 lowercase">
                      please login to delete your account
                    </p>
                  </div>
                </div>
                <HushhTechCta
                  variant={HushhTechCtaVariant.BLACK}
                  onClick={handleLoginRedirect}
                >
                  login to continue
                </HushhTechCta>
              </div>
            )}
          </section>

          {/* ── What Gets Deleted ── */}
          <section className="mb-10">
            <h2
              className="text-xl font-medium text-black tracking-tight lowercase mb-5"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              data that will be deleted
            </h2>
            <div className="space-y-0">
              {[
                { icon: "person", label: "account credentials & profile" },
                { icon: "analytics", label: "investor profile & preferences" },
                { icon: "checklist", label: "onboarding data & responses" },
                { icon: "verified_user", label: "kyc verification data" },
                { icon: "chat", label: "chat history with ai assistant" },
                { icon: "folder", label: "uploaded documents & files" },
                { icon: "shield", label: "privacy settings & data vault" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 py-3.5 border-b border-gray-100"
                >
                  <span
                    className="material-symbols-outlined text-gray-400 text-lg"
                    style={{ fontVariationSettings: "'wght' 300" }}
                  >
                    {item.icon}
                  </span>
                  <span className="text-sm text-gray-700 lowercase font-light">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Retention Policy ── */}
          <section className="mb-10">
            <h2
              className="text-xl font-medium text-black tracking-tight lowercase mb-5"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              retention policy
            </h2>
            <div className="space-y-4">
              {[
                {
                  title: "immediate",
                  desc: "all personal data is deleted upon confirmation",
                },
                {
                  title: "30 days",
                  desc: "encrypted backups are purged within 30 days",
                },
                {
                  title: "7 years",
                  desc: "transaction records retained per financial regulations",
                },
                {
                  title: "anonymized",
                  desc: "aggregated analytics that cannot identify you may be kept",
                },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-4">
                  <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold w-20 shrink-0 pt-0.5">
                    {item.title}
                  </span>
                  <p className="text-sm text-gray-600 lowercase font-light leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Need Help ── */}
          <section className="mb-10 border-t border-gray-100 pt-8">
            <h2
              className="text-xl font-medium text-black tracking-tight lowercase mb-4"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              need help?
            </h2>
            <p className="text-sm text-gray-500 lowercase font-light leading-relaxed mb-4">
              if you're unable to access your account, contact us directly:
            </p>
            <div className="space-y-2">
              <a
                href="mailto:support@hushh.ai"
                className="flex items-center gap-3 py-3 border-b border-gray-100 group"
              >
                <span className="material-symbols-outlined text-gray-400 text-lg">
                  mail
                </span>
                <span className="text-sm text-gray-700 lowercase font-light group-hover:text-black transition-colors">
                  support@hushh.ai
                </span>
              </a>
              <a
                href="mailto:privacy@hushh.ai"
                className="flex items-center gap-3 py-3 border-b border-gray-100 group"
              >
                <span className="material-symbols-outlined text-gray-400 text-lg">
                  shield
                </span>
                <span className="text-sm text-gray-700 lowercase font-light group-hover:text-black transition-colors">
                  privacy@hushh.ai
                </span>
              </a>
            </div>
          </section>

          {/* ── CTAs ── */}
          <section className="pb-12 space-y-3">
            <HushhTechCta
              variant={HushhTechCtaVariant.WHITE}
              onClick={() => navigate("/")}
            >
              go to home
            </HushhTechCta>
          </section>

          {/* ── Trust Badges ── */}
          <section className="flex flex-col items-center justify-center text-center gap-2 pb-8">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px] text-gray-400">
                lock
              </span>
              <span className="text-[10px] text-gray-400 tracking-wide uppercase font-medium">
                256 bit encryption
              </span>
            </div>
            <p className="text-[10px] text-gray-400 lowercase">
              hushh technologies inc.
            </p>
          </section>
        </main>
      </div>

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={isOpen}
        onClose={onClose}
        onAccountDeleted={handleAccountDeleted}
      />
    </>
  );
};

export default DeleteAccountPage;
