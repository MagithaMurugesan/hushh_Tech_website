/**
 * ResumeUploadDialog.tsx
 * 
 * Beautiful modal for resume upload with drag-and-drop.
 * Triggered after neural greeting in the Vision Session flow.
 * 
 * Flow: Coach Select → Welcome → Calibration → Neural Greeting → [THIS DIALOG] → Vision Session
 * 
 * Features:
 * - Hushh-branded narrative (no "Gemini" references)
 * - Multi-phase upload states: idle → uploading → caching → success
 * - Auto-close after success with animation
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Coach } from '../../types';

type UploadPhase = 'idle' | 'uploading' | 'caching' | 'success';

interface ResumeUploadDialogProps {
  isOpen: boolean;
  coach: Coach;
  onUpload: (file: File) => void;
  onSkip: () => void;
  onComplete?: () => void;
  isUploading?: boolean;
  uploadProgress?: number;
  isComplete?: boolean;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Hushh-branded upload phase messages
const UPLOAD_MESSAGES = {
  uploading: [
    'Activating Neural Analysis...',
    'Connecting to Hushh AI Core...',
    'Preparing Deep Intelligence...',
    'Initiating Career Blueprint...',
  ],
  caching: [
    'Caching your career story...',
    'Building intelligence matrix...',
    'Optimizing neural pathways...',
  ],
};

const ResumeUploadDialog: React.FC<ResumeUploadDialogProps> = ({
  isOpen,
  coach,
  onUpload,
  onSkip,
  onComplete,
  isUploading = false,
  uploadProgress = 0,
  isComplete = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [currentMessage, setCurrentMessage] = useState('');
  const [hasCompletedSuccessfully, setHasCompletedSuccessfully] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset internal state when dialog opens fresh
  useEffect(() => {
    if (isOpen && !isUploading && !isComplete && uploadProgress === 0) {
      setHasCompletedSuccessfully(false);
      setUploadPhase('idle');
      setSelectedFile(null);
    }
  }, [isOpen, isUploading, isComplete, uploadProgress]);

  // Determine upload phase based on progress
  // Once we've completed successfully, don't go back to other states
  useEffect(() => {
    if (hasCompletedSuccessfully) {
      setUploadPhase('success');
      return;
    }
    
    if (isComplete) {
      setHasCompletedSuccessfully(true);
      setUploadPhase('success');
    } else if (isUploading) {
      if (uploadProgress < 70) {
        setUploadPhase('uploading');
      } else if (uploadProgress < 100) {
        setUploadPhase('caching');
      }
    } else if (!hasCompletedSuccessfully) {
      setUploadPhase('idle');
    }
  }, [isUploading, uploadProgress, isComplete, hasCompletedSuccessfully]);

  // Cycle through upload messages
  useEffect(() => {
    if (uploadPhase === 'uploading' || uploadPhase === 'caching') {
      const messages = UPLOAD_MESSAGES[uploadPhase];
      let index = 0;
      setCurrentMessage(messages[index]);
      
      const interval = setInterval(() => {
        index = (index + 1) % messages.length;
        setCurrentMessage(messages[index]);
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [uploadPhase]);

  // Auto-close after success
  useEffect(() => {
    if (uploadPhase === 'success') {
      const timer = setTimeout(() => {
        onComplete?.();
      }, 2000); // 2 second delay to show success state
      
      return () => clearTimeout(timer);
    }
  }, [uploadPhase, onComplete]);

  const validateFile = useCallback((file: File): boolean => {
    setError(null);
    
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please upload a PDF or Word document');
      return false;
    }
    
    if (file.size > 30 * 1024 * 1024) {
      setError('File size must be under 30MB');
      return false;
    }
    
    return true;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  }, [validateFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  }, [validateFile]);

  const handleUpload = useCallback(() => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  }, [selectedFile, onUpload]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (!isOpen) return null;

  // Success state - full screen celebration
  if (uploadPhase === 'success') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
        
        <div className="relative text-center animate-in zoom-in-95 fade-in duration-500">
          {/* Success glow */}
          <div className="absolute inset-0 bg-green-500/20 rounded-full blur-[100px] scale-150" />
          
          <div className="relative">
            {/* Success icon */}
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center animate-bounce">
              <i className="fas fa-check text-4xl text-white"></i>
            </div>
            
            <h2 className="font-serif text-3xl font-bold text-white mb-3">
              Resume Loaded
            </h2>
            <p className="text-green-400 text-lg font-medium mb-2">
              Neural Intelligence Active
            </p>
            <p className="text-white/50 text-sm">
              {selectedFile?.name}
            </p>
            
            {/* Progress dots */}
            <div className="flex justify-center gap-2 mt-8">
              {[0, 1, 2].map((i) => (
                <div 
                  key={i}
                  className="w-2 h-2 rounded-full bg-green-400 animate-pulse"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
            
            <p className="text-white/30 text-xs mt-4 uppercase tracking-widest">
              Proceeding to session...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />

      {/* Dialog */}
      <div className="relative w-full max-w-lg animate-in zoom-in-95 fade-in duration-300">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20 rounded-[40px] blur-3xl" />

        <div className="relative glass rounded-[40px] border border-white/10 overflow-hidden">
          {/* Header */}
          <div className="p-8 pb-4 text-center">
            {/* Coach avatar */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full overflow-hidden border-2 border-white/20 shadow-2xl">
              <img 
                src={coach.avatarUrl} 
                alt={coach.name}
                className="w-full h-full object-cover"
              />
            </div>

            <h2 className="font-serif text-2xl font-bold text-white mb-2">
              Upload Your Resume
            </h2>
            <p className="text-white/50 text-sm leading-relaxed max-w-sm mx-auto">
              {coach.id === 'victor' 
                ? "Let me architect your career blueprint. Share your resume for a deep structural analysis."
                : "Share your career story with me. I'll help you craft a compelling narrative."
              }
            </p>
          </div>

          {/* Upload Zone */}
          <div className="px-8 pb-4">
            {!selectedFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleBrowseClick}
                className={`
                  relative p-10 rounded-3xl border-2 border-dashed cursor-pointer
                  transition-all duration-300
                  ${isDragging 
                    ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' 
                    : 'border-white/20 hover:border-white/40 hover:bg-white/5'
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="text-center">
                  <div className={`
                    w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center
                    transition-all duration-300
                    ${isDragging ? 'bg-blue-500/20 scale-110' : 'bg-white/5'}
                  `}>
                    <i className={`fas fa-file-upload text-2xl ${isDragging ? 'text-blue-400' : 'text-white/40'}`}></i>
                  </div>

                  <p className="text-white font-medium mb-2">
                    {isDragging ? 'Drop your resume here' : 'Drag & drop your resume'}
                  </p>
                  <p className="text-white/40 text-sm">
                    or <span className="text-blue-400 hover:underline">browse</span> to choose a file
                  </p>
                  <p className="text-white/20 text-xs mt-3">
                    PDF, DOC, DOCX • Max 30MB
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    isUploading ? 'bg-blue-500/30 animate-pulse' : 'bg-blue-500/20'
                  }`}>
                    <i className={`fas fa-file-pdf text-2xl ${isUploading ? 'text-blue-300' : 'text-blue-400'}`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{selectedFile.name}</p>
                    <p className="text-white/40 text-sm">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  {!isUploading && (
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="w-10 h-10 rounded-full bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                    >
                      <i className="fas fa-times text-white/40 hover:text-red-400"></i>
                    </button>
                  )}
                </div>

                {/* Upload progress with Hushh narrative */}
                {isUploading && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-blue-400 font-medium">{currentMessage}</span>
                      <span className="text-white/40">{uploadProgress}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 transition-all duration-300 relative"
                        style={{ width: `${uploadProgress}%` }}
                      >
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                      </div>
                    </div>
                    
                    {/* Phase indicator */}
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <div className={`w-2 h-2 rounded-full transition-colors ${
                        uploadPhase === 'uploading' ? 'bg-blue-400 animate-pulse' : 'bg-white/20'
                      }`} />
                      <span className="text-[9px] text-white/30 uppercase tracking-wider">Upload</span>
                      <div className="w-8 h-px bg-white/10" />
                      <div className={`w-2 h-2 rounded-full transition-colors ${
                        uploadPhase === 'caching' ? 'bg-purple-400 animate-pulse' : 'bg-white/20'
                      }`} />
                      <span className="text-[9px] text-white/30 uppercase tracking-wider">Intelligence</span>
                      <div className="w-8 h-px bg-white/10" />
                      <div className={`w-2 h-2 rounded-full transition-colors ${
                        isComplete ? 'bg-green-400' : 'bg-white/20'
                      }`} />
                      <span className="text-[9px] text-white/30 uppercase tracking-wider">Ready</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
                <i className="fas fa-exclamation-circle text-red-400"></i>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-8 pt-4 flex flex-col gap-3">
            <button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className={`
                w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.3em]
                transition-all duration-300
                ${selectedFile && !isUploading
                  ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-[0_0_40px_rgba(59,130,246,0.4)]'
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
                }
              `}
            >
              {isUploading ? (
                <span className="flex items-center justify-center gap-3">
                  <i className="fas fa-spinner animate-spin"></i>
                  {uploadPhase === 'caching' ? 'Building Intelligence...' : 'Analyzing Resume...'}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-3">
                  <i className="fas fa-brain"></i>
                  Begin Deep Analysis
                </span>
              )}
            </button>

            <button
              onClick={onSkip}
              disabled={isUploading}
              className="w-full py-3 rounded-xl text-white/40 hover:text-white/60 text-[10px] uppercase tracking-[0.3em] transition-colors"
            >
              Skip for now • Chat without resume
            </button>
          </div>

          {/* Neural decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>
      </div>
    </div>
  );
};

export default ResumeUploadDialog;
