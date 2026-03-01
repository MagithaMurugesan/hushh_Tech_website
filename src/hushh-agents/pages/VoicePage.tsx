/**
 * Hushh Agents — Voice Assistant Page
 * Real-time Tamil Voice AI powered by Gemini Live API
 * Dedicated voice-first interface for Tamil users
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import HushhLogo from '../../components/images/Hushhogo.png';

/* ── Voice states ── */
type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error';

/* ── Language configs ── */
const LANGUAGE_CONFIG = {
  'ta-IN': {
    name: 'தமிழ்',
    nameEn: 'Tamil',
    greeting: 'வணக்கம்! நான் ஹஷ் AI. என்னிடம் தமிழில் பேசுங்கள்.',
    greetingEn: 'Hello! I am Hushh AI. Speak to me in Tamil.',
    listeningText: 'கேட்கிறேன்...',
    processingText: 'சிந்திக்கிறேன்...',
    speakingText: 'பேசுகிறேன்...',
    tapToSpeak: 'பேச தொடவும்',
    systemPrompt: `நீங்கள் ஹஷ் (Hushh) AI உதவியாளர். தமிழில் மட்டுமே பதிலளிக்கவும்.
You are Hushh AI assistant. ALWAYS respond in Tamil language only.
Be helpful, friendly, and conversational.
Keep responses concise for voice conversations.`,
  },
  'hi-IN': {
    name: 'हिंदी',
    nameEn: 'Hindi',
    greeting: 'नमस्ते! मैं हुश AI हूं। मुझसे हिंदी में बात करें।',
    greetingEn: 'Hello! I am Hushh AI. Speak to me in Hindi.',
    listeningText: 'सुन रहा हूं...',
    processingText: 'सोच रहा हूं...',
    speakingText: 'बोल रहा हूं...',
    tapToSpeak: 'बोलने के लिए टैप करें',
    systemPrompt: `आप हुश (Hushh) AI सहायक हैं। केवल हिंदी में जवाब दें।
You are Hushh AI assistant. ALWAYS respond in Hindi language only.
Be helpful, friendly, and conversational.
Keep responses concise for voice conversations.`,
  },
  'en-US': {
    name: 'English',
    nameEn: 'English',
    greeting: 'Hello! I am Hushh AI. How can I help you today?',
    greetingEn: 'Hello! I am Hushh AI. How can I help you today?',
    listeningText: 'Listening...',
    processingText: 'Thinking...',
    speakingText: 'Speaking...',
    tapToSpeak: 'Tap to speak',
    systemPrompt: `You are Hushh AI assistant. Be helpful, friendly, and conversational.
Keep responses concise for voice conversations.`,
  },
};

export default function VoicePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading, user } = useAuth();
  
  const langParam = (searchParams.get('lang') as keyof typeof LANGUAGE_CONFIG) || 'ta-IN';
  const langConfig = LANGUAGE_CONFIG[langParam] || LANGUAGE_CONFIG['ta-IN'];
  
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { state: { redirectTo: `/hushh-agents/voice?lang=${langParam}` } });
    }
  }, [isAuthenticated, isLoading, navigate, langParam]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  // Connect to Gemini Live API
  const connect = useCallback(async () => {
    if (wsRef.current || status === 'connecting') return;
    
    setStatus('connecting');
    setError(null);

    try {
      // Get WebSocket URL from Supabase Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wowsvdyzwvujfzfswqpm.supabase.co';
      const tokenRes = await fetch(`${supabaseUrl}/functions/v1/gemini-voice-token`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ language: langParam }),
      });

      if (!tokenRes.ok) throw new Error('Failed to get connection');

      const { wsUrl } = await tokenRes.json();
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ Connected to Gemini Live API');
        
        // Send setup with Tamil config
        ws.send(JSON.stringify({
          setup: {
            model: 'gemini-2.5-flash-native-audio-preview-12-2025',
            config: {
              response_modalities: ['AUDIO', 'TEXT'],
              system_instruction: langConfig.systemPrompt,
              speech_config: {
                language_code: langParam,
              },
            },
          },
        }));
        
        setStatus('idle');
        setResponse(langConfig.greeting);
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle transcription
          if (data.serverContent?.inputTranscript) {
            setTranscript(data.serverContent.inputTranscript);
          }

          // Handle response
          if (data.serverContent?.modelTurn?.parts) {
            setStatus('speaking');
            for (const part of data.serverContent.modelTurn.parts) {
              if (part.text) {
                setResponse(part.text);
              }
              if (part.inlineData?.data) {
                const audioData = Uint8Array.from(atob(part.inlineData.data), c => c.charCodeAt(0));
                audioQueueRef.current.push(audioData.buffer);
                playAudio();
              }
            }
          }

          // Turn complete
          if (data.serverContent?.turnComplete) {
            setStatus('idle');
          }

          // Handle interruption
          if (data.serverContent?.interrupted) {
            audioQueueRef.current = [];
            isPlayingRef.current = false;
            setStatus('idle');
          }
        } catch (err) {
          console.error('Message error:', err);
        }
      };

      ws.onerror = () => {
        setError('Connection failed. Please try again.');
        setStatus('error');
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        wsRef.current = null;
        setStatus('idle');
      };

    } catch (err) {
      console.error('Connect error:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
      setStatus('error');
    }
  }, [langParam, langConfig, status]);

  // Play audio response
  const playAudio = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    
    isPlayingRef.current = true;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }

      while (audioQueueRef.current.length > 0) {
        const audioData = audioQueueRef.current.shift();
        if (!audioData) continue;

        const int16 = new Int16Array(audioData);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768;
        }

        const buffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
        buffer.getChannelData(0).set(float32);

        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        
        await new Promise<void>(resolve => {
          source.onended = () => resolve();
          source.start();
        });
      }
    } catch (err) {
      console.error('Playback error:', err);
    } finally {
      isPlayingRef.current = false;
      if (audioQueueRef.current.length === 0) {
        setStatus('idle');
      }
    }
  }, []);

  // Start listening
  const startListening = useCallback(async () => {
    if (!wsRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      
      mediaStreamRef.current = stream;
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(1024, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || status !== 'listening') return;
        
        const input = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          pcm[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
        }

        wsRef.current.send(JSON.stringify({
          realtimeInput: {
            audio: {
              data: btoa(String.fromCharCode(...new Uint8Array(pcm.buffer))),
              mimeType: 'audio/pcm;rate=16000',
            },
          },
        }));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      
      setStatus('listening');
      setTranscript('');

    } catch (err) {
      console.error('Mic error:', err);
      setError('Please allow microphone access');
      setStatus('error');
    }
  }, [status]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (status === 'listening') {
      setStatus('processing');
    }
  }, [status]);

  // Disconnect
  const disconnect = useCallback(() => {
    stopListening();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  }, [stopListening]);

  // Handle mic button
  const handleMicPress = useCallback(() => {
    if (!wsRef.current) {
      connect();
    } else if (status === 'idle' || status === 'speaking') {
      startListening();
    } else if (status === 'listening') {
      stopListening();
    }
  }, [connect, startListening, stopListening, status]);

  if (isLoading || !mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-white/20" />
          <div className="w-32 h-4 bg-white/20 rounded" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // Status text
  const getStatusText = () => {
    switch (status) {
      case 'connecting': return 'Connecting...';
      case 'listening': return langConfig.listeningText;
      case 'processing': return langConfig.processingText;
      case 'speaking': return langConfig.speakingText;
      default: return langConfig.tapToSpeak;
    }
  };

  // Status color
  const getStatusColor = () => {
    switch (status) {
      case 'listening': return 'bg-red-500';
      case 'speaking': return 'bg-green-500';
      case 'processing': return 'bg-yellow-500';
      case 'error': return 'bg-red-600';
      default: return 'bg-white';
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col text-white antialiased selection:bg-white/20"
      style={{ 
        background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 30%, #FF6B00 70%, #E65100 100%)',
      }}
    >
      {/* ═══ Header ═══ */}
      <header className="px-6 py-5 flex justify-between items-center">
        <Link to="/hushh-agents" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
            <img src={HushhLogo} alt="Hushh" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <span className="font-semibold text-sm">Hushh AI</span>
            <span className="text-[9px] text-white/70 block uppercase tracking-widest">
              {langConfig.name} Voice
            </span>
          </div>
        </Link>
        
        <button
          onClick={() => navigate('/hushh-agents')}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Close"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>

      {/* ═══ Main Content ═══ */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        
        {/* Response Text */}
        <div className="max-w-md text-center mb-8 min-h-[120px] flex items-center justify-center">
          <p className="text-xl md:text-2xl font-light leading-relaxed">
            {response || langConfig.greeting}
          </p>
        </div>

        {/* Transcript */}
        {transcript && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-3 mb-8 max-w-sm">
            <p className="text-sm text-white/80 text-center italic">
              "{transcript}"
            </p>
          </div>
        )}

        {/* Mic Button */}
        <div className="relative">
          {/* Pulse animation when listening */}
          {status === 'listening' && (
            <>
              <div className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
              <div className="absolute inset-[-20px] rounded-full border-2 border-white/30 animate-pulse" />
            </>
          )}
          
          <button
            onClick={handleMicPress}
            disabled={status === 'connecting' || status === 'processing'}
            className={`
              relative w-32 h-32 rounded-full flex items-center justify-center
              transition-all duration-300 transform
              ${status === 'listening' ? 'scale-110 bg-red-500' : getStatusColor()}
              ${status === 'idle' ? 'hover:scale-105 shadow-2xl' : ''}
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            aria-label={status === 'listening' ? 'Stop listening' : 'Start listening'}
          >
            <span 
              className={`material-symbols-outlined text-5xl ${
                status === 'listening' ? 'text-white animate-pulse' : 'text-orange-500'
              }`}
            >
              {status === 'listening' ? 'stop' : 'mic'}
            </span>
          </button>
        </div>

        {/* Status Text */}
        <p className="mt-8 text-lg font-medium">
          {getStatusText()}
        </p>

        {/* Error */}
        {error && (
          <div className="mt-6 bg-red-500/20 backdrop-blur-md rounded-xl px-4 py-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">error</span>
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Language Badge */}
        <div className="mt-8 flex items-center gap-2">
          <span className="text-sm text-white/60">Powered by</span>
          <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium">
            Hushh Live API
          </span>
        </div>
      </main>

      {/* ═══ Footer ═══ */}
      <footer className="px-6 py-4 flex justify-center">
        <p className="text-xs text-white/50 text-center">
          {langParam === 'ta-IN' && 'தமிழில் பேசுங்கள், தமிழில் பதில் பெறுங்கள்'}
          {langParam === 'hi-IN' && 'हिंदी में बोलें, हिंदी में जवाब पाएं'}
          {langParam === 'en-US' && 'Speak naturally, get instant responses'}
        </p>
      </footer>
    </div>
  );
}
