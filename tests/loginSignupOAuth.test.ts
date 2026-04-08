// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const startOAuthMock = vi.fn();
const redirectToUrlMock = vi.fn();
const resolveOAuthHostMock = vi.fn();
var actualResolveOAuthHost: typeof import("../src/auth/authHost").resolveOAuthHost;
const authState = {
  status: "anonymous",
};

vi.mock("../src/auth/AuthSessionProvider", () => ({
  useAuthSession: () => ({
    status: authState.status,
    startOAuth: (...args: unknown[]) => startOAuthMock(...args),
  }),
}));

vi.mock("../src/auth/authHost", async () => {
  const actual = await vi.importActual<typeof import("../src/auth/authHost")>(
    "../src/auth/authHost"
  );
  actualResolveOAuthHost = actual.resolveOAuthHost;
  return {
    ...actual,
    redirectToUrl: (...args: unknown[]) => redirectToUrlMock(...args),
    resolveOAuthHost: (...args: unknown[]) => resolveOAuthHostMock(...args),
  };
});

vi.mock("../src/components/hushh-tech-header/HushhTechHeader", () => ({
  default: () => React.createElement("div", null, "header"),
}));

vi.mock("../src/components/hushh-tech-footer/HushhTechFooter", () => ({
  default: () => React.createElement("div", null, "footer"),
}));

vi.mock("../src/components/images/Hushhogo.png", () => ({
  default: "logo.png",
}));

import LoginPage from "../src/pages/login/ui";
import SignupPage from "../src/pages/signup/ui";

describe("login/signup OAuth UI", () => {
  let container: HTMLDivElement;
  let root: Root;

  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    authState.status = "anonymous";
    resolveOAuthHostMock.mockImplementation((...args: Parameters<typeof actualResolveOAuthHost>) =>
      actualResolveOAuthHost(...args)
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows an inline login error and re-enables the buttons when OAuth start fails", async () => {
    startOAuthMock.mockResolvedValue({
      ok: false,
      provider: "apple",
      reason: "missing_client",
      message: "Authentication is not configured for this build.",
    });

    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(LoginPage)
        )
      );
    });
    await flush();

    const appleButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Continue with Apple")
    );

    await act(async () => {
      appleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(startOAuthMock).toHaveBeenCalledWith("apple");
    expect(appleButton?.hasAttribute("disabled")).toBe(false);
    expect(container.textContent).toContain(
      "Authentication is not configured for this build."
    );
    expect(redirectToUrlMock).not.toHaveBeenCalled();
  });

  it("redirects unsupported login hosts before rendering sign-in CTAs", async () => {
    resolveOAuthHostMock.mockReturnValue({
      supported: false,
      canonicalOrigin: "https://hushhtech.com",
      callbackUrl: "https://hushhtech.com/auth/callback",
      canonicalEntryUrl: "https://hushhtech.com/login?redirect=%2Fprofile",
    });

    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(LoginPage)
        )
      );
    });
    await flush();

    expect(redirectToUrlMock).toHaveBeenCalledWith(
      "https://hushhtech.com/login?redirect=%2Fprofile"
    );
    expect(startOAuthMock).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Continue with Apple");
    expect(container.textContent).not.toContain("Continue with Google");
    expect(container.textContent).not.toContain(
      "Sign-in is only available on https://hushhtech.com."
    );
  });

  it("redirects unsupported signup hosts before rendering sign-up CTAs", async () => {
    resolveOAuthHostMock.mockReturnValue({
      supported: false,
      canonicalOrigin: "https://hushhtech.com",
      callbackUrl: "https://hushhtech.com/auth/callback",
      canonicalEntryUrl: "https://hushhtech.com/signup?redirect=%2Fprofile",
    });

    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(SignupPage)
        )
      );
    });
    await flush();

    expect(redirectToUrlMock).toHaveBeenCalledWith(
      "https://hushhtech.com/signup?redirect=%2Fprofile"
    );
    expect(startOAuthMock).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Continue with Apple");
    expect(container.textContent).not.toContain("Continue with Google");
    expect(container.textContent).not.toContain(
      "Sign-in is only available on https://hushhtech.com."
    );
  });
});
