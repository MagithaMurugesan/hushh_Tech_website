/**
 * Email Login Modal Component for Hushh Agent
 * 
 * Beautiful modal for email OTP authentication
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Icon,
  Box,
  PinInput,
  PinInputField,
  useToast,
  Spinner,
  Heading,
  Divider,
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMail, FiArrowLeft, FiCheck, FiLock, FiShield } from 'react-icons/fi';
import { useEmailAuth } from '../hooks/useEmailAuth';

const MotionBox = motion(Box);

interface EmailLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
}

export const EmailLoginModal: React.FC<EmailLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const toast = useToast();
  const {
    sendOTP,
    verifyOTP,
    isSendingOTP,
    isVerifying,
    error,
    otpSent,
    clearError,
  } = useEmailAuth();

  // Local state
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setOtp('');
      setStep('email');
      clearError();
    }
  }, [isOpen, clearError]);

  // Focus email input when modal opens
  useEffect(() => {
    if (isOpen && step === 'email') {
      setTimeout(() => emailInputRef.current?.focus(), 100);
    }
  }, [isOpen, step]);

  // Auto-advance when OTP is sent
  useEffect(() => {
    if (otpSent && step === 'email') {
      setStep('otp');
    }
  }, [otpSent, step]);

  // Handle send OTP
  const handleSendOTP = async () => {
    if (!email || !email.includes('@')) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    const success = await sendOTP(email);
    if (success) {
      toast({
        title: 'OTP Sent! 📧',
        description: `Check your inbox at ${email}`,
        status: 'success',
        duration: 4000,
      });
    }
  };

  // Handle verify OTP
  const handleVerifyOTP = async (otpValue: string) => {
    if (otpValue.length !== 6) return;

    const success = await verifyOTP(email, otpValue);
    if (success) {
      toast({
        title: 'Welcome! 🎉',
        description: 'You are now logged in',
        status: 'success',
        duration: 3000,
      });
      onLoginSuccess?.();
      onClose();
    }
  };

  // Handle OTP change
  const handleOtpChange = (value: string) => {
    setOtp(value);
    if (value.length === 6) {
      handleVerifyOTP(value);
    }
  };

  // Go back to email step
  const handleBack = () => {
    setStep('email');
    setOtp('');
    clearError();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isCentered
      size="md"
      motionPreset="slideInBottom"
    >
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(10px)" />
      <ModalContent
        bg="linear-gradient(145deg, #1a1a2e 0%, #16213e 100%)"
        borderRadius="24px"
        border="1px solid"
        borderColor="whiteAlpha.200"
        overflow="hidden"
        mx={4}
      >
        <ModalCloseButton color="white" zIndex={10} />
        
        <ModalBody py={8} px={6}>
          <AnimatePresence mode="wait">
            {step === 'email' ? (
              <MotionBox
                key="email-step"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <VStack spacing={6} align="stretch">
                  {/* Header */}
                  <VStack spacing={2} textAlign="center">
                    <Box
                      bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                      p={4}
                      borderRadius="full"
                      mb={2}
                    >
                      <Icon as={FiMail} boxSize={8} color="white" />
                    </Box>
                    <Heading size="lg" color="white" fontWeight="600">
                      Sign In
                    </Heading>
                    <Text color="gray.400" fontSize="sm">
                      Enter your email to receive a verification code
                    </Text>
                  </VStack>

                  {/* Email Input */}
                  <Box>
                    <Text color="gray.400" fontSize="xs" mb={2} fontWeight="500">
                      EMAIL ADDRESS
                    </Text>
                    <Input
                      ref={emailInputRef}
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                      size="lg"
                      bg="whiteAlpha.100"
                      border="2px solid"
                      borderColor="whiteAlpha.200"
                      color="white"
                      _placeholder={{ color: 'gray.500' }}
                      _hover={{ borderColor: 'whiteAlpha.400' }}
                      _focus={{
                        borderColor: '#667eea',
                        boxShadow: '0 0 0 1px #667eea',
                      }}
                      borderRadius="12px"
                    />
                  </Box>

                  {/* Error Message */}
                  {error && (
                    <Text color="red.400" fontSize="sm" textAlign="center">
                      {error}
                    </Text>
                  )}

                  {/* Send OTP Button */}
                  <Button
                    size="lg"
                    bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                    color="white"
                    _hover={{
                      transform: 'translateY(-2px)',
                      boxShadow: '0 10px 20px rgba(102, 126, 234, 0.3)',
                    }}
                    _active={{ transform: 'scale(0.98)' }}
                    borderRadius="12px"
                    onClick={handleSendOTP}
                    isLoading={isSendingOTP}
                    loadingText="Sending..."
                    spinner={<Spinner size="sm" />}
                    fontWeight="600"
                    transition="all 0.2s"
                  >
                    Send Verification Code
                  </Button>

                  {/* Security Note */}
                  <HStack justify="center" spacing={2} opacity={0.6}>
                    <Icon as={FiShield} color="gray.500" boxSize={3} />
                    <Text color="gray.500" fontSize="xs">
                      Secure, passwordless authentication
                    </Text>
                  </HStack>
                </VStack>
              </MotionBox>
            ) : (
              <MotionBox
                key="otp-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <VStack spacing={6} align="stretch">
                  {/* Back Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<FiArrowLeft />}
                    color="gray.400"
                    _hover={{ color: 'white', bg: 'whiteAlpha.100' }}
                    alignSelf="flex-start"
                    onClick={handleBack}
                    isDisabled={isVerifying}
                  >
                    Back
                  </Button>

                  {/* Header */}
                  <VStack spacing={2} textAlign="center">
                    <Box
                      bg="linear-gradient(135deg, #11998e 0%, #38ef7d 100%)"
                      p={4}
                      borderRadius="full"
                      mb={2}
                    >
                      <Icon as={FiLock} boxSize={8} color="white" />
                    </Box>
                    <Heading size="lg" color="white" fontWeight="600">
                      Enter Code
                    </Heading>
                    <Text color="gray.400" fontSize="sm">
                      We sent a 6-digit code to
                    </Text>
                    <Text color="white" fontWeight="500" fontSize="sm">
                      {email}
                    </Text>
                  </VStack>

                  {/* OTP Input */}
                  <HStack justify="center" spacing={2}>
                    <PinInput
                      value={otp}
                      onChange={handleOtpChange}
                      size="lg"
                      otp
                      isDisabled={isVerifying}
                      autoFocus
                    >
                      {[...Array(6)].map((_, i) => (
                        <PinInputField
                          key={i}
                          bg="whiteAlpha.100"
                          border="2px solid"
                          borderColor="whiteAlpha.200"
                          color="white"
                          fontSize="xl"
                          fontWeight="bold"
                          _hover={{ borderColor: 'whiteAlpha.400' }}
                          _focus={{
                            borderColor: '#38ef7d',
                            boxShadow: '0 0 0 1px #38ef7d',
                          }}
                          borderRadius="12px"
                          w="48px"
                          h="56px"
                        />
                      ))}
                    </PinInput>
                  </HStack>

                  {/* Verifying State */}
                  {isVerifying && (
                    <HStack justify="center" spacing={2}>
                      <Spinner size="sm" color="green.400" />
                      <Text color="gray.400" fontSize="sm">
                        Verifying...
                      </Text>
                    </HStack>
                  )}

                  {/* Error Message */}
                  {error && (
                    <Text color="red.400" fontSize="sm" textAlign="center">
                      {error}
                    </Text>
                  )}

                  {/* Resend Link */}
                  <VStack spacing={2}>
                    <Divider borderColor="whiteAlpha.200" />
                    <HStack justify="center" spacing={1}>
                      <Text color="gray.500" fontSize="sm">
                        Didn't receive the code?
                      </Text>
                      <Button
                        variant="link"
                        color="#667eea"
                        fontSize="sm"
                        fontWeight="600"
                        onClick={handleSendOTP}
                        isDisabled={isSendingOTP}
                      >
                        Resend
                      </Button>
                    </HStack>
                  </VStack>

                  {/* Check Spam Note */}
                  <Text color="gray.600" fontSize="xs" textAlign="center">
                    Check your spam folder if you don't see it
                  </Text>
                </VStack>
              </MotionBox>
            )}
          </AnimatePresence>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default EmailLoginModal;
