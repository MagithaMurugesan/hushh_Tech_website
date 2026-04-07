import { useState } from "react";
import { useToast } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import config from "../resources/config/config";
import { useAuthSession } from "../auth/AuthSessionProvider";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountDeleted: () => void;
}

/**
 * Delete Account Modal — Glassmorphism design matching Step 4 location modal.
 * Playfair Display headings, black/white buttons, frosted overlay.
 * Backend logic is preserved — only UI is redesigned.
 */
const DeleteAccountModal = ({
  isOpen,
  onClose,
  onAccountDeleted,
}: DeleteAccountModalProps) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { session, revalidateSession, handleAccountDeleted } = useAuthSession();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isDeleteEnabled = confirmText.toUpperCase() === "DELETE";

  // =====================================================
  // Backend logic — UNCHANGED
  // =====================================================
  const handleDeleteAccount = async () => {
    if (!isDeleteEnabled || !config.supabaseClient) return;

    setIsDeleting(true);

    try {
      console.log("[DeleteAccount] Starting account deletion process...");

      const { data: refreshData, error: refreshError } =
        await config.supabaseClient.auth.refreshSession();

      let accessToken: string | null = session?.access_token || null;

      if (refreshError) {
        console.error("[DeleteAccount] Session refresh failed:", refreshError);
        if (!accessToken) {
          const snapshot = await revalidateSession();
          if (snapshot.status === "authenticated") {
            accessToken = snapshot.session?.access_token || null;
          }
        }

        if (!accessToken) {
          throw new Error(
            "Session expired. Please log out and log in again to delete your account."
          );
        }

        console.log("[DeleteAccount] Using validated fallback session...");
      } else if (refreshData.session?.access_token) {
        console.log("[DeleteAccount] Session refreshed successfully");
        accessToken = refreshData.session.access_token;
      } else {
        console.error("[DeleteAccount] No session after refresh");
        throw new Error(
          "Unable to verify your session. Please log out and log in again."
        );
      }

      console.log("[DeleteAccount] Calling delete endpoint...");
      const supabaseUrl = config.SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/delete-user-account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("[DeleteAccount] Edge function error:", data);
        throw new Error(data.error || "Failed to delete account");
      }

      console.log("[DeleteAccount] Account deleted successfully");
      await handleAccountDeleted();

      toast({
        title: t("deleteAccount.successTitle"),
        description: t("deleteAccount.successMessage"),
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      setTimeout(() => {
        onAccountDeleted();
      }, 500);
    } catch (error: any) {
      console.error("[DeleteAccount] Error:", error);
      toast({
        title: t("deleteAccount.errorTitle"),
        description: error.message || t("deleteAccount.errorMessage"),
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  if (!isOpen) return null;

  // =====================================================
  // Glassmorphism Modal — Matches Step 4 location modal
  // =====================================================
  return (
    <>
      {/* ── Frosted glass overlay ── */}
      <div
        className="fixed inset-0 z-40 bg-white/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* ── Modal card — bottom-sheet on mobile, centered on desktop ── */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
        <div
          className="relative w-full max-w-sm bg-white rounded-3xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08),0_0_1px_rgba(0,0,0,0.04)] p-8 flex flex-col items-center text-center border border-gray-100/50"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Warning icon in circle ── */}
          <div className="mb-8">
            <div className="w-20 h-20 rounded-full border border-gray-200 bg-white flex items-center justify-center shadow-sm">
              <span
                className="material-symbols-outlined text-black text-[2rem]"
                style={{ fontVariationSettings: "'wght' 200" }}
              >
                delete_forever
              </span>
            </div>
          </div>

          {/* ── Heading & description ── */}
          <div className="space-y-4 mb-8 px-2">
            <h2
              className="text-[1.75rem] leading-[1.2] text-black lowercase tracking-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              are you sure?
            </h2>
            <p className="text-gray-500 text-[0.85rem] leading-relaxed font-normal lowercase max-w-[90%] mx-auto">
              this action is permanent and cannot be undone. all your data,
              investment info, and services will be removed.
            </p>
          </div>

          {/* ── Confirmation input ── */}
          <div className="w-full mb-8">
            <p className="text-xs text-gray-500 lowercase font-semibold mb-3 tracking-wide">
              type DELETE to confirm
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="DELETE"
              className="w-full h-[52px] border border-gray-200 bg-white px-4 text-sm text-black font-mono tracking-[2px] placeholder:text-gray-300 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-colors"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Type DELETE to confirm account deletion"
            />
          </div>

          {/* ── Action buttons ── */}
          <div className="w-full space-y-4">
            {/* Delete — primary black */}
            <button
              onClick={handleDeleteAccount}
              disabled={!isDeleteEnabled || isDeleting}
              className="w-full h-12 bg-black text-white font-medium text-[0.8rem] flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-[0.99] border border-black hover:bg-black/90 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none lowercase"
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                  <span>deleting...</span>
                </>
              ) : (
                <>
                  <span
                    className="material-symbols-outlined text-lg"
                    style={{ fontVariationSettings: "'wght' 400" }}
                  >
                    delete_forever
                  </span>
                  <span>delete my account</span>
                </>
              )}
            </button>

            {/* Keep — outlined white */}
            <button
              onClick={handleClose}
              disabled={isDeleting}
              className="w-full h-12 border border-black bg-white text-black font-medium text-[0.8rem] hover:bg-gray-50 transition-colors active:scale-[0.99] disabled:opacity-50 lowercase"
            >
              keep my account
            </button>

            {/* Cancel — text link */}
            <div className="pt-2">
              <button
                onClick={handleClose}
                disabled={isDeleting}
                className="text-xs font-medium text-gray-400 hover:text-black transition-colors lowercase disabled:opacity-50"
              >
                cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DeleteAccountModal;
