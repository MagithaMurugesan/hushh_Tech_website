import { COUNTRY_CODE_TO_NAME, COUNTRY_NAME_TO_CODE, type LocationData } from '../location';

export interface OnboardingPrefillValues {
  citizenship_country: string;
  residence_country: string;
  phone_number: string;
  phone_country_code: string;
  legal_first_name: string;
  legal_last_name: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  zip_code: string;
  address_country: string;
}

export interface OnboardingPrefillSources {
  onboardingData?: Partial<OnboardingPrefillValues> | null;
  plaidIdentity?: unknown;
  oauthMetadata?: Record<string, unknown> | null;
  enrichedProfile?: Partial<OnboardingPrefillValues> | null;
  locationData?: Partial<LocationData> | null;
}

export interface ResolvedOnboardingPrefill {
  values: Partial<OnboardingPrefillValues>;
  sources: Partial<Record<keyof OnboardingPrefillValues, string>>;
  completeness: number;
}

const PREFILL_FIELDS: Array<keyof OnboardingPrefillValues> = [
  'citizenship_country',
  'residence_country',
  'phone_number',
  'phone_country_code',
  'legal_first_name',
  'legal_last_name',
  'address_line_1',
  'address_line_2',
  'city',
  'state',
  'zip_code',
  'address_country',
];

const toCleanString = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const toCountryName = (value: unknown): string => {
  const raw = toCleanString(value);
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (upper.length === 2 && COUNTRY_CODE_TO_NAME[upper]) {
    return COUNTRY_CODE_TO_NAME[upper];
  }
  return raw;
};

const toCountryCode = (value: unknown): string => {
  const raw = toCleanString(value);
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (upper.length === 2) return upper;
  const directMatch = COUNTRY_NAME_TO_CODE[raw];
  if (directMatch) return directMatch;

  const lower = raw.toLowerCase();
  const normalizedEntry = Object.entries(COUNTRY_NAME_TO_CODE).find(
    ([countryName]) => countryName.toLowerCase() === lower
  );
  return normalizedEntry?.[1] || '';
};

const toDialCode = (value: unknown): string => {
  const raw = toCleanString(value);
  if (!raw) return '';
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? `+${digits}` : '';
};

const KNOWN_DIAL_CODES = [
  '+971', '+966', '+880', '+852', '+358', '+351', '+353', '+972',
  '+254', '+234', '+233', '+971', '+971', '+971',
  '+91', '+44', '+49', '+33', '+39', '+34', '+31', '+81', '+82',
  '+61', '+65', '+55', '+52', '+27', '+20', '+90', '+63', '+62',
  '+60', '+66', '+92', '+86', '+7', '+1',
];

const parseInternationalPhone = (raw: string): { phone_country_code: string; phone_number: string } | null => {
  const normalized = raw.replace(/[^\d+]/g, '');
  if (!normalized) return null;
  if (!normalized.startsWith('+')) {
    const digits = normalized.replace(/\D/g, '');
    return digits ? { phone_country_code: '+1', phone_number: digits } : null;
  }

  for (const dialCode of KNOWN_DIAL_CODES) {
    if (!normalized.startsWith(dialCode)) continue;
    const localNumber = normalized.slice(dialCode.length);
    if (localNumber.length < 6) continue;
    return {
      phone_country_code: dialCode,
      phone_number: localNumber,
    };
  }

  const digitsOnly = normalized.slice(1);
  for (let codeLength = 3; codeLength >= 1; codeLength -= 1) {
    const countryDigits = digitsOnly.slice(0, codeLength);
    const localNumber = digitsOnly.slice(codeLength);
    if (!countryDigits || localNumber.length < 6) continue;
    return {
      phone_country_code: `+${countryDigits}`,
      phone_number: localNumber,
    };
  }

  return null;
};

const extractPlaidOwner = (identity: unknown): Record<string, any> | null => {
  const record = identity as Record<string, any> | null;
  const accounts = Array.isArray(record?.accounts) ? record.accounts : [];
  const firstAccount = accounts[0] as Record<string, any> | undefined;
  const owners = Array.isArray(firstAccount?.owners) ? firstAccount.owners : [];
  return (owners[0] as Record<string, any>) || null;
};

const extractPlaidPrefill = (identity: unknown): Partial<OnboardingPrefillValues> => {
  const owner = extractPlaidOwner(identity);
  if (!owner) return {};

  const result: Partial<OnboardingPrefillValues> = {};

  const fullName = toCleanString(Array.isArray(owner.names) ? owner.names[0] : '');
  if (fullName) {
    const parts = fullName.split(/\s+/);
    result.legal_first_name = parts[0] || '';
    result.legal_last_name = parts.slice(1).join(' ');
  }

  const phoneRaw = toCleanString(owner.phone_numbers?.[0]?.data);
  const parsedPhone = phoneRaw ? parseInternationalPhone(phoneRaw) : null;
  if (parsedPhone) {
    result.phone_country_code = parsedPhone.phone_country_code;
    result.phone_number = parsedPhone.phone_number;
  }

  const address = owner.addresses?.[0]?.data || owner.addresses?.[0] || owner.address || {};
  const line1 =
    toCleanString(address.street) ||
    [toCleanString(address.street_1), toCleanString(address.street_2)].filter(Boolean).join(', ');

  if (line1) result.address_line_1 = line1;
  if (toCleanString(address.street_2)) result.address_line_2 = toCleanString(address.street_2);
  if (toCleanString(address.city)) result.city = toCleanString(address.city);
  if (toCleanString(address.region)) result.state = toCleanString(address.region);
  if (toCleanString(address.postal_code)) result.zip_code = toCleanString(address.postal_code);

  const country = toCountryName(address.country);
  if (country) {
    result.residence_country = country;
    result.address_country = country;
  }

  return result;
};

const extractOauthPrefill = (metadata: Record<string, unknown> | null | undefined): Partial<OnboardingPrefillValues> => {
  if (!metadata) return {};

  const fullName =
    toCleanString(metadata.full_name) ||
    toCleanString(metadata.name);
  const givenName =
    toCleanString(metadata.given_name) ||
    toCleanString(metadata.first_name) ||
    fullName.split(' ')[0] ||
    '';
  const familyName =
    toCleanString(metadata.family_name) ||
    toCleanString(metadata.last_name) ||
    fullName.split(' ').slice(1).join(' ') ||
    '';

  return {
    legal_first_name: givenName,
    legal_last_name: familyName,
  };
};

const extractLocationPrefill = (locationData: Partial<LocationData> | null | undefined): Partial<OnboardingPrefillValues> => {
  if (!locationData) return {};

  const country = toCountryName(locationData.countryCode || locationData.country);
  const formattedAddress = toCleanString(locationData.formattedAddress);
  const line1 = formattedAddress ? formattedAddress.split(',')[0]?.trim() || '' : '';

  return {
    phone_country_code: toDialCode(locationData.phoneDialCode),
    address_line_1: line1,
    city: toCleanString(locationData.city),
    state: toCleanString(locationData.stateCode || locationData.state),
    zip_code: toCleanString(locationData.postalCode),
    address_country: country,
  };
};

const mergePrefillSource = (
  into: ResolvedOnboardingPrefill,
  sourceName: string,
  values: Partial<OnboardingPrefillValues> | null | undefined
) => {
  if (!values) return;

  for (const field of PREFILL_FIELDS) {
    if (into.values[field]) continue;
    const value = toCleanString(values[field]);
    if (!value) continue;
    into.values[field] = value;
    into.sources[field] = sourceName;
  }
};

export const resolveOnboardingPrefill = (
  sources: OnboardingPrefillSources
): ResolvedOnboardingPrefill => {
  const resolved: ResolvedOnboardingPrefill = {
    values: {},
    sources: {},
    completeness: 0,
  };

  mergePrefillSource(resolved, 'onboarding', sources.onboardingData || {});
  mergePrefillSource(resolved, 'plaid', extractPlaidPrefill(sources.plaidIdentity));
  mergePrefillSource(resolved, 'oauth', extractOauthPrefill(sources.oauthMetadata));
  mergePrefillSource(resolved, 'enriched', sources.enrichedProfile || {});
  mergePrefillSource(resolved, 'location', extractLocationPrefill(sources.locationData));

  const filledFields = PREFILL_FIELDS.filter((field) => Boolean(resolved.values[field])).length;
  resolved.completeness = filledFields / PREFILL_FIELDS.length;

  return resolved;
};

export const deriveBankCountry = ({
  addressCountry,
  residenceCountry,
  savedBankCountry,
}: {
  addressCountry?: string | null;
  residenceCountry?: string | null;
  savedBankCountry?: string | null;
}): string => {
  return (
    toCountryCode(addressCountry) ||
    toCountryCode(residenceCountry) ||
    toCountryCode(savedBankCountry) ||
    'US'
  );
};
