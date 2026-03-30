import { Preferences } from '@capacitor/preferences';

import { isNativeApp } from '../../utils/platform';
import type { LocationCacheRecord, LocationData } from './types';

const LOCATION_CACHE_PREFIX = 'hushh:onboarding:location:v1';
const COORDINATE_PRECISION = 2;

const normalizeText = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

const roundCoordinate = (value: unknown): string => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return '';
  return num.toFixed(COORDINATE_PRECISION);
};

const isLocationData = (value: unknown): value is LocationData => {
  const record = value as Record<string, unknown> | null;
  return Boolean(
    record &&
    typeof record.country === 'string' &&
    typeof record.countryCode === 'string' &&
    typeof record.state === 'string' &&
    typeof record.stateCode === 'string' &&
    typeof record.city === 'string' &&
    typeof record.postalCode === 'string' &&
    typeof record.phoneDialCode === 'string' &&
    typeof record.timezone === 'string' &&
    typeof record.formattedAddress === 'string' &&
    typeof record.latitude === 'number' &&
    typeof record.longitude === 'number'
  );
};

export const getLocationCacheKey = (userId: string): string =>
  `${LOCATION_CACHE_PREFIX}:${userId}`;

export const buildLocationSignature = (location: Partial<LocationData>): string => {
  return [
    normalizeText(location.countryCode || location.country),
    normalizeText(location.stateCode || location.state),
    normalizeText(location.city),
    normalizeText(location.postalCode),
    roundCoordinate(location.latitude),
    roundCoordinate(location.longitude),
  ].join('|');
};

const normalizeCacheRecord = (value: unknown): LocationCacheRecord | null => {
  const record = value as Partial<LocationCacheRecord> | null;
  if (!record || !isLocationData(record.data)) return null;

  return {
    data: record.data,
    source: record.source === 'gps' ? 'gps' : 'ip',
    detectedAt:
      typeof record.detectedAt === 'string' && record.detectedAt
        ? record.detectedAt
        : new Date().toISOString(),
    lastCheckedAt:
      typeof record.lastCheckedAt === 'string' && record.lastCheckedAt
        ? record.lastCheckedAt
        : new Date().toISOString(),
    signature:
      typeof record.signature === 'string' && record.signature
        ? record.signature
        : buildLocationSignature(record.data),
  };
};

export const readLocationCache = async (
  userId: string
): Promise<LocationCacheRecord | null> => {
  const key = getLocationCacheKey(userId);

  try {
    if (isNativeApp()) {
      const { value } = await Preferences.get({ key });
      if (!value) return null;
      return normalizeCacheRecord(JSON.parse(value));
    }

    if (typeof globalThis.localStorage === 'undefined') return null;
    const raw = globalThis.localStorage.getItem(key);
    if (!raw) return null;
    return normalizeCacheRecord(JSON.parse(raw));
  } catch (error) {
    console.warn('[location cache] Failed to read shared cache:', error);
    return null;
  }
};

export const writeLocationCache = async (
  userId: string,
  record: LocationCacheRecord
): Promise<void> => {
  const key = getLocationCacheKey(userId);
  const payload = JSON.stringify(record);

  if (isNativeApp()) {
    await Preferences.set({ key, value: payload });
    return;
  }

  if (typeof globalThis.localStorage === 'undefined') return;
  globalThis.localStorage.setItem(key, payload);
};
