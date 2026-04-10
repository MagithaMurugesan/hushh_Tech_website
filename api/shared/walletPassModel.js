export const DEFAULT_WALLET_ROOT_URL = "https://hushhtech.com";
export const WALLET_CARD_BADGE_TEXT = "HUSHH GOLD";
export const WALLET_CARD_TITLE = "Hushh Gold Investor Pass";
export const WALLET_CARD_ORGANIZATION_NAME = "Hushh Technologies";
export const WALLET_CARD_ORGANIZATION_FALLBACK = "Hushh";
export const WALLET_CARD_STATUS = "Gold Member";

const getTrimmedString = (value) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : "";

export const getWalletPayloadFieldValue = (fields, key, fallback = "") => {
  if (!Array.isArray(fields)) {
    return fallback;
  }

  const field = fields.find((item) => item?.key === key);
  const value = getTrimmedString(field?.value);
  return value || fallback;
};

export const getWalletInvestmentClass = (amount) => {
  if (typeof amount !== "number" || Number.isNaN(amount)) {
    return "Class C";
  }

  if (amount >= 5_000_000) return "Class A";
  if (amount >= 2_000_000) return "Class B";
  return "Class C";
};

const normalizeInvestmentClass = (value) => {
  const normalizedValue = getTrimmedString(value).replace(/^Investor\s*-\s*/i, "");
  return normalizedValue || "Class C";
};

const buildInvestmentLabel = (investmentClass) => `Investor - ${investmentClass}`;

const getDisplayValue = (value, fallback) => getTrimmedString(value) || fallback;

const buildPublicProfileUrl = (input) =>
  getTrimmedString(input?.slug)
    ? `${DEFAULT_WALLET_ROOT_URL}/investor/${getTrimmedString(input.slug)}`
    : null;

const buildMembershipId = (input) =>
  getTrimmedString(input?.slug) ||
  getTrimmedString(input?.userId) ||
  (getTrimmedString(input?.email)
    ? getTrimmedString(input.email).split("@")[0]
    : "hushh-investor");

export const buildWalletCardContent = (input = {}) => {
  const profileUrl = buildPublicProfileUrl(input);
  const investmentClass = getWalletInvestmentClass(input.investmentAmount);

  return {
    badgeText: WALLET_CARD_BADGE_TEXT,
    title: WALLET_CARD_TITLE,
    status: WALLET_CARD_STATUS,
    holderName: getDisplayValue(input.name, "Hushh Investor"),
    organizationName: getDisplayValue(
      input.organisation,
      WALLET_CARD_ORGANIZATION_FALLBACK
    ),
    investmentClass,
    investmentLabel: buildInvestmentLabel(investmentClass),
    membershipId: buildMembershipId(input),
    email: getDisplayValue(input.email, "—"),
    profileUrl,
    passUrl: profileUrl || DEFAULT_WALLET_ROOT_URL,
  };
};

export const buildGoldPassPayload = (input = {}) => {
  const content = buildWalletCardContent(input);

  return {
    passType: "storeCard",
    description: content.title,
    organizationName: WALLET_CARD_ORGANIZATION_NAME,
    logoText: "hushh Gold Pass",
    backgroundColor: "rgb(212, 175, 55)",
    foregroundColor: "rgb(12, 12, 12)",
    labelColor: "rgb(32, 32, 32)",
    headerFields: [
      {
        key: "status",
        label: "Status",
        value: content.status,
        textAlignment: "PKTextAlignmentLeft",
      },
      {
        key: "org",
        label: "Organization",
        value: content.organizationName,
        textAlignment: "PKTextAlignmentLeft",
      },
    ],
    primaryFields: [
      {
        key: "investor",
        label: "Holder",
        value: content.holderName,
        textAlignment: "PKTextAlignmentLeft",
      },
    ],
    secondaryFields: [
      {
        key: "class",
        label: "Investor",
        value: content.investmentLabel,
        textAlignment: "PKTextAlignmentLeft",
      },
    ],
    auxiliaryFields: [
      {
        key: "email",
        label: "Email",
        value: content.email,
        textAlignment: "PKTextAlignmentLeft",
      },
      {
        key: "memberId",
        label: "Membership ID",
        value: content.membershipId,
        textAlignment: "PKTextAlignmentLeft",
      },
    ],
    barcode: {
      message: content.passUrl,
      format: "PKBarcodeFormatQR",
      altText: "Hushh Gold Pass QR",
    },
    webServiceURL: content.passUrl,
  };
};

export const buildWalletCardContentFromPayload = (payload = {}) => {
  const passUrl =
    getTrimmedString(payload?.barcode?.message) || DEFAULT_WALLET_ROOT_URL;
  const investmentLabel = getWalletPayloadFieldValue(
    payload?.secondaryFields,
    "class",
    buildInvestmentLabel("Class C")
  );

  return {
    badgeText: WALLET_CARD_BADGE_TEXT,
    title: getTrimmedString(payload?.description) || WALLET_CARD_TITLE,
    status: getWalletPayloadFieldValue(
      payload?.headerFields,
      "status",
      WALLET_CARD_STATUS
    ),
    holderName: getWalletPayloadFieldValue(
      payload?.primaryFields,
      "investor",
      "Hushh Investor"
    ),
    organizationName: getWalletPayloadFieldValue(
      payload?.headerFields,
      "org",
      getTrimmedString(payload?.organizationName) || WALLET_CARD_ORGANIZATION_NAME
    ),
    investmentClass: normalizeInvestmentClass(investmentLabel),
    investmentLabel,
    membershipId: getWalletPayloadFieldValue(
      payload?.auxiliaryFields,
      "memberId",
      passUrl
    ),
    email: getWalletPayloadFieldValue(payload?.auxiliaryFields, "email", "—"),
    profileUrl: passUrl !== DEFAULT_WALLET_ROOT_URL ? passUrl : null,
    passUrl,
  };
};
