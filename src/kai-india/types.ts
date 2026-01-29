
export enum MarketSegment {
  MUTUAL_FUNDS = 'Mutual Funds',
  SIP = 'SIP Recommendations',
  TOP_MOVERS = 'Top Movers',
  MTF = 'Most Traded MTF',
  INTRADAY = 'Top Intraday',
  PRIOR = 'Prior Market Analysis'
}

export interface MarketItem {
  name: string;
  price?: string; // e.g., NAV or Stock Price
  change?: string; // e.g., +2.4%
  risk?: string; // Low, Mod, High
  category?: string; // e.g., Large Cap, Small Cap
  description?: string;
}

export interface MarketData {
  mutualFunds: MarketItem[];
  sips: MarketItem[];
  topMovers: MarketItem[];
  mtf: MarketItem[];
  intraday: MarketItem[];
  gold: MarketItem[];
  silver: MarketItem[];
  metals: MarketItem[];
  priorAnalysis: string;
}

// Advisor Types
export interface AdvisorAllocation {
  assetName: string;
  type: string; // "Gold", "Stock", "Mutual Fund", "ETF"
  riskLevel: "High" | "Medium" | "Low";
  allocationAmount: number; // The specific portion of cash to put here
  projectedValue: number;
  estimatedReturnPct: string; // e.g. "+5%"
  reasoning: string;
  action: string; // "Buy immediately"
}

export interface AdvisorResult {
  amount: number;
  durationDays: number;
  strategyName: string; // e.g. "Aggressive Short-Term Growth"
  analysis: string;
  allocations: AdvisorAllocation[];
  totalProjectedValue: number;
  totalEstimatedReturn: string;
}
