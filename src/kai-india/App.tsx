import React, { useEffect, useState } from 'react';
import { fetchMarketOverview } from './services/geminiService';
import { MarketData } from './types';
import { MarketCard } from './components/MarketCard';
import { InvestmentCalculator } from './components/InvestmentCalculator';
import { Loader } from './components/Loader';

const App: React.FC = () => {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setHasError(false);

    try {
      const marketData = await fetchMarketOverview();
      // Ensure we don't wipe out existing data if the refresh fails or returns empty
      if (marketData && (marketData.mutualFunds.length > 0 || marketData.topMovers.length > 0)) {
        setData(marketData);
        setLastUpdated(new Date());
      } else if (!data) {
        setHasError(true);
      }
    } catch (e) {
      console.error("Failed to load data", e);
      if (!data) setHasError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Initial load
    loadData();

    // Auto-refresh every 60 seconds
    const intervalId = setInterval(() => {
      loadData(true);
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);

  const handleFundSelect = (name: string) => {
    // Scrolls to top to use the advisor and focuses input
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
        document.getElementById('amount-input')?.focus();
    }, 800);
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans selection:bg-black selection:text-white pb-20">
      {/* Header - Glassmorphism minimal */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md z-50 border-b border-neutral-100 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
              <span className="lowercase">hushh</span> <span className="font-light text-neutral-400">|</span> <span className="font-medium tracking-wide">wealth</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
             {lastUpdated && !refreshing && (
                 <span className="text-[10px] text-neutral-400 font-medium hidden md:inline-block">
                     Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                 </span>
             )}
             {refreshing ? (
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-200 shadow-sm animate-pulse transition-all">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="hidden sm:inline">Syncing Market Data...</span>
                  <span className="sm:hidden">Syncing...</span>
                </div>
             ) : (
                <div className="text-[10px] font-medium tracking-wider text-neutral-400 uppercase hidden sm:block bg-neutral-50 px-3 py-1.5 rounded-full border border-neutral-100">
                    System Online
                </div>
             )}
          </div>
        </div>
        {/* Subtle progress line when refreshing */}
        {refreshing && (
           <div className="absolute bottom-0 left-0 w-full h-[1px] bg-neutral-100 overflow-hidden">
             <div className="h-full bg-black/20 w-1/3 animate-[slide_1s_infinite_linear]"></div>
           </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-8 md:pt-12">
        {/* Top Section: Prior Analysis with Skeleton */}
        {(loading || data?.priorAnalysis) && !hasError && (
          <div className="mb-8 md:mb-12">
            <div className="bg-neutral-50 rounded-2xl p-6 md:p-8 border border-neutral-100 min-h-[100px] flex items-center">
              {loading ? (
                <div className="w-full flex flex-col md:flex-row gap-4 md:items-baseline">
                   <div className="h-6 animate-shimmer rounded w-24"></div>
                   <div className="h-4 animate-shimmer rounded flex-1"></div>
                   <div className="h-4 animate-shimmer rounded w-1/4 hidden md:block"></div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-4 md:items-baseline">
                  <span className="text-neutral-900 font-semibold whitespace-nowrap md:mr-4 lowercase">
                    hushh kai
                  </span>
                  <span className="text-neutral-600 text-sm md:text-base leading-relaxed font-light">
                    {data?.priorAnalysis}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hero: Investment Advisor */}
        <InvestmentCalculator />

        {/* Error State for Global Data */}
        {hasError && !data ? (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-neutral-50 rounded-3xl border border-neutral-100">
                <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">Market Stream Unavailable</h3>
                <p className="text-neutral-500 max-w-sm mb-6">We couldn't retrieve the live market data. This might be due to network connectivity or exchange maintenance.</p>
                <button 
                    onClick={() => loadData(false)}
                    className="px-6 py-2.5 bg-neutral-900 text-white rounded-full text-sm font-medium hover:bg-black transition-colors"
                >
                    Retry Connection
                </button>
            </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-fr">
            {/* Standard Assets */}
            <MarketCard 
              title="Top 10 Mutual Funds" 
              items={data?.mutualFunds} 
              isLoading={loading}
              onSelect={handleFundSelect}
            />

            <MarketCard 
              title="Top 10 SIP Recommendations" 
              items={data?.sips} 
              isLoading={loading}
              onSelect={handleFundSelect}
            />

            <MarketCard 
              title="Top 10 Market Movers" 
              items={data?.topMovers} 
              isLoading={loading}
              onSelect={handleFundSelect}
            />

            <MarketCard 
              title="Top 10 Traded (MTF)" 
              items={data?.mtf} 
              isLoading={loading}
              onSelect={handleFundSelect}
            />

            <MarketCard 
              title="Top 10 Intraday Picks" 
              items={data?.intraday} 
              isLoading={loading}
              onSelect={handleFundSelect}
            />

            {/* Commodities Section */}
            <MarketCard 
              title="Top 10 Gold Opportunities" 
              items={data?.gold} 
              isLoading={loading}
              onSelect={handleFundSelect}
            />

            <MarketCard 
              title="Top 10 Silver Opportunities" 
              items={data?.silver} 
              isLoading={loading}
              onSelect={handleFundSelect}
            />

            <MarketCard 
              title="Top 10 Metal Sector Picks" 
              items={data?.metals} 
              isLoading={loading}
              onSelect={handleFundSelect}
            />
            
            {/* Promo / Info Block - Minimal style */}
            <div className="bg-neutral-900 rounded-3xl p-8 flex flex-col justify-center items-center text-center text-white h-full min-h-[400px]">
                <h3 className="text-2xl font-medium mb-3 lowercase">hushh wealth</h3>
                <p className="text-neutral-400 mb-8 text-sm font-light max-w-xs mx-auto leading-6">
                  Advanced algorithms decoding Indian market trends in real-time.
                </p>
                <button 
                  onClick={() => handleFundSelect("Nifty 50 Index")}
                  className="px-6 py-2.5 bg-white text-black rounded-full hover:bg-neutral-200 transition-all text-sm font-medium"
                >
                    Test Nifty 50
                </button>
            </div>
          </div>
        )}
      </main>
      
      <footer className="mt-24 border-t border-neutral-100 py-12 bg-neutral-50/30">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center justify-center text-center">
          <p className="text-lg font-medium tracking-tighter text-neutral-900 lowercase mb-4">
            hushh <span className="text-neutral-300 font-light">|</span> wealth
          </p>
          <p className="text-xs text-neutral-500 font-light max-w-md mx-auto leading-relaxed">
            Investments are subject to market risks. AI generated predictions.
            <br />
            Hushh Kai algorithms analyze market data in real-time. This is informational only.
          </p>
        </div>
      </footer>
      
      {/* Add inline style for the slide animation */}
      <style>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-shimmer {
          background: linear-gradient(90deg, #f5f5f5 25%, #e5e5e5 37%, #f5f5f5 63%);
          background-size: 400% 100%;
          animation: shimmer 1.4s ease-in-out infinite;
        }
        .animate-fade-in {
          animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default App;