/**
 * Hushh Agents — Code Generation Page (with Conversation History)
 * 
 * Uses Claude Opus 4.5 via GCP Vertex AI.
 * Maintains full conversation context across messages.
 * Modes: generate, debug, explain, optimize
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useChatPersistence, type PersistedMessage } from '../hooks/useChatPersistence';
import HushhLogo from '../../components/images/Hushhogo.png';
import MarkdownRenderer from '../components/MarkdownRenderer';

/* ── Types ── */
type CodeMode = 'generate' | 'debug' | 'explain' | 'optimize';

/** A single message in the conversation thread */
interface ThreadMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  code?: string;
  explanation?: string;
  thinking?: string;
  timestamp: number;
  mode?: CodeMode;
  language?: string;
}

/* ── Language options ── */
const LANGUAGES = [
  { id: 'typescript', label: 'TypeScript', icon: 'TS' },
  { id: 'javascript', label: 'JavaScript', icon: 'JS' },
  { id: 'python', label: 'Python', icon: 'PY' },
  { id: 'react', label: 'React/JSX', icon: 'RX' },
  { id: 'sql', label: 'SQL', icon: 'SQ' },
  { id: 'html', label: 'HTML/CSS', icon: 'HT' },
  { id: 'rust', label: 'Rust', icon: 'RS' },
  { id: 'go', label: 'Go', icon: 'GO' },
];

/* ── Mode configs ── */
const MODES: { id: CodeMode; label: string; icon: string; desc: string }[] = [
  { id: 'generate', label: 'Generate', icon: 'auto_awesome', desc: 'Create new code' },
  { id: 'debug', label: 'Debug', icon: 'bug_report', desc: 'Find & fix bugs' },
  { id: 'explain', label: 'Explain', icon: 'school', desc: 'Understand code' },
  { id: 'optimize', label: 'Optimize', icon: 'speed', desc: 'Improve performance' },
];

const playfair = { fontFamily: "'Playfair Display', serif" };

/** Generate a unique ID for messages */
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function CodePage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const persistence = useChatPersistence('code');

  const [prompt, setPrompt] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [mode, setMode] = useState<CodeMode>('generate');
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [mounted, setMounted] = useState(false);

  // On mount: restore latest session or create new one
  useEffect(() => {
    const latest = persistence.getLatestSession();
    if (latest && latest.messages.length > 0) {
      setThread(latest.messages as ThreadMessage[]);
      setSessionId(latest.id);
    } else {
      setSessionId(persistence.createSession());
    }
    setMounted(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { state: { redirectTo: '/hushh-agents/code' } });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Auto-save thread to localStorage whenever it changes
  useEffect(() => {
    if (sessionId && thread.length > 0) {
      persistence.saveSession(sessionId, thread as PersistedMessage[]);
    }
  }, [thread, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom when thread updates
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  /**
   * Build the messages array for the API from our thread.
   * Each user message = { role: 'user', content }
   * Each assistant message = { role: 'assistant', content: rawText }
   */
  const buildApiMessages = useCallback((currentPrompt: string) => {
    const messages: { role: 'user' | 'assistant'; content: string }[] = [];

    // Add existing thread history
    for (const msg of thread) {
      if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content });
      } else {
        // Reconstruct assistant response for context
        let assistantContent = '';
        if (msg.code) {
          assistantContent += '```\n' + msg.code + '\n```\n\n';
        }
        if (msg.explanation) {
          assistantContent += msg.explanation;
        }
        if (!assistantContent) {
          assistantContent = msg.content;
        }
        messages.push({ role: 'assistant', content: assistantContent });
      }
    }

    // Add the new user message
    messages.push({ role: 'user', content: currentPrompt });

    return messages;
  }, [thread]);

  // Send message with full conversation context
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;

    const userMsg: ThreadMessage = {
      id: genId(),
      role: 'user',
      content: prompt.trim(),
      timestamp: Date.now(),
      mode,
      language,
    };

    // Add user message to thread immediately
    setThread((prev) => [...prev, userMsg]);
    const currentPrompt = prompt.trim();
    setPrompt('');
    setIsGenerating(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ibsisfnjxeowvdtvgzff.supabase.co';

      // Build full message history for context
      const apiMessages = buildApiMessages(currentPrompt);

      const res = await fetch(`${supabaseUrl}/functions/v1/claude-code-gen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          prompt: currentPrompt,
          language,
          mode,
          messages: apiMessages, // Full conversation history!
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Code generation failed');
      }

      // Add assistant response to thread
      const assistantMsg: ThreadMessage = {
        id: genId(),
        role: 'assistant',
        content: data.rawText || data.explanation || data.code || '',
        code: data.code,
        explanation: data.explanation,
        thinking: data.thinking,
        timestamp: Date.now(),
      };

      setThread((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Code gen error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsGenerating(false);
      // Focus textarea for next message
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [prompt, language, mode, isGenerating, buildApiMessages]);

  // Copy code to clipboard
  const handleCopy = useCallback(async (code: string, msgId: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Toggle thinking visibility
  const toggleThinking = useCallback((msgId: string) => {
    setExpandedThinking((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }, []);

  // Start a new conversation (preserves old one in history)
  const handleNewConversation = useCallback(() => {
    const newId = persistence.createSession();
    setSessionId(newId);
    setThread([]);
    setError(null);
    setPrompt('');
    setShowHistory(false);
  }, [persistence]);

  // Load a past session from history
  const handleLoadSession = useCallback((id: string) => {
    const session = persistence.getSession(id);
    if (session) {
      setSessionId(session.id);
      setThread(session.messages as ThreadMessage[]);
      setError(null);
      setPrompt('');
    }
    setShowHistory(false);
  }, [persistence]);

  // Delete a session from history
  const handleDeleteSession = useCallback((id: string) => {
    persistence.deleteSession(id);
    // If we deleted the current session, start fresh
    if (id === sessionId) {
      const newId = persistence.createSession();
      setSessionId(newId);
      setThread([]);
    }
  }, [persistence, sessionId]);

  // Keyboard shortcut (Cmd+Enter to send)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleGenerate();
    }
  }, [handleGenerate]);

  if (isLoading || !mounted) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-purple-500/20" />
          <div className="w-32 h-4 bg-purple-500/20 rounded" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const messageCount = thread.filter((m) => m.role === 'user').length;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#0d1117] text-gray-100 flex flex-col antialiased overflow-x-hidden w-full">

      {/* ═══ Header ═══ */}
      <header className="px-2 sm:px-4 md:px-6 py-2.5 sm:py-4 flex justify-between items-center border-b border-gray-800/60 sticky top-0 bg-[#0d1117]/95 backdrop-blur-md z-50">
        <Link to="/hushh-agents" className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
            <img src={HushhLogo} alt="Hushh" className="w-5 h-5 sm:w-6 sm:h-6 object-contain" />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-[13px] sm:text-sm text-white">Hushh Code</span>
            <span className="text-[8px] sm:text-[9px] text-purple-400 block uppercase tracking-widest truncate">
              {messageCount > 0 ? `${messageCount} msgs · Context Active` : 'Agentic Intelligence'}
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* History button */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 p-2 sm:px-3 sm:py-2 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 transition-colors text-gray-400 hover:text-white text-xs"
            aria-label="Chat History"
            title="Past conversations"
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
          </button>
          {/* New Conversation button */}
          <button
            onClick={handleNewConversation}
            className="flex items-center gap-1 p-2 sm:px-3 sm:py-2 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 transition-colors text-gray-400 hover:text-white text-xs"
            aria-label="New Conversation"
            title="Start fresh (clears context)"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
          </button>
          <button
            onClick={() => navigate('/hushh-agents')}
            className="p-2 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 transition-colors text-gray-400 hover:text-white"
            aria-label="Back to Agents"
          >
            <span className="material-symbols-outlined text-[16px] sm:text-lg">close</span>
          </button>
        </div>
      </header>

      {/* ═══ History Sidebar Overlay ═══ */}
      {showHistory && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setShowHistory(false)} />
          <div className="fixed right-0 top-0 bottom-0 w-80 md:w-96 bg-[#0d1117] border-l border-gray-800 z-[70] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-purple-400">history</span>
                Chat History
              </h3>
              <button onClick={() => setShowHistory(false)} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-white transition-colors">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {persistence.getSessions().length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <span className="material-symbols-outlined text-3xl text-gray-700 mb-3">chat_bubble_outline</span>
                  <p className="text-sm text-gray-600">No past conversations yet</p>
                  <p className="text-xs text-gray-700 mt-1">Your chats will appear here</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {persistence.getSessions().map((session) => (
                    <div
                      key={session.id}
                      className={`group flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        session.id === sessionId
                          ? 'bg-purple-500/15 border border-purple-500/20'
                          : 'hover:bg-gray-800/60 border border-transparent'
                      }`}
                      onClick={() => handleLoadSession(session.id)}
                    >
                      <span className="material-symbols-outlined text-sm text-gray-600 mt-0.5 shrink-0">
                        {session.id === sessionId ? 'radio_button_checked' : 'chat'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-300 truncate font-medium">{session.title}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          {session.messages.length} msgs · {new Date(session.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition-all shrink-0"
                        aria-label="Delete session"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-800">
              <button
                onClick={handleNewConversation}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-xs font-medium transition-colors"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                New Conversation
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══ Main ═══ */}
      <main className="flex-1 flex flex-col w-full max-w-4xl mx-auto px-2 sm:px-4 md:px-6 overflow-hidden min-w-0">

        {/* Mode & Language selectors (sticky below header) */}
        <div className="sticky top-[49px] sm:top-[65px] z-40 bg-[#0d1117]/95 backdrop-blur-md py-2 sm:py-3 space-y-2 border-b border-gray-800/30">
          {/* Mode Selector */}
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`
                  flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-medium whitespace-nowrap transition-all shrink-0
                  ${mode === m.id
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-gray-800/40 text-gray-500 border border-gray-800 hover:text-gray-300 hover:border-gray-700'
                  }
                `}
              >
                <span className="material-symbols-outlined text-[14px] sm:text-base">{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>

          {/* Language Selector */}
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                onClick={() => setLanguage(lang.id)}
                className={`
                  px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-mono font-bold transition-all shrink-0
                  ${language === lang.id
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-gray-800/40 text-gray-600 border border-gray-800 hover:text-gray-400'
                  }
                `}
              >
                {lang.icon}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ Conversation Thread ═══ */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">

          {/* Empty State */}
          {thread.length === 0 && !isGenerating && !error && (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-4xl text-purple-500/60">code</span>
              </div>
              <h3 className="text-lg font-medium text-gray-400 mb-2" style={playfair}>
                Ready to code
              </h3>
              <p className="text-sm text-gray-600 max-w-sm mb-6">
                Describe what you need, paste code to debug, or ask for an explanation.
                Your conversation context persists across messages.
              </p>
              <div className="flex items-center gap-2 bg-gray-800/40 border border-gray-800 rounded-lg px-3 py-2">
                <span className="material-symbols-outlined text-sm text-purple-400">history</span>
                <span className="text-[11px] text-gray-500">
                  Context is maintained — say "now add types" and it knows what you mean
                </span>
              </div>
            </div>
          )}

          {/* Thread Messages */}
          {thread.map((msg) => (
            <div
              key={msg.id}
              className={`
                ${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'} min-w-0
              `}
            >
              <div
                className={`
                  max-w-full sm:max-w-[90%] md:max-w-[85%] rounded-2xl min-w-0
                  ${msg.role === 'user'
                    ? 'bg-purple-600/20 border border-purple-500/20 px-3 sm:px-4 py-2.5 sm:py-3'
                    : 'bg-gray-900/80 border border-gray-800 overflow-hidden'
                  }
                `}
              >
                {/* User Message */}
                {msg.role === 'user' && (
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-purple-400/60 font-medium">
                        You · {msg.mode} · {msg.language}
                      </span>
                    </div>
                    <pre className="text-[13px] sm:text-sm text-gray-200 font-mono whitespace-pre-wrap leading-relaxed break-words overflow-hidden">
                      {msg.content}
                    </pre>
                  </div>
                )}

                {/* Assistant Message */}
                {msg.role === 'assistant' && (
                  <div>
                    {/* Thinking (collapsible) */}
                    {msg.thinking && (
                      <div className="border-b border-gray-800">
                        <button
                          onClick={() => toggleThinking(msg.id)}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-500 hover:text-gray-400 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">psychology</span>
                            Thinking Process
                          </span>
                          <span className="material-symbols-outlined text-sm">
                            {expandedThinking.has(msg.id) ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                        {expandedThinking.has(msg.id) && (
                          <div className="px-4 pb-3">
                            <pre className="text-[11px] text-gray-600 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                              {msg.thinking}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Code Block */}
                    {msg.code && (
                      <div className="min-w-0">
                        <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-gray-800 bg-gray-900/50">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex gap-1 sm:gap-1.5">
                              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500/60" />
                              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-yellow-500/60" />
                              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-500/60" />
                            </div>
                            <span className="text-[9px] sm:text-[10px] text-gray-600 font-mono">{language}</span>
                          </div>
                          <button
                            onClick={() => handleCopy(msg.code!, msg.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-[9px] sm:text-[10px] text-gray-400 hover:text-white transition-colors shrink-0"
                          >
                            <span className="material-symbols-outlined text-[10px] sm:text-xs">
                              {copiedId === msg.id ? 'check' : 'content_copy'}
                            </span>
                            {copiedId === msg.id ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <div className="p-3 sm:p-4 overflow-x-auto">
                          <pre className="text-[12px] sm:text-sm font-mono text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                            {msg.code}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Explanation — rendered as markdown */}
                    {msg.explanation && (
                      <div className={`px-3 sm:px-4 py-3 min-w-0 overflow-hidden ${msg.code ? 'border-t border-gray-800' : ''}`}>
                        <MarkdownRenderer content={msg.explanation} theme="dark" />
                      </div>
                    )}

                    {/* No code, no explanation — show raw content as markdown */}
                    {!msg.code && !msg.explanation && msg.content && (
                      <div className="px-3 sm:px-4 py-3 min-w-0 overflow-hidden">
                        <MarkdownRenderer content={msg.content} theme="dark" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Generating indicator */}
          {isGenerating && (
            <div className="flex justify-start">
              <div className="bg-gray-900/80 border border-gray-800 rounded-2xl px-5 py-4 flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-purple-300/30 border-t-purple-300 rounded-full animate-spin" />
                <span className="text-sm text-gray-500">Hushh is thinking...</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-red-400 text-lg mt-0.5">error</span>
              <div>
                <p className="text-sm text-red-300">{error}</p>
                <p className="text-xs text-red-400/60 mt-1">Try again or check your connection.</p>
              </div>
            </div>
          )}

          <div ref={threadEndRef} />
        </div>

        {/* ═══ Input Area (sticky bottom) ═══ */}
        <div className="sticky bottom-0 bg-[#0d1117] border-t border-gray-800/60 py-2 sm:py-3 pb-[env(safe-area-inset-bottom,8px)]">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                thread.length > 0
                  ? 'Continue the conversation...'
                  : mode === 'generate' ? 'Describe what code you need...'
                  : mode === 'debug' ? 'Paste your buggy code here...'
                  : mode === 'explain' ? 'Paste code you want explained...'
                  : 'Paste code to optimize...'
              }
              className="w-full min-h-[56px] sm:min-h-[80px] md:min-h-[100px] bg-gray-900/80 border border-gray-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 pr-20 sm:pr-32 text-[13px] sm:text-sm font-mono text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
              rows={2}
            />

            {/* Submit */}
            <div className="absolute bottom-2.5 sm:bottom-3 right-2.5 sm:right-3 flex items-center gap-2">
              <span className="text-[10px] text-gray-600 hidden md:block">⌘ Enter</span>
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className={`
                  flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[12px] sm:text-sm font-medium transition-all
                  ${isGenerating
                    ? 'bg-purple-500/20 text-purple-400 cursor-wait'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20'
                  }
                  disabled:opacity-40 disabled:cursor-not-allowed
                `}
              >
                <span className="material-symbols-outlined text-[14px] sm:text-base">send</span>
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
          </div>

          {/* Context indicator */}
          <div className="flex items-center justify-between mt-1.5 sm:mt-2 px-1">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="material-symbols-outlined text-[10px] sm:text-xs text-purple-400/50 shrink-0">
                {thread.length > 0 ? 'link' : 'link_off'}
              </span>
              <span className="text-[9px] sm:text-[10px] text-gray-600 truncate">
                {thread.length > 0
                  ? `${messageCount} msgs in context`
                  : 'No context'
                }
              </span>
            </div>
            <span className="text-[9px] sm:text-[10px] text-gray-700 shrink-0">
              Hushh Intelligence
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
