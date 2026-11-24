// Telegram Bot @paynebulabot — подарки/звёзды → ключ.
// Защита: secret-token, лимит запросов, дедуп update_id, лимит размера.
const https = require('https');
let blob = null;
try { blob = require('@vercel/blob'); } catch (e) { blob = null; }

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const GOAL = 125;
const GOAL_PROMO = 110; // промокод qqc0d / Nebula даёт -10% → 110 ⭐
const BLOB_PATH = 'nebula/paynebula-state.json';
const EVENT_BLOB = 'nebula/events-live.json';
const KEYS_URL = 'https://nebulavisuals-public-sandy.vercel.app/keys-tg.json';
const FUNTIME_TOKEN = process.env.FUNTIME_CLIENT_TOKEN || '';
const FUNTIME_URL = 'https://api.funtime.su/v2/events';

let cache = null;
let cacheAt = 0;
const seen = new Set();
const rate = new Map();

function blocked(chatId) {
  const now = Date.now();
  const arr = (rate.get(chatId) || []).filter(t => now - t < 10000);
  if (arr.length >= 5) { rate.set(chatId, arr); return true; }
  arr.push(now); rate.set(chatId, arr); return false;
}
function tg(method, payload) {
  return new Promise((res) => {
    const data = Buffer.from(JSON.stringify(payload));
    const r = https.request({ hostname: 'api.telegram.org', method: 'POST',
      path: '/bot' + TOKEN + '/' + method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, (resp) => { let b=''; resp.on('data',c=>b+=c); resp.on('end',()=>res(b)); });
    r.on('error',()=>res('')); r.write(data); r.end();
  });
}
async function load() {
  if (cache && Date.now() - cacheAt < 4000) return cache;
  try {
    if (blob && process.env.BLOB_READ_WRITE_TOKEN) {
      const res = await blob.get(BLOB_PATH, { access: 'private' });
      if (res && res.stream) { cache = JSON.parse(await new Response(res.stream).text()); cacheAt = Date.now(); }
    } else {
      const r = await fetch('https://blob.vercel-storage.com/' + BLOB_PATH, {
        headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN, 'x-api-version': '1', 'x-blob-access': 'private' }
      });
      if (r.ok) { cache = await r.json(); cacheAt = Date.now(); }
    }
  } catch (e) {}
  return cache || { stars: {}, issued: {} };
}
async function save(s) {
  try {
    if (blob && process.env.BLOB_READ_WRITE_TOKEN) {
      await blob.put(BLOB_PATH, JSON.stringify(s), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
    } else {
      await fetch('https://blob.vercel-storage.com/' + BLOB_PATH, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN, 'x-api-version': '1',
          'x-blob-access': 'private', 'x-blob-add-random-suffix': '0', 'x-blob-allow-overwrite': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify(s)
      });
    }
  } catch (e) {}
  cache = s; cacheAt = Date.now();
}
function fmtTime(sec) {
  sec = Number(sec) || 0;
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return m + ':' + s;
}
async function fetchFuntime() {
  if (!FUNTIME_TOKEN) return null;
  try {
    const r = await fetch(FUNTIME_URL, { headers: { 'client-token': FUNTIME_TOKEN }, cache: 'no-store' });
    if (!r.ok) return null;
    const data = await r.json();
    const groups = Array.isArray(data) ? data : (data.items || data.events || data.data || []);
    const list = [];
    let nextSec = 0;
    groups.forEach(function (g) {
      if (g.server) {
        const sec = Number(g.nextScheduledEventInSeconds) || 0;
        if (sec && (!nextSec || sec < nextSec)) nextSec = sec;
      }
      (g.events || []).forEach(function (ev) {
        list.push({ name: ev.name || ev.type || 'Ивент', server: g.server || ev.server || '', type: ev.type || '', phase: ev.phase || '', sec: Number(ev.timeLeftSeconds) || 0 });
      });
    });
    if (!list.length) return null;
    const current = list.map(function (ev) {
      let label = ev.name + (ev.server ? ' → ' + ev.server : '');
      if (ev.phase) label += ' [' + ev.phase + ']';
      return label;
    });
    const next = fmtTime(nextSec || Math.min.apply(null, list.map(function (ev) { return ev.sec; }).filter(function (x) { return x > 0; })) || 0);
    const e = { current: current, next: next || '—', shown: current.length + ' из ' + current.length, ts: Date.now(), live: true };
    await saveEvents(e);
    return e;
  } catch (err) { return null; }
}
async function loadEvents() {
  try {
    if (blob && process.env.BLOB_READ_WRITE_TOKEN) {
      const res = await blob.get(EVENT_BLOB, { access: 'private' });
      if (res && res.stream) return JSON.parse(await new Response(res.stream).text());
    }
  } catch (e) {}
  return null;
}
async function saveEvents(e) {
  try {
    if (blob && process.env.BLOB_READ_WRITE_TOKEN) {
      await blob.put(EVENT_BLOB, JSON.stringify(e), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
    }
  } catch (err) {}
}
function parseEvents(text) {
  const lines = String(text || '').split(/\r?\n/);
  const current = [];
  let next = '';
  let shown = '';
  lines.forEach(function (l) {
    const e = l.match(/(Анархия\s*→\s*\d+)/);
    if (e) current.push(e[1]);
    const n = l.match(/До следующего ивента:\s*([\d:]+)/);
    if (n) next = n[1];
    const sh = l.match(/Отображено ближайших ивентов:\s*([^\n]+)/);
    if (sh) shown = sh[1].trim();
  });
  if (!current.length) return null;
  return { current: current, next: next || '—', shown: shown || (current.length + ' из ' + current.length), ts: Date.now() };
}
function formatEvents(e) {
  return '📌 Ивенты сервера FunTime (обновлено ' + new Date(e.ts || Date.now()).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + ')\n\n' +
    'До следующего ивента: ' + e.next + '\n\n' +
    (e.current || []).map(function (x) { return '📌 ' + x + '\n   До следующего ивента: ' + e.next; }).join('\n') +
    '\n\nОтображено ближайших ивентов: ' + e.shown;
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

  //实时 ивенты: пересланные сообщения от @deltaclient_bot или сообщения в группе
  const evText = msg.text || msg.caption || '';
  if (evText.indexOf('Анархия →') !== -1 && evText.indexOf('До следующего ивента') !== -1) {
    const parsed = parseEvents(evText);
    if (parsed) {
      await saveEvents(parsed);
      await tg('sendMessage', { chat_id: chat, text: '✅ Ивенты обновлены в реальном времени.\n\n' + formatEvents(parsed) });
      return res.status(200).json({ ok: true, events: parsed.current.length });
    }
  }

  const keyboard = {
    keyboard: [
      [{ text: 'Купить' }, { text: 'О нас' }],
      [{ text: 'Задать вопрос' }, { text: 'Промокод' }],
      [{ text: 'Ближайшие ивенты' }, { text: 'Текущие ивенты' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };
  if (msg.text && msg.text.startsWith('/start')) {
    await tg('sendMessage', {
      chat_id: chat,
      text: 'Привет это чат с покупкой NebulaVisuals выбери пункт который тебе надо!',
      reply_markup: keyboard
    });
    return res.status(200).json({ ok: true });
  }
  if (msg.text === 'Промокод') {
    const sp0 = await load();
    sp0.promo = sp0.promo || {};
    sp0.promo[chat] = true;
    await save(sp0);
    await tg('sendMessage', { chat_id: chat, text: 'Введите промокод', reply_markup: keyboard });
    return res.status(200).json({ ok: true });
  }
  if (msg.text === 'Купить' || msg.text === 'О нас' || msg.text === 'Задать вопрос' ||
      msg.text === 'Ближайшие ивенты' || msg.text === 'Текущие ивенты') {
    let text = '';
    if (msg.text === 'Купить') {
      text = 'Чтобы получить ключ, напишите в мой личный Telegram: @efelyz — там я выдам ключ или промокод. Либо купите на сайте: https://nebulavisuals-public-sandy.vercel.app/';
    } else if (msg.text === 'О нас') {
      text = 'Nebula Visuals — клиент для Minecraft с визуальными эффектами, стабильным FPS и умной оптимизацией. Один лаунчер — и игра обновляется сама.';
    } else if (msg.text === 'Задать вопрос') {
      const s0 = await load();
      s0.asking = s0.asking || {};
      s0.asking[chat] = true;
      await save(s0);
      text = 'Задайте вопрос тут:';
    } else {
      try {
        const e = await fetchFuntime() || await loadEvents() || await (await fetch('https://nebulavisuals-public-sandy.vercel.app/events.json')).json();
        text = (e.live ? '🔴 LIVE · ' : '') + formatEvents(e);
      } catch (err) {
        text = 'Не удалось загрузить список ивентов.';
      }
    }
    await tg('sendMessage', { chat_id: chat, text: text, reply_markup: keyboard, disable_web_page_preview: true });
    return res.status(200).json({ ok: true });
  }
  // вопрос из этого бота → админ-боту
  const sAsk = await load();
  if (sAsk.asking && sAsk.asking[chat] && msg.text && msg.text.length > 2) {
    sAsk.asking[chat] = false;
    await save(sAsk);
    try {
      const qr = await fetch('https://nebulavisuals-public-sandy.vercel.app/question-state.json', { cache: 'no-store' });
      if (qr.ok) {
        const qs = await qr.json();
        if (qs.adminChat) {
          await tg(process.env.QUESTION_BOT_TOKEN || '', 'sendMessage', {
            chat_id: qs.adminChat,
            text: 'Вопрос из @paynebulabot:\n\n' + msg.text
          });
        }
      }
    } catch (e) {}
    await tg('sendMessage', { chat_id: chat, text: 'Вопрос отправлен администратору.', reply_markup: keyboard });
    return res.status(200).json({ ok: true });
  }
  // ввод промокода
  const sPromo = await load();
  if (sPromo.promo && sPromo.promo[chat] && msg.text && /^[A-Za-z0-9_-]{3,32}$/.test(msg.text)) {
    const code = msg.text.trim().toLowerCase();
    sPromo.promo[chat] = false;
    if (code === 'qqc0d' || code === 'nebula') {
      sPromo.goal = sPromo.goal || {};
      sPromo.goal[chat] = GOAL_PROMO;
      await save(sPromo);
      await tg('sendMessage', { chat_id: chat,
        text: 'Промокод активирован. Скиньте скрины мой юз @efelyz чтобы получить скидку', reply_markup: keyboard });
      return res.status(200).json({ ok: true, goal: GOAL_PROMO });
    }
    await save(sPromo);
    await tg('sendMessage', { chat_id: chat, text: 'Промокода не существует', reply_markup: keyboard });
    return res.status(200).json({ ok: true });
  }

  // скрины подарков → админу; его ответом выдаётся ключ/промокод
  if ((msg.photo || msg.document) && process.env.ADMIN_CHAT_ID) {
    const sShot = await load();
    sShot.shots = sShot.shots || {};
    sShot.nextShot = Number(sShot.nextShot) || 1;
    const id = String(sShot.nextShot++);
    sShot.shots[id] = chat;
    await save(sShot);
    const caption = '#G' + id + ' Скрин подарка от ' + chat + '. Ответьте на это сообщение ключом/промокодом.';
    try {
      if (msg.photo) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        await tg('sendPhoto', { chat_id: process.env.ADMIN_CHAT_ID, photo: fileId, caption: caption });
      } else {
        await tg('sendDocument', { chat_id: process.env.ADMIN_CHAT_ID, document: msg.document.file_id, caption: caption });
      }
    } catch (e) {}
    await tg('sendMessage', { chat_id: chat, text: 'Скрин отправлен администратору. Ожидайте ключ.', reply_markup: keyboard });
    return res.status(200).json({ ok: true, shot: id });
  }
  // ответ администратора на скрин → ключ/промокод пользователю
  if (String(chat) === String(process.env.ADMIN_CHAT_ID) && msg.reply_to_message && msg.text) {
    const m = String(msg.reply_to_message.caption || msg.reply_to_message.text || '').match(/#G(\d+)/);
    if (m) {
      const sRep = await load();
      const target = sRep.shots && sRep.shots[m[1]];
      if (target) {
        await tg('sendMessage', { chat_id: target, text: 'Ваш ключ/промокод: ' + msg.text, reply_markup: keyboard });
        await tg('sendMessage', { chat_id: chat, text: 'Отправлено пользователю.' });
        delete sRep.shots[m[1]];
        await save(sRep);
      }
    }
    return res.status(200).json({ ok: true });
  }

  const got = starsOf(msg);
  if (got <= 0) return res.status(200).json({ ok: true });

  // уведомление администратору о поступивших звёздах
  try {
    if (process.env.ADMIN_CHAT_ID) {
      await tg('sendMessage', { chat_id: process.env.ADMIN_CHAT_ID,
        text: '💎 Поступило ' + got + ' ⭐ от ' + chat + '. Всего: ' + ((await load()).stars[chat] || 0) });
    }
  } catch (e) {}

  const s = await load();
  s.stars[chat] = Number(s.stars[chat] || 0) + got;
  const have = s.stars[chat];
  const goal = (s.goal && s.goal[chat]) || GOAL;
  let text = 'Получено ' + got + ' ⭐. Всего: ' + have + '/' + goal + '. ';
  if (have >= goal && !s.issued[chat]) {
    try {
      const r = await fetch(KEYS_URL); const keys = await r.json();
      const used = new Set(Object.values(s.issued));
      const key = keys.find(k => !used.has(k));
      if (key) { s.issued[chat] = key; text += '🎉 Ключ: ' + key; }
      else text += 'Ключей пока нет.';
    } catch (e) { text += 'Не удалось получить ключ.'; }
  } else if (s.issued[chat]) {
    text += 'Ваш ключ: ' + s.issued[chat];
  } else {
    text += 'До ключа ещё ' + (goal - have) + ' ⭐.';
  }
  await save(s);
  await tg('sendMessage', { chat_id: chat, text: text });
  return res.status(200).json({ ok: true });
};
