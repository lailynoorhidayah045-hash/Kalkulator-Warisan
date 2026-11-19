import React, { useEffect, useRef, useState } from 'react';
import { Send, Scale, Trash2 } from 'lucide-react';
import { AppState, CalculationResult, ChatMessage } from '../types/inheritance';
import {
  generateLegalCoachResponse,
  QUICK_COACH_QUESTIONS,
} from '../modules/aiLegalCoach';
import { AppTheme } from '../modules/themes';

interface AiLegalCoachPanelProps {
  state: AppState;
  result: CalculationResult;
  theme: AppTheme;
  onLogInteraction?: (question: string, answer: string) => void;
}

const INITIAL_MESSAGE: ChatMessage = {
  id: 'welcome_coach',
  role: 'coach',
  content:
    'Halo, saya **AI Legal Coach**. Ajukan pertanyaan kritis seputar Hukum Waris Islam (KHI/Faraid) maupun Perdata Barat (KUHPerdata/BW)—seperti rasio `2:1` vs `1:1`, mekanisme `\'Aul` & `Radd`, *Hijab Hirman*, status saudara perempuan saat Ayah tiada, anak angkat/tiri/luar kawin, atau batas wasiat `1/3`.',
  timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
};

function renderFormattedText(text: string, primaryColor: string, tintColor: string): React.ReactNode {
  const paragraphs = text.split('\n\n');
  return paragraphs.map((para, pIdx) => {
    const parts = para.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return (
      <p key={pIdx} className={pIdx > 0 ? 'mt-2' : ''}>
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={idx} className="font-semibold text-slate-900">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith('*') && part.endsWith('*')) {
            return (
              <em key={idx} className="italic">
                {part.slice(1, -1)}
              </em>
            );
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code
                key={idx}
                className="font-mono-num rounded px-1 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: tintColor, color: primaryColor }}
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          return <React.Fragment key={idx}>{part}</React.Fragment>;
        })}
      </p>
    );
  });
}

export const AiLegalCoachPanel: React.FC<AiLegalCoachPanelProps> = ({
  state,
  result,
  theme,
  onLogInteraction,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (overrideText?: string) => {
    const question = (overrideText ?? input).trim();
    if (!question) return;

    const now = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: now,
    };

    const replyText = generateLegalCoachResponse(question, state, result);
    const coachMsg: ChatMessage = {
      id: `c_${Date.now() + 1}`,
      role: 'coach',
      content: replyText,
      timestamp: now,
    };

    setMessages((prev) => [...prev, userMsg, coachMsg]);
    if (onLogInteraction) {
      onLogInteraction(question, replyText);
    }
    if (!overrideText) setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <section className="no-print rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: theme.tint, color: theme.primary }}
          >
            <Scale className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: theme.primary }}>
              AI Legal Coach Interaktif
            </h2>
            <p className="text-xs text-slate-500">
              Analisis langsung kaidah KHI, Faraid &amp; KUHPerdata (BW)
            </p>
          </div>
        </div>
        {messages.length > 1 && (
          <button
            type="button"
            onClick={() => setMessages([INITIAL_MESSAGE])}
            title="Bersihkan percakapan"
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </div>

      {/* Quick question buttons */}
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {QUICK_COACH_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => handleSend(q)}
            className="rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition-opacity hover:opacity-85"
            style={{
              backgroundColor: theme.tint,
              borderColor: theme.border,
              color: theme.primary,
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat history */}
      <div
        ref={scrollRef}
        className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-[#f8fafc] p-3.5"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'text-white'
                  : 'border border-slate-200 bg-white text-slate-700'
              }`}
              style={
                msg.role === 'user'
                  ? { backgroundColor: theme.primary }
                  : undefined
              }
            >
              {msg.role === 'user'
                ? msg.content
                : renderFormattedText(msg.content, theme.primary, theme.tint)}
            </div>
            <span className="mt-1 px-1 text-[10px] text-slate-400">
              {msg.role === 'user' ? 'Anda' : 'AI Legal Coach'} · {msg.timestamp}
            </span>
          </div>
        ))}
      </div>

      {/* Input box */}
      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tanyakan hukum waris (misal: mengapa saudara terhalang, apa itu 'Aul)..."
          className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2"
        />
        <button
          type="button"
          onClick={() => handleSend()}
          className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: theme.bright, color: theme.brightText }}
        >
          <Send className="h-4 w-4" />
          Kirim
        </button>
      </div>
    </section>
  );
};
