// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { ChakraProvider } from "@chakra-ui/react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import WalletCardPreviewModal from "../src/components/wallet/WalletCardPreviewModal";
import theme from "../src/theme";

describe("WalletCardPreviewModal", () => {
  let container: HTMLDivElement;
  let root: Root;
  type WalletCardPreviewModalProps = React.ComponentProps<
    typeof WalletCardPreviewModal
  >;

  const preview = {
    badgeText: "HUSHH GOLD",
    title: "Hushh Gold Investor Pass",
    holderName: "Test User",
    organizationName: "Hushh",
    membershipId: "test-user",
    investmentClass: "Class B",
    email: "test@example.com",
    qrValue: "https://hushhtech.com/investor/test-user",
    profileUrl: "https://hushhtech.com/investor/test-user",
  };
  const longPreview = {
    ...preview,
    holderName: "Ankit Kumar Singh the Third of Hushh Capital Partners",
    membershipId: "ankit-kumar-singh-premier-member-2597e6b8",
    profileUrl:
      "https://hushhtech.com/investor/ankit-kumar-singh-premier-member-2597e6b8",
  };

  const setViewport = (
    width: number,
    height: number,
    options: { finePointer?: boolean; reducedMotion?: boolean } = {}
  ) => {
    const finePointer = options.finePointer ?? width >= 1024;
    const reducedMotion = options.reducedMotion ?? false;

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: height,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => {
        if (query.includes("(hover: hover) and (pointer: fine)")) {
          return {
            matches: finePointer,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          };
        }

        if (
          query.includes("prefers-reduced-motion") &&
          query.includes("reduce")
        ) {
          return {
            matches: reducedMotion,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          };
        }

        const minWidthMatch = query.match(/min-width:\s*(\d+)px/);
        const maxWidthMatch = query.match(/max-width:\s*(\d+)px/);
        const matchesMin = minWidthMatch
          ? width >= Number(minWidthMatch[1])
          : true;
        const matchesMax = maxWidthMatch
          ? width <= Number(maxWidthMatch[1])
          : true;
        const matches = matchesMin && matchesMax;

        return {
          matches,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        };
      }),
    });
  };

  const renderModal = async (
    overrides: Partial<WalletCardPreviewModalProps> = {}
  ) => {
    await act(async () => {
      root.render(
        React.createElement(
          ChakraProvider,
          { theme },
          React.createElement(WalletCardPreviewModal, {
            isOpen: true,
            onClose: () => undefined,
            preview,
            appleWalletSupported: false,
            appleWalletSupportMessage:
              "Available on iPhone in Wallet-supported browsers.",
            googleWalletAvailable: false,
            googleWalletSupportMessage:
              "Google Wallet is temporarily unavailable while we finish the wallet issuer setup.",
            ...overrides,
          })
        )
      );
    });
  };

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    setViewport(390, 844);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("shows Apple add action when Apple Wallet is supported", async () => {
    await renderModal({
      appleWalletSupported: true,
      onAddToAppleWallet: () => undefined,
    });

    expect(document.body.textContent).toContain("Preview Card");
    expect(document.body.textContent).toContain(
      "Apple Wallet and Google Wallet use the same Hushh Gold card details."
    );
    expect(document.body.textContent).toContain("Add to Apple Wallet");
    expect(document.body.textContent).toContain(
      "Google Wallet is temporarily unavailable"
    );
  });

  it("shows helper copy instead of the Apple add action when unsupported", async () => {
    await renderModal();

    expect(document.body.textContent).toContain(
      "Available on iPhone in Wallet-supported browsers."
    );
    const buttonLabels = Array.from(
      document.body.querySelectorAll("button")
    ).map((button) => button.textContent?.trim() || "");

    expect(buttonLabels).not.toContain("Add to Apple Wallet");
  });

  it("keeps the card bounded and shortens long membership ids only inside the preview card", async () => {
    await renderModal({
      preview: longPreview,
      appleWalletSupported: true,
      onAddToAppleWallet: () => undefined,
    });

    const mobileQrNode = document.querySelector(
      '[data-testid="wallet-preview-qr"] svg'
    );
    const previewShell = document.querySelector(
      '[data-testid="wallet-preview-shell"]'
    );
    const membershipPreview = document.querySelector(
      '[data-testid="wallet-preview-membership-id"]'
    );
    const profileLinkTile = document.querySelector(
      '[data-testid="wallet-preview-profile-link"]'
    ) as HTMLAnchorElement | null;
    const profileUrlDetails = document.querySelector(
      '[data-testid="wallet-preview-profile-url"]'
    );

    expect(mobileQrNode).not.toBeNull();
    expect(document.body.textContent).toContain(longPreview.holderName);
    expect(previewShell?.getAttribute("data-tilt-enabled")).toBe("false");
    expect(membershipPreview?.textContent).toContain("Membership ID · ");
    expect(membershipPreview?.textContent).toContain("…");
    expect(membershipPreview?.textContent).toContain("2597e6b8".slice(-6));
    expect(document.body.textContent).toContain(
      `Full membership ID · ${longPreview.membershipId}`
    );
    expect(profileLinkTile?.getAttribute("href")).toBe(longPreview.profileUrl);
    expect(profileLinkTile?.getAttribute("target")).toBe("_blank");
    expect(profileUrlDetails?.textContent).toContain(longPreview.profileUrl);

    await act(async () => {
      root.unmount();
    });
    root = createRoot(container);

    setViewport(1280, 900);
    await renderModal({
      preview: longPreview,
      appleWalletSupported: true,
      onAddToAppleWallet: () => undefined,
    });

    const desktopQrNode = document.querySelector(
      '[data-testid="wallet-preview-qr"] svg'
    );
    const desktopPreviewShell = document.querySelector(
      '[data-testid="wallet-preview-shell"]'
    );

    expect(desktopQrNode).not.toBeNull();
    expect(desktopPreviewShell?.getAttribute("data-tilt-enabled")).toBe("true");
    expect(document.body.textContent).toContain("Add to Apple Wallet");
    expect(document.body.textContent).toContain(
      "Google Wallet is temporarily unavailable"
    );
  });

  it("renders the profile tile as unavailable when there is no slug-backed public URL", async () => {
    await renderModal({
      preview: {
        ...preview,
        profileUrl: null,
      },
    });

    const profileLinkTile = document.querySelector(
      '[data-testid="wallet-preview-profile-link"]'
    );
    const profileUrlDetails = document.querySelector(
      '[data-testid="wallet-preview-profile-url"]'
    );

    expect(profileLinkTile?.getAttribute("href")).toBeNull();
    expect(profileUrlDetails?.textContent).toContain(
      "Public profile link unavailable"
    );
  });
});
