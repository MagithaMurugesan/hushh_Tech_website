/**
 * Delete Account Page — Matches the provided mockup exactly.
 * Clean, minimal layout with collapsible accordion sections.
 * Playfair Display heading, single CTA, expandable info rows.
 * Logic stays in logic.ts — zero logic changes.
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDeleteAccountLogic } from "./logic";
import HushhTechBackHeader from "../../components/hushh-tech-back-header/HushhTechBackHeader";
import DeleteAccountModal from "../../components/DeleteAccountModal";
import { Helmet } from "react-helmet";

/* ── Accordion section data ── */
const ACCORDION_SECTIONS = [
  {
    id: "how-to",
    icon: "delete_forever",
    title: "how to delete your account",
    subtitle: "step-by-step process",
    content: [
      { step: "1", text: "click the 'permanently delete account' button above" },
      { step: "2", text: "type DELETE in the confirmation field" },
      { step: "3", text: "confirm your decision — this cannot be undone" },
      { step: "4", text: "your account and all data will be permanently removed" },
    ],
  },
  {
    id: "data-deleted",
    icon: "folder_off",
    title: "data that will be permanently deleted",
    subtitle: "profile, history & preferences",
    content: [
      { step: "•", text: "account credentials & profile information" },
      { step: "•", text: "investor profile & preferences" },
      { step: "•", text: "onboarding data & responses" },
      { step: "•", text: "kyc verification data" },
      { step: "•", text: "chat history with ai assistant" },
      { step: "•", text: "uploaded documents & files" },
      { step: "•", text: "privacy settings & data vault" },
    ],
  },
  {
    id: "retention",
    icon: "history_toggle_off",
    title: "data retention policy",
    subtitle: "what we keep for compliance",
    content: [
      { step: "→", text: "all personal data is deleted immediately upon confirmation" },
      { step: "→", text: "encrypted backups are purged within 30 days" },
      { step: "→", text: "transaction records retained for 7 years per financial regulations" },
      { step: "→", text: "anonymized aggregated analytics that cannot identify you may be kept" },
    ],
  },
  {
    id: "notice",
    icon: "warning",
    title: "important notice",
    subtitle: "read before proceeding",
    content: [
      { step: "!", text: "this action is permanent and cannot be undone" },
      { step: "!", text: "you will lose access to all hushh services immediately" },
      { step: "!", text: "any active investments or pending transactions should be resolved first" },
      { step: "!", text: "contact support@hushh.ai if you need help before deleting" },
    ],
  },
];

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

  /* Accordion expand/collapse state — purely UI, no business logic */
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <Helmet>
        <title>Delete Account - Hushh</title>
        <meta
          name="description"
          content="Delete your Hushh account and remove all your personal data from our systems."
        />
      </Helmet>

      <div className="bg-white text-gray-900 min-h-screen antialiased flex flex-col selection:bg-black selection:text-white relative overflow-hidden">
        {/* ═══ Background layer (blurs when modal is open) ═══ */}
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ${
            isOpen
              ? "scale-[0.98] blur-[2px] opacity-40 pointer-events-none select-none"
              : ""
          }`}
        >
          {/* ═══ Header ═══ */}
          <HushhTechBackHeader
            onBackClick={() => navigate(-1)}
            rightType="label"
            rightLabel="FAQs"
          />

          <main className="flex-1 px-6 pt-8 pb-12 flex flex-col max-w-lg mx-auto w-full">
            {/* ── Title Section ── */}
            <div className="mb-12">
              <h1
                className="text-4xl text-black mb-3 lowercase leading-tight"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {isLoading
                  ? "checking session..."
                  : isLoggedIn
                  ? "ready to delete your account?"
                  : "login to delete your account"}
              </h1>

              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-black rounded-full" />
                  <p className="text-gray-500 text-sm lowercase">
                    verifying session...
                  </p>
                </div>
              ) : isLoggedIn && userEmail ? (
                <p className="text-gray-500 text-sm font-normal lowercase">
                  logged in as: {userEmail}
                </p>
              ) : (
                <p className="text-gray-500 text-sm font-normal lowercase">
                  please login to proceed with account deletion
                </p>
              )}
            </div>

            {/* ── Primary CTA ── */}
            <div className="mb-16">
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={onOpen}
                  className="w-full bg-black text-white h-14 font-medium text-sm flex items-center justify-center hover:bg-neutral-800 transition-colors active:scale-[0.99] shadow-[0_4px_20px_rgba(0,0,0,0.03)] lowercase"
                >
                  permanently delete account
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLoginRedirect}
                  className="w-full bg-black text-white h-14 font-medium text-sm flex items-center justify-center hover:bg-neutral-800 transition-colors active:scale-[0.99] shadow-[0_4px_20px_rgba(0,0,0,0.03)] lowercase"
                >
                  login to continue
                </button>
              )}
            </div>

            {/* ── Accordion Sections ── */}
            <div className="space-y-0">
              {ACCORDION_SECTIONS.map((section) => {
                const isExpanded = expandedId === section.id;

                return (
                  <div key={section.id}>
                    {/* Row trigger */}
                    <button
                      type="button"
                      onClick={() => handleToggle(section.id)}
                      className="group w-full py-5 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors -mx-2 px-2"
                      aria-expanded={isExpanded}
                      aria-controls={`accordion-${section.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-white transition-colors shrink-0">
                          <span
                            className="material-symbols-outlined text-gray-500 text-[1.25rem]"
                            style={{
                              fontVariationSettings:
                                "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",
                            }}
                          >
                            {section.icon}
                          </span>
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="text-sm font-medium text-black lowercase">
                            {section.title}
                          </span>
                          <span className="text-xs text-gray-500 mt-0.5 lowercase">
                            {section.subtitle}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`material-symbols-outlined text-gray-400 text-xl transition-transform duration-300 ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      >
                        arrow_forward
                      </span>
                    </button>

                    {/* Expandable content */}
                    <div
                      id={`accordion-${section.id}`}
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        isExpanded
                          ? "max-h-[500px] opacity-100"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="py-4 pl-16 pr-4 space-y-3 border-b border-gray-100">
                        {section.content.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3"
                          >
                            <span className="text-xs text-gray-400 font-semibold w-4 shrink-0 pt-0.5">
                              {item.step}
                            </span>
                            <p className="text-sm text-gray-600 lowercase leading-relaxed">
                              {item.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Spacer ── */}
            <div className="flex-grow min-h-[4rem]" />

            {/* ── Trust Badge ── */}
            <div className="mt-auto pt-8 flex items-center justify-center gap-2 opacity-60">
              <span
                className="material-symbols-outlined text-[1.2rem] text-gray-500"
                style={{
                  fontVariationSettings:
                    "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",
                }}
              >
                lock
              </span>
              <span className="text-[0.65rem] text-gray-500 tracking-wide font-medium uppercase">
                256 bit encryption
              </span>
            </div>
          </main>
        </div>

        {/* ═══ Delete Account Modal ═══ */}
        <DeleteAccountModal
          isOpen={isOpen}
          onClose={onClose}
          onAccountDeleted={handleAccountDeleted}
        />
      </div>
    </>
  );
};

export default DeleteAccountPage;
