/**
 * Sign NDA + Fund Documents Page
 * User must sign the NDA AND acknowledge all 4 fund documents.
 * Playfair Display headings, HushhTechHeader/Footer.
 * Backend logic (auth, NDA signing, PDF gen, notification) fully preserved.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '@chakra-ui/react';
import config from '../../resources/config/config';
import { signNDA, sendNDANotification, generateNDAPdf, uploadSignedNDA } from '../../services/nda/ndaService';
import HushhTechHeader from '../../components/hushh-tech-header/HushhTechHeader';
import HushhTechFooter from '../../components/hushh-tech-footer/HushhTechFooter';
import HushhTechCta, { HushhTechCtaVariant } from '../../components/hushh-tech-cta/HushhTechCta';
import { useAuthSession } from '../../auth/AuthSessionProvider';
import { buildLoginRedirectPath } from '../../auth/routePolicy';

/* ── Fund documents config ── */
const FUND_DOCUMENTS = [
  {
    id: 'delaware-feeder-lpa',
    name: 'Delaware Feeder LPA',
    fullName: 'Hushh Alpha Aloha Fund A Delaware Feeder LPA',
    url: '/fund-documents/delaware-feeder-lpa.docx',
    description: 'Limited Partnership Agreement for the Delaware Feeder Fund.',
  },
  {
    id: 'investment-prospectus',
    name: 'Investment Prospectus',
    fullName: 'Hushh Alpha Aloha Fund A Investment Prospectus',
    url: '/fund-documents/investment-prospectus.docx',
    description: 'Detailed investment strategy, risks, and fund objectives.',
  },
  {
    id: 'lp-master-lpa',
    name: 'LP Master LPA',
    fullName: 'Hushh Alpha Aloha Fund A LP Master LPA',
    url: '/fund-documents/lp-master-lpa.docx',
    description: 'Master Limited Partnership Agreement governing LP interests.',
  },
  {
    id: 'ppm',
    name: 'Private Placement Memorandum',
    fullName: 'Hushh Alpha Aloha Fund A PPM',
    url: '/fund-documents/ppm.docx',
    description: 'Offering memorandum with terms, risks, and disclosures.',
  },
] as const;

/* ── NDA terms data ── */
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

/* ── Playfair style shortcut ── */
const playfair = { fontFamily: "'Playfair Display', serif" };

const SignNDAPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const isMountedRef = useRef(true);
  const { session, status, user, revalidateSession } = useAuthSession();

  const [isLoading, setIsLoading] = useState(true);
  const [signerName, setSignerName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  /* Track which fund documents have been acknowledged */
  const [docAcknowledged, setDocAcknowledged] = useState<Record<string, boolean>>(
    Object.fromEntries(FUND_DOCUMENTS.map((d) => [d.id, false]))
  );

  const [nameError, setNameError] = useState('');
  const [termsError, setTermsError] = useState('');

  /* Derived: all documents acknowledged? */
  const allDocsAcknowledged = FUND_DOCUMENTS.every((d) => docAcknowledged[d.id]);

  /* Can submit? */
  const canSubmit = agreedToTerms && allDocsAcknowledged && signerName.trim().length >= 2 && !isSubmitting;

  /* Cleanup on unmount */
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  /* Auth lifecycle */
  useEffect(() => {
    if (status === 'booting') {
      return;
    }

    if (status !== 'authenticated' || !user) {
      setIsLoading(false);
      navigate(
        buildLoginRedirectPath(location.pathname, location.search, location.hash),
        { replace: true }
      );
      return;
    }

    setUserId(user.id);
    setUserEmail(user.email || null);

    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      '';

    if (fullName) {
      setSignerName((currentName) => currentName || fullName);
    }

    setIsLoading(false);
  }, [location.hash, location.pathname, location.search, navigate, status, user]);

  /* Toggle individual document acknowledgment */
  const handleDocToggle = useCallback((docId: string) => {
    setDocAcknowledged((prev) => ({ ...prev, [docId]: !prev[docId] }));
  }, []);

  /* Download handler */
  const handleDownload = useCallback((url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  }, []);

  const handleReadDocument = useCallback((url: string, title: string) => {
    const readerUrl = new URL('/document-viewer', window.location.origin);
    readerUrl.searchParams.set('src', url);
    readerUrl.searchParams.set('title', title);
    window.open(readerUrl.toString(), '_blank', 'noopener,noreferrer');
  }, []);

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
      setTermsError('you must agree to the terms');
      isValid = false;
    } else {
      setTermsError('');
    }

    if (!allDocsAcknowledged) {
      toast({
        title: 'documents required',
        description: 'please acknowledge all fund documents before signing.',
        status: 'warning',
        duration: 4000,
        isClosable: true,
      });
      isValid = false;
    }

    return isValid;
  }, [signerName, agreedToTerms, allDocsAcknowledged, toast]);

  const handleSignNDA = useCallback(async () => {
    if (!validateForm()) return;
    if (isSubmitting) return;

    if (!config.supabaseClient || !userId) {
      toast({
        title: 'session expired',
        description: 'please log in again.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
      navigate(
        buildLoginRedirectPath(location.pathname, location.search, location.hash),
        { replace: true }
      );
      return;
    }

    setIsSubmitting(true);

    try {
      let accessToken = session?.access_token || null;

      if (!accessToken) {
        const snapshot = await revalidateSession();
        if (snapshot.status === 'authenticated') {
          accessToken = snapshot.session?.access_token || null;
        }
      }

      if (!accessToken) {
        toast({
          title: 'session expired',
          description: 'your session has expired. please log in again.',
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
        navigate(
          buildLoginRedirectPath(location.pathname, location.search, location.hash),
          { replace: true }
        );
        return;
      }

      const trimmedName = signerName.trim();
      let generatedPdfUrl: string | undefined;
      let pdfBlob: Blob | undefined;

      /* PDF generation — non-blocking */
      try {
        if (accessToken) {
          const pdfResult = await generateNDAPdf(
            {
              signerName: trimmedName,
              signerEmail: userEmail || 'unknown@email.com',
              signedAt: new Date().toISOString(),
              ndaVersion: 'v1.0',
              userId,
            },
            accessToken
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
        console.warn('[SignNDA] PDF generation/upload failed, continuing:', pdfError);
      }

      const result = await signNDA(trimmedName, 'v1.0', generatedPdfUrl);

      if (!isMountedRef.current) return;

      if (result.success) {
        /* Build list of acknowledged documents for notification */
        const acknowledgedDocs = FUND_DOCUMENTS.map((d) => d.fullName);

        sendNDANotification(
          trimmedName,
          userEmail || 'unknown@email.com',
          result.signedAt || new Date().toISOString(),
          result.ndaVersion || 'v1.0',
          generatedPdfUrl,
          pdfBlob,
          userId,
          undefined,
          acknowledgedDocs
        ).catch((err) => console.error('[SignNDA] Notification failed:', err));

        toast({
          title: 'agreements signed successfully',
          description: 'thank you for signing the NDA and acknowledging the fund documents.',
          status: 'success',
          duration: 4000,
          isClosable: true,
        });

        const redirectTo = sessionStorage.getItem('nda_redirect_after') || '/';
        sessionStorage.removeItem('nda_redirect_after');
        navigate(redirectTo, { replace: true });
      } else {
        toast({
          title: 'error signing agreements',
          description: result.error || 'an error occurred. please try again.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('[SignNDA] Unexpected error:', error);
      if (isMountedRef.current) {
        toast({
          title: 'error',
          description: 'an unexpected error occurred. please try again.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } finally {
      if (isMountedRef.current) setIsSubmitting(false);
    }
  }, [
    location.hash,
    location.pathname,
    location.search,
    navigate,
    revalidateSession,
    session?.access_token,
    signerName,
    toast,
    userEmail,
    userId,
    validateForm,
    isSubmitting,
  ]);

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
      {/* ═══ Common Header ═══ */}
      <HushhTechHeader />

      <main className="px-6 flex-grow max-w-md mx-auto w-full pb-32">
        {/* ── Icon + Title ── */}
        <section className="pt-12 pb-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-hushh-blue flex items-center justify-center">
            <span
              className="material-symbols-outlined text-white text-3xl"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 500" }}
            >
              gavel
            </span>
          </div>
          <h1
            className="text-[2.5rem] leading-[1.1] font-normal text-black tracking-tight font-serif"
            style={playfair}
          >
            Investor<br />
            <span className="text-gray-400 italic font-light">Agreements</span>
          </h1>
          <p className="text-gray-500 text-sm font-light mt-3 leading-relaxed">
            Review the NDA, download the fund documents, and sign to access
            confidential investment materials.
          </p>
        </section>

        {/* ── Security Badge ── */}
        <section className="mb-8">
          <div className="flex items-center justify-center gap-2 py-3 px-4 border border-gray-200 bg-gray-50">
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

        {/* ── Step indicator ── */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-black text-white text-xs flex items-center justify-center font-semibold">1</span>
            <span className="text-xs font-medium text-black">NDA</span>
          </div>
          <div className="flex-1 h-px bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-black text-white text-xs flex items-center justify-center font-semibold">2</span>
            <span className="text-xs font-medium text-black">Fund Docs</span>
          </div>
          <div className="flex-1 h-px bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-black text-white text-xs flex items-center justify-center font-semibold">3</span>
            <span className="text-xs font-medium text-black">Sign</span>
          </div>
        </div>

        {/* ═══ STEP 1: NDA Agreement Terms ═══ */}
        <section className="mb-10">
          <h3 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase mb-4 font-medium">
            Step 1 · Non-Disclosure Agreement
          </h3>
          <div className="border border-gray-200 bg-white">
            <div className="max-h-80 overflow-y-auto p-5 space-y-5 scrollbar-thin">
              <p className="text-sm font-bold text-black uppercase tracking-wide">
                mutual non-disclosure agreement
              </p>
              <p className="text-sm text-gray-500 leading-relaxed">
                This Non-Disclosure Agreement ("Agreement") is entered into between
                Hushh Technologies LLC ("Hushh") and the undersigned party ("Recipient").
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

        {/* ═══ STEP 2: Fund Documents ═══ */}
        <section className="mb-10">
          <h3 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase mb-2 font-medium">
            Step 2 · Fund Documents
          </h3>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Download and review each document. Check the box to confirm you have reviewed it.
          </p>

          <div className="space-y-3">
            {FUND_DOCUMENTS.map((doc) => {
              const isChecked = docAcknowledged[doc.id];
              return (
                <div
                  key={doc.id}
                  className={`border rounded-xl p-4 transition-all ${
                    isChecked
                      ? 'border-green-300 bg-green-50/50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* Top row: icon + name + actions */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <span
                        className="material-symbols-outlined text-gray-600 text-xl"
                        style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                      >
                        description
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-black leading-tight">
                        {doc.name}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                        {doc.description}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={() => handleReadDocument(doc.url, doc.name)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-[11px] font-medium hover:border-gray-300 hover:bg-gray-50 transition-colors"
                        aria-label={`Read ${doc.name}`}
                        tabIndex={0}
                      >
                        <span className="material-symbols-outlined text-sm">menu_book</span>
                        Read
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(doc.url, `${doc.fullName}.docx`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white text-[11px] font-medium hover:bg-black/80 transition-colors"
                        aria-label={`Download ${doc.name}`}
                        tabIndex={0}
                      >
                        <span className="material-symbols-outlined text-sm">download</span>
                        Download
                      </button>
                    </div>
                  </div>

                  {/* Acknowledge checkbox */}
                  <label className="flex items-center gap-2.5 cursor-pointer pl-1">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleDocToggle(doc.id)}
                      className="w-4 h-4 accent-green-600 shrink-0"
                    />
                    <span className={`text-xs leading-relaxed ${isChecked ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                      {isChecked ? 'Reviewed ✓' : 'I have downloaded and reviewed this document'}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>

          {/* Progress indicator */}
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-300"
                style={{
                  width: `${(FUND_DOCUMENTS.filter((d) => docAcknowledged[d.id]).length / FUND_DOCUMENTS.length) * 100}%`,
                }}
              />
            </div>
            <span className="text-[10px] text-gray-400 font-medium shrink-0">
              {FUND_DOCUMENTS.filter((d) => docAcknowledged[d.id]).length}/{FUND_DOCUMENTS.length} reviewed
            </span>
          </div>
        </section>

        {/* ═══ STEP 3: Digital Signature ═══ */}
        <section className="mb-8">
          <h3 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase mb-4 font-medium">
            Step 3 · Digital Signature
          </h3>

          {/* Name input */}
          <div className="border border-gray-200 mb-2">
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
              <p className="px-4 py-2 text-xs text-red-600 font-medium">{nameError}</p>
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
                  Agreement. I acknowledge that I have reviewed all fund documents and
                  that this constitutes my legal electronic signature.
                </span>
              </label>
            </div>
            {termsError && (
              <p className="px-4 py-2 text-xs text-red-600 font-medium">{termsError}</p>
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

        {/* ── Validation hint when not ready ── */}
        {!canSubmit && signerName.trim().length >= 2 && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700 leading-relaxed">
              {!allDocsAcknowledged && '⚠ Please acknowledge all fund documents above. '}
              {!agreedToTerms && '⚠ Please agree to the NDA terms.'}
            </p>
          </div>
        )}

        {/* ── CTA — Sign & Continue ── */}
        <section className="space-y-3 mb-8">
          <HushhTechCta
            variant={HushhTechCtaVariant.BLACK}
            onClick={handleSignNDA}
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Signing...' : 'Sign & Continue'}
          </HushhTechCta>
        </section>

        {/* ── Legal Footer ── */}
        <p className="text-[11px] leading-[16px] text-gray-400 text-center font-light">
          By signing, you agree that your digital signature has the same legal validity
          as a handwritten signature under applicable electronic signature laws.
          You also confirm that you have reviewed all fund offering documents.
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

      {/* ═══ Common Footer ═══ */}
      <HushhTechFooter />
    </div>
  );
};

export default SignNDAPage;
