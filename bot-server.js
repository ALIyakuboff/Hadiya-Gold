const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN || '8721340914:AAG2eadcCeRHap3Pd2bQfMbMre7LewlfYEc';
const DATA_FILE = path.join(__dirname, 'bot-data.json');
const SESSIONS_FILE = path.join(__dirname, 'bot-sessions.json');
const PORT = 3001;

// ==================== Data Management ====================

const defaultData = { users: [], debts: [] };

const loadBotData = () => {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { console.error('Data load error:', e); }
  return defaultData;
};

const saveSessions = (sessions) => {
  try { fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2)); } catch (e) {}
};

const loadSessions = () => {
  try {
    if (fs.existsSync(SESSIONS_FILE)) return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
  } catch (e) {}
  return { users: {}, states: {} };
};

const fmtUZS = (amount) =>
  new Intl.NumberFormat('uz-UZ').format(Math.round(amount)) + " so'm";

// ==================== Express API ====================

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Web app sends data here to keep bot in sync
app.post('/api/sync', (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
       return res.status(400).json({ ok: false, error: 'Mashurotlar noto\'g\'ri formatda' });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`[Sync] Barcha ma'lumotlar yangilandi. (${Object.keys(data).length} ta bo'lim)`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/get-data', (req, res) => {
  try {
    const data = loadBotData();
    res.json(data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/status', (req, res) => {
  const data = loadBotData();
  res.json({ ok: true, users: data.users?.length || 0, debts: data.debts?.length || 0 });
});

// Send shift close report to all managers via Telegram
app.post('/api/send-report', async (req, res) => {
  try {
    const { message, pdfBase64, filename } = req.body;
    const data = loadBotData();

    // Find all manager chatIds from sessions
    const managerChatIds = Object.entries(sessions.users || {})
      .filter(([_, u]) => u.role === 'Manager')
      .map(([chatId]) => chatId);

    if (managerChatIds.length === 0) {
      return res.json({ ok: false, error: 'Menejer ulangan emas. Avval /start orqali kirish kerak.' });
    }

    for (const chatId of managerChatIds) {
      // Send text message
      await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });

      // Send PDF if provided
      if (pdfBase64 && filename) {
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        await bot.sendDocument(chatId, pdfBuffer, { caption: 'Kunlik kassa hisobot fayli 📄' }, { filename });
      }
    }

    res.json({ ok: true, sent: managerChatIds.length });
  } catch (e) {
    console.error('[send-report xato]:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Bot API server: http://localhost:${PORT}`);
});

// ==================== Telegram Bot ====================

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
let sessions = loadSessions();

// Save sessions every 10 seconds
setInterval(() => saveSessions(sessions), 10000);

console.log('🤖 Telegram bot ishga tushdi! @Hadiyagold_bot');

bot.on('message', async (msg) => {
  const chatId = msg.chat.id.toString();
  const text = msg.text;
  const contact = msg.contact;
  const data = loadBotData();
  const state = sessions.states?.[chatId];

  // ---- Contact (tugma orqali) yuborildi ----
  if (contact && contact.phone_number) {
    await handlePhoneInput(chatId, contact.phone_number, data);
    return;
  }

  if (!text) return;

  // ---- /start ----
  if (text === '/start') {
    if (!sessions.states) sessions.states = {};
    sessions.states[chatId] = { step: 'AWAITING_PHONE' };
    saveSessions(sessions);
    await bot.sendMessage(chatId,
      "Assalomu alaykum! 👋\n<b>Hadiya Gold</b> tizimiga kirish uchun:\n\n📌 Pastdagi tugmani bosing <b>yoki</b> telefon raqamingizni yozing (masalan: <code>998901234567</code>)",
      {
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [[{ text: "📞 Raqamni yuborish", request_contact: true }]],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      }
    );
    return;
  }

  // ---- Telefon raqam matn sifatida kiritildi ----
  if (state && state.step === 'AWAITING_PHONE') {
    // Raqam formatini tekshirish: faqat raqamlar bo'lishi kerak (kamida 9 raqam)
    const cleanText = text.replace(/[\s\-\+\(\)]/g, '');
    if (/^\d{9,15}$/.test(cleanText)) {
      await handlePhoneInput(chatId, cleanText, data);
      return;
    } else {
      await bot.sendMessage(chatId,
        "❗ Noto'g'ri format. Telefon raqamingizni kiriting (masalan: <code>998901234567</code>) yoki pastdagi tugmani bosing.",
        { parse_mode: 'HTML' }
      );
      return;
    }
  }

  // ---- PIN kutilmoqda ----
  if (state && state.step === 'AWAITING_PIN') {
    const user = data.users.find(u => u.id === state.userId);
    if (user && user.pin === text.trim()) {
      // To'g'ri PIN
      if (!sessions.users) sessions.users = {};
      sessions.users[chatId] = { role: user.role, userId: user.id, name: user.name };
      delete sessions.states[chatId];
      saveSessions(sessions);

      const commands = user.role === 'Manager'
        ? '/debts - Nasiyalar ro\'yxati\n/mening_natijam - Sotuvlar reytingi'
        : '/mening_natijam - Sotuvlar reytingi';

      await bot.sendMessage(chatId,
        `🎉 Xush kelibsiz, <b>${user.name}</b>!\nRolingiz: <b>${user.role === 'Manager' ? 'Menejer' : 'Sotuvchi'}</b>\n\nFoydalanish mumkin bo'lgan buyruqlar:\n${commands}`,
        { parse_mode: 'HTML' }
      );
    } else {
      await bot.sendMessage(chatId,
        "❌ Noto'g'ri PIN kod. Qaytadan urining yoki /start ni bosing."
      );
    }
    return;
  }

  // ---- /debts ----
  if (text === '/debts') {
    const botUser = sessions.users?.[chatId];
    if (!botUser || botUser.role !== 'Manager') {
      await bot.sendMessage(chatId, "⛔ Bu buyruq faqat Menejerlar uchun.");
      return;
    }
    const activeDebts = data.debts.filter(d => (d.totalUZS - d.paidUZS) > 100);
    if (activeDebts.length === 0) {
      await bot.sendMessage(chatId, "✅ Hozircha faol nasiyalar yo'q.");
      return;
    }
    let response = "📋 <b>Nasiyalar Ro'yxati:</b>\n\n";
    activeDebts.forEach((d, i) => {
      response += `${i + 1}. <b>${d.customerName}</b> - ${d.customerPhone}\nQolgan: <i>${fmtUZS(d.totalUZS - d.paidUZS)}</i>\n\n`;
    });
    await bot.sendMessage(chatId, response, { parse_mode: 'HTML' });
    return;
  }

  // ---- /mening_natijam ----
  if (text === '/mening_natijam') {
    const botUser = sessions.users?.[chatId];
    if (!botUser) {
      await bot.sendMessage(chatId, "Iltimos, avval /start ni bosib kirish qiling.");
      return;
    }
    const staff = [...data.users]
      .filter(u => u.role === 'Staff' || u.dailySales > 0)
      .sort((a, b) => b.dailySales - a.dailySales);

    const myInfo = data.users.find(u => u.id === botUser.userId);
    let response = myInfo
      ? `📊 Sizning natijangiz:\nBugun: <b>${myInfo.dailySales}</b> ta savdo\nOylik: <b>${myInfo.monthlySales}</b> ta savdo\n\n`
      : '';

    response += "🏆 <b>Bugungi Reyting:</b>\n\n";
    staff.forEach((s, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🔹';
      const me = s.id === botUser.userId ? ' ← Siz' : '';
      response += `${medal} <b>${s.name}${me}</b>: ${s.dailySales} ta\n`;
    });

    await bot.sendMessage(chatId, response, { parse_mode: 'HTML' });
    return;
  }

  // ---- Noma'lum buyruq ----
  await bot.sendMessage(chatId,
    "Botdan foydalanish uchun /start ni bosing."
  );
});

// ---- Ortakcha funksiya: telefon raqamni tekshirish ----
async function handlePhoneInput(chatId, phone, data) {
  if (!phone.startsWith('+')) phone = '+' + phone;
  const cleanSource = phone.replace(/\D/g, '');

  const user = data.users.find(u => {
    const uClean = u.phone.replace(/\D/g, '');
    return uClean.includes(cleanSource) || cleanSource.includes(uClean);
  });

  if (user) {
    if (!sessions.states) sessions.states = {};
    sessions.states[chatId] = { step: 'AWAITING_PIN', userId: user.id };
    saveSessions(sessions);
    await bot.sendMessage(chatId,
      `✅ Raqam topildi: <b>${user.name}</b>\n\nIltimos, <b>PIN kodni</b> kiriting:`,
      { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
    );
  } else {
    await bot.sendMessage(chatId,
      "❌ Bu raqam tizimda topilmadi. Menejerga murojaat qiling."
    );
  }
}

bot.on('polling_error', (error) => {
  console.error('[Polling xato]:', error.message);
});

