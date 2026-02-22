/**
 * Sign NDA Page — iOS-first grouped design
 *
 * UI: iOS grouped table style with white cards, section headers, inline form.
 * Backend: Auth lifecycle, NDA signing, PDF gen, notification — all preserved.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  VStack,
  Text,
  Button,
  Checkbox,
  Input,
  FormControl,
  FormErrorMessage,
  Flex,
  Spinner,
  HStack,
  useToast,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import config from '../../resources/config/config';
import { signNDA, sendNDANotification, generateNDAPdf, uploadSignedNDA } from '../../services/nda/ndaService';

const MotionBox = motion(Box);

/* iOS design tokens */
const IOS = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  primary: '#007AFF',
  primaryHover: '#0062CC',
  text: '#000000',
  secondary: '#8E8E93',
  tertiary: '#3C3C43',
  separator: 'rgba(60, 60, 67, 0.12)',
  destructive: '#FF3B30',
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
};

/* NDA terms data */
const NDA_SECTIONS = [
  {
    title: '1. Definition of Confidential Information',
    body: '"Confidential Information" means any non-public information disclosed by Hushh to the Recipient, including but not limited to: business strategies, financial information, investment strategies, fund performance data, technical specifications, proprietary algorithms, AI models, trade secrets, and any other information marked as confidential or that reasonably should be understood to be confidential.',
  },
  {
    title: '2. Obligations of the Recipient',
    body: 'The Recipient agrees to: (a) hold Confidential Information in strict confidence; (b) not disclose Confidential Information to any third party without prior written consent; (c) use Confidential Information solely for evaluating a potential relationship with Hushh; (d) take reasonable measures to protect the confidentiality of such information.',
  },
  {
    title: '3. Exceptions',
    body: 'This Agreement does not apply to information that: (a) is or becomes publicly available through no fault of the Recipient; (b) was known to the Recipient prior to disclosure; (c) is independently developed by the Recipient; (d) is disclosed pursuant to a court order or legal requirement.',
  },
  {
    title: '4. Term and Termination',
    body: 'This Agreement shall remain in effect for a period of three (3) years from the date of execution. The obligations of confidentiality shall survive the termination of this Agreement.',
  },
  {
    title: '5. Governing Law',
    body: 'This Agreement shall be governed by the laws of the State of Delaware, United States of America, without regard to its conflict of laws principles.',
  },
  {
    title: '6. Acknowledgment',
    body: 'By signing below, the Recipient acknowledges that they have read, understood, and agree to be bound by the terms of this Non-Disclosure Agreement. The Recipient further acknowledges that any breach of this Agreement may result in irreparable harm to Hushh and that Hushh shall be entitled to seek injunctive relief in addition to any other remedies available at law.',
  },
];

const SignNDAPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const isMountedRef = useRef(true);

  const [isLoading, setIsLoading] = useState(true);
  const [signerName, setSignerName] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [nameError, setNameError] = useState('');
  const [termsError, setTermsError] = useState('');

  /* Cleanup on unmount */
  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  /* Auth lifecycle: validate session + listen for changes */
  useEffect(() => {
    if (!config.supabaseClient) {
      if (isMountedRef.current) setIsLoading(false);
      return;
    }

    const {
      data: { subscription },
    } = config.supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (!isMountedRef.current) return;

      if (!session?.user) {
        navigate('/login', { replace: true });
        return;
      }

      setUserId(session.user.id);
      setUserEmail(session.user.email || null);

      const fullName =
        session.user.user_metadata?.full_name ||
        session.user.user_metadata?.name || '';
      if (fullName && !signerName) {
        setSignerName(fullName);
      }

      setIsLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, [navigate]);

  const validateForm = useCallback((): boolean => {
    let isValid = true;

    const trimmedName = signerName.trim();
    if (!trimmedName) {
      setNameError('Please enter your full legal name');
      isValid = false;
    } else if (trimmedName.length < 2) {
      setNameError('Name must be at least 2 characters');
      isValid = false;
    } else {
      setNameError('');
    }

    if (!agreedToTerms) {
      setTermsError('You must agree to the NDA terms');
      isValid = false;
    } else {
      setTermsError('');
    }

    return isValid;
  }, [signerName, agreedToTerms]);

  const handleSignNDA = useCallback(async () => {
    if (!validateForm()) return;
    if (isSubmitting) return;

    if (!config.supabaseClient || !userId) {
      toast({
        title: 'Session expired',
        description: 'Please log in again.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
      navigate('/login', { replace: true });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { session } } = await config.supabaseClient.auth.getSession();
      if (!session) {
        toast({
          title: 'Session expired',
          description: 'Your session has expired. Please log in again.',
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
        navigate('/login', { replace: true });
        return;
      }

      const accessToken = session.access_token;
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
        sendNDANotification(
          trimmedName,
          userEmail || 'unknown@email.com',
          result.signedAt || new Date().toISOString(),
          result.ndaVersion || 'v1.0',
          generatedPdfUrl,
          pdfBlob,
          userId
        ).catch((err) => console.error('[SignNDA] Notification failed:', err));

        toast({
          title: 'NDA Signed Successfully',
          description: 'Thank you for signing the Non-Disclosure Agreement.',
          status: 'success',
          duration: 4000,
          isClosable: true,
        });

        const redirectTo = sessionStorage.getItem('nda_redirect_after') || '/';
        sessionStorage.removeItem('nda_redirect_after');
        navigate(redirectTo, { replace: true });
      } else {
        toast({
          title: 'Error Signing NDA',
          description: result.error || 'An error occurred. Please try again.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('[SignNDA] Unexpected error:', error);
      if (isMountedRef.current) {
        toast({
          title: 'Error',
          description: 'An unexpected error occurred. Please try again.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } finally {
      if (isMountedRef.current) setIsSubmitting(false);
    }
  }, [validateForm, isSubmitting, userId, userEmail, signerName, navigate, toast]);

  /* Loading state */
  if (isLoading) {
    return (
      <Flex minH="100dvh" bg={IOS.bg} align="center" justify="center">
        <Spinner size="lg" color={IOS.primary} />
      </Flex>
    );
  }

  /* ─── RENDER ─── */
  return (
    <Box
      minH="100dvh"
      bg={IOS.bg}
      fontFamily={IOS.font}
      sx={{ WebkitFontSmoothing: 'antialiased' }}
    >
      <Box maxW="428px" mx="auto" pb={10}>
        <MotionBox
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* ═══ Header ═══ */}
          <VStack spacing={3} pt={12} pb={6} px={6} textAlign="center">
            {/* Icon */}
            <Flex
              w="64px" h="64px" borderRadius="18px"
              bg={IOS.primary} align="center" justify="center"
              boxShadow="0 4px 16px rgba(0,122,255,0.3)"
              mb={1}
            >
              <Text
                fontSize="30px" lineHeight="1" color="white"
                className="material-symbols-outlined"
                sx={{ fontVariationSettings: "'FILL' 1, 'wght' 500" }}
              >
                description
              </Text>
            </Flex>

            <Text
              fontSize="30px" lineHeight="36px" fontWeight="700"
              letterSpacing="-0.02em" color={IOS.text}
            >
              Non-Disclosure Agreement
            </Text>

            <Text
              fontSize="17px" lineHeight="22px" color={IOS.secondary}
              px={2}
            >
              Review and sign to access confidential investment materials.
            </Text>
          </VStack>

          {/* ═══ Security Badge ═══ */}
          <Box px={4} mb={6}>
            <HStack
              spacing={2} bg={IOS.card} borderRadius="12px"
              py={3} px={4} justify="center"
              boxShadow="0 1px 2px rgba(0,0,0,0.04)"
              border="0.5px solid" borderColor="rgba(0,0,0,0.05)"
            >
              <Text
                fontSize="18px" lineHeight="1" color={IOS.secondary}
                className="material-symbols-outlined"
                sx={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
              >
                lock
              </Text>
              <Text fontSize="13px" fontWeight="500" color={IOS.secondary}
                textTransform="uppercase" letterSpacing="0.04em"
              >
                Encrypted &amp; legally binding · GDPR compliant
              </Text>
            </HStack>
          </Box>

          {/* ═══ Agreement Terms ═══ */}
          <Box px={4} mb={6}>
            <Text
              pl={4} mb={2} fontSize="13px" fontWeight="500"
              color={IOS.secondary} textTransform="uppercase" letterSpacing="0.04em"
            >
              Agreement Terms
            </Text>

            <Box
              bg={IOS.card} borderRadius="20px" overflow="hidden"
              boxShadow="0 1px 2px rgba(0,0,0,0.04)"
              border="0.5px solid" borderColor="rgba(0,0,0,0.05)"
            >
              <Box
                maxH="320px" overflowY="auto" p={5}
                css={{
                  '&::-webkit-scrollbar': { width: '4px' },
                  '&::-webkit-scrollbar-track': { background: 'transparent' },
                  '&::-webkit-scrollbar-thumb': {
                    background: '#C1C1C1',
                    borderRadius: '10px',
                  },
                }}
              >
                <VStack align="stretch" spacing={5}>
                  <Text fontSize="14px" fontWeight="700" color={IOS.text}
                    textTransform="uppercase"
                  >
                    Mutual Non-Disclosure Agreement
                  </Text>

                  <Text fontSize="15px" lineHeight="22px" color={IOS.secondary}>
                    This Non-Disclosure Agreement (&quot;Agreement&quot;) is entered into between
                    Hushh Technologies LLC (&quot;Hushh&quot;) and the undersigned party (&quot;Recipient&quot;).
                  </Text>

                  {NDA_SECTIONS.map((section) => (
                    <Box key={section.title}>
                      <Text
                        color={IOS.primary} fontSize="13px" fontWeight="600"
                        textTransform="uppercase" letterSpacing="0.02em" mb={1}
                      >
                        {section.title}
                      </Text>
                      <Text fontSize="15px" lineHeight="22px" color={IOS.secondary}>
                        {section.body}
                      </Text>
                    </Box>
                  ))}
                </VStack>
              </Box>
            </Box>
          </Box>

          {/* ═══ Digital Signature ═══ */}
          <Box px={4} mb={6}>
            <Text
              pl={4} mb={2} fontSize="13px" fontWeight="500"
              color={IOS.secondary} textTransform="uppercase" letterSpacing="0.04em"
            >
              Digital Signature
            </Text>

            <Box
              bg={IOS.card} borderRadius="20px" overflow="hidden"
              boxShadow="0 1px 2px rgba(0,0,0,0.04)"
              border="0.5px solid" borderColor="rgba(0,0,0,0.05)"
            >
              {/* Name input — iOS Settings inline style */}
              <FormControl isInvalid={!!nameError}>
                <Flex
                  align="center" px={4} py={3.5}
                  borderBottom="0.5px solid" borderColor={IOS.separator}
                >
                  <Text fontSize="17px" color={IOS.text} flexShrink={0} mr={4}>
                    Full Legal Name
                  </Text>
                  <Input
                    value={signerName}
                    onChange={(e) => {
                      setSignerName(e.target.value);
                      if (nameError) setNameError('');
                    }}
                    placeholder="Required"
                    variant="unstyled"
                    textAlign="right"
                    fontSize="17px"
                    fontWeight="500"
                    color={IOS.primary}
                    _placeholder={{ color: '#C7C7CC' }}
                    flex="1"
                  />
                </Flex>
                {nameError && (
                  <Box px={4} py={2}>
                    <FormErrorMessage mt={0}>{nameError}</FormErrorMessage>
                  </Box>
                )}
              </FormControl>

              {/* Agreement checkbox */}
              <FormControl isInvalid={!!termsError}>
                <Box
                  px={4} py={3.5}
                  bg={agreedToTerms ? 'rgba(0,122,255,0.04)' : 'rgba(242,242,247,0.5)'}
                  transition="background 0.2s"
                >
                  <Checkbox
                    isChecked={agreedToTerms}
                    onChange={(e) => {
                      setAgreedToTerms(e.target.checked);
                      if (termsError) setTermsError('');
                    }}
                    colorScheme="blue"
                    size="lg"
                    sx={{
                      '[data-checked] > span:first-of-type': {
                        bg: IOS.primary,
                        borderColor: IOS.primary,
                      },
                    }}
                  >
                    <Text fontSize="14px" lineHeight="20px" color={IOS.secondary}>
                      I have read, understood, and agree to the terms of this Non-Disclosure
                      Agreement. I acknowledge that this constitutes my legal electronic signature.
                    </Text>
                  </Checkbox>
                </Box>
                {termsError && (
                  <Box px={4} py={2}>
                    <Text color={IOS.destructive} fontSize="12px" fontWeight="500">
                      {termsError}
                    </Text>
                  </Box>
                )}
              </FormControl>
            </Box>

            {/* Signing as info */}
            {userEmail && (
              <HStack spacing={1.5} justify="center" mt={3}>
                <Text
                  fontSize="16px" lineHeight="1" color={IOS.secondary}
                  className="material-symbols-outlined"
                  sx={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                >
                  person
                </Text>
                <Text fontSize="13px" color={IOS.secondary}>
                  Signing as{' '}
                  <Text as="span" color={IOS.text} fontWeight="600">
                    {userEmail}
                  </Text>
                </Text>
              </HStack>
            )}
          </Box>

          {/* ═══ Submit Button ═══ */}
          <Box px={4} mb={4}>
            <Button
              onClick={handleSignNDA}
              isLoading={isSubmitting}
              loadingText="Signing..."
              width="full"
              bg={IOS.primary}
              color="white"
              _hover={{ bg: IOS.primaryHover }}
              _active={{ opacity: 0.85, transform: 'scale(0.98)' }}
              isDisabled={!agreedToTerms || !signerName.trim() || isSubmitting}
              borderRadius="14px"
              fontWeight="600"
              h="52px"
              fontSize="17px"
              transition="all 0.2s"
            >
              Sign &amp; Continue
            </Button>
          </Box>

          {/* Footer */}
          <Text
            fontSize="11px" lineHeight="16px" textAlign="center"
            color={IOS.secondary} px={8} pb={6}
          >
            By signing, you agree that your digital signature has the same legal validity
            as a handwritten signature under applicable electronic signature laws.
          </Text>
        </MotionBox>
      </Box>
    </Box>
  );
};

export default SignNDAPage;
