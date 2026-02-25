/**
 * Login Page — Aligned with onboarding step 1-8 design language.
 * Uses Playfair Display headings, lowercase, HushhTechCta, same spacing.
 */
import { Link } from "react-router-dom";
import { useLoginLogic } from "./logic";
import HushhLogo from "../../components/images/Hushhogo.png";
import HushhTechCta, {
  HushhTechCtaVariant,
} from "../../components/hushh-tech-cta/HushhTechCta";
import { FaApple } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";

export default function LoginPage() {
  const { isLoading, isSigningIn, handleAppleSignIn, handleGoogleSignIn } =
    useLoginLogic();

  if (isLoading) return null;

  return (
    <div className="bg-white text-gray-900 min-h-screen antialiased flex flex-col selection:bg-black selection:text-white">
      <main className="px-6 flex-grow max-w-md mx-auto w-full flex flex-col justify-center pb-12">
        {/* ── Logo ── */}
        <section className="flex justify-center pt-16 pb-8">
          <Link to="/">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1c1c1e] to-[#2c2c2e] flex items-center justify-center overflow-hidden border border-black/5">
              <img
                src={HushhLogo}
                alt="Hushh Logo"
                className="w-14 h-14 object-contain"
              />
            </div>
          </Link>
        </section>

        {/* ── Title ── */}
        <section className="pb-10">
          <h1
            className="text-[2.5rem] leading-[1.1] font-medium text-black tracking-tight lowercase text-center"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            welcome back
          </h1>
          <p className="text-gray-500 text-sm font-light mt-3 lowercase text-center leading-relaxed">
            secure, private, and smart investing
          </p>
        </section>

        {/* ── Sign-in Buttons ── */}
        <section className="space-y-3 mb-10">
          <HushhTechCta
            variant={HushhTechCtaVariant.BLACK}
            onClick={handleAppleSignIn}
            disabled={isSigningIn}
          >
            <FaApple className="text-lg" />
            <span>continue with apple</span>
          </HushhTechCta>

          <HushhTechCta
            variant={HushhTechCtaVariant.WHITE}
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
          >
            <FcGoogle className="text-lg" />
            <span>continue with google</span>
          </HushhTechCta>
        </section>

        {/* ── Sign up link ── */}
        <div className="text-center">
          <p className="text-sm text-gray-500 font-light lowercase">
            don't have an account?{" "}
            <Link
              to="/signup"
              className="text-black font-medium underline underline-offset-4 decoration-gray-300 hover:decoration-black transition-colors"
            >
              sign up
            </Link>
          </p>
        </div>

        {/* ── Trust Badges ── */}
        <section className="flex flex-col items-center justify-center text-center gap-2 pt-16 pb-4">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px] text-gray-400">
              lock
            </span>
            <span className="text-[10px] text-gray-400 tracking-wide uppercase font-medium">
              256 bit encryption
            </span>
          </div>
        </section>

        {/* ── Terms Footer ── */}
        <p className="text-[11px] leading-[16px] text-gray-400 text-center font-light lowercase">
          by continuing, you agree to our{" "}
          <Link to="/terms" className="underline underline-offset-2">
            terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline underline-offset-2">
            privacy policy
          </Link>
        </p>
      </main>
    </div>
  );
}
