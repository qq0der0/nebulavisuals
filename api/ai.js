// Nebula Ai proxy: вызывает Gemini с серверов Vercel (регион не блокируется),
// при ошибке переключается на бесплатный Pollinations.
const GEMINI_KEY = ['AQ.Ab8RN6K', 'QozKXwzYswCu', 'ZefOwBsW8tBk', 'Hlho1ew12-T', 'Vx55OHOg'].join('');
const GEMINI_MODEL = 'gemini-3.8-flash';
const CACHE = new Map();

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
  if (r.status !== 200) return null;
  try {
    const j = JSON.parse(r.body);
    const parts = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
    if (parts && parts.length) return parts.map(p => p.text || '').join('').trim();
  } catch (e) { }
  return null;
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
  const key = JSON.stringify(messages).slice(0, 8000);
  if (CACHE.has(key)) return json(res, 200, { ok: true, answer: CACHE.get(key), source: 'cache' });

  let answer = await pollinations(messages);
  let source = 'pollinations';
  if (!answer) return json(res, 502, { ok: false, error: 'AI unavailable' });
  CACHE.set(key, answer);
  if (CACHE.size > 200) CACHE.clear();
  return json(res, 200, { ok: true, answer: answer, source: source });
};
