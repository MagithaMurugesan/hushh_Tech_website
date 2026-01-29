import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { getInvestmentAdvice } from '../services/geminiService';
import { AdvisorResult } from '../types';

type RiskProfile = 'stability' | 'growth' | 'max_profit';

export const InvestmentCalculator: React.FC = () => {
  const [amount, setAmount] = useState<string>('10000');
  const [days, setDays] = useState<string>('10');
  const [profile, setProfile] = useState<RiskProfile>('max_profit');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amt = parseFloat(amount);
    const d = parseInt(days);

    // UX Validation
    if (!amount || isNaN(amt)) {
        setError("Please enter a valid capital amount.");
        return;
    }
    if (amt < 500) {
        setError("Minimum capital requirement is ₹500 to generate a diversified plan.");
        return;
    }
    if (amt > 100000000) {
        setError("For amounts over ₹10Cr, please contact our institutional desk.");
        return;
    }
    if (!days || isNaN(d)) {
         setError("Please enter a valid duration.");
         return;
    }
    if (d < 1) {
        setError("Duration must be at least 1 day.");
        return;
    }

    setLoading(true);
    setResult(null);
    try {
      const data = await getInvestmentAdvice(amt, d, profile);
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("Unable to generate analysis. The AI service might be busy. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#6366f1'];

  const profiles: { id: RiskProfile; label: string; sub: string }[] = [
    { id: 'stability', label: 'Stability', sub: 'Equilibrium' },
    { id: 'growth', label: 'High Risk', sub: 'Growth' },
    { id: 'max_profit', label: 'Max Profit', sub: 'Sniper' },
  ];

  return (
    <div className="w-full bg-white border border-neutral-100 rounded-3xl md:rounded-[2.5rem] p-5 md:p-10 mb-12 md:mb-16 relative overflow-hidden shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-10 gap-6 relative z-10">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
             <span className="bg-orange-50 text-orange-600 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-orange-100 flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                India Market
             </span>
             <span className="hidden sm:inline text-neutral-300 text-xs">|</span>
             <span className="text-neutral-400 text-[10px] font-medium uppercase tracking-widest whitespace-nowrap">NSE • BSE • MCX</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-medium text-neutral-900 tracking-tighter mb-2">
            hushh kai <span className="text-neutral-300 font-light">|</span> india
          </h2>
          <p className="text-neutral-500 text-sm font-light max-w-xl leading-relaxed">
            AI-driven capital allocation tailored for the Indian financial ecosystem. Select your risk appetite to generate a real-time portfolio strategy.
          </p>
        </div>
      </div>

      <form onSubmit={handleCalculate} className="relative z-10 max-w-5xl">
        
        {/* Modern Segmented Control */}
        <div className="mb-8 md:mb-10">
            <label className="text-[10px] uppercase text-neutral-400 font-bold tracking-widest mb-3 block ml-2">Select Strategy Profile</label>
            <div className="grid grid-cols-3 sm:flex sm:flex-row p-1 bg-neutral-100/80 rounded-xl sm:rounded-full gap-1 sm:gap-0">
                {profiles.map((p) => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => setProfile(p.id)}
                        className={`relative flex flex-col items-center justify-center sm:flex-1 py-3 sm:py-4 rounded-lg sm:rounded-full transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                            profile === p.id 
                            ? 'bg-neutral-900 shadow-lg scale-[1.02]' 
                            : 'bg-transparent hover:bg-neutral-200/50 text-neutral-500'
                        }`}
                    >
                        <span className={`text-xs sm:text-sm font-semibold tracking-tight transition-colors duration-300 ${
                            profile === p.id ? 'text-white' : 'text-neutral-600'
                        }`}>
                            {p.label}
                        </span>
                        <span className={`text-[9px] uppercase tracking-wider font-medium mt-0.5 transition-colors duration-300 hidden xs:block ${
                            profile === p.id ? 'text-neutral-400' : 'text-neutral-400/70'
                        }`}>
                            {p.sub}
                        </span>
                    </button>
                ))}
            </div>
        </div>

        {/* Inputs Group */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-stretch mb-4">
            {/* Amount Input */}
            <div className={`md:col-span-5 bg-neutral-50 hover:bg-white focus-within:bg-white rounded-2xl md:rounded-[1.5rem] px-5 py-4 border ${error && !amount ? 'border-red-300 ring-2 ring-red-50' : 'border-neutral-100'} focus-within:border-neutral-300 focus-within:shadow-md transition-all group cursor-text`} onClick={() => document.getElementById('amount-input')?.focus()}>
                <div className="flex justify-between items-center h-full">
                    <div className="flex flex-col justify-center w-full">
                        <label className="text-[10px] uppercase text-neutral-400 font-bold tracking-widest mb-1 group-focus-within:text-neutral-600 transition-colors">Total Capital</label>
                        <input
                            id="amount-input"
                            type="number"
                            min="500"
                            step="500"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full outline-none text-neutral-900 text-xl md:text-2xl font-medium placeholder-neutral-300 bg-transparent tracking-tight font-sans"
                            placeholder="50000"
                        />
                    </div>
                    <span className="text-neutral-400 font-light text-base md:text-lg">INR</span>
                </div>
            </div>
            
            {/* Days Input */}
            <div className={`md:col-span-4 bg-neutral-50 hover:bg-white focus-within:bg-white rounded-2xl md:rounded-[1.5rem] px-5 py-4 border ${error && !days ? 'border-red-300 ring-2 ring-red-50' : 'border-neutral-100'} focus-within:border-neutral-300 focus-within:shadow-md transition-all group cursor-text`} onClick={() => document.getElementById('days-input')?.focus()}>
                <div className="flex justify-between items-center h-full">
                    <div className="flex flex-col justify-center w-full">
                        <label className="text-[10px] uppercase text-neutral-400 font-bold tracking-widest mb-1 group-focus-within:text-neutral-600 transition-colors">Duration</label>
                        <input
                            id="days-input"
                            type="number"
                            min="1"
                            value={days}
                            onChange={(e) => setDays(e.target.value)}
                            className="w-full outline-none text-neutral-900 text-xl md:text-2xl font-medium placeholder-neutral-300 bg-transparent tracking-tight font-sans"
                            placeholder="30"
                        />
                    </div>
                    <span className="text-neutral-400 font-light text-base md:text-lg">Days</span>
                </div>
            </div>
            
            {/* Action Button */}
            <button 
                type="submit" 
                disabled={loading}
                className="md:col-span-3 bg-neutral-900 hover:bg-black text-white rounded-2xl md:rounded-[1.5rem] p-4 transition-all disabled:opacity-80 active:scale-[0.98] shadow-xl shadow-neutral-200 flex flex-col justify-center items-center h-[80px] md:h-auto border border-neutral-800"
            >
                {loading ? (
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span className="text-[10px] uppercase font-bold tracking-widest opacity-80">Analyzing...</span>
                    </div>
                ) : (
                    <>
                        <span className="text-lg font-medium tracking-wide">Generate Plan</span>
                        <span className="text-[10px] font-medium text-neutral-400 mt-1 uppercase tracking-wider">Start Analysis</span>
                    </>
                )}
            </button>
        </div>

        {/* Error Message */}
        {error && (
            <div className="animate-fade-in flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl text-sm font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
            </div>
        )}
      </form>

      {/* Results Section */}
      {result && (
        <div className="animate-fade-in mt-12 pt-8 border-t border-dashed border-neutral-200">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
             {/* Strategy Summary Card - Dark Mode */}
             <div className="lg:col-span-3 bg-[#0a0a0a] text-white rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-10 shadow-2xl shadow-neutral-200/50 relative overflow-hidden">
                {/* Abstract Background pattern */}
                <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none" style={{backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px'}}></div>
                
                <div className="relative z-10 flex flex-col md:flex-row gap-8 justify-between items-start md:items-end">
                    <div className="space-y-4 max-w-2xl w-full">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                                {result.strategyName}
                            </span>
                            <span className="text-neutral-500 text-xs font-medium uppercase tracking-wider whitespace-nowrap">
                                {result.durationDays} Day Outlook
                            </span>
                        </div>
                        <p className="text-lg md:text-xl text-neutral-200 font-light leading-relaxed">
                            "{result.analysis}"
                        </p>
                    </div>

                    <div className="flex flex-row flex-wrap sm:flex-nowrap items-center gap-6 md:gap-12 bg-white/5 p-5 md:p-6 rounded-2xl border border-white/5 backdrop-blur-sm w-full md:w-auto">
                        <div className="flex-1 min-w-[120px]">
                            <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Target Alpha</div>
                            <div className="text-2xl md:text-3xl font-semibold text-emerald-400 tracking-tight">{result.totalEstimatedReturn}</div>
                        </div>
                        <div className="hidden sm:block w-px h-10 bg-white/10"></div>
                        <div className="flex-1 min-w-[120px]">
                            <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Proj. Value</div>
                            <div className="text-2xl md:text-3xl font-semibold text-white tracking-tight">₹{result.totalProjectedValue.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
             </div>

             {/* Allocations List */}
             <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center gap-2 mb-2 px-1">
                    <h3 className="text-neutral-900 font-bold text-xs uppercase tracking-widest">Recommended Allocation</h3>
                    <div className="h-px bg-neutral-100 flex-1"></div>
                </div>

                {result.allocations.map((rec, idx) => (
                    <div key={idx} className="bg-white hover:bg-neutral-50/50 border border-neutral-100 hover:border-neutral-200 p-5 md:p-6 rounded-[1.5rem] transition-all duration-300 group">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                            <div className="flex items-start gap-4">
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center text-xs md:text-sm font-bold shadow-sm flex-shrink-0 ${
                                     rec.type.toLowerCase().includes('gold') ? 'bg-yellow-50 text-yellow-600' :
                                     rec.type.toLowerCase().includes('cash') ? 'bg-blue-50 text-blue-600' :
                                     rec.type.toLowerCase().includes('stock') ? 'bg-emerald-50 text-emerald-600' :
                                     'bg-neutral-100 text-neutral-600'
                                }`}>
                                    {rec.type.substring(0,2).toUpperCase()}
                                </div>
                                <div>
                                    <h4 className="text-base md:text-lg font-bold text-neutral-900 leading-tight">{rec.assetName}</h4>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-md whitespace-nowrap">{rec.type}</span>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md whitespace-nowrap ${
                                            rec.riskLevel === 'High' ? 'bg-red-50 text-red-500' : 
                                            rec.riskLevel === 'Medium' ? 'bg-orange-50 text-orange-500' : 
                                            'bg-green-50 text-green-500'
                                        }`}>{rec.riskLevel} Risk</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-left sm:text-right pl-14 sm:pl-4 sm:border-l sm:border-neutral-100 w-full sm:w-auto">
                                <div className="text-lg font-bold text-neutral-900">₹{rec.allocationAmount.toLocaleString()}</div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Invest Now</div>
                            </div>
                        </div>
                        
                        <div className="bg-neutral-50 rounded-xl p-4 mb-4 ml-0 md:ml-16">
                            <p className="text-sm text-neutral-600 leading-relaxed font-medium">
                                <span className="text-neutral-400 text-xs uppercase tracking-wider font-bold mr-2">Why:</span>
                                {rec.reasoning}
                            </p>
                        </div>

                        <div className="flex justify-between items-center ml-0 md:ml-16">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 group-hover:bg-black transition-colors"></div>
                                <span className="text-xs font-semibold text-neutral-500 group-hover:text-black transition-colors">{rec.action}</span>
                            </div>
                            <span className="text-xs md:text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 md:px-3 py-1 rounded-full whitespace-nowrap">
                                Potential: {rec.estimatedReturnPct}
                            </span>
                        </div>
                    </div>
                ))}
             </div>

             {/* Chart Section */}
             <div className="lg:col-span-1">
                <div className="bg-neutral-50 rounded-[2rem] p-6 md:p-8 h-full flex flex-col items-center">
                    <h3 className="text-neutral-900 font-bold text-xs uppercase tracking-widest mb-6 w-full text-center">Portfolio Mix</h3>
                    
                    <div className="w-full aspect-square max-w-[220px] relative mb-8">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={result.allocations}
                                    innerRadius={65}
                                    outerRadius={85}
                                    paddingAngle={6}
                                    dataKey="allocationAmount"
                                    stroke="none"
                                    cornerRadius={6}
                                >
                                    {result.allocations.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                     formatter={(value: number) => `₹${value.toLocaleString()}`}
                                     contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold'}}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-bold">Total</span>
                            <span className="text-lg font-bold text-neutral-900">₹{parseInt(amount).toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="w-full space-y-3">
                        {result.allocations.map((entry, index) => (
                            <div key={index} className="flex justify-between items-center text-sm p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                                    <span className="text-neutral-600 font-medium text-xs truncate max-w-[120px] sm:max-w-none">{entry.assetName}</span>
                                </div>
                                <span className="font-bold text-neutral-900 text-xs">₹{entry.allocationAmount.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};