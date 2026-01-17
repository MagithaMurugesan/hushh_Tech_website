/**
 * geminiFileService.ts
 * 
 * Gemini File API Integration
 * - Inline data for files up to 30MB (resumes, documents)
 * - File API for larger files (up to 2GB)
 * - Explicit caching for resume tokens
 * 
 * Reference: https://ai.google.dev/gemini-api/docs/file-input-methods
 * 
 * For resumes (typically < 5MB), we use inline base64 encoding
 * which is simpler and more reliable than the File API.
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';

// Max file size for inline upload (30MB - well under Gemini's 50MB PDF limit)
export const MAX_INLINE_FILE_SIZE = 30 * 1024 * 1024;

/**
 * Convert a File to base64 string for inline upload to Gemini
 * This is the simplest and most reliable method for files under 50MB
 */
export async function convertFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Prepare resume for Gemini Live session using inline base64
 * This is simpler and more reliable than the File API + caching approach
 * 
 * Returns the base64 data and mime type for sending to Live session
 */
export async function prepareResumeForLiveSession(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<{
  base64Data: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
}> {
  // Validate file size
  if (file.size > MAX_INLINE_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_INLINE_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Step 1: Reading file (0-30%)
  if (onProgress) onProgress({ loaded: 0, total: 100, percentage: 10 });
  
  const base64Data = await convertFileToBase64(file);
  
  // Step 2: Processing complete (30-60%)
  if (onProgress) onProgress({ loaded: 60, total: 100, percentage: 60 });
  
  // Step 3: Ready for session (60-100%)
  if (onProgress) onProgress({ loaded: 100, total: 100, percentage: 100 });

  return {
    base64Data,
    mimeType: file.type,
    fileName: file.name,
    fileSize: file.size,
  };
}

export interface UploadedFile {
  name: string;           // e.g., "files/abc123"
  displayName: string;    // Original filename
  mimeType: string;
  sizeBytes: string;
  uri: string;
  state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
  createTime: string;
  expirationTime: string;
}

export interface CachedContent {
  name: string;           // e.g., "cachedContents/abc123"
  displayName: string;
  model: string;
  createTime: string;
  updateTime: string;
  expireTime: string;
  usageMetadata?: {
    totalTokenCount: number;
  };
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Upload a file to Gemini File API
 * Supports files up to 2GB, persists for 48 hours
 */
export async function uploadFileToGemini(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadedFile> {
  // Step 1: Initiate resumable upload
  const initResponse = await fetch(
    `${GEMINI_API_BASE}/upload/v1beta/files?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': file.size.toString(),
        'X-Goog-Upload-Header-Content-Type': file.type,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: { displayName: file.name }
      }),
    }
  );

  if (!initResponse.ok) {
    const error = await initResponse.text();
    console.error('[GeminiFile] Upload init failed:', error);
    throw new Error(`Failed to initiate upload: ${initResponse.status}`);
  }

  const uploadUrl = initResponse.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) {
    throw new Error('No upload URL received from Gemini');
  }

  // Step 2: Upload the file content
  const arrayBuffer = await file.arrayBuffer();
  
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': file.size.toString(),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: arrayBuffer,
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    console.error('[GeminiFile] Upload failed:', error);
    throw new Error(`Failed to upload file: ${uploadResponse.status}`);
  }

  const result = await uploadResponse.json();
  console.log('[GeminiFile] Upload success:', result);
  
  // Simulate progress for UX (actual progress tracking requires XHR)
  if (onProgress) {
    onProgress({ loaded: file.size, total: file.size, percentage: 100 });
  }

  return result.file as UploadedFile;
}

/**
 * Simple upload for smaller files (< 20MB)
 * Uses inline upload instead of resumable
 */
export async function uploadFileSimple(file: File): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `${GEMINI_API_BASE}/upload/v1beta/files?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${error}`);
  }

  const result = await response.json();
  return result.file as UploadedFile;
}

/**
 * Wait for file to finish processing
 * Some files (PDFs, docs) need processing time
 */
export async function waitForFileProcessing(
  fileName: string,
  maxWaitMs: number = 60000
): Promise<UploadedFile> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(
      `${GEMINI_API_BASE}/v1beta/${fileName}?key=${GEMINI_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to check file status: ${response.status}`);
    }
    
    const file = await response.json() as UploadedFile;
    
    if (file.state === 'ACTIVE') {
      return file;
    }
    
    if (file.state === 'FAILED') {
      throw new Error('File processing failed');
    }
    
    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('File processing timed out');
}

/**
 * Create a cached content from an uploaded file
 * Uses Gemini's explicit caching feature
 * Cache TTL: 1 hour (can be extended up to 24 hours)
 */
export async function createCachedContent(
  uploadedFile: UploadedFile,
  displayName: string,
  systemInstruction?: string,
  ttlSeconds: number = 3600
): Promise<CachedContent> {
  const response = await fetch(
    `${GEMINI_API_BASE}/v1beta/cachedContents?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-2.0-flash',
        displayName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                fileData: {
                  fileUri: uploadedFile.uri,
                  mimeType: uploadedFile.mimeType,
                }
              },
              {
                text: 'This is the resume document for analysis. Remember all details from this resume for our conversation.'
              }
            ]
          }
        ],
        systemInstruction: systemInstruction ? {
          parts: [{ text: systemInstruction }]
        } : undefined,
        ttl: `${ttlSeconds}s`,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[GeminiFile] Cache creation failed:', error);
    throw new Error(`Failed to create cache: ${response.status}`);
  }

  const cache = await response.json();
  console.log('[GeminiFile] Cache created:', cache);
  return cache as CachedContent;
}

/**
 * Generate content using cached resume
 * This uses cached tokens instead of re-sending the file
 */
export async function generateWithCache(
  cacheName: string,
  userMessage: string,
  systemInstruction?: string
): Promise<string> {
  const response = await fetch(
    `${GEMINI_API_BASE}/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cachedContent: cacheName,
        contents: [
          {
            role: 'user',
            parts: [{ text: userMessage }]
          }
        ],
        systemInstruction: systemInstruction ? {
          parts: [{ text: systemInstruction }]
        } : undefined,
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Generation failed: ${error}`);
  }

  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Delete a cached content
 */
export async function deleteCachedContent(cacheName: string): Promise<void> {
  const response = await fetch(
    `${GEMINI_API_BASE}/v1beta/${cacheName}?key=${GEMINI_API_KEY}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    console.error('[GeminiFile] Failed to delete cache');
  }
}

/**
 * Delete an uploaded file
 */
export async function deleteFile(fileName: string): Promise<void> {
  const response = await fetch(
    `${GEMINI_API_BASE}/v1beta/${fileName}?key=${GEMINI_API_KEY}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    console.error('[GeminiFile] Failed to delete file');
  }
}

/**
 * List all uploaded files
 */
export async function listFiles(): Promise<UploadedFile[]> {
  const response = await fetch(
    `${GEMINI_API_BASE}/v1beta/files?key=${GEMINI_API_KEY}`
  );

  if (!response.ok) {
    throw new Error('Failed to list files');
  }

  const result = await response.json();
  return result.files || [];
}

/**
 * High-level function: Upload resume and create cache
 * Returns both the file info and cache name for use in conversations
 */
export async function uploadAndCacheResume(
  file: File,
  coachId: 'victor' | 'sophia',
  onProgress?: (progress: UploadProgress) => void
): Promise<{ file: UploadedFile; cache: CachedContent }> {
  // Step 1: Upload file
  if (onProgress) onProgress({ loaded: 0, total: 100, percentage: 10 });
  
  const uploadedFile = await uploadFileToGemini(file, (p) => {
    if (onProgress) {
      onProgress({ ...p, percentage: Math.min(50, p.percentage / 2) });
    }
  });

  // Step 2: Wait for processing
  if (onProgress) onProgress({ loaded: 50, total: 100, percentage: 50 });
  
  const processedFile = await waitForFileProcessing(uploadedFile.name);

  // Step 3: Create cache with coach-specific context
  if (onProgress) onProgress({ loaded: 70, total: 100, percentage: 70 });

  const coachContext = coachId === 'victor'
    ? `You are Victor Thorne, the Resume Architect. You have access to the user's resume.
       Analyze it with precision - structure, ATS compatibility, quantifiable achievements.
       Reference specific sections when giving feedback.`
    : `You are Sophia Sterling, the Career Oracle. You have access to the user's resume.
       Read the narrative of their career - the story, transitions, growth arcs.
       Reference their journey when providing guidance.`;

  const cache = await createCachedContent(
    processedFile,
    `resume_${coachId}_${Date.now()}`,
    coachContext,
    3600 // 1 hour cache
  );

  if (onProgress) onProgress({ loaded: 100, total: 100, percentage: 100 });

  return { file: processedFile, cache };
}
