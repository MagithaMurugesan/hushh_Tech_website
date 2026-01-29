import { GoogleGenAI } from "@google/genai";
import { MarketData, AdvisorResult, MarketItem } from "../types";

// Helper to sanitize JSON strings if the model returns markdown code blocks
const cleanJsonString = (str: string): string => {
  let cleaned = str.replace(/```json/gi, '').replace(/```/g, '').trim();
  const firstOpen = cleaned.indexOf('{');
  const lastClose = cleaned.lastIndexOf('}');
  if (firstOpen !== -1 && lastClose !== -1) {
    cleaned = cleaned.substring(firstOpen, lastClose + 1);
  }
  return cleaned;
};

// Strict validator: Ensures Name, Price, and Change are present and valid (no "N/A")
const isValidMarketItem = (item: MarketItem): boolean => {
  const isInvalid = (val?: string) => !val || val === "N/A" || val === "-" || val.trim() === "" || val.toLowerCase().includes("unknown");
  
  if (isInvalid(item.name)) return false;
  if (isInvalid(item.price)) return false;
  if (isInvalid(item.change)) return false;
  
  return true;
};

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// Retry wrapper for API calls with exponential backoff
const generateWithRetry = async (model: string, prompt: string, tools?: any[]) => {
  let retries = 3;
  let delay = 2000;

  while (true) {
    try {
      return await ai.models.generateContent({
        model,
        contents: prompt,
        config: tools ? { tools } : undefined
      });
    } catch (error: any) {
      const isQuotaError = error?.status === 429 || 
                           error?.code === 429 || 
                           error?.message?.includes('429') || 
                           error?.message?.includes('quota') ||
                           error?.message?.includes('RESOURCE_EXHAUSTED');

      if (isQuotaError && retries > 0) {
        console.warn(`Quota limit hit (429). Retrying in ${delay}ms... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries--;
        delay *= 2;
        continue;
      }
      
      throw error;
    }
  }
};

export const fetchMarketOverview = async (): Promise<MarketData> => {
  const model = "gemini-2.5-flash"; 
  
  const prompt = `
    You are an expert Indian Stock Market Analyst. 
    Using Google Search, find the latest REAL-TIME data for the Indian Market (NSE/BSE).
    
    CRITICAL DATA QUALITY RULES:
    1. **Complete Data Only**: Every item MUST have a specific 'name', a 'price' (NAV/Stock Price), and a 'change' (Percentage). 
    2. **No Placeholders**: Do NOT return items with "N/A", "Unknown", "-", or empty fields. If data is missing, omit the item entirely.
    3. **Real-Time Accuracy**: Values must be from the latest trading session.
    
    I need a structured JSON response containing these exact lists:
    1. Top 10 recommended Mutual Funds (High Return).
    2. Top 10 Mutual Funds for SIP (Long Term Wealth).
    3. Top 10 Stock Gainers (Live/Today).
    4. Top 10 Stocks traded in Margin Trading Facility (MTF).
    5. Top 10 Intraday stock picks.
    6. Top 10 Gold Assets (ETFs/SGBs).
    7. Top 10 Silver Assets.
    8. Top 10 Metal Sector Stocks.
    9. A brief "Prior Market Analysis" (2 sentences).

    Output ONLY a raw JSON object matching this structure:
    {
      "mutualFunds": [
        { "name": "Fund Name", "price": "NAV ₹123.45", "change": "+15.2% (1Y)", "risk": "High", "category": "Small Cap" }
      ],
      "sips": [
        { "name": "Fund Name", "price": "Min SIP ₹500", "change": "+12% (3Y CAGR)", "risk": "Mod", "category": "Flexi Cap" }
      ],
      "topMovers": [
        { "name": "Stock Name", "price": "₹1,250.00", "change": "+5.4%" }
      ],
      "mtf": [
        { "name": "Stock Name", "price": "₹450.00", "change": "+1.2%" }
      ],
      "intraday": [
        { "name": "Stock Name", "price": "Tgt ₹2000", "change": "SL ₹1950", "description": "Buy above ₹1980" }
      ],
      "gold": [
        { "name": "Nippon Gold BeES", "price": "₹52.00", "change": "+0.5%" }
      ],
      "silver": [
        { "name": "Silver BeES", "price": "₹75.00", "change": "-0.2%" }
      ],
      "metals": [
        { "name": "Tata Steel", "price": "₹150.00", "change": "+2.1%" }
      ],
      "priorAnalysis": "Market closed positive yesterday led by banking stocks..."
    }
  `;

  try {
    const response = await generateWithRetry(model, prompt, [{ googleSearch: {} }]);

    const text = response.text || "{}";
    const rawData = JSON.parse(cleanJsonString(text));

    // Strict Filtering: Remove any incomplete items
    const filteredData: MarketData = {
      mutualFunds: (rawData.mutualFunds || []).filter(isValidMarketItem),
      sips: (rawData.sips || []).filter(isValidMarketItem),
      topMovers: (rawData.topMovers || []).filter(isValidMarketItem),
      mtf: (rawData.mtf || []).filter(isValidMarketItem),
      intraday: (rawData.intraday || []).filter(isValidMarketItem),
      gold: (rawData.gold || []).filter(isValidMarketItem),
      silver: (rawData.silver || []).filter(isValidMarketItem),
      metals: (rawData.metals || []).filter(isValidMarketItem),
      priorAnalysis: rawData.priorAnalysis || "Market data is currently being updated."
    };

    return filteredData;
  } catch (error) {
    console.error("Error fetching market overview:", error);
    return {
      mutualFunds: [],
      sips: [],
      topMovers: [],
      mtf: [],
      intraday: [],
      gold: [],
      silver: [],
      metals: [],
      priorAnalysis: "Market data unavailable due to high traffic. Please try again shortly."
    };
  }
};

export const getInvestmentAdvice = async (amount: number, days: number, profile: 'stability' | 'growth' | 'max_profit'): Promise<AdvisorResult> => {
  const model = "gemini-2.5-flash"; 

  let profileInstructions = "";
  
  if (profile === 'stability') {
    profileInstructions = `
      You are 'Hushh Kai - Equilibrium', a risk-averse AI strategist.
      USER GOAL: **Stability & Equilibrium**.
      
      CRITICAL RULES:
      1. **Safety First**: Prioritize Large Cap Stocks (Nifty 50), Gold ETFs (Hedge), and Liquid/Overnight Funds.
      2. **Low Volatility**: Avoid high-beta stocks. Focus on consistent compounders.
      3. **Allocation**: Suggest ~40-50% in safer assets (Gold/Liquid) to maintain equilibrium.
      4. **Commentary**: Explain how this portfolio maintains stability and protects capital while beating inflation.
    `;
  } else if (profile === 'growth') {
    profileInstructions = `
      You are 'Hushh Kai - Growth', an aggressive wealth creation strategist.
      USER GOAL: **High Risk / High Growth**.
      
      CRITICAL RULES:
      1. **Aggressive Growth**: Target Mid-Cap and Small-Cap stocks with strong fundamentals and growth stories.
      2. **Volatility Tolerance**: Accept higher risk for higher potential returns (Target 15-20% CAGR equivalent).
      3. **Sectoral Bets**: Look for trending sectors (e.g., Defence, Railways, PSU) and allocate heavily there.
      4. **Commentary**: Explain that this portfolio carries higher risk but aims for significant wealth expansion.
    `;
  } else {
    // max_profit
    profileInstructions = `
      You are 'Hushh Kai - Sniper', an elite strategist focused on MAXIMUM PROFIT (Alpha).
      USER GOAL: **Maximum Possible Net Profit**.
      
      CRITICAL RULES:
      1. **Maximize Returns**: Focus purely on Momentum, Breakout Stocks, and High-Velocity setups.
      2. **Sniper Precision**: Use Real-time data to find the absolute top movers or potential gainers for the specific duration.
      3. **Strategic Cash**: Keep only minimal cash (5-10%) for buying dips; deploy the rest for maximum market exposure.
      4. **Commentary**: Explain how this specific allocation squeezes the maximum profit out of current market conditions.
    `;
  }

  const prompt = `
    ${profileInstructions}
    
    The user has a capital of ₹${amount} and wants to invest it for exactly ${days} days.
    
    Task:
    Create a detailed, real-time "Portfolio Allocation Plan".
    Split the ₹${amount} into 2 to 4 strategic allocations based on LIVE market conditions.
    
    GENERAL RULES (Apply to all profiles):
    1. **Real-Time Data**: Use Google Search to find the EXACT current price and trend.
    2. **Sum**: The sum of "allocationAmount" MUST equal ${amount}.
    3. **Checklist**: Ensure every recommendation has a valid Asset Name, Risk Level, and Reasoning.
    
    Output ONLY a raw JSON object (no markdown) with this structure:
    {
      "amount": ${amount},
      "durationDays": ${days},
      "strategyName": "Strategy Name (e.g. 'Equilibrium Shield' or 'Alpha Sniper')",
      "analysis": "Hushh Kai commentary tailored to the selected risk profile.",
      "totalProjectedValue": 10500, // Projection based on risk profile
      "totalEstimatedReturn": "+X.X%", 
      "allocations": [
        {
          "assetName": "Specific Asset",
          "type": "Stock / Gold / Liquid Fund / Cash",
          "riskLevel": "High" | "Medium" | "Low",
          "allocationAmount": 5000, 
          "projectedValue": 5100, 
          "estimatedReturnPct": "+2%", 
          "reasoning": "Why this fits the '${profile}' profile...",
          "action": "Specific instruction"
        }
      ]
    }
  `;

  try {
    const response = await generateWithRetry(model, prompt, [{ googleSearch: {} }]);

    const text = response.text || "{}";
    return JSON.parse(cleanJsonString(text)) as AdvisorResult;
  } catch (error) {
    console.error("Error generating advice:", error);
    throw new Error("Analysis failed due to high demand. Please try again in a moment.");
  }
};
