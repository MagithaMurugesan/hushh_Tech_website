// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LocationCacheRecord, LocationData } from '../src/services/location/types';

const navigateMock = vi.fn();
const authGetUserMock = vi.fn();
const maybeSingleMock = vi.fn();
const fromMock = vi.fn(() => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: maybeSingleMock,
    })),
  })),
}));

const readSharedLocationCacheMock = vi.fn();
const getCachedLocationMock = vi.fn();
const refreshStep4LocationMock = vi.fn();
const cancelMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../src/resources/config/config', () => ({
  default: {
    supabaseClient: {
      auth: {
        getUser: (...args: unknown[]) => authGetUserMock(...args),
      },
      from: (...args: unknown[]) => fromMock(...args),
    },
  },
}));

vi.mock('../src/utils/useFooterVisibility', () => ({
  useFooterVisibility: () => true,
}));

vi.mock('../src/services/location', () => ({
  locationService: {
    readSharedLocationCache: (...args: unknown[]) => readSharedLocationCacheMock(...args),
    getCachedLocation: (...args: unknown[]) => getCachedLocationMock(...args),
    refreshStep4Location: (...args: unknown[]) => refreshStep4LocationMock(...args),
    cancel: (...args: unknown[]) => cancelMock(...args),
  },
  COUNTRY_CODE_TO_NAME: {
    US: 'United States',
    IN: 'India',
  },
}));

import {
  getTrustedStep4Countries,
  useStep4Logic,
} from '../src/pages/onboarding/step-4/logic';

const createLocationRecord = (
  data: LocationData,
  source: LocationCacheRecord['source'] = 'gps'
): LocationCacheRecord => ({
  data,
  source,
  detectedAt: '2026-03-30T10:00:00.000Z',
  lastCheckedAt: '2026-03-30T10:05:00.000Z',
  signature: `${data.countryCode}|${data.city}|${data.postalCode}`,
});

const indiaLocation = {
  country: 'India',
  countryCode: 'IN',
  state: 'Maharashtra',
  stateCode: 'MH',
  city: 'Mumbai',
  postalCode: '400001',
  phoneDialCode: '+91',
  timezone: 'Asia/Kolkata',
  formattedAddress: 'Mumbai, Maharashtra 400001, India',
  latitude: 19.076,
  longitude: 72.8777,
} satisfies LocationData;

const usLocation = {
  country: 'United States',
  countryCode: 'US',
  state: 'California',
  stateCode: 'CA',
  city: 'San Francisco',
  postalCode: '94105',
  phoneDialCode: '+1',
  timezone: 'America/Los_Angeles',
  formattedAddress: 'San Francisco, California 94105, United States',
  latitude: 37.7749,
  longitude: -122.4194,
} satisfies LocationData;

function Step4Harness() {
  const state = useStep4Logic();
  return React.createElement(
    'div',
    null,
    React.createElement('span', { 'data-testid': 'citizenship' }, state.citizenshipCountry),
    React.createElement('span', { 'data-testid': 'residence' }, state.residenceCountry),
    React.createElement('span', { 'data-testid': 'detected-location' }, state.detectedLocation),
    React.createElement('span', { 'data-testid': 'status' }, state.locationStatus)
  );
}

describe('Step 4 location refresh logic', () => {
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
    window.scrollTo = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    authGetUserMock.mockResolvedValue({ data: { user: { id: 'user-123' } } });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('prefills from shared cache immediately and auto-runs a fresh location refresh on mount', async () => {
    const cachedRecord = createLocationRecord(indiaLocation);
    maybeSingleMock.mockResolvedValue({
      data: {
        citizenship_country: 'United States',
        residence_country: 'United States',
        current_step: 3,
      },
    });
    readSharedLocationCacheMock.mockResolvedValue(cachedRecord);
    refreshStep4LocationMock.mockResolvedValue({
      cached: cachedRecord,
      fresh: cachedRecord,
      changed: false,
    });

    await act(async () => {
      root.render(React.createElement(Step4Harness));
    });
    await flush();

    expect(readSharedLocationCacheMock).toHaveBeenCalledWith('user-123');
    expect(refreshStep4LocationMock).toHaveBeenCalledWith('user-123');
    expect(container.querySelector('[data-testid="citizenship"]')?.textContent).toBe('');
    expect(container.querySelector('[data-testid="residence"]')?.textContent).toBe('');
    expect(container.querySelector('[data-testid="detected-location"]')?.textContent).toContain('Mumbai');
    expect(container.querySelector('[data-testid="status"]')?.textContent).toBe('success');
    expect(getCachedLocationMock).not.toHaveBeenCalled();
  });

  it('does not overwrite non-empty saved countries when the fresh location changes', async () => {
    const freshRecord = createLocationRecord(usLocation);
    maybeSingleMock.mockResolvedValue({
      data: {
        citizenship_country: 'India',
        residence_country: 'India',
        current_step: 5,
      },
    });
    readSharedLocationCacheMock.mockResolvedValue(null);
    getCachedLocationMock.mockResolvedValue(null);
    refreshStep4LocationMock.mockResolvedValue({
      cached: null,
      fresh: freshRecord,
      changed: true,
    });

    await act(async () => {
      root.render(React.createElement(Step4Harness));
    });
    await flush();

    expect(refreshStep4LocationMock).toHaveBeenCalledWith('user-123');
    expect(container.querySelector('[data-testid="citizenship"]')?.textContent).toBe('India');
    expect(container.querySelector('[data-testid="residence"]')?.textContent).toBe('India');
    expect(container.querySelector('[data-testid="detected-location"]')?.textContent).toContain('San Francisco');
    expect(container.querySelector('[data-testid="status"]')?.textContent).toBe('success');
  });

  it('ignores onboarding country defaults before Step 4 is actually reached', () => {
    expect(getTrustedStep4Countries({
      citizenship_country: 'United States',
      residence_country: 'United States',
      current_step: 3,
    })).toEqual({});

    expect(getTrustedStep4Countries({
      citizenship_country: 'India',
      residence_country: 'India',
      current_step: 4,
    })).toEqual({
      citizenship_country: 'India',
      residence_country: 'India',
    });
  });
});
