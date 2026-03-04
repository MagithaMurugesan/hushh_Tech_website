/**
 * Sign NDA Page — Aligned with onboarding design language.
 * Playfair Display headings, HushhTechCta, HushhTechHeader/Footer.
 *
 * Performance optimizations:
 * - Sign NDA first (fast RPC) → redirect immediately
 * - PDF generation + upload + notification run in background (non-blocking)
 * - IP fetched once and reused (no duplicate ipify calls)
 * - Streamlined auth check (getSession instead of onAuthStateChange listener)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@chakra-ui/react';
import config from '../../resources/config/config';
import {
  signNDA,
  sendNDANotification,
  generateNDAPdf,
  uploadSignedNDA,
  fetchClientIP,
} from '../../services/nda/ndaService';
import { setCachedNDA } from '../../components/GlobalNDAGate';
import HushhTechHeader from '../../components/hushh-tech-header/HushhTechHeader';
import HushhTechFooter from '../../components/hushh-tech-footer/HushhTechFooter';
import HushhTechCta, {
  HushhTechCtaVariant,
} from '../../components/hushh-tech-cta/HushhTechCta';

/* NDA terms data */
const NDA_SECTIONS = [
  {
    title: '1. definition of confidential information',
    body: '"Confidential Information" means any non-public information disclosed by Hushh to the Recipient, including but not limited to: business strategies, financial information, investment strategies, fund performance data, technical specifications, proprietary algorithms, AI models, trade secrets, and any other information marked as confidential or that reasonably should be understood to be confidential.',
  },
  {
    title: '2. obligations of the recipient',
    body: 'The Recipient agrees to: (a) hold Confidential Information in strict confidence; (b) not disclose Confidential Information to any third party without prior written consent; (c) use Confidential Information solely for evaluating a potential relationship with Hushh; (d) take reasonable measures to protect the confidentiality of such information.',
  },
  {
    title: '3. exceptions',
    body: 'This Agreement does not apply to information that: (a) is or becomes publicly available through no fault of the Recipient; (b) was known to the Recipient prior to disclosure; (c) is independently developed by the Recipient; (d) is disclosed pursuant to a court order or legal requirement.',
  },
  {
    title: '4. term and termination',
    body: 'This Agreement shall remain in effect for a period of three (3) years from the date of execution. The obligations of confidentiality shall survive the termination of this Agreement.',
  },
  {
    title: '5. governing law',
    body: 'This Agreement shall be governed by the laws of the State of Delaware, United States of America, without regard to its conflict of laws principles.',
  },
  {
    title: '6. acknowledgment',
    body: 'By signing below, the Recipient acknowledges that they have read, understood, and agree to be bound by the terms of this Non-Disclosure Agreement. The Recipient further acknowledges that any breach of this Agreement may result in irreparable harm to Hushh and that Hushh shall be entitled to seek injunctive relief in addition to any other remedies available at law.',
  },
];

const SignNDAPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [signerName, setSignerName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [nameError, setNameError] = useState('');
  const [termsError, setTermsError] = useState('');

  /* Auth check — uses local `cancelled` flag (StrictMode-safe) */
  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      if (!config.supabaseClient) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const {
          data: { session },
        } = await config.supabaseClient.auth.getSession();

        if (cancelled) return;

        if (!session?.user) {
          navigate('/login', { replace: true });
          return;
        }

        setUserId(session.user.id);
        setUserEmail(session.user.email || null);

        // Pre-fill name from OAuth metadata
        const fullName =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          session.user.email?.split('@')[0] ||
          '';
        if (fullName) setSignerName(fullName);
      } catch (err) {
        console.error('[SignNDA] Auth check failed:', err);
        if (!cancelled) navigate('/login', { replace: true });
        return;
      }

      if (!cancelled) setIsLoading(false);
    };

    initAuth();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const validateForm = useCallback((): boolean => {
    let isValid = true;

    const trimmedName = signerName.trim();
    if (!trimmedName) {
      setNameError('please enter your full legal name');
      isValid = false;
    } else if (trimmedName.length < 2) {
      setNameError('name must be at least 2 characters');
      isValid = false;
    } else {
      setNameError('');
    }

    if (!agreedToTerms) {
      setTermsError('you must agree to the nda terms');
      isValid = false;
    } else {
      setTermsError('');
    }

    return isValid;
  }, [signerName, agreedToTerms]);

  /**
   * OPTIMIZED NDA SIGNING FLOW:
   * 1. Fetch IP + Sign NDA in parallel → fast (~1s)
   * 2. Redirect immediately after signing
   * 3. PDF generation + upload + notification run in background
   */
  const handleSignNDA = useCallback(async () => {
    if (!validateForm() || isSubmitting) return;

    if (!config.supabaseClient || !userId) {
      toast({
        title: 'session expired',
        description: 'please log in again.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
      navigate('/login', { replace: true });
      return;
    }

    setIsSubmitting(true);

    try {
      const {
        data: { session },
      } = await config.supabaseClient.auth.getSession();

      if (!session) {
        toast({
          title: 'session expired',
          description: 'your session has expired. please log in again.',
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
        navigate('/login', { replace: true });
        return;
      }

      const trimmedName = signerName.trim();
      const accessToken = session.access_token;

      // Step 1: Fetch IP + Sign NDA in parallel (fast path)
      const [clientIp, signResult] = await Promise.all([
        fetchClientIP(),
        signNDA(trimmedName, 'v1.0', undefined, undefined),
      ]);

      if (!signResult.success) {
        // If sign failed without IP, retry with IP
        const retryResult = await signNDA(trimmedName, 'v1.0', undefined, clientIp);
        if (!retryResult.success) {
          toast({
            title: 'error signing nda',
            description: retryResult.error || 'an error occurred. please try again.',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Step 2: NDA signed! Update cache + show success + redirect immediately
      setCachedNDA(userId, true);

      toast({
        title: 'nda signed successfully',
        description: 'thank you for signing the non-disclosure agreement.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      });

      const redirectTo = sessionStorage.getItem('nda_redirect_after') || '/';
      sessionStorage.removeItem('nda_redirect_after');
      navigate(redirectTo, { replace: true });

      // Step 3: Background tasks — PDF gen + upload + notification (non-blocking)
      const signedAt = signResult.signedAt || new Date().toISOString();
      const emailAddr = userEmail || 'unknown@email.com';

      // Fire-and-forget background tasks
      (async () => {
        let generatedPdfUrl: string | undefined;
        let pdfBlob: Blob | undefined;

        try {
          if (accessToken) {
            const pdfResult = await generateNDAPdf(
              {
                signerName: trimmedName,
                signerEmail: emailAddr,
                signedAt,
                ndaVersion: 'v1.0',
                userId,
              },
              accessToken,
            );

            if (pdfResult.success && pdfResult.blob) {
              pdfBlob = pdfResult.blob;
              const uploadResult = await uploadSignedNDA(userId, pdfResult.blob);
              if (uploadResult.success && uploadResult.url) {
                generatedPdfUrl = uploadResult.url;
              }
            }
          }
        } catch (pdfError) {
          console.warn('[SignNDA] Background PDF gen/upload failed:', pdfError);
        }

        // Send notification (fire-and-forget)
        sendNDANotification(
          trimmedName,
          emailAddr,
          signedAt,
          signResult.ndaVersion || 'v1.0',
          generatedPdfUrl,
          pdfBlob,
          userId,
          clientIp,
        ).catch((err) => console.error('[SignNDA] Notification failed:', err));
      })();
    } catch (error) {
      console.error('[SignNDA] Unexpected error:', error);
      toast({
        title: 'error',
        description: 'an unexpected error occurred. please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setIsSubmitting(false);
    }
  }, [validateForm, isSubmitting, userId, userEmail, signerName, navigate, toast]);

  /* Loading state */
  if (isLoading) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-hushh-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ─── RENDER ─── */
  return (
    <div className="bg-white text-gray-900 min-h-screen antialiased flex flex-col selection:bg-hushh-blue selection:text-white">
      <HushhTechHeader />

      <main className="px-6 md:px-10 flex-grow max-w-md md:max-w-2xl lg:max-w-3xl mx-auto w-full pb-32">
        {/* ── Icon + Title ── */}
        <section className="pt-12 pb-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-hushh-blue flex items-center justify-center">
            <span
              className="material-symbols-outlined text-white text-3xl"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 500" }}
            >
              description
            </span>
          </div>
          <h1
            className="text-[2.5rem] md:text-[3rem] lg:text-[3.5rem] leading-[1.1] font-normal text-black tracking-tight font-serif"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Non-Disclosure
            <br />
            <span className="text-gray-400 italic font-light">Agreement</span>
          </h1>
          <p className="text-gray-500 text-sm font-light mt-3 leading-relaxed">
            Review and sign to access confidential investment materials.
          </p>
        </section>

        {/* ── Security Badge ── */}
        <section className="mb-8">
          <div className="flex items-center justify-center gap-2 py-3 px-4 border border-gray-200 bg-gray-50 rounded-xl">
            <span
              className="material-symbols-outlined text-hushh-blue text-lg"
              style={{ fontVariationSettings: "'wght' 400" }}
            >
              lock
            </span>
            <span className="text-[11px] text-gray-500 tracking-wide uppercase font-medium">
              Encrypted &amp; Legally Binding · GDPR Compliant
            </span>
          </div>
        </section>

        {/* ── Agreement Terms ── */}
        <section className="mb-8">
          <h3 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase mb-4 font-medium">
            Agreement Terms
          </h3>
          <div className="border border-gray-200 bg-white rounded-xl">
            <div className="max-h-80 md:max-h-[28rem] overflow-y-auto p-5 md:p-8 space-y-5 scrollbar-thin">
              <p className="text-sm font-bold text-black uppercase tracking-wide">
                mutual non-disclosure agreement
              </p>
              <p className="text-sm text-gray-500 leading-relaxed">
                This Non-Disclosure Agreement (&quot;Agreement&quot;) is entered into
                between Hushh Technologies LLC (&quot;Hushh&quot;) and the undersigned
                party (&quot;Recipient&quot;).
              </p>
              {NDA_SECTIONS.map((section) => (
                <div key={section.title}>
                  <p className="text-xs font-semibold text-black uppercase tracking-wide mb-1">
                    {section.title}
                  </p>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {section.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Digital Signature ── */}
        <section className="mb-8">
          <h3 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase mb-4 font-medium">
            Digital Signature
          </h3>

          {/* Name input */}
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-2">
            <div className="flex items-center px-4 py-4 border-b border-gray-100">
              <label className="text-sm font-semibold text-gray-900 shrink-0 mr-4">
                Full Legal Name
              </label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => {
                  setSignerName(e.target.value);
                  if (nameError) setNameError('');
                }}
                placeholder="required"
                className="flex-1 text-right text-sm font-medium text-black placeholder:text-gray-400 bg-transparent outline-none"
              />
            </div>
            {nameError && (
              <p className="px-4 py-2 text-xs text-red-600 font-medium">
                {nameError}
              </p>
            )}

            {/* Agreement checkbox */}
            <div
              className={`px-4 py-4 transition-colors ${
                agreedToTerms ? 'bg-gray-50' : 'bg-white'
              }`}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => {
                    setAgreedToTerms(e.target.checked);
                    if (termsError) setTermsError('');
                  }}
                  className="mt-0.5 w-5 h-5 accent-black shrink-0"
                />
                <span className="text-xs text-gray-500 leading-relaxed">
                  I have read, understood, and agree to the terms of this Non-Disclosure
                  Agreement. I acknowledge that this constitutes my legal electronic
                  signature.
                </span>
              </label>
            </div>
            {termsError && (
              <p className="px-4 py-2 text-xs text-red-600 font-medium">
                {termsError}
              </p>
            )}
          </div>

          {/* Signing as info */}
          {userEmail && (
            <div className="flex items-center justify-center gap-1.5 mt-3">
              <span
                className="material-symbols-outlined text-gray-400 text-base"
                style={{ fontVariationSettings: "'wght' 400" }}
              >
                person
              </span>
              <p className="text-xs text-gray-500">
                Signing as{' '}
                <span className="text-black font-semibold">{userEmail}</span>
              </p>
            </div>
          )}
        </section>

        {/* ── CTA — Sign & Continue ── */}
        <section className="space-y-3 mb-8">
          <HushhTechCta
            variant={HushhTechCtaVariant.BLACK}
            onClick={handleSignNDA}
            disabled={!agreedToTerms || !signerName.trim() || isSubmitting}
          >
            {isSubmitting ? 'signing...' : 'sign & continue'}
          </HushhTechCta>
        </section>

        {/* ── Legal Footer ── */}
        <p className="text-[11px] leading-[16px] text-gray-400 text-center font-light">
          By signing, you agree that your digital signature has the same legal
          validity as a handwritten signature under applicable electronic signature
          laws.
        </p>

        {/* ── Trust Badges ── */}
        <section className="flex flex-col items-center justify-center text-center gap-2 pt-12 pb-4">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px] text-hushh-blue">
              lock
            </span>
            <span className="text-[10px] text-gray-500 tracking-wide uppercase font-medium">
              256 Bit Encryption
            </span>
          </div>
        </section>
      </main>

      <HushhTechFooter />
    </div>
  );
};

export default SignNDAPage;
