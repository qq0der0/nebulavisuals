// Telegram Bot @NebulaQuestionbot — вопросы с сайта и ответы администратора.
const https = require('https');
let blob = null;
try { blob = require('@vercel/blob'); } catch (e) { blob = null; }

const TOKEN = process.env.QUESTION_BOT_TOKEN || '';
const SECRET = process.env.QUESTION_WEBHOOK_SECRET || '';
const ADMIN = process.env.QUESTION_ADMIN_CHAT || '';
const PASSWORD = process.env.QUESTION_PASSWORD || 'qqc0dAdmin1337';
const BLOB_PATH = 'nebula/question-state.json';
let lastSend = { at: 0, ok: null, status: null, error: null, method: '' };
const seen = new Set();
const rate = new Map();

function blocked(id) {
  const now = Date.now();
  const arr = (rate.get(id) || []).filter(t => now - t < 10000);
  if (arr.length >= 6) { rate.set(id, arr); return true; }
  arr.push(now); rate.set(id, arr); return false;
}
function tg(token, method, payload) {
  return new Promise((res) => {
    const data = Buffer.from(JSON.stringify(payload));
    const r = https.request({ hostname: 'api.telegram.org', method: 'POST',
      path: '/bot' + token + '/' + method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, (resp) => { let b=''; resp.on('data',c=>b+=c); resp.on('end',()=>{
      try { const j=JSON.parse(b); lastSend={ at:Date.now(), ok:!!j.ok, status:resp.statusCode, error:j.description||null, method:method }; }
      catch(e) { lastSend={ at:Date.now(), ok:false, status:resp.statusCode, error:'bad json', method:method }; }
      res(b);
    }); });
    r.on('error',()=>res('')); r.write(data); r.end();
  });
}
async function load() {
  try {
    if (blob && process.env.BLOB_READ_WRITE_TOKEN) {
      const res = await blob.get(BLOB_PATH, { access: 'private' });
      if (res && res.stream) return JSON.parse(await new Response(res.stream).text());
    }
  } catch (e) {}
  return { tickets: {}, next: 1, adminChat: '', auth: {}, pending: {} };
}
async function save(s) {
  try {
    if (blob && process.env.BLOB_READ_WRITE_TOKEN) {
      await blob.put(BLOB_PATH, JSON.stringify(s), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
    }
  } catch (e) {}
}
function parseId(text) {
  const m = String(text || '').match(/#Q(\d+)/);
  return m ? m[1] : '';
}
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'GET') {
    return res.json({ ok: true, token: !!TOKEN, lastSend });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (SECRET && req.headers['x-telegram-bot-api-secret-token'] !== SECRET) return res.status(403).json({ ok: false });
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (raw.length > 500000) return res.status(413).json({ ok: false });
  let upd;
  try { upd = JSON.parse(raw); } catch (e) { return res.status(400).json({ ok: false }); }
  if (!upd.update_id) return res.status(400).json({ ok: false });
  if (seen.has(upd.update_id)) return res.status(200).json({ ok: true, duplicate: true });
  seen.add(upd.update_id);
  if (seen.size > 5000) seen.clear();

  const msg = upd.message || {};
  const chat = String((msg.chat && msg.chat.id) || '');
  if (!chat || blocked(chat)) return res.status(200).json({ ok: true });
  const s = await load();
  s.auth = s.auth || {};
  s.pending = s.pending || {};

  // Пароль при первом входе
  const authed = !!s.auth[chat];
  if (!authed) {
    const text = String(msg.text || '').trim();
    if (text === PASSWORD) {
      s.auth[chat] = true;
      s.pending[chat] = false;
      s.adminChat = chat;
      await save(s);
      await tg(TOKEN, 'sendMessage', { chat_id: chat,
        text: 'Пароль принят. Этот бот только для вас. Все вопросы из @paynebulabot приходят сюда. Чтобы ответить — нажмите «Ответить» на сообщение с тикетом.' });
      return res.status(200).json({ ok: true, auth: true });
    }
    if (!s.pending[chat]) {
      s.pending[chat] = true;
      await save(s);
    }
    await tg(TOKEN, 'sendMessage', { chat_id: chat, text: 'Введите пароль' });
    return res.status(200).json({ ok: true, needPassword: true });
  }

  // Личный ящик: все вопросы приходят сюда из @paynebulabot.
  const OWNER = String(ADMIN || process.env.ADMIN_CHAT_ID || s.adminChat || '');
  const isOwner = OWNER && chat === OWNER;

  if (isOwner) {
    const replyId = parseId(msg.reply_to_message && (msg.reply_to_message.text || msg.reply_to_message.caption));
    if (replyId && msg.text) {
      // тикеты из @paynebulabot живут в его state — отвечаем через его токен
      try {
        const ps = await fetch('https://nebulavisuals-public-sandy.vercel.app/api/telegram?ticket=' + encodeURIComponent(replyId), { cache: 'no-store' });
        if (ps.ok) {
          const pj = await ps.json();
          if (pj.chat) {
            await tg(process.env.TELEGRAM_BOT_TOKEN || TOKEN, 'sendMessage', { chat_id: pj.chat, text: 'Ответ:\n\n' + msg.text });
            await tg(TOKEN, 'sendMessage', { chat_id: chat, text: 'Ответ отправлен человеку (тикет #Q' + replyId + ').' });
            return res.status(200).json({ ok: true });
          }
        }
      } catch (e) {}
      const t = s.tickets[replyId];
      if (t) {
        await tg(TOKEN, 'sendMessage', { chat_id: t.chat, text: 'Ответ:\n\n' + msg.text });
        await tg(TOKEN, 'sendMessage', { chat_id: chat, text: 'Ответ отправлен человеку (тикет #Q' + replyId + ').' });
        delete s.tickets[replyId];
        await save(s);
      } else {
        await tg(TOKEN, 'sendMessage', { chat_id: chat, text: 'Тикет #Q' + replyId + ' не найден.' });
      }
    }
    return res.status(200).json({ ok: true });
  }

  if (msg.text && msg.text.startsWith('/start')) {
    if (!s.adminChat) { s.adminChat = chat; await save(s); }
    await tg(TOKEN, 'sendMessage', { chat_id: chat,
      text: 'Этот бот только для вас. Все вопросы из @paynebulabot приходят сюда. Чтобы ответить — нажмите «Ответить» на сообщение с тикетом.' });
    return res.status(200).json({ ok: true });
  }

  if (msg.text && msg.text.length > 2) {
    const id = String(s.next || 1);
    s.next = (Number(s.next) || 1) + 1;
    s.tickets[id] = { chat: chat, text: msg.text, ts: Date.now() };
    await save(s);
    const adminChat = ADMIN || process.env.ADMIN_CHAT_ID || s.adminChat;
    if (adminChat) {
      await tg(TOKEN, 'sendMessage', {
        chat_id: adminChat,
        text: 'Вопрос #Q' + id + ' от ' + (msg.from && (msg.from.username ? '@'+msg.from.username : msg.from.first_name) || 'пользователя') + ':\n\n' + msg.text
      });
    }
    await tg(TOKEN, 'sendMessage', { chat_id: chat, text: 'Вопрос отправлен. Ожидайте ответа — он придёт в этот бот.' });
  }
  return res.status(200).json({ ok: true });
};
