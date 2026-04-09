import { loadData, fmtUZS } from './store';

// Helper to get Chat ID (Manager only)
export const setChatId = (id: string) => localStorage.setItem('tg_chat_id', id);
export const getChatId = () => localStorage.getItem('tg_chat_id');

// Send message via BOT SERVER (Node.js)
// This is more reliable as it avoids polling conflicts
export const sendTelegramMessage = async (text: string) => {
  try {
    await fetch('/api/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
  } catch (e) {
    console.error('Tg Sync Error:', e);
  }
};

// Send document via BOT SERVER
export const sendTelegramDocument = async (pdfBlob: Blob, filename: string, caption?: string) => {
  const reader = new FileReader();
  reader.onloadend = async () => {
    const base64 = (reader.result as string).split(',')[1];
    try {
      await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           message: caption || 'Hujjat yuborildi', 
           pdfBase64: base64, 
           filename 
        }),
      });
    } catch (e) {
      console.error('Tg Doc Sync Error:', e);
    }
  };
  reader.readAsDataURL(pdfBlob);
};

// Polling is now handled by bot-server.js
export const initTelegramBot = () => {
  console.log('🤖 Telegram bot logic moved to server side.');
  // Return an empty interval so the app doesn't crash if it expects one
  return setInterval(() => {}, 1000000);
};


