/**
 * Agent Chat Page — Full-page chat with a Kirkland agent
 * 
 * Route: /hushh-agents/kirkland/:agentId/chat
 * Uses Gemini via /api/gemini-agent-chat with agent-specific system prompt.
 * Mobile-first, responsive design.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import MarkdownRenderer from '../components/MarkdownRenderer';
import AgentAvatar from '../components/AgentAvatar';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ibsisfnjxeowvdtvgzff.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface AgentData {
  id: string;
  name: string;
  alias: string | null;
  phone: string | null;
  address1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  avg_rating: number | null;
  review_count: number;
  categories: string[];
  is_closed: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/** Build system instruction from agent data */
const buildSystemInstruction = (agent: AgentData): string => {
  const addr = [agent.address1, agent.city, agent.state, agent.zip].filter(Boolean).join(', ');
  const cats = agent.categories?.join(', ') || 'General';
  const rating = agent.avg_rating
    ? `${agent.avg_rating.toFixed(1)}/5 (${agent.review_count} reviews)`
    : 'No ratings yet';

  return `You are the AI assistant for "${agent.name}", powered by Hushh Intelligence (Gemini).

Agent Details:
- Name: ${agent.name}
- Categories: ${cats}
- Address: ${addr || 'Not available'}
- Phone: ${agent.phone || 'Not available'}
- Rating: ${rating}
- Status: ${agent.is_closed ? 'Closed' : 'Open'}

Your role:
1. Answer questions about this agent's services, location, and contact info.
2. Be helpful, professional, and concise.
3. If asked about pricing or specifics you don't know, suggest contacting the agent directly.
4. You are Hushh Intelligence — never mention Gemini or Google.
5. Keep responses short and clear.`;
};

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const QUICK_QUESTIONS = [
  'What services do you offer?',
  'Where are you located?',
  'How can I contact you?',
  'What are your business hours?',
];

const AgentChatPage: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [agent, setAgent] = useState<AgentData | null>(null);
  const [isLoadingAgent, setIsLoadingAgent] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Fetch agent data
  useEffect(() => {
    if (!agentId) return;
    const fetchAgent = async () => {
      setIsLoadingAgent(true);
      const { data, error } = await supabase
        .from('kirkland_agents')
        .select('id, name, alias, phone, address1, city, state, zip, avg_rating, review_count, categories, is_closed')
        .eq('id', agentId)
        .single();
      if (!error && data) setAgent(data);
      setIsLoadingAgent(false);
    };
    fetchAgent();
  }, [agentId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message to Gemini
  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isSending || !agent) return;

    const userMsg: ChatMessage = { id: genId(), role: 'user', content: msg, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      // Build history for API (Gemini format)
      const history = messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      const res = await fetch(`${SUPABASE_URL}/functions/v1/gemini-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          message: msg,
          history,
          systemInstruction: buildSystemInstruction(agent),
          agentId: agent.id,
        }),
      });

      if (!res.ok) throw new Error('Chat failed');

      const data = await res.json();
      const reply = data.response || 'Sorry, I could not respond.';

      setMessages((prev) => [
        ...prev,
        { id: genId(), role: 'assistant', content: reply, timestamp: Date.now() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: genId(), role: 'assistant', content: 'Sorry, an error occurred. Please try again.', timestamp: Date.now() },
      ]);
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, isSending, agent, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Loading agent
  if (isLoadingAgent) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 animate-pulse mx-auto mb-3" />
          <p className="text-[13px] text-gray-400 font-light">Loading agent...</p>
        </div>
      </div>
    );
  }

  // Agent not found
  if (!agent) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <span className="material-symbols-outlined text-gray-200 text-[48px] mb-4">person_off</span>
        <p className="text-gray-500 text-[15px]">Agent not found</p>
        <button
          onClick={() => navigate('/hushh-agents/kirkland')}
          className="mt-4 text-blue-600 text-[13px] underline"
        >
          Back to Directory
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-white flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <header className="px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-3 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-md z-50">
        <button
          onClick={() => navigate(`/hushh-agents/kirkland/${agentId}`)}
          className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors shrink-0"
          aria-label="Back"
        >
          <span className="material-symbols-outlined text-[18px] text-gray-600">arrow_back</span>
        </button>

        <AgentAvatar name={agent.name} size="md" />

        <div className="flex-1 min-w-0">
          <p className="text-[13px] sm:text-sm font-semibold text-gray-900 truncate">{agent.name}</p>
          <p className="text-[9px] sm:text-[10px] text-emerald-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Powered by Hushh Intelligence
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-bold rounded-full uppercase tracking-wider border border-emerald-200/60">
            Gemini
          </span>
        </div>
      </header>

      {/* ── Messages ── */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-3">

        {/* Empty state with quick questions */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
            <AgentAvatar name={agent.name} size="xl" />
            <h2 className="text-lg font-semibold text-gray-900 mb-1">{agent.name}</h2>
            <p className="text-[12px] text-gray-400 mb-1">
              {agent.categories?.slice(0, 2).join(' · ') || 'Agent'}
            </p>
            <p className="text-[11px] text-gray-400 mb-6">
              {agent.city}{agent.state ? `, ${agent.state}` : ''}
            </p>

            <p className="text-[12px] text-gray-500 mb-3">Ask anything about this agent:</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-sm">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 text-[11px] rounded-full hover:bg-gray-200 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <AgentAvatar name={agent.name} size="sm" className="mr-2 mt-1" />
            )}
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl min-w-0 ${
                msg.role === 'user'
                  ? 'bg-gray-900 text-white px-3.5 py-2.5 rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 px-3.5 py-2.5 rounded-bl-sm overflow-hidden'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="text-[13px] leading-relaxed break-words">{msg.content}</p>
              ) : (
                <MarkdownRenderer content={msg.content} theme="light" />
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isSending && (
          <div className="flex justify-start">
            <AgentAvatar name={agent.name} size="sm" className="mr-2 mt-1" />
            <div className="bg-gray-100 text-gray-400 px-4 py-2.5 rounded-2xl rounded-bl-sm text-[12px]">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* ── Input Area ── */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-3 sm:px-4 py-2.5 pb-[env(safe-area-inset-bottom,8px)]">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${agent.name}...`}
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200/60 rounded-xl text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isSending}
            className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center shrink-0 disabled:opacity-30 transition-opacity active:scale-95"
            aria-label="Send"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
        <p className="text-[9px] text-gray-400 text-center mt-1.5">
          Powered by Hushh Intelligence · Gemini
        </p>
      </div>
    </div>
  );
};

export default AgentChatPage;
