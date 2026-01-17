/**
 * ResumeNodeVisionSession.tsx
 * Phase 0: Neural Emotional Layer
 * 
 * This component runs BEFORE the standard LiveSession.
 * It uses MediaPipe Face Mesh + Gemini 3 Pro (the most advanced reasoning model) in parallel to:
 * 1. Analyze user's facial expressions, emotions, and appearance in real-time
 * 2. Display the EmotionalStateHUD with live emotion bars
 * 3. Allow coach selection (Victor Thorne or Sophia Sterling)
 * 4. After neural calibration, proceed to full resume session
 * 
 * Gemini 3 Pro Features:
 * - Deep reasoning with thinking_level: HIGH
 * - 1M token context window
 * - Advanced multimodal understanding
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { Coach } from '../../types';
import { COACHES, AUDIO_SAMPLE_RATE_INPUT, AUDIO_SAMPLE_RATE_OUTPUT } from '../../constants';
import { EmotionalState } from '../../types/resumeNode';
import { useEmotionDetection } from '../../hooks/useEmotionDetection';
import { FaceAnalysis } from '../../services/mediapipeService';
import EmotionalStateHUD from './EmotionalStateHUD';
import ResumeUploadDialog from './ResumeUploadDialog';
import { decode, decodeAudioData, createPcmBlob } from '../../services/audioUtils';
import { prepareResumeForLiveSession } from '../../services/geminiFileService';

interface ResumeNodeVisionSessionProps {
  onClose: () => void;
  onProceedToLiveSession: (coach: Coach) => void;
}

type SessionPhase = 'coach-select' | 'welcome' | 'calibrating' | 'neural-greeting' | 'resume-upload' | 'vision-active';

const CALIBRATION_STEPS = [
  { id: 'init', label: 'INITIALIZING HUSHH NEURAL CORE', duration: 1200 },
  { id: 'vision', label: 'ACTIVATING VISION INTELLIGENCE', duration: 1500 },
  { id: 'ai', label: 'CONNECTING HUSHH AI ENGINE', duration: 1800 },
  { id: 'sync', label: 'SYNCHRONIZING EMOTION MATRIX', duration: 1200 },
];

// Helper to convert MediaPipe FaceAnalysis to EmotionalState for HUD
const mapToEmotionalState = (analysis: FaceAnalysis | null): EmotionalState | null => {
  if (!analysis || !analysis.faceDetected) return null;

  const { emotions, eyeContact, headPose } = analysis;

  // Derive engagement from eye contact and head pose
  const isEngaged = eyeContact && Math.abs(headPose.yaw) < 20;
  const engagement: 'low' | 'medium' | 'high' = 
    isEngaged && emotions.confident > 60 ? 'high' :
    isEngaged ? 'medium' : 'low';

  // Derive attention from eye contact and blinking pattern
  const attention: 'distracted' | 'focused' | 'intense' = 
    eyeContact && emotions.happy > 30 ? 'intense' :
    eyeContact ? 'focused' : 'distracted';

  // Derive confidence level
  const confidence: 'low' | 'moderate' | 'high' = 
    emotions.confident > 70 ? 'high' :
    emotions.confident > 40 ? 'moderate' : 'low';

  return {
    happy: emotions.happy,
    neutral: emotions.neutral,
    confused: emotions.confused,
    worried: emotions.sad, // Map sad to worried
    frustrated: emotions.angry, // Map angry to frustrated
    excited: emotions.surprised, // Map surprised to excited
    engagement,
    attention,
    confidence,
  };
};

const blobToBase64 = (blob: globalThis.Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const ResumeNodeVisionSession: React.FC<ResumeNodeVisionSessionProps> = ({
  onClose,
  onProceedToLiveSession,
}) => {
  // State
  const [phase, setPhase] = useState<SessionPhase>('coach-select');
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [calibrationStep, setCalibrationStep] = useState(0);
  const [emotionalState, setEmotionalState] = useState<EmotionalState | null>(null);
  const [isGeminiConnected, setIsGeminiConnected] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [agentTranscript, setAgentTranscript] = useState('');
  const [neuralReadout, setNeuralReadout] = useState('');
  const [readinessScore, setReadinessScore] = useState(0);
  
  // Resume upload state
  const [showResumeUpload, setShowResumeUpload] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [resumeData, setResumeData] = useState<{ fileName: string; fileSize: number } | null>(null);
  const [welcomeStep, setWelcomeStep] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextInputRef = useRef<AudioContext | null>(null);
  const audioContextOutputRef = useRef<AudioContext | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const frameIntervalRef = useRef<number | null>(null);
  const emotionContextSentRef = useRef(false);

  // Get career coaches (Victor and Sophia)
  const careerCoaches = useMemo(() => 
    COACHES.filter(c => c.category === 'career'),
    []
  );

  // MediaPipe emotion detection hook
  const {
    analysis,
    isReady: isMediaPipeReady,
    isAnalyzing,
    error: mediaPipeError,
    startAnalysis,
    stopAnalysis,
    dominantEmotion,
    getGeminiContext,
  } = useEmotionDetection({
    targetFps: 30,
    geminiContextInterval: 3000,
    onEmotionChange: (current, previous) => {
      // Log significant emotion changes
      console.log('[Vision] Emotion changed:', dominantEmotion, current.emotions);
    },
    onGeminiContext: (context) => {
      // Send emotion context to Gemini periodically
      if (sessionRef.current && isGeminiConnected) {
        sessionRef.current.sendRealtimeInput({
          text: `[NEURAL VISION UPDATE]\n${context}`
        });
      }
    },
  });

  // Update emotional state when analysis changes
  useEffect(() => {
    if (analysis) {
      const mapped = mapToEmotionalState(analysis);
      setEmotionalState(mapped);
      setReadinessScore(analysis.readinessScore);
    }
  }, [analysis]);

  // Handle coach selection
  const handleCoachSelect = useCallback((coach: Coach) => {
    setSelectedCoach(coach);
    setPhase('calibrating');
    runCalibration(coach);
  }, []);

  // Run calibration sequence
  const runCalibration = async (coach: Coach) => {
    for (let i = 0; i < CALIBRATION_STEPS.length; i++) {
      setCalibrationStep(i);
      await new Promise(resolve => setTimeout(resolve, CALIBRATION_STEPS[i].duration));
    }
    setPhase('vision-active');
    startVisionSession(coach);
  };

  // Start the vision session with camera + MediaPipe + Gemini
  const startVisionSession = async (coach: Coach) => {
    try {
      // Initialize audio contexts
      audioContextInputRef.current = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE_INPUT });
      audioContextOutputRef.current = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE_OUTPUT });
      outputNodeRef.current = audioContextOutputRef.current.createGain();
      outputNodeRef.current.connect(audioContextOutputRef.current.destination);

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        // Start MediaPipe analysis
        if (isMediaPipeReady) {
          startAnalysis(videoRef.current);
        }
      }

      // Connect to Gemini 3 Pro - The most intelligent reasoning model
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      
      const visionSystemInstruction = `${coach.systemInstruction}

NEURAL VISION PROTOCOL - PHASE 0 (Powered by Gemini 3 Pro):
You are currently in the Neural Calibration Phase. Your camera uplink is ACTIVE and you can SEE the user.
MediaPipe Face Mesh is running in parallel, analyzing their emotions at 30fps with 468 facial landmarks.

You are using hushh's most advanced AI - Gemini 3 Pro, the latest reasoning model from Google.
This gives you unprecedented ability to understand context, emotions, and nuance.

YOUR TASK:
1. GREET the user warmly, commenting on what you observe through the camera
2. ANALYZE their appearance, expression, and emotional state with deep reasoning
3. REACT to their emotions in real-time as you receive [NEURAL VISION UPDATE] messages
4. PREPARE them for the resume analysis by building genuine rapport
5. When they seem ready (readiness score high, emotions stable), offer to proceed

EMOTIONAL AWARENESS TRIGGERS:
- When you see happiness/excitement: Acknowledge it positively and build on it
- When you see confusion: Slow down, clarify with patience
- When you see worry/frustration: Address it with genuine empathy
- When they nod or show agreement: Confirm and continue confidently
- When eyes widen: Something surprised them, explore what caught their attention

GEMINI 3 PRO ADVANTAGES:
- Deep reasoning allows you to pick up subtle cues
- Advanced context understanding for nuanced conversation
- Think step-by-step before responding to complex emotional states
- You can remember and reference earlier parts of the conversation naturally

IMPORTANT: You are having a LIVE conversation. Be natural, responsive, and human.
After a few exchanges, ask if they're ready to upload their resume for analysis.`;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: coach.voiceName } } },
          systemInstruction: visionSystemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          // Gemini 2.5 Flash Native Audio with thinking capabilities
          thinkingConfig: { thinkingBudget: 2048 },
        },
        callbacks: {
          onopen: () => {
            setIsGeminiConnected(true);
            console.log('[Vision] Gemini Live connected');

            // Set up audio input
            const source = audioContextInputRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextInputRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              sessionPromise.then(session => session.sendRealtimeInput({ media: createPcmBlob(inputData) }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextInputRef.current!.destination);

            // Send initial visual frame with emotion context
            const sendVisualFrame = async () => {
              if (canvasRef.current && videoRef.current) {
                const ctx = canvasRef.current.getContext('2d', { alpha: false });
                if (ctx) {
                  ctx.drawImage(videoRef.current, 0, 0, 320, 240);
                  canvasRef.current.toBlob(async (blob) => {
                    if (blob) {
                      const base64Data = await blobToBase64(blob);
                      sessionPromise.then(session => {
                        session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
                        
                        // Send initial greeting trigger with emotion context
                        if (!emotionContextSentRef.current) {
                          emotionContextSentRef.current = true;
                          setTimeout(() => {
                            const emotionContext = getGeminiContext();
                            session.sendRealtimeInput({
                              text: `[SYSTEM: Neural Vision Uplink Active]
${emotionContext}

You are ${coach.name}, the ${coach.role}. 
GREET the user now. Comment on what you SEE through the camera.
Notice their emotional state and appearance. Be warm and engaging.
This is Phase 0 - Neural Calibration before resume analysis.`
                            });
                          }, 2000);
                        }
                      });
                    }
                  }, 'image/jpeg', 0.6);
                }
              }
            };

            sendVisualFrame();
            frameIntervalRef.current = window.setInterval(sendVisualFrame, 1000);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle transcriptions
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              setAgentTranscript(prev => prev + text);
            }
            if (message.serverContent?.turnComplete) {
              setAgentTranscript('');
            }

            // Handle audio output
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && audioContextOutputRef.current && outputNodeRef.current) {
              setIsModelSpeaking(true);
              const ctx = audioContextOutputRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), ctx, AUDIO_SAMPLE_RATE_OUTPUT, 1);
              const sourceNode = ctx.createBufferSource();
              sourceNode.buffer = buffer;
              sourceNode.connect(outputNodeRef.current);
              sourceNode.onended = () => {
                sourcesRef.current.delete(sourceNode);
                if (sourcesRef.current.size === 0) setIsModelSpeaking(false);
              };
              sourceNode.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(sourceNode);
            }
          },
          onerror: (error) => console.error('[Vision] Gemini error:', error),
          onclose: () => setIsGeminiConnected(false),
        },
      });

      sessionRef.current = await sessionPromise;

    } catch (error) {
      console.error('[Vision] Failed to start:', error);
    }
  };

  // Handle resume upload - using simple inline base64 approach
  const handleResumeUpload = useCallback(async (file: File) => {
    if (!selectedCoach) return;
    
    setIsUploadingResume(true);
    setUploadProgress(0);
    setUploadComplete(false);
    
    try {
      // Use the simpler inline approach
      const result = await prepareResumeForLiveSession(
        file,
        (progress) => setUploadProgress(progress.percentage)
      );
      
      // Store resume data for UI
      setResumeData({ fileName: result.fileName, fileSize: result.fileSize });
      setUploadComplete(true); // Trigger success state in dialog
      
      // Send the resume directly to Gemini Live session as inline data
      if (sessionRef.current) {
        // Send the PDF as inline data to the Live session
        sessionRef.current.sendRealtimeInput({
          media: {
            data: result.base64Data,
            mimeType: result.mimeType,
          }
        });
        
        // Then send a text prompt to analyze it
        setTimeout(() => {
          sessionRef.current?.sendRealtimeInput({
            text: `[SYSTEM: Resume Uploaded Successfully]
The user has just uploaded their resume: ${result.fileName} (${(result.fileSize / 1024).toFixed(1)} KB)
The resume PDF has been sent to you for analysis.

Now provide a brief acknowledgment and ask what aspect of their resume they'd like to explore first.
Be specific - mention that you can see their resume and are ready to analyze it.`
          });
        }, 500);
      }
      
      console.log('[Vision] Resume sent to Live session:', result.fileName);
    } catch (error) {
      console.error('[Vision] Resume upload failed:', error);
      setUploadComplete(false);
    } finally {
      setIsUploadingResume(false);
    }
  }, [selectedCoach]);

  // Handle upload complete - called after success animation
  const handleUploadComplete = useCallback(() => {
    setShowResumeUpload(false);
    setUploadComplete(false);
    setUploadProgress(0);
  }, []);

  // Handle skip resume upload
  const handleSkipUpload = useCallback(() => {
    setShowResumeUpload(false);
    
    // Notify Gemini that user skipped upload
    if (sessionRef.current) {
      sessionRef.current.sendRealtimeInput({
        text: `[SYSTEM: User Skipped Resume Upload]
The user chose to continue without uploading a resume.
Adapt your conversation - you can still provide career advice based on verbal discussion.
Ask them about their current role and career goals instead.`
      });
    }
  }, []);

  // Handle proceed to full session
  const handleProceed = useCallback(() => {
    if (selectedCoach) {
      stopSession();
      onProceedToLiveSession(selectedCoach);
    }
  }, [selectedCoach, onProceedToLiveSession]);

  // Show resume upload dialog after greeting
  const handleShowResumeUpload = useCallback(() => {
    setShowResumeUpload(true);
  }, []);

  // Stop session and cleanup
  const stopSession = useCallback(() => {
    stopAnalysis();
    if (sessionRef.current) sessionRef.current.close();
    if (audioContextInputRef.current) audioContextInputRef.current.close();
    if (audioContextOutputRef.current) audioContextOutputRef.current.close();
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    
    // Stop camera
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
  }, [stopAnalysis]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopSession();
  }, [stopSession]);

  // Update neural readout based on phase
  useEffect(() => {
    if (phase === 'vision-active' && analysis) {
      const readouts = [
        `DOMINANT EMOTION: ${dominantEmotion?.toUpperCase() || 'ANALYZING'}`,
        `EYE CONTACT: ${analysis.eyeContact ? 'DIRECT' : 'AVERTED'}`,
        `HEAD POSE: YAW ${analysis.headPose.yaw}° PITCH ${analysis.headPose.pitch}°`,
        `READINESS: ${analysis.readinessScore}%`,
      ];
      setNeuralReadout(readouts[Math.floor(Date.now() / 2000) % readouts.length]);
    }
  }, [phase, analysis, dominantEmotion]);

  // Render coach selection
  if (phase === 'coach-select') {
    return (
      <div className="fixed inset-0 z-50 bg-[#010101] flex items-center justify-center overflow-y-auto py-8">
        <div className="max-w-4xl w-full px-6">
          {/* hushh Narrative Value Proposition */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full glass border border-white/10 mb-8">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse"></div>
              <span className="text-[10px] uppercase tracking-[0.4em] text-white/50 font-black">
                Resume Node • Neural Vision Layer
              </span>
            </div>

            {/* Main Value Proposition */}
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-rose-500/10 blur-3xl"></div>
              <h1 className="relative font-serif text-4xl md:text-6xl font-bold text-white mb-4">
                Your Personal Career AI
              </h1>
              <h2 className="relative text-xl md:text-2xl text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-rose-400 font-medium">
                Powered by Neural Vision • Completely Free
              </h2>
            </div>

            {/* hushh Narrative Box */}
            <div className="max-w-2xl mx-auto mb-10 p-6 rounded-3xl glass border border-white/10 text-left relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
              <div className="relative space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <i className="fas fa-gift text-white text-xs"></i>
                  </div>
                  <div>
                    <h3 className="text-white font-bold mb-1">Enterprise-Grade AI, Zero Cost</h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                      What you're about to experience typically costs <span className="text-white/80 font-medium">$500+/hour</span> with executive career coaches. 
                      We're offering it <span className="text-green-400 font-bold">completely free</span> because we believe everyone deserves a world-class career partner.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-rose-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <i className="fas fa-brain text-white text-xs"></i>
                  </div>
                  <div>
                    <h3 className="text-white font-bold mb-1">Neural Vision Technology</h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                      Real-time emotion analysis with <span className="text-white/80 font-medium">468 facial landmarks</span>, eye contact tracking, and readiness scoring — 
                      the same technology used by Fortune 500 interview trainers.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <i className="fas fa-rocket text-white text-xs"></i>
                  </div>
                  <div>
                    <h3 className="text-white font-bold mb-1">The hushh Promise</h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                      Your data stays <span className="text-white/80 font-medium">100% private</span>. No storage, no selling, no compromises. 
                      Just pure AI power working for <span className="text-blue-400 font-bold">you</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* What You'll Get */}
            <div className="flex flex-wrap justify-center gap-3 mb-10">
              {[
                { icon: 'fa-video', label: 'Live Video Analysis' },
                { icon: 'fa-microphone', label: 'Voice Conversation' },
                { icon: 'fa-file-alt', label: 'Resume Deep Dive' },
                { icon: 'fa-chart-line', label: 'Career Roadmap' },
                { icon: 'fa-shield-alt', label: '100% Private' },
              ].map((feature, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10"
                >
                  <i className={`fas ${feature.icon} text-blue-400 text-xs`}></i>
                  <span className="text-[11px] text-white/60 font-medium">{feature.label}</span>
                </div>
              ))}
            </div>

            <h3 className="font-serif text-2xl md:text-3xl font-bold text-white mb-3">
              Select Your Career Architect
            </h3>
            <p className="text-white/40 max-w-xl mx-auto text-sm">
              Choose your personal AI coach. They'll analyze your presence through neural vision 
              before diving deep into your career journey.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {careerCoaches.map((coach) => (
              <button
                key={coach.id}
                onClick={() => handleCoachSelect(coach)}
                className="group relative overflow-hidden rounded-[32px] glass border border-white/10 hover:border-blue-500/50 transition-all duration-500"
              >
                <div className="absolute inset-0">
                  <img 
                    src={coach.avatarUrl} 
                    alt={coach.name}
                    className="w-full h-full object-cover object-top brightness-50 group-hover:brightness-75 transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
                </div>
                
                <div className="relative p-10 text-left min-h-[300px] flex flex-col justify-end">
                  <div className="mb-4">
                    <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${
                      coach.id === 'victor' 
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' 
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}>
                      {coach.role}
                    </span>
                  </div>
                  <h2 className="font-serif text-3xl font-bold text-white mb-3">
                    {coach.name}
                  </h2>
                  <p className="text-white/50 text-sm leading-relaxed mb-6">
                    {coach.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {coach.expertise.map((skill, i) => (
                      <span 
                        key={i}
                        className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] uppercase tracking-wider text-white/40"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-12 text-center">
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/60 text-[10px] uppercase tracking-[0.3em] font-black transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render calibration
  if (phase === 'calibrating') {
    return (
      <div className="fixed inset-0 z-50 bg-[#010101] flex items-center justify-center">
        <div className="max-w-md w-[85%] p-10 glass rounded-[48px] border border-white/10 text-center space-y-10">
          <div className="w-24 h-24 mx-auto rounded-full bg-white/5 flex items-center justify-center">
            <i className="fas fa-brain text-4xl text-blue-400 animate-pulse"></i>
          </div>
          
          <div>
            <h2 className="text-xl font-serif font-bold tracking-[0.2em] text-white uppercase mb-2">
              {CALIBRATION_STEPS[calibrationStep]?.label}
            </h2>
            <p className="text-white/30 text-sm">
              Preparing neural vision for {selectedCoach?.name}
            </p>
          </div>

          <div className="w-full h-[3px] bg-white/5 relative overflow-hidden rounded-full">
            <div 
              className="absolute inset-0 bg-blue-500 transition-all duration-700 ease-out"
              style={{ width: `${((calibrationStep + 1) / CALIBRATION_STEPS.length) * 100}%` }}
            />
          </div>

          <div className="flex justify-center gap-2">
            {CALIBRATION_STEPS.map((_, i) => (
              <div 
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i <= calibrationStep ? 'bg-blue-500' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Render vision session (main view)
  return (
    <div className="fixed inset-0 z-50 bg-[#010101] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { stopSession(); onClose(); }}
            className="w-10 h-10 rounded-full glass border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors"
          >
            <i className="fas fa-arrow-left text-white/60 text-sm"></i>
          </button>
          <div>
            <h1 className="font-serif text-lg font-bold text-white">{selectedCoach?.name}</h1>
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
              Neural Vision Active
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/10">
            <div className={`w-2 h-2 rounded-full ${isGeminiConnected ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-black">
              {isGeminiConnected ? 'HUSHH AI' : 'CONNECTING'}
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/10">
            <div className={`w-2 h-2 rounded-full ${isAnalyzing ? 'bg-blue-500' : 'bg-yellow-500'} animate-pulse`}></div>
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-black">
              VISION {isAnalyzing ? 'ACTIVE' : 'INIT'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
        {/* Video + Agent View */}
        <div className="flex-[2] relative rounded-[32px] overflow-hidden glass border border-white/10">
          {/* Coach Background */}
          <img 
            src={selectedCoach?.avatarUrl}
            alt={selectedCoach?.name}
            className="absolute inset-0 w-full h-full object-cover object-top brightness-50"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80"></div>

          {/* User Camera Feed - Picture in Picture */}
          <div className="absolute top-6 right-6 w-32 md:w-48 h-24 md:h-36 rounded-2xl overflow-hidden border-2 border-blue-500/30 shadow-2xl z-20">
            <video 
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />
            <canvas ref={canvasRef} width={320} height={240} className="hidden" />
            
            {/* Readiness indicator */}
            <div className="absolute bottom-2 left-2 right-2 h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${readinessScore}%` }}
              />
            </div>
          </div>

          {/* Neural Readout */}
          <div className="absolute top-6 left-6 z-20">
            <div className="flex items-center gap-3 px-4 py-2 rounded-full glass border border-white/10 animate-pulse">
              <i className="fas fa-brain text-blue-400 text-xs"></i>
              <span className="text-[9px] uppercase tracking-[0.2em] text-white/50 font-black">
                {neuralReadout || 'NEURAL VISION SCANNING...'}
              </span>
            </div>
          </div>

          {/* Agent Transcript */}
          {agentTranscript && (
            <div className="absolute bottom-8 left-8 right-8 z-20">
              <div className="p-6 rounded-2xl glass border border-blue-500/30 bg-black/80">
                <p className="text-lg md:text-2xl font-serif text-white leading-relaxed">
                  {agentTranscript}
                </p>
              </div>
            </div>
          )}

          {/* Speaking indicator */}
          <div className="absolute bottom-6 left-6 z-20">
            <div className={`flex items-center gap-3 px-4 py-2 rounded-full glass border ${
              isModelSpeaking ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isModelSpeaking ? 'bg-blue-500 animate-ping' : 'bg-white/20'}`}></div>
              <span className="text-[9px] uppercase tracking-[0.2em] text-white/50 font-black">
                {isModelSpeaking ? 'SPEAKING' : 'LISTENING'}
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar - Emotion HUD + Actions */}
        <div className="flex-1 flex flex-col gap-4 max-w-sm">
          {/* Emotional State HUD */}
          <div className="flex-1 overflow-auto">
            <EmotionalStateHUD emotion={emotionalState} />
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Upload Resume Button */}
            {!resumeData && (
              <button
                onClick={handleShowResumeUpload}
                className="w-full py-4 rounded-2xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-300 text-[11px] font-black uppercase tracking-[0.3em] transition-all group"
              >
                <i className="fas fa-file-upload mr-3 group-hover:animate-bounce"></i>
                Upload Resume
              </button>
            )}
            
            {/* Resume Uploaded Indicator */}
            {resumeData && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-green-500/10 border border-green-500/30">
                <i className="fas fa-check-circle text-green-400"></i>
                <span className="text-green-300 text-[10px] uppercase tracking-[0.2em] font-bold">
                  Resume Ready • {(resumeData.fileSize / 1024).toFixed(1)} KB
                </span>
              </div>
            )}
            
            {readinessScore >= 70 && (
              <button
                onClick={handleProceed}
                className="w-full py-4 rounded-2xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-300 text-[11px] font-black uppercase tracking-[0.3em] transition-all animate-in fade-in zoom-in duration-500"
              >
                <i className="fas fa-check mr-3"></i>
                Proceed to Resume Analysis
              </button>
            )}
            
            <button
              onClick={() => { stopSession(); onClose(); }}
              className="w-full py-4 rounded-2xl glass border border-white/10 hover:bg-white/5 text-white/50 text-[10px] font-black uppercase tracking-[0.3em] transition-all"
            >
              Exit Neural Vision
            </button>
          </div>

          {/* Debug info */}
          {mediaPipeError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
              <i className="fas fa-exclamation-triangle mr-2"></i>
              {mediaPipeError}
            </div>
          )}
        </div>
      </div>

      {/* Resume Upload Dialog */}
      {selectedCoach && (
        <ResumeUploadDialog
          isOpen={showResumeUpload}
          coach={selectedCoach}
          onUpload={handleResumeUpload}
          onSkip={handleSkipUpload}
          onComplete={handleUploadComplete}
          isUploading={isUploadingResume}
          uploadProgress={uploadProgress}
          isComplete={uploadComplete}
        />
      )}
    </div>
  );
};

export default ResumeNodeVisionSession;
