import React, { useState, useMemo } from 'react';
import { Coach } from './types';
import { COACHES } from './constants';
import CoachCard from './components/CoachCard';
import LiveSession from './components/LiveSession';
import EmailLoginModal from './components/EmailLoginModal';
import { useEmailAuth } from './hooks/useEmailAuth';

type FilterType = 'all' | 'biological' | 'automation' | 'dating' | 'career';

const App: React.FC = () => {
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // Email Auth Hook
  const { isAuthenticated, isLoading, user, signOut } = useEmailAuth();

  const filteredCoaches = useMemo(() => {
    if (activeFilter === 'all') return COACHES;
    return COACHES.filter(coach => coach.category === activeFilter);
  }, [activeFilter]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020202] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/10 border-t-white rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-white/30 text-sm uppercase tracking-[0.3em]">Initializing Neural Matrix...</p>
        </div>
      </div>
    );
  }

  // Show login modal if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#020202] flex items-center justify-center">
        <EmailLoginModal 
          isOpen={true} 
          onClose={() => {}} 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020202] text-white selection:bg-rose-500/30 overflow-x-hidden">
      {/* Immersive Neural Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-purple-900/10 rounded-full blur-[180px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-blue-900/10 rounded-full blur-[180px] animate-pulse"></div>
        <div className="absolute top-[30%] left-[20%] w-[50%] h-[50%] bg-rose-900/10 rounded-full blur-[140px]"></div>
        <div className="absolute inset-0 portal-bg opacity-40"></div>
      </div>

      {!selectedCoach ? (
        <div className="relative z-10 max-w-[1600px] mx-auto px-6 py-16 md:py-32">
          {/* User Status Bar */}
          <div className="fixed top-6 right-6 z-50 flex items-center gap-4">
            <div className="glass rounded-full px-6 py-3 border border-white/10 flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-black">
                  {user?.email || 'Connected'}
                </span>
              </div>
              <div className="w-px h-4 bg-white/10"></div>
              <button
                onClick={signOut}
                className="text-[10px] uppercase tracking-[0.2em] text-white/30 hover:text-red-400 transition-colors font-black"
              >
                Disconnect
              </button>
            </div>
          </div>

          {/* Main Header */}
          <header className="mb-20 md:mb-32 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="flex flex-col items-center gap-6 mb-12">
                <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full glass border border-white/5 shadow-2xl">
                   <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></div>
                   <span className="text-[10px] md:text-[11px] uppercase tracking-[0.5em] text-white/50 font-black">hushh Neural Architecture • Sovereign Collective v4.5</span>
                </div>
            </div>

            <h1 className="font-serif text-5xl sm:text-7xl md:text-[11rem] font-bold mb-10 tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white/80 to-white/10 leading-none">
              hushh Sovereign
            </h1>

            <p className="max-w-4xl mx-auto text-lg md:text-2xl text-white/30 font-light leading-relaxed px-4 md:px-0">
              Navigate the hierarchy of performance. Our agents facilitate 
              <span className="text-white/70 font-medium mx-2 italic">absolute resonance</span> 
              through the hushh Uplink. Rebuild your 
              <span className="text-blue-400 font-semibold mx-1">career trajectory</span>, 
              <span className="text-white/60 font-semibold mx-1">biological profile</span>, 
              <span className="text-cyan-400 font-semibold mx-1">automation workflows</span>, or 
              <span className="text-rose-500/80 font-bold mx-1 uppercase tracking-wider">sovereign intimacy</span>.
            </p>
          </header>

          {/* Neural Filter Node */}
          <div className="mb-16 md:mb-24 flex justify-center animate-in fade-in zoom-in-95 duration-700 delay-300">
             <div className="p-2 rounded-[32px] glass border border-white/10 flex flex-wrap justify-center items-center gap-2 bg-black/40 shadow-3xl">
                {[
                    { id: 'all', label: 'All Sovereigns', icon: 'fa-globe' },
                    { id: 'career', label: 'Resume Node', icon: 'fa-file-alt' },
                    { id: 'biological', label: 'Biological Node', icon: 'fa-dna' },
                    { id: 'automation', label: 'Automation Node', icon: 'fa-robot' },
                    { id: 'dating', label: 'Intimacy Node', icon: 'fa-heart' }
                ].map((filter) => (
                    <button
                        key={filter.id}
                        onClick={() => setActiveFilter(filter.id as FilterType)}
                        className={`
                            px-6 py-3 md:px-10 md:py-4 rounded-[24px] flex items-center gap-3 transition-all duration-500
                            ${activeFilter === filter.id 
                                ? 'bg-white text-black shadow-[0_0_50px_rgba(255,255,255,0.2)] scale-105' 
                                : 'text-white/30 hover:text-white/60 hover:bg-white/5'
                            }
                        `}
                    >
                        <i className={`fas ${filter.icon} text-xs md:text-sm`}></i>
                        <span className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.3em]">{filter.label}</span>
                    </button>
                ))}
             </div>
          </div>

          {/* Agent Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-10">
            {filteredCoaches.map((coach, index) => (
              <div 
                key={coach.id} 
                className="card-3d animate-in fade-in slide-in-from-bottom-8 duration-700"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CoachCard 
                  coach={coach} 
                  onSelect={setSelectedCoach} 
                />
              </div>
            ))}
          </div>

          <footer className="mt-32 md:mt-48 pt-16 md:pt-20 border-t border-white/5 flex flex-col items-center gap-10">
            <div className="flex flex-wrap justify-center gap-10 md:gap-16 text-[10px] md:text-[12px] uppercase tracking-[0.4em] text-white/20 font-black px-6 text-center">
                <div className="flex items-center gap-3">
                   <div className="w-1 h-1 rounded-full bg-blue-500"></div>
                   <span>Career Architect</span>
                </div>
                <div className="flex items-center gap-3">
                   <div className="w-1 h-1 rounded-full bg-purple-500"></div>
                   <span>Bio-Resonance</span>
                </div>
                <div className="flex items-center gap-3">
                   <div className="w-1 h-1 rounded-full bg-cyan-400"></div>
                   <span>Automation</span>
                </div>
                <div className="flex items-center gap-3">
                   <div className="w-1 h-1 rounded-full bg-rose-500"></div>
                   <span>Sovereign Intimacy</span>
                </div>
            </div>
            
            <div className="text-center space-y-4 px-6">
                <p className="text-white/10 text-[9px] md:text-[10px] uppercase tracking-[0.4em] font-medium max-w-lg mx-auto leading-relaxed">
                  hushh Sovereign is an agentic neural matrix designed for absolute human optimization.
                </p>
                <p className="text-white/5 text-[8px] md:text-[9px] uppercase tracking-widest">
                  &copy; 2025 hushh Architecture • The Narrative Ecosystem • Total sync active
                </p>
            </div>
          </footer>
        </div>
      ) : (
        <LiveSession 
          coach={selectedCoach} 
          onClose={() => setSelectedCoach(null)} 
        />
      )}
    </div>
  );
};

export default App;
