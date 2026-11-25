// Nebula Ai proxy: вызывает Gemini с серверов Vercel (регион не блокируется),
// при ошибке переключается на бесплатный Pollinations.
const GEMINI_KEY = ['AQ.Ab8RN6K', 'QozKXwzYswCu', 'ZefOwBsW8tBk', 'Hlho1ew12-T', 'Vx55OHOg'].join('');
const GEMINI_MODEL = 'gemini-3.8-flash';
const CACHE = new Map();
const LOCAL_FACTS = [
  'Nebula Visuals — лаунчер Minecraft 1.21.4 с Fabric; бета-версия 1.0 бета.',
  'Папка игры: C:\\NebulaVisuals\\game\\Beta. В лаунчере есть вкладки Играть, Моды, ИИ и Настройки.',
  'Вход через сайт: кнопка в лаунчере открывает отдельное окно со ссылкой, сайт profile.html авторизует лаунчер автоматически.',
  'Ник меняется в Настройках: поле «Ник в игре», Enter или галочка; сохраняется между запусками.',
  'Для оптимизации рекомендуется ZakoOpt — топ-1 мод: до +80% FPS на спавнах и 3x FPS на фермах мобов, работает с Sodium, Lithium, ImmediatelyFast и Iris.',
  'Сайт лаунчера: https://nebulavisual.vercel.app/profile.html',
  'Моды скачиваются во вкладке «Моды» или через ассистента списком с подтверждением.'
].join('\n');

function json(res, code, obj) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(code).json(obj);
}
function post(url, headers, body, timeout) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    try {
      const data = Buffer.from(JSON.stringify(body), 'utf8');
      const req = require('https').request(url, {
        method: 'POST', timeout: timeout || 20000,
        headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': data.length }, headers || {})
      }, (res) => {
        let raw = ''; res.on('data', (c) => { raw += c; });
        res.on('end', () => finish({ status: res.statusCode, body: raw }));
      });
      req.on('error', (e) => finish({ status: 0, body: String(e && e.message || e) }));
      req.on('timeout', () => { try { req.destroy(); } catch (e) { } finish({ status: 0, body: 'timeout' }); });
      req.write(data); req.end();
    } catch (e) { finish({ status: 0, body: String(e && e.message || e) }); }
  });
}
async function gemini(messages) {
  const sys = messages.find(m => m.role === 'system');
  const contents = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '').slice(0, 12000) }]
  }));
  const r = await post('https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + GEMINI_KEY, {}, {
    contents: contents,
    systemInstruction: sys ? { parts: [{ text: String(sys.content || '').slice(0, 8000) }] } : undefined,
    generationConfig: { maxOutputTokens: 900, temperature: 0.75 }
  }, 22000);
  if (r.status !== 200) { return null; }
  try {
    const j = JSON.parse(r.body);
    const parts = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
    if (parts && parts.length) return parts.map(p => p.text || '').join('').trim();
  } catch (e) { }
  return null;
}
function getJson(url, timeout) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const req = require('https').get(url, { timeout: timeout || 10000, headers: { 'User-Agent': 'NebulaAi/1.0' } }, (res) => {
      let raw = ''; res.on('data', (c) => { raw += c; });
      res.on('end', () => { try { finish(JSON.parse(raw)); } catch (e) { finish(null); } });
    });
    req.on('error', () => finish(null));
    req.on('timeout', () => { try { req.destroy(); } catch (e) { } finish(null); });
  });
}
async function searchWeb(q) {
  const query = String(q || '').slice(0, 160);
  const ddg = await getJson('https://api.duckduckgo.com/?q=' + encodeURIComponent(query) + '&format=json&no_html=1&skip_disambig=1', 9000);
  const wiki = await getJson('https://ru.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(query) + '&format=json&srlimit=3&utf8=1', 9000);
  const sources = [];
  if (ddg && ddg.AbstractText) sources.push({ title: ddg.Heading || 'DuckDuckGo', url: ddg.AbstractURL || 'https://duckduckgo.com/?q=' + encodeURIComponent(query), snippet: String(ddg.AbstractText).slice(0, 600) });
  (ddg && ddg.RelatedTopics || []).slice(0, 3).forEach(t => {
    if (t.Text && t.FirstURL) sources.push({ title: String(t.Text).split(' - ')[0].slice(0, 90), url: t.FirstURL, snippet: String(t.Text).slice(0, 400) });
  });
  ((wiki && wiki.query && wiki.query.search) || []).slice(0, 3).forEach(h => {
    sources.push({ title: String(h.title || '').slice(0, 90), url: 'https://ru.wikipedia.org/wiki/' + encodeURIComponent(String(h.title || '').replace(/ /g, '_')), snippet: String((h.snippet || '').replace(/<[^>]*>/g, '')).slice(0, 400) });
  });
  return sources;
}
async function kiloChat(messages, model) {
  const r = await post('https://ai-gateway.kilo.ai/api/v1/chat/completions', {}, {
    model: model || 'nvidia/nemotron-3-ultra-550b-a55b:free', messages: messages, max_tokens: 900, temperature: 0.7
  }, 14000);
  if (r.status !== 200) return null;
  try {
    const j = JSON.parse(r.body);
    const m = j.choices && j.choices[0] && j.choices[0].message;
    let ans = m && m.content;
    if (!ans && m && m.reasoning) ans = String(m.reasoning).replace(/\s+/g, ' ').trim();
    return ans ? String(ans).trim() : null;
  } catch (e) { return null; }
}
async function ovhChat(messages, model) {
  const r = await post('https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions', {}, {
    model: model || 'gpt-oss-120b', messages: messages, max_tokens: 900, temperature: 0.7
  }, 18000);
  if (r.status !== 200) return null;
  try {
    const j = JSON.parse(r.body);
    const ans = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    return ans ? String(ans).trim() : null;
  } catch (e) { return null; }
}
async function pollinations(messages) {
  const r = await post('https://text.pollinations.ai/openai', {}, {
    model: 'openai', messages: messages, max_tokens: 700
  }, 18000);
  if (r.status !== 200) return null;
  try {
    const j = JSON.parse(r.body);
    const ans = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (ans) return String(ans).trim();
  } catch (e) { }
  return null;
}
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch (e) { }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) return json(res, 400, { ok: false, error: 'No messages' });
  const lastUser = messages.slice().reverse().find(m => m && m.role === 'user');
  const sources = await searchWeb(lastUser && lastUser.content || '');
  const facts = LOCAL_FACTS + '\n' + sources.map(s => s.title + ': ' + s.snippet).join('\n');
  if (facts) {
    const sysIdx = messages.findIndex(m => m.role === 'system');
    const addition = '\n\nОтвечай как умный поисковый ассистент: кратко, по фактам, без выдуманных имен. Используй свежие данные ниже. Если данных мало — скажи честно.\nДанные из интернета:\n' + facts.slice(0, 4000);
    if (sysIdx >= 0) messages[sysIdx].content += addition;
    else messages.unshift({ role: 'system', content: addition });
  }
  const key = JSON.stringify(messages).slice(0, 8000);
  if (CACHE.has(key)) return json(res, 200, { ok: true, answer: CACHE.get(key), source: 'cache' });

  let answer = await kiloChat(messages, 'baidu/ernie-5.5-flash-preview:free');
  let source = 'ernie-5.5';
  if (!answer) { answer = await kiloChat(messages, 'nvidia/nemotron-3-ultra-550b-a55b:free'); source = 'nemotron-550b'; }
  if (!answer) { answer = await ovhChat(messages, 'gpt-oss-120b'); source = 'ovh-120b'; }
  if (!answer) { answer = await ovhChat(messages, 'Meta-Llama-3_3-70B-Instruct'); source = 'ovh-llama'; }
  if (!answer) { answer = await pollinations(messages); source = 'pollinations'; }
  if (!answer) return json(res, 502, { ok: false, error: 'AI unavailable' });
  CACHE.set(key, answer);
  if (CACHE.size > 200) CACHE.clear();
  return json(res, 200, { ok: true, answer: answer, source: source, sources: sources.slice(0, 4), debug: body.debug ? (global.__geminiErr || '') : undefined });
};
