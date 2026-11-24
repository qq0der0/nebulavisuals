// Telegram Bot @paynebulabot — подарки/звёзды → ключ.
// Защита: secret-token, лимит запросов, дедуп update_id, лимит размера.
const https = require('https');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const GOAL = 150;
const BLOB_URL = 'https://blob.vercel-storage.com/nebula/paynebula-state.json';
const KEYS_URL = 'https://nebulavisuals-public-sandy.vercel.app/keys.json';

let cache = null;
let cacheAt = 0;
const seen = new Set();
const rate = new Map(); // chatId -> [ts,...]

function blocked(chatId) {
  const now = Date.now();
  const arr = (rate.get(chatId) || []).filter(t => now - t < 10000);
  if (arr.length >= 5) { rate.set(chatId, arr); return true; }
  arr.push(now); rate.set(chatId, arr);
  return false;
}
function tg(method, payload) {
  return new Promise((res) => {
    const data = Buffer.from(JSON.stringify(payload));
    const r = https.request({
      hostname: 'api.telegram.org', method: 'POST',
      path: '/bot' + TOKEN + '/' + method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, (resp) => { let b = ''; resp.on('data', c => b += c); resp.on('end', () => res(b)); });
    r.on('error', () => res('')); r.write(data); r.end();
  });
}
async function load() {
  if (cache && Date.now() - cacheAt < 5000) return cache;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return cache || { stars: {}, issued: {} };
  try {
    const r = await fetch(BLOB_URL, { headers: { Authorization: 'Bearer ' + token, 'x-api-version': '1', 'x-blob-access': 'private' } });
    if (r.ok) { cache = await r.json(); cacheAt = Date.now(); }
  } catch (e) {}
  return cache || { stars: {}, issued: {} };
}
async function save(s) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;
  try {
    await fetch(BLOB_URL, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + token,
        'x-api-version': '1', 'x-blob-access': 'private',
        'x-blob-add-random-suffix': '0', 'x-blob-allow-overwrite': '1',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(s)
    });
  } catch (e) {}
  cache = s; cacheAt = Date.now();
}
function starsOf(msg) {
  if (msg.gift) return Number(msg.gift.star_count || msg.gift.total_stars || 0);
  if (msg.successful_payment && msg.successful_payment.currency === 'XTR') return Number(msg.successful_payment.total_amount || 0);
  if (msg.stars_paid) return Number(msg.stars_paid);
  return 0;
}
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
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

  const msg = upd.message || upd.channel_post || {};
  const chat = String((msg.chat && msg.chat.id) || '');
  if (!chat || blocked(chat)) return res.status(200).json({ ok: true });

  if (msg.text && msg.text.startsWith('/start')) {
    await tg('sendMessage', { chat_id: chat, text: 'Привет! Кидай подарки со звёздами — я считаю прогресс до ключа. Цель: ' + GOAL + ' ⭐.' });
    return res.status(200).json({ ok: true });
  }
  const got = starsOf(msg);
  if (got <= 0) return res.status(200).json({ ok: true });

  const s = await load();
  s.stars[chat] = Number(s.stars[chat] || 0) + got;
  const have = s.stars[chat];
  let text = 'Получено ' + got + ' ⭐. Всего: ' + have + '/' + GOAL + '. ';
  if (have >= GOAL && !s.issued[chat]) {
    try {
      const r = await fetch(KEYS_URL);
      const keys = await r.json();
      const used = new Set(Object.values(s.issued));
      const key = keys.find(k => !used.has(k));
      if (key) {
        s.issued[chat] = key;
        text += '🎉 Ключ: ' + key;
      } else text += 'Ключей пока нет.';
    } catch (e) { text += 'Не удалось получить ключ.'; }
  } else if (s.issued[chat]) {
    text += 'Ваш ключ: ' + s.issued[chat];
  } else {
    text += 'До ключа ещё ' + (GOAL - have) + ' ⭐.';
  }
  await save(s);
  await tg('sendMessage', { chat_id: chat, text: text });
  return res.status(200).json({ ok: true });
};
