# Kai India - Indian Market Intelligence Dashboard

Real-time NSE/BSE market data dashboard powered by Gemini 2.5 Flash with Google Search grounding.

## 🚀 Access

**Route:** `/kai-india`

## 📋 Features

### Market Overview
- **Mutual Funds**: Top 10 high-return mutual funds with NAV, returns, and risk levels
- **SIPs**: Top 10 SIP recommendations for long-term wealth building
- **Top Movers**: Live stock gainers from NSE/BSE
- **MTF Stocks**: Margin Trading Facility eligible stocks
- **Intraday Picks**: Daily intraday trading recommendations with targets and stop-losses
- **Gold**: Gold ETFs and Sovereign Gold Bonds (SGBs)
- **Silver**: Silver ETFs and investment options
- **Metal Stocks**: Metal sector equity picks

### Investment Calculator (Advisor)
AI-powered portfolio allocation with 3 risk profiles:
1. **Stability (Equilibrium)**: Low-risk, capital preservation focus
2. **Growth**: Aggressive wealth creation with higher volatility tolerance
3. **Max Profit (Sniper)**: Maximum alpha-seeking momentum strategy

## 🛠 Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **AI Backend**: Gemini 2.5 Flash with Google Search grounding
- **Charts**: Recharts (Pie Chart for portfolio allocation)
- **Data**: Real-time NSE/BSE market data via Google Search API

## 📁 Module Structure

```
src/kai-india/
├── App.tsx                    # Main dashboard component
├── types.ts                   # TypeScript interfaces
├── pages/
│   └── index.tsx              # Route entry point
├── services/
│   └── geminiService.ts       # Gemini API integration
└── components/
    ├── MarketCard.tsx         # Market data display cards
    ├── InvestmentCalculator.tsx # AI advisor component
    └── Loader.tsx             # Loading spinner
```

## 🔑 Environment Variables

Requires `VITE_GEMINI_API_KEY` in `.env.local`:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

## 🎯 API Features

### Market Overview (`fetchMarketOverview`)
- Uses Gemini 2.5 Flash with Google Search grounding
- Fetches real-time Indian market data
- Auto-validates data quality (no N/A or empty fields)
- Auto-refresh every 60 seconds

### Investment Advice (`getInvestmentAdvice`)
- Takes investment amount, duration (days), and risk profile
- Returns AI-generated portfolio allocation
- Uses real-time market data for recommendations

## 🔄 Auto-Refresh

The dashboard automatically refreshes market data every 60 seconds to ensure real-time accuracy.

## 📱 Responsive Design

- Mobile-first design with Tailwind CSS
- Grid layout adapts to screen size
- Loading skeletons for smooth UX

## 🧑‍💻 Development

```bash
# Start development server
npm run dev

# Access the dashboard
open http://localhost:3000/kai-india
```

## 📊 Data Quality

All market items are validated to ensure:
- Valid asset name (not empty, not "N/A")
- Valid price (NAV/stock price)
- Valid change percentage

Items failing validation are automatically filtered out.

---

**Part of Hushh Technologies** | Built with ❤️ for Indian Investors
