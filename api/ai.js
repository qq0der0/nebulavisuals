// Anonymous free LLM proxy for Nebula Visuals launcher.
// No paid API keys, no DeepSeek/Gemini/Groq/OpenRouter.
const CACHE = new Map();
let lastPollinationsAt = 0;
const LOCAL_FACTS = [
  'Nebula Visuals Beta is an Electron launcher for Minecraft 1.21.4 with Fabric.',
  'The Beta game directory is C:\\NebulaVisuals\\game\\Beta.',
  'The launcher includes game, mods, assistant and settings areas.'
].join('\n');

function json(res, code, obj) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(code).json(obj);
}
function post(url, body, timeout) {
  return new Promise(resolve => {
    let done = false;
    const finish = value => { if (!done) { done = true; resolve(value); } };
    try {
      const data = Buffer.from(JSON.stringify(body), 'utf8');
      const req = require('https').request(url, {
        method: 'POST', timeout: timeout || 7000,
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
      }, response => {
        let raw = '';
        response.on('data', chunk => { raw += chunk; });
        response.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            const answer = parsed && parsed.choices && parsed.choices[0] &&
              parsed.choices[0].message && parsed.choices[0].message.content;
            finish(response.statusCode >= 200 && response.statusCode < 300 && answer
              ? String(answer).trim() : null);
          } catch (e) { finish(null); }
        });
      });
      req.on('error', () => finish(null));
      req.on('timeout', () => { try { req.destroy(); } catch (e) {} finish(null); });
      req.write(data);
      req.end();
    } catch (e) { finish(null); }
  });
}
function getJson(url, timeout) {
  return new Promise(resolve => {
    let done = false;
    const finish = value => { if (!done) { done = true; resolve(value); } };
    try {
      const req = require('https').get(url, {
        timeout: timeout || 3500,
        headers: { 'User-Agent': 'NebulaVisualsLauncher/1.0' }
      }, response => {
        let raw = '';
        response.on('data', chunk => { raw += chunk; });
        response.on('end', () => {
          try { finish(JSON.parse(raw)); } catch (e) { finish(null); }
        });
      });
      req.on('error', () => finish(null));
      req.on('timeout', () => { try { req.destroy(); } catch (e) {} finish(null); });
    } catch (e) { finish(null); }
  });
}

function getText(url, timeout) {
  return new Promise(resolve => {
    let done = false;
    const finish = value => { if (!done) { done = true; resolve(value); } };
    try {
      const req = require('https').get(url, {
        timeout: timeout || 4000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NebulaVisualsLauncher/1.0)' }
      }, response => {
        let raw = '';
        response.on('data', chunk => { raw += chunk; if (raw.length > 900000) req.destroy(); });
        response.on('end', () => finish(raw));
      });
      req.on('error', () => finish(''));
      req.on('timeout', () => { try { req.destroy(); } catch (e) {} finish(''); });
    } catch (e) { finish(''); }
  });
}
function decodeHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)));
}

async function searchWeb(query) {
  const q = String(query || '').slice(0, 180);
  const ddgUrl = 'https://api.duckduckgo.com/?q=' + encodeURIComponent(q) + '&format=json&no_html=1&skip_disambig=1';
  const wikiUrl = 'https://ru.wikipedia.org/w/api.php?action=query&list=search&srsearch=' +
    encodeURIComponent(q) + '&format=json&srlimit=3&utf8=1';
  const htmlUrl = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q);
  const results = await Promise.all([getJson(ddgUrl, 3500), getJson(wikiUrl, 3500), getText(htmlUrl, 4000)]);
  const ddg = results[0], wiki = results[1], html = results[2] || '', sources = [], facts = [];
  if (ddg && ddg.AbstractText) {
    facts.push(String(ddg.AbstractText).slice(0, 700));
    sources.push({ title: ddg.Heading || 'DuckDuckGo', url: ddg.AbstractURL || 'https://duckduckgo.com/?q=' + encodeURIComponent(q), snippet: String(ddg.AbstractText).slice(0, 450) });
  }
  (ddg && ddg.RelatedTopics || []).forEach(item => {
    if (item && item.Text && item.FirstURL && sources.length < 4) {
      facts.push(String(item.Text).slice(0, 450));
      sources.push({ title: String(item.Text).split(' - ')[0].slice(0, 90), url: item.FirstURL, snippet: String(item.Text).slice(0, 350) });
    }
  });
  const resultRx = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>)/gi;
  let match;
  while ((match = resultRx.exec(html)) && sources.length < 5) {
    let href = String(match[1] || '').replace(/&amp;/g, '&');
    try {
      const parsed = new URL(href, 'https://duckduckgo.com');
      const target = parsed.searchParams.get('uddg');
      if (target) href = target;
    } catch (e) {}
    if (!/^https?:\/\//i.test(href) || sources.some(s => s.url === href)) continue;
    const title = decodeHtml(match[2]).trim().slice(0, 100);
    const snippet = decodeHtml(match[3] || match[4] || '').trim().slice(0, 450);
    if (title && snippet) {
      facts.push(title + ': ' + snippet);
      sources.push({ title, url: href, snippet });
    }
  }
  (((wiki || {}).query || {}).search || []).forEach(item => {
    if (sources.length < 5) {
      const title = String(item.title || '');
      const snippet = String(item.snippet || '').replace(/<[^>]*>/g, '');
      facts.push(title + ': ' + snippet);
      sources.push({ title: title.slice(0, 90), url: 'https://ru.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_')), snippet: snippet.slice(0, 350) });
    }
  });
  return { facts: facts, sources: sources.slice(0, 5) };
}
async function getAnswer(messages) {
  let answer = await post('https://ai-gateway.kilo.ai/api/v1/chat/completions', {
    model: 'baidu/ernie-5.5-flash-preview:free', messages, max_tokens: 850, temperature: 0.72
  }, 6500);
  if (!answer) answer = await post('https://ai-gateway.kilo.ai/api/v1/chat/completions', {
    model: 'nvidia/nemotron-3-ultra-550b-a55b:free', messages, max_tokens: 850, temperature: 0.7
  }, 7500);
  if (!answer) answer = await post('https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions', {
    model: 'gpt-oss-120b', messages, max_tokens: 850, temperature: 0.7
  }, 7500);
  if (!answer) answer = await post('https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions', {
    model: 'Meta-Llama-3_3-70B-Instruct', messages, max_tokens: 850, temperature: 0.7
  }, 7500);
  if (!answer && Date.now() - lastPollinationsAt >= 45000) {
    lastPollinationsAt = Date.now();
    answer = await post('https://text.pollinations.ai/openai', {
      model: 'openai', messages, max_tokens: 700
    }, 9000);
  }
  return answer;
}
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch (e) {}
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) return json(res, 400, { ok: false, error: 'No messages' });

  const baseCacheKey = JSON.stringify({ messages, web: !!body.web });
  const cachedEarly = CACHE.get(baseCacheKey);
  if (cachedEarly && Date.now() - cachedEarly.at < 3 * 60 * 1000) {
    return json(res, 200, { ok: true, answer: cachedEarly.answer, sources: cachedEarly.sources || [], source: 'cache' });
  }
  const lastUser = messages.slice().reverse().find(m => m && m.role === 'user');
  let sources = [], facts = '';
  if (body.web && lastUser) {
    const found = await searchWeb(lastUser.content || '');
    sources = found.sources;
    facts = found.facts.join('\n').slice(0, 3500);
  }
  const safeMessages = messages.map(m => ({
    role: m.role === 'assistant' || m.role === 'system' ? m.role : 'user',
    content: String(m.content || '').slice(0, m.role === 'system' ? 8000 : 3000)
  }));
  if (facts) {
    const system = safeMessages.find(m => m.role === 'system');
    const addition = '\n\nАктуальные найденные сведения (используй только релевантное, не выдумывай факты):\n' + facts;
    if (system) system.content += addition;
    else safeMessages.unshift({ role: 'system', content: 'Отвечай точно и честно.' + addition });
  }
  const answer = await getAnswer(safeMessages);
  if (!answer) {
    if (facts) {
      const factAnswer = 'Не удалось подключиться к языковой модели, но поиск нашёл такие сведения:\n\n' +
        facts.split('\n').filter(Boolean).slice(0, 5).map(x => '• ' + x).join('\n');
      return json(res, 200, { ok: true, answer: factAnswer, sources, source: 'search-fallback' });
    }
    return json(res, 503, { ok: false, error: 'Все бесплатные провайдеры временно недоступны' });
  }
  CACHE.set(baseCacheKey, { answer, sources, at: Date.now() });
  if (CACHE.size > 150) {
    const oldest = CACHE.keys().next().value;
    CACHE.delete(oldest);
  }
  return json(res, 200, { ok: true, answer, sources, source: 'free-router' });
};
