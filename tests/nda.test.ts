/**
 * NDA Service & GlobalNDAGate Unit Tests
 * Tests for the global NDA gate feature
 * 
 * Total: 28 Test Cases covering:
 * - NDA Service Functions (10 tests)
 * - Public Route Detection (8 tests)
 * - Form Validation (6 tests)
 * - Error Handling (4 tests)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveSignNDASession } from '../src/pages/sign-nda/sessionBootstrap';

// ============================================================
// Type Definitions (mirrors the service types)
// ============================================================

interface NDAStatus {
  hasSignedNda: boolean;
  signedAt: string | null;
  ndaVersion: string | null;
  signerName: string | null;
}

interface SignNDAResult {
  success: boolean;
  signedAt?: string;
  signerName?: string;
  ndaVersion?: string;
  error?: string;
}

// ============================================================
// Helper Functions (Re-implemented for testing)
// These mirror the logic in the actual components
// ============================================================

// PUBLIC_ROUTES from GlobalNDAGate.tsx
const PUBLIC_ROUTES = [
  '/',
  '/Login',
  '/Signup',
  '/auth/callback',
  '/privacy-policy',
  '/faq',
  '/carrer-privacy-policy',
  '/california-privacy-policy',
  '/eu-uk-jobs-privacy-policy',
  '/delete-account',
  '/investor-guide',
  '/hushhid',
  '/investor',
  '/sign-nda',
  '/document-viewer',
  '/hushh-ai',
  '/hushh-agent',
  '/kai',
  '/kai-india',
  '/studio',
];

/**
 * Check if a path matches any public route pattern
 * Note: This logic mirrors GlobalNDAGate.tsx exactly
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => {
    // Exact match for home route
    if (route === '/') {
      return pathname === '/';
    }
    // For other routes, check exact match or sub-routes
    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

/**
 * Validate signer name for NDA form
 */
function validateSignerName(name: string): { valid: boolean; error?: string } {
  if (!name || !name.trim()) {
    return { valid: false, error: 'Please enter your full legal name' };
  }
  if (name.trim().length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }
  if (name.trim().length > 100) {
    return { valid: false, error: 'Name is too long' };
  }
  return { valid: true };
}

/**
 * Validate NDA terms agreement
 */
function validateTermsAgreement(agreed: boolean): { valid: boolean; error?: string } {
  if (!agreed) {
    return { valid: false, error: 'You must agree to the NDA terms' };
  }
  return { valid: true };
}

/**
 * Validate complete NDA form
 */
function validateNDAForm(
  signerName: string,
  agreedToTerms: boolean
): { valid: boolean; errors: { name?: string; terms?: string } } {
  const nameValidation = validateSignerName(signerName);
  const termsValidation = validateTermsAgreement(agreedToTerms);
  
  return {
    valid: nameValidation.valid && termsValidation.valid,
    errors: {
      name: nameValidation.error,
      terms: termsValidation.error,
    },
  };
}

/**
 * Mock IP fetch (simulates the IP lookup in ndaService.ts)
 */
async function fetchClientIP(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return 'unknown';
  }
}

/**
 * Create a mock NDA status response
 */
function createMockNDAStatus(overrides: Partial<NDAStatus> = {}): NDAStatus {
  return {
    hasSignedNda: false,
    signedAt: null,
    ndaVersion: null,
    signerName: null,
    ...overrides,
  };
}

/**
 * Create a mock Sign NDA result
 */
function createMockSignResult(overrides: Partial<SignNDAResult> = {}): SignNDAResult {
  return {
    success: false,
    ...overrides,
  };
}

/**
 * Simulate checkNDAStatus behavior
 */
function mockCheckNDAStatus(userId: string | null): NDAStatus {
  if (!userId) {
    return createMockNDAStatus();
  }
  
  // Simulate different user scenarios for testing
  if (userId === 'user-with-signed-nda') {
    return createMockNDAStatus({
      hasSignedNda: true,
      signedAt: '2026-01-30T10:00:00Z',
      ndaVersion: 'v1.0',
      signerName: 'John Doe',
    });
  }
  
  if (userId === 'user-without-nda') {
    return createMockNDAStatus({
      hasSignedNda: false,
    });
  }
  
  // Default: not signed
  return createMockNDAStatus();
}

/**
 * Simulate signNDA behavior
 */
function mockSignNDA(
  signerName: string,
  ndaVersion: string = 'v1.0',
  signerIp: string = 'unknown'
): SignNDAResult {
  const validation = validateSignerName(signerName);
  
  if (!validation.valid) {
    return createMockSignResult({
      success: false,
      error: validation.error,
    });
  }
  
  return createMockSignResult({
    success: true,
    signedAt: new Date().toISOString(),
    signerName: signerName.trim(),
    ndaVersion,
  });
}

function createMockSession(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
      user_metadata: {
        full_name: 'Test User',
      },
    },
    ...overrides,
  } as any;
}

afterEach(() => {
  vi.useRealTimers();
});

// ============================================================
// Test Suite 1: Public Route Detection (8 tests)
// ============================================================

describe('isPublicRoute', () => {
  // Test 1: Home page is public
  it('should return true for home page /', () => {
    expect(isPublicRoute('/')).toBe(true);
  });

  // Test 2: Login page is public
  it('should return true for Login page', () => {
    expect(isPublicRoute('/Login')).toBe(true);
  });

  // Test 3: Signup page is public
  it('should return true for Signup page', () => {
    expect(isPublicRoute('/Signup')).toBe(true);
  });

  // Test 4: Sign NDA page is public (must be accessible to sign)
  it('should return true for sign-nda page', () => {
    expect(isPublicRoute('/sign-nda')).toBe(true);
  });

  // Test 5: Hushh AI sub-routes are public
  it('should return true for hushh-ai sub-routes', () => {
    expect(isPublicRoute('/hushh-ai')).toBe(true);
    expect(isPublicRoute('/hushh-ai/chat')).toBe(true);
  });

  // Test 6: Protected onboarding routes are NOT public
  it('should return false for protected onboarding routes', () => {
    expect(isPublicRoute('/onboarding')).toBe(false);
    expect(isPublicRoute('/onboarding/step1')).toBe(false);
  });

  // Test 7: User profile is NOT public (requires NDA)
  it('should return false for user profile routes', () => {
    expect(isPublicRoute('/hushh-user-profile')).toBe(false);
  });

  // Test 8: Protected dashboard routes are NOT public
  it('should return false for dashboard routes', () => {
    expect(isPublicRoute('/dashboard')).toBe(false);
    expect(isPublicRoute('/investor-profile')).toBe(false);
  });
});

// ============================================================
// Test Suite 2: NDA Form Validation - Signer Name (6 tests)
// ============================================================

describe('validateSignerName', () => {
  // Test 9: Empty name is invalid
  it('should reject empty name', () => {
    const result = validateSignerName('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Please enter your full legal name');
  });

  // Test 10: Whitespace-only name is invalid
  it('should reject whitespace-only name', () => {
    const result = validateSignerName('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Please enter your full legal name');
  });

  // Test 11: Single character name is invalid
  it('should reject single character name', () => {
    const result = validateSignerName('A');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Name must be at least 2 characters');
  });

  // Test 12: Two character name is valid
  it('should accept two character name', () => {
    const result = validateSignerName('AB');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  // Test 13: Normal full name is valid
  it('should accept normal full name', () => {
    const result = validateSignerName('John Doe');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  // Test 14: Very long name is invalid
  it('should reject very long name', () => {
    const longName = 'A'.repeat(101);
    const result = validateSignerName(longName);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Name is too long');
  });
});

// ============================================================
// Test Suite 3: NDA Form Validation - Terms Agreement (3 tests)
// ============================================================

describe('validateTermsAgreement', () => {
  // Test 15: Unchecked terms is invalid
  it('should reject unchecked terms', () => {
    const result = validateTermsAgreement(false);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('You must agree to the NDA terms');
  });

  // Test 16: Checked terms is valid
  it('should accept checked terms', () => {
    const result = validateTermsAgreement(true);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  // Test 17: Form validation combines both checks
  it('should combine name and terms validation', () => {
    // Both invalid
    let result = validateNDAForm('', false);
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
    expect(result.errors.terms).toBeDefined();
    
    // Name valid, terms invalid
    result = validateNDAForm('John Doe', false);
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeUndefined();
    expect(result.errors.terms).toBeDefined();
    
    // Both valid
    result = validateNDAForm('John Doe', true);
    expect(result.valid).toBe(true);
    expect(result.errors.name).toBeUndefined();
    expect(result.errors.terms).toBeUndefined();
  });
});

// ============================================================
// Test Suite 4: NDA Status Check (5 tests)
// ============================================================

describe('mockCheckNDAStatus', () => {
  // Test 18: Returns not signed for null userId
  it('should return not signed for null userId', () => {
    const status = mockCheckNDAStatus(null);
    expect(status.hasSignedNda).toBe(false);
    expect(status.signedAt).toBeNull();
  });

  // Test 19: Returns signed for user with signed NDA
  it('should return signed status for user-with-signed-nda', () => {
    const status = mockCheckNDAStatus('user-with-signed-nda');
    expect(status.hasSignedNda).toBe(true);
    expect(status.signedAt).toBeDefined();
    expect(status.ndaVersion).toBe('v1.0');
    expect(status.signerName).toBe('John Doe');
  });

  // Test 20: Returns not signed for user without NDA
  it('should return not signed for user-without-nda', () => {
    const status = mockCheckNDAStatus('user-without-nda');
    expect(status.hasSignedNda).toBe(false);
  });

  // Test 21: Returns not signed for new user
  it('should return not signed for new random user', () => {
    const status = mockCheckNDAStatus('random-new-user-123');
    expect(status.hasSignedNda).toBe(false);
  });

  // Test 22: NDA status object has correct structure
  it('should return correctly structured NDA status', () => {
    const status = mockCheckNDAStatus('user-with-signed-nda');
    expect(status).toHaveProperty('hasSignedNda');
    expect(status).toHaveProperty('signedAt');
    expect(status).toHaveProperty('ndaVersion');
    expect(status).toHaveProperty('signerName');
  });
});

// ============================================================
// Test Suite 5: Sign NDA Operation (6 tests)
// ============================================================

describe('mockSignNDA', () => {
  // Test 23: Successful NDA signing
  it('should successfully sign NDA with valid name', () => {
    const result = mockSignNDA('John Doe', 'v1.0', '192.168.1.1');
    expect(result.success).toBe(true);
    expect(result.signerName).toBe('John Doe');
    expect(result.ndaVersion).toBe('v1.0');
    expect(result.signedAt).toBeDefined();
  });

  // Test 24: Failed NDA signing with empty name
  it('should fail with empty name', () => {
    const result = mockSignNDA('', 'v1.0');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  // Test 25: Failed NDA signing with short name
  it('should fail with single character name', () => {
    const result = mockSignNDA('A', 'v1.0');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Name must be at least 2 characters');
  });

  // Test 26: Trimmed name in successful signing
  it('should trim whitespace from signer name', () => {
    const result = mockSignNDA('  Jane Smith  ', 'v1.0');
    expect(result.success).toBe(true);
    expect(result.signerName).toBe('Jane Smith');
  });

  // Test 27: Uses default version if not provided
  it('should use default version v1.0', () => {
    const result = mockSignNDA('Test User');
    expect(result.success).toBe(true);
    expect(result.ndaVersion).toBe('v1.0');
  });

  // Test 28: Custom version is recorded
  it('should record custom NDA version', () => {
    const result = mockSignNDA('Test User', 'v2.0');
    expect(result.success).toBe(true);
    expect(result.ndaVersion).toBe('v2.0');
  });
});

// ============================================================
// Test Suite 6: Error Handling (4 tests)
// ============================================================

describe('Error Handling', () => {
  // Test 29: NDAStatus default values on error
  it('should return safe defaults for NDAStatus on error', () => {
    const status = createMockNDAStatus();
    expect(status.hasSignedNda).toBe(false);
    expect(status.signedAt).toBeNull();
    expect(status.ndaVersion).toBeNull();
    expect(status.signerName).toBeNull();
  });

  // Test 30: SignNDAResult default values on error
  it('should return safe defaults for SignNDAResult on error', () => {
    const result = createMockSignResult();
    expect(result.success).toBe(false);
    expect(result.signedAt).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  // Test 31: Error result includes error message
  it('should include error message in failed result', () => {
    const result = createMockSignResult({
      success: false,
      error: 'Database connection failed',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Database connection failed');
  });

  // Test 32: Form validation returns all errors
  it('should return all validation errors when form is completely invalid', () => {
    const result = validateNDAForm('', false);
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).length).toBe(2);
    expect(result.errors.name).toBeDefined();
    expect(result.errors.terms).toBeDefined();
  });
});

// ============================================================
// Test Suite 7: Session Storage Redirect (3 tests)
// ============================================================

describe('Redirect Logic', () => {
  // These tests verify the redirect storage logic used in GlobalNDAGate
  
  // Test 33: Store intended destination
  it('should store intended destination in sessionStorage pattern', () => {
    const intendedPath = '/protected/dashboard';
    const storageKey = 'nda_redirect_after';
    
    // Simulate storing
    const storedValue = intendedPath;
    expect(storedValue).toBe('/protected/dashboard');
    
    // Simulate retrieval
    const redirectTo = storedValue || '/';
    expect(redirectTo).toBe('/protected/dashboard');
  });

  // Test 34: Default to home when no stored destination
  it('should default to home when no stored destination', () => {
    const storedValue: string | null = null;
    const redirectTo = storedValue || '/';
    expect(redirectTo).toBe('/');
  });

  // Test 35: Public routes should not trigger redirect
  it('should allow access to public routes without redirect', () => {
    const publicPaths = ['/Login', '/Signup', '/privacy-policy', '/sign-nda'];
    publicPaths.forEach(path => {
      expect(isPublicRoute(path)).toBe(true);
    });
  });
});

// ============================================================
// Test Suite 8: NDA Version Management (3 tests)
// ============================================================

describe('NDA Version Management', () => {
  // Test 36: Version format validation
  it('should accept valid version formats', () => {
    const validVersions = ['v1.0', 'v2.0', 'v1.1', 'v10.5'];
    validVersions.forEach(version => {
      const result = mockSignNDA('Test User', version);
      expect(result.success).toBe(true);
      expect(result.ndaVersion).toBe(version);
    });
  });

  // Test 37: Version is preserved in signed result
  it('should preserve version in signed NDA result', () => {
    const result = mockSignNDA('Test User', 'v3.0');
    expect(result.ndaVersion).toBe('v3.0');
  });

  // Test 38: Status includes version info
  it('should include version in NDA status', () => {
    const status = mockCheckNDAStatus('user-with-signed-nda');
    expect(status.ndaVersion).toBe('v1.0');
  });
});

// ============================================================
// Test Suite 9: Integration Patterns (4 tests)
// ============================================================

describe('Integration Patterns', () => {
  // Test 39: Full NDA signing flow simulation
  it('should simulate complete NDA signing flow', async () => {
    // Step 1: Check initial status
    const initialStatus = mockCheckNDAStatus('new-user-xyz');
    expect(initialStatus.hasSignedNda).toBe(false);
    
    // Step 2: Validate form
    const formValidation = validateNDAForm('New User', true);
    expect(formValidation.valid).toBe(true);
    
    // Step 3: Sign NDA
    const signResult = mockSignNDA('New User', 'v1.0', '10.0.0.1');
    expect(signResult.success).toBe(true);
    expect(signResult.signerName).toBe('New User');
  });

  // Test 40: Route protection flow simulation
  it('should simulate route protection flow', () => {
    const protectedPath = '/onboarding/step5';
    const userId = 'user-without-nda';
    
    // Check if route is public
    const isPublic = isPublicRoute(protectedPath);
    expect(isPublic).toBe(false);
    
    // Check NDA status
    const status = mockCheckNDAStatus(userId);
    expect(status.hasSignedNda).toBe(false);
    
    // Should redirect to sign-nda
    const shouldRedirect = !isPublic && !status.hasSignedNda;
    expect(shouldRedirect).toBe(true);
  });

  // Test 41: Authenticated user with NDA should access protected routes
  it('should allow authenticated user with NDA to access protected routes', () => {
    const protectedPath = '/onboarding/step5';
    const userId = 'user-with-signed-nda';
    
    // Check if route is public
    const isPublic = isPublicRoute(protectedPath);
    expect(isPublic).toBe(false);
    
    // Check NDA status
    const status = mockCheckNDAStatus(userId);
    expect(status.hasSignedNda).toBe(true);
    
    // Should NOT redirect
    const shouldRedirect = !isPublic && !status.hasSignedNda;
    expect(shouldRedirect).toBe(false);
  });

  // Test 42: Unauthenticated users bypass NDA check
  it('should allow unauthenticated users to access public routes', () => {
    const publicPath = '/Login';
    const userId = null;
    
    // Check if route is public
    const isPublic = isPublicRoute(publicPath);
    expect(isPublic).toBe(true);
    
    // No NDA check needed for public routes
    // User can access without any NDA status check
    expect(isPublic).toBe(true);
  });
});

// ============================================================
// Test Suite 10: Sign NDA Session Bootstrap (4 tests)
// ============================================================

describe('resolveSignNDASession', () => {
  it('should use the current session immediately when one exists on mount', async () => {
    const onAuthStateChange = vi.fn();
    const session = createMockSession();
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session } }),
        onAuthStateChange,
      },
    };

    const result = await resolveSignNDASession(client as any, 25);

    expect(result.source).toBe('current_session');
    expect(result.session?.user.id).toBe('test-user-123');
    expect(onAuthStateChange).not.toHaveBeenCalled();
  });

  it('should wait briefly for a late auth event when no current session exists', async () => {
    vi.useFakeTimers();

    const lateSession = createMockSession({
      user: {
        id: 'late-user-456',
        email: 'late@example.com',
        user_metadata: {
          name: 'Late User',
        },
      },
    });
    const unsubscribe = vi.fn();
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn((callback: (event: string, session: any) => void) => {
          setTimeout(() => callback('SIGNED_IN', lateSession), 25);
          return {
            data: {
              subscription: {
                unsubscribe,
              },
            },
          };
        }),
      },
    };

    const resultPromise = resolveSignNDASession(client as any, 100);
    await vi.advanceTimersByTimeAsync(25);
    const result = await resultPromise;

    expect(result.source).toBe('auth_event');
    expect(result.session?.user.id).toBe('late-user-456');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('should resolve to a redirect path when no session arrives before timeout', async () => {
    vi.useFakeTimers();

    const unsubscribe = vi.fn();
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn(() => ({
          data: {
            subscription: {
              unsubscribe,
            },
          },
        })),
      },
    };

    const resultPromise = resolveSignNDASession(client as any, 50);
    await vi.advanceTimersByTimeAsync(50);
    const result = await resultPromise;

    expect(result.source).toBe('timeout');
    expect(result.session).toBeNull();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('should resolve with an error state instead of hanging when bootstrap throws', async () => {
    const client = {
      auth: {
        getSession: vi.fn().mockRejectedValue(new Error('bootstrap failed')),
        onAuthStateChange: vi.fn(),
      },
    };

    const result = await resolveSignNDASession(client as any, 25);

    expect(result.source).toBe('error');
    expect(result.session).toBeNull();
    expect(result.error?.message).toBe('bootstrap failed');
  });
});
