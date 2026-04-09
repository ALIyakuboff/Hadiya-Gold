import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppData, User } from '../types';
import { fmtUZS } from '../store';

interface Message {
  role: 'user' | 'model';
  content: string;
}

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function AiAssistant({ data, currentUser }: { data: AppData; currentUser: User }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  const genAI = new GoogleGenerativeAI(apiKey);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Voice recognition setup
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Brauzeringiz ovoz tanishni qo\'llab-quvvatlamaydi.');
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'uz-UZ';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*_#`]/g, '').replace(/\n/g, ' ');
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = 'uz-UZ';
    utter.rate = 1;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utter);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const handleSend = async (overrideText?: string) => {
    const userMsg = (overrideText ?? input).trim();
    if (!userMsg || !apiKey) {
      if (!apiKey) setMessages(prev => [...prev, { role: 'model', content: 'API kalit topilmadi.' }]);
      return;
    }
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const todaySales = data.sales.filter(s => s.date.startsWith(today));
      const minimizedProducts = data.products.filter(p => p.status === 'InStock')
        .map(p => ({ kod: p.code, nom: p.name, vazn: p.weight, narx: p.costPriceUZS }));
      const minimizedSales = todaySales.map(s => ({ maxsulot: s.productName, summa: fmtUZS(s.soldPriceUZS), tur: s.paymentType }));

      const systemPrompt = `Sen "Hadiya Gold" zargarlik do'konining AI yordamchisi - Hadiya AI.
Foydalanuvchi: ${currentUser.name} (${currentUser.role}). O'zbek tilida qisqa va aniq javob ber.
Oltin kursi: ${fmtUZS(data.goldRateUZS)}/gramm | Dollar kursi: ${data.exchangeRateUZS} so'm
Bugungi savdolar: ${JSON.stringify(minimizedSales)}
Ombordagi tovarlar: ${JSON.stringify(minimizedProducts.slice(0, 30))}
Jami qarz: ${fmtUZS(data.debts.reduce((s,d)=>s+(d.totalUZS-d.paidUZS),0))}`;

      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Tushundim, yordam berishga tayyorman.' }] },
          ...messages.map(m => ({ role: m.role, parts: [{ text: m.content }] }))
        ]
      });
      const result = await chat.sendMessage(userMsg);
      const responseText = result.response.text();
      setMessages(prev => [...prev, { role: 'model', content: responseText }]);
      speakText(responseText);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', content: 'Xatolik yuz berdi. Qayta urinib ko\'ring.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatText = (text: string) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(?:\*\*|__)(.*?)(?:\*\*|__)/g);
      return (
        <React.Fragment key={i}>
          {parts.map((part, idx) => idx % 2 === 1 ? <strong key={idx}>{part}</strong> : part)}
          <br />
        </React.Fragment>
      );
    });
  };

  return (
    <div className="ai-assistant-wrapper">
      {isOpen && (
        <div className="ai-chat-window glass animate-up">
          <div className="ai-chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: 'var(--primary)', borderRadius: '50%', padding: '6px', display: 'flex' }}>
                <Lucide.Sparkles size={20} color="#fff" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Hadiya AI</h3>
                <span style={{ fontSize: '0.8rem', color: '#a4b0be' }}>
                  {isListening ? '🔴 Eshityapman...' : isSpeaking ? '🔊 Gapirmoqda...' : 'Online yordamchi'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {isListening && (
                <button className="theme-btn" style={{ color: 'var(--danger)' }} onClick={stopListening} title="To'xtatish">
                  <Lucide.MicOff size={18} />
                </button>
              )}
              {isSpeaking && (
                <button className="theme-btn" onClick={stopSpeaking} title="Ovozni to'xtatish">
                  <Lucide.VolumeX size={18} />
                </button>
              )}
              <button className="logout-btn" onClick={() => setIsOpen(false)}>
                <Lucide.X size={20} />
              </button>
            </div>
          </div>

          <div className="ai-chat-messages">
            {messages.length === 0 && (
              <div className="ai-chat-placeholder">
                <Lucide.Bot size={48} opacity={0.3} color="var(--primary)" />
                <p>Assalomu alaykum, <strong>{currentUser.name}</strong>!<br />Savolingizni yozing yoki 🎤 tugmasini bosib gapirib yuboring.</p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`ai-message ${msg.role}`}>
                {msg.role === 'model' && <Lucide.Bot className="ai-avatar" size={24} />}
                <div className="ai-message-bubble">
                  {formatText(msg.content)}
                  {msg.role === 'model' && (
                    <button
                      onClick={() => speakText(msg.content)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', marginTop: '4px', opacity: 0.6 }}
                      title="Ovozda o'qish"
                    >
                      <Lucide.Volume2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="ai-message model">
                <Lucide.Bot className="ai-avatar" size={24} />
                <div className="ai-message-bubble loading-dots">
                  <span>.</span><span>.</span><span>.</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} style={{ height: '1px' }} />
          </div>

          <div className="ai-chat-input-area">
            <button
              className="theme-btn"
              style={{
                width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                background: isListening ? 'rgba(231,76,60,0.2)' : 'rgba(212,175,55,0.1)',
                color: isListening ? 'var(--danger)' : 'var(--primary)',
                border: `1px solid ${isListening ? 'var(--danger)' : 'var(--primary)'}`,
                animation: isListening ? 'pulse 1s infinite' : 'none'
              }}
              onClick={isListening ? stopListening : startListening}
              title={isListening ? 'To\'xtatish' : 'Ovozli kiritish'}
            >
              {isListening ? <Lucide.MicOff size={18} /> : <Lucide.Mic size={18} />}
            </button>
            <input
              type="text"
              placeholder="Savolingizni yozing..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              className="ai-input"
            />
            <button className="gold-btn ai-send-btn" onClick={() => handleSend()} disabled={isLoading || !input.trim()}>
              <Lucide.Send size={18} />
            </button>
          </div>
        </div>
      )}

      {!isOpen && (
        <button className="ai-fab-button heartbeat" onClick={() => setIsOpen(true)}>
          <Lucide.Sparkles size={28} />
          <span className="ai-tooltip">Savol bormi?</span>
        </button>
      )}
    </div>
  );
}
