import { loadData, fmtUZS } from './store';

const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '';
let lastUpdateId = 0;

export const setChatId = (id: string) => localStorage.setItem('tg_chat_id', id);
export const getChatId = () => localStorage.getItem('tg_chat_id');

export const sendTelegramMessage = async (text: string) => {
  const chatId = getChatId();
  if (!chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
  } catch (e) {
    console.error('Tg Bot error:', e);
  }
};

export const sendTelegramDocument = async (pdfBlob: Blob, filename: string, caption?: string) => {
  const chatId = getChatId();
  if (!chatId) return;
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('document', pdfBlob, filename);
  if (caption) formData.append('caption', caption);

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData
    });
  } catch (e) {
    console.error('Tg doc error:', e);
  }
};

const getChatStates = () => JSON.parse(localStorage.getItem('tg_chat_states') || '{}');
const setChatState = (chatId: string, state: any) => {
  const states = getChatStates();
  if (state === null) delete states[chatId];
  else states[chatId] = state;
  localStorage.setItem('tg_chat_states', JSON.stringify(states));
};

export const initTelegramBot = () => {
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`);
      const data = await res.json();
      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          const msg = update.message;
          if (!msg) continue;
          
          const chatId = msg.chat.id.toString();
          const chatStates = getChatStates();
          const currentState = chatStates[chatId];

          // Handle Contact sharing for Authentication
          if (msg.contact && msg.contact.phone_number) {
            let phone = msg.contact.phone_number;
            if (!phone.startsWith('+')) phone = '+' + phone;

            const appData = loadData();
            const cleanSource = phone.replace(/\D/g, '');
            const user = appData.users.find(u => {
              const uClean = u.phone.replace(/\D/g, '');
              return uClean.includes(cleanSource) || cleanSource.includes(uClean);
            });

            if (user) {
              // Transition to AWAITING_PIN state
              setChatState(chatId, { step: 'AWAITING_PIN', userId: user.id, phone: phone });

              await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  chat_id: chatId, 
                  text: `✅ Raqam topildi: <b>${user.name}</b>\n\nIltimos, davom etish uchun <b>PIN kodni</b> kiriting:`,
                  parse_mode: 'HTML',
                  reply_markup: { remove_keyboard: true }
                })
              });
            } else {
              await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: "❌ Kechirasiz, sizning bu raqamingiz tizimda topilmadi. Iltimos Menejerga aytib raqamingizni dasturga qo'shtiring." })
              });
            }
            continue;
          }

          const text = msg.text;
          if (!text) continue;

          // Check if awaiting PIN
          if (currentState && currentState.step === 'AWAITING_PIN') {
            const appData = loadData();
            const user = appData.users.find(u => u.id === currentState.userId);
            
            if (user && user.pin === text.trim()) {
              // PIN correct - Authenticate
              const botUsers = JSON.parse(localStorage.getItem('tg_users') || '{}');
              botUsers[chatId] = { role: user.role, userId: user.id };
              localStorage.setItem('tg_users', JSON.stringify(botUsers));

              if (user.role === 'Manager') {
                setChatId(chatId);
              }

              setChatState(chatId, null); // Clear state

              await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  chat_id: chatId, 
                  text: `🎉 Muvaffaqiyatli ulandingiz, <b>${user.name}</b>!\nRo'lingiz: <b>${user.role === 'Manager' ? 'Menejer' : 'Sotuvchi'}</b>\n\nSiz endi tizim buyruqlaridan foydalanishingiz mumkin:\n${user.role === 'Manager' ? '/debts - Nasiyalar ro\'yxati\n' : ''}/mening_natijam - O'z natijalaringizni ko'rish`,
                  parse_mode: 'HTML'
                })
              });
            } else {
              await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: "❌ Noto'g'ri PIN kod. Iltimos qaytadan urining yoki /start ni bosing." })
              });
            }
            continue;
          }

          const botUsers = JSON.parse(localStorage.getItem('tg_users') || '{}');
          const botUser = botUsers[chatId];

          if (text === '/start') {
            setChatState(chatId, null); // Reset state
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                chat_id: chatId, 
                text: "Assalomu alaykum! Hadiya Gold tizimida o'z profilingizni tasdiqlash uchun pastdagi tugmani bosing va raqamingizni yuboring👇",
                reply_markup: {
                  keyboard: [[{ text: "📞 Raqamni yuborish", request_contact: true }]],
                  one_time_keyboard: true,
                  resize_keyboard: true
                }
              })
            });
          } else if (text === '/debts') {
            if (!botUser || botUser.role !== 'Manager') {
              await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: "Buning uchun sizda Menejer huquqi bo'lishi kerak." }) });
              continue;
            }
            const appData = loadData();
            const activeDebts = appData.debts.filter(d => (d.totalUZS - d.paidUZS) > 100);
            let response = "📋 <b>Nasiyalar (Qarzlar) Ro'yxati:</b>\n\n";
            if (activeDebts.length === 0) {
              response += "Hozircha faol nasiyalar yo'q.";
            } else {
              activeDebts.forEach((d, i) => {
                response += `${i + 1}. <b>${d.customerName}</b> - ${d.customerPhone}\nQolgan qarz: <i>${fmtUZS(d.totalUZS - d.paidUZS)}</i>\n\n`;
              });
            }
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, text: response, parse_mode: 'HTML' })
            });
          } else if (text === '/mening_natijam') {
             if (!botUser) {
               await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: "Iltimos, avval /start ni bosib raqamingizni tasdiqlang." }) });
               continue;
             }
             const appData = loadData();
             const staff = [...appData.users].sort((a,b) => b.dailySales - a.dailySales);
             const myInfo = staff.find(u => u.id === botUser.userId);
             const myRank = staff.findIndex(u => u.id === botUser.userId) + 1;

             let response = myInfo ? `Sizning joriy oydagi natijangiz:\nBugun: <b>${myInfo.dailySales}</b> ta savdo\nOylik: <b>${myInfo.monthlySales}</b> ta savdo\n\n` : '';
             response += "🏆 <b>Bugungi Sotuvchilar Reytingi:</b>\n\n";

             staff.forEach((s, idx) => {
                if (s.role === 'Staff' || s.dailySales > 0) {
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🔹';
                  const meHighlight = s.id === botUser.userId ? ' (Siz)' : '';
                  response += `${medal} <b>${s.name}${meHighlight}</b>: ${s.dailySales} ta savdo\n`;
                }
             });
             await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chatId, text: response, parse_mode: 'HTML' })
            });
          }
        }
      }
    } catch (e) {
      // ignore network errors for polling to prevent console spam
    }
  }, 4000); // query every 4 seconds to avoid hitting rate limits
  return interval;
};


