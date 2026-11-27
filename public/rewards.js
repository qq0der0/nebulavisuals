/* Nebula Visuals — награды и промокоды (демо, localStorage). РUBLEЙ БОЛЬШЕ НЕТ. */
(function () {
  'use strict';

  var STATE_KEY = 'nvRewardsState';
  var FREE_KEY = 'nvRewardsFreeDate';
  var USED_KEY = 'nvRewardsUsedPromos';
  var DISCOUNT_KEY = 'nvPromoDiscount';
  var DISCOUNT_UNTIL_KEY = 'nvPromoDiscountUntil';

  var OWN_PROMO = 'qqc0d';
  var DISCOUNT_CODES = {
    'QQC0D': 10,
    'NEBULA15': 15,
    'NEBULA18': 18,
    'NEBULA20': 20,
    'NEBULA22': 22,
    'NEBULA25': 25
  };
  var COLORS = ['#ff83bc', '#9b7bff', '#69a8ff', '#7ef0a8', '#ffd66b', '#ff9a5c'];
  var RARITY_LABEL = {
    common: 'ОБЫЧНЫЙ', rare: 'РЕДКИЙ', epic: 'ЭПИЧЕСКИЙ',
    legendary: 'ЛЕГЕНДАРНЫЙ', mythic: 'МИФИЧЕСКИЙ'
  };

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function dateStr(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function num(v) { var n = Number(v); return isFinite(n) && n > 0 ? Math.floor(n) : 0; }
  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function loadState() {
    var raw = {};
    try { raw = JSON.parse(lsGet(STATE_KEY) || '{}') || {}; } catch (e) { raw = {}; }
    return {
      betaDays: num(raw.betaDays),
      betaForever: !!raw.betaForever,
      nickColor: String(raw.nickColor || ''),
      cardsOpened: num(raw.cardsOpened),
      history: Array.isArray(raw.history) ? raw.history.slice(0, 20) : []
    };
  }
  var state = loadState();
  var picked = [];
  var currentCards = [];
  var dailyClaimed = false;

  function saveState() {
    lsSet(STATE_KEY, JSON.stringify(state));
    syncSubscription();
    renderBalances();
    try { window.dispatchEvent(new CustomEvent('nv-rewards-updated')); } catch (e) {}
  }

  function syncSubscription() {
    var sub = null;
    try { sub = JSON.parse(lsGet('nvSubscription') || 'null'); } catch (e) { sub = null; }
    var next = null;
    if (state.betaForever) {
      next = { active: true, forever: true, since: (sub && sub.since) || Date.now(), days: state.betaDays, source: 'rewards' };
    } else if (state.betaDays > 0) {
      next = { active: true, forever: false, since: (sub && sub.since) || Date.now(), days: state.betaDays, source: 'rewards' };
    }
    if (next) lsSet('nvSubscription', JSON.stringify(next));
  }

  function loadUsed() {
    try { var a = JSON.parse(lsGet(USED_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }

  var CSS = [
    '.nvr-backdrop{position:fixed;inset:0;z-index:1500;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(4,5,12,.84);backdrop-filter:blur(9px)}',
    '.nvr-backdrop.open{display:flex}',
    '.nvr-modal{position:relative;width:min(540px,100%);max-height:92vh;overflow:auto;border-radius:22px;padding:24px;color:#f2f2fa;background:linear-gradient(160deg,rgba(34,28,62,.99),rgba(12,13,25,.99));border:1px solid rgba(180,150,255,.28);box-shadow:0 30px 90px rgba(0,0,0,.7)}',
    '.nvr-close{position:absolute;top:12px;right:16px;background:none;border:0;color:#a0a6bb;font-size:26px;line-height:1;cursor:pointer}',
    '.nvr-kicker{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#b89bff;font-weight:800}',
    '.nvr-title{margin:6px 0 6px;font-size:25px;font-weight:800;letter-spacing:-.02em}',
    '.nvr-sub{margin:0 0 14px;font-size:13px;line-height:1.55;color:#a2a9bd}',
    '.nvr-balance{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}',
    '.nvr-balance>div{flex:1 1 180px;padding:10px 13px;border-radius:13px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);font-size:13px;color:#cfd3e2}',
    '.nvr-balance b{color:#c9b6ff;font-size:15px}',
    '.nvr-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:6px 0 14px;min-height:40px}',
    '.nvr-empty{grid-column:1/-1;text-align:center;padding:22px 12px;border:1px dashed rgba(180,150,255,.25);border-radius:16px;color:#8e95a9;font-size:13px;line-height:1.5}',
    '.nvr-card{position:relative;perspective:900px;aspect-ratio:3/4;min-height:150px;cursor:pointer;outline:none}',
    '.nvr-card-inner{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .65s cubic-bezier(.2,.8,.25,1)}',
    '.nvr-card.flipped .nvr-card-inner,.nvr-card.picked .nvr-card-inner{transform:rotateY(180deg)}',
    '.nvr-card.picked{filter:drop-shadow(0 0 10px rgba(170,130,255,.5))}',
    '.nvr-face{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:10px;text-align:center;border-radius:14px;backface-visibility:hidden;-webkit-backface-visibility:hidden;border:1px solid rgba(255,255,255,.12)}',
    '.nvr-front{background:radial-gradient(circle at 50% 30%,rgba(160,120,255,.45),rgba(20,18,40,.98) 65%)}',
    '.nvr-front-mark{font-size:32px;color:#d7c4ff;animation:nvrPulse 1.8s ease-in-out infinite}',
    '.nvr-front-text{font-size:11px;letter-spacing:.16em;color:#b8a7e8;font-weight:800}',
    '.nvr-back{transform:rotateY(180deg);background:linear-gradient(160deg,rgba(46,38,78,.98),rgba(16,17,30,.98))}',
    '.nvr-rarity{font-size:9px;letter-spacing:.1em;font-weight:800;color:#9aa4b8}',
    '.nvr-icon{font-size:28px;line-height:1}',
    '.nvr-value{font-size:14px;font-weight:800;color:#fff}',
    '.nvr-desc{font-size:10px;line-height:1.35;color:#a7aec1}',
    '.nvr-common{border-color:rgba(180,190,210,.4)}.nvr-rare{border-color:rgba(90,170,255,.55)}.nvr-epic{border-color:rgba(180,120,255,.6)}.nvr-legendary{border-color:rgba(255,190,80,.65)}.nvr-mythic{border-color:rgba(255,110,180,.7)}',
    '@keyframes nvrPulse{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.12);opacity:1}}',
    '.nvr-actions{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:8px}',
    '.nvr-btn{flex:1 1 150px;min-height:42px;padding:10px 14px;border-radius:13px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#f2f2fa;font-weight:700;font-size:13px;cursor:pointer;transition:.18s}',
    '.nvr-btn:hover:not(:disabled){transform:translateY(-1px);border-color:rgba(180,150,255,.55)}',
    '.nvr-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.nvr-btn.primary{border:0;background:linear-gradient(135deg,#9b7bff,#5aa9ff);color:#fff;box-shadow:0 8px 24px rgba(140,100,255,.25)}',
    '.nvr-msg{min-height:18px;margin:8px 0;font-size:12.5px;line-height:1.5;color:#8fe6ad}',
    '.nvr-msg.err{color:#ff9090}',
    '.nvr-section{margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.08)}',
    '.nvr-section h3{margin:0 0 9px;font-size:14px;font-weight:800;color:#e8e6f4}',
    '.nvr-row{display:flex;gap:8px}',
    '.nvr-input{flex:1;min-width:0;padding:11px 13px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#fff;font-size:13px;outline:none}',
    '.nvr-input:focus{border-color:rgba(170,125,255,.7)}',
    '.nvr-small{padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);color:#fff;font-weight:700;font-size:13px;cursor:pointer}',
    '.nvr-code-list{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0 0}',
    '.nvr-code{padding:7px 11px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#d7d9e6;font-size:12px;cursor:pointer}',
    '.nvr-code:hover{border-color:#b89bff;color:#fff}',
    '.nvr-promo-slot{margin-top:20px;max-width:560px;margin-left:auto;margin-right:auto}',
    '.nvr-promo-widget{padding:16px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(180,150,255,.2)}',
    '.nvr-promo-top{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font-size:14px}',
    '.nvr-promo-top b{font-size:17px;color:#c9b6ff;letter-spacing:.04em}',
    '.nvr-promo-badge{padding:4px 9px;border-radius:999px;background:rgba(169,139,255,.18);border:1px solid rgba(169,139,255,.35);font-size:10px;font-weight:800;letter-spacing:.08em;color:#c9b6ff}',
    '.nvr-promo-off{font-size:13px;font-weight:800;color:#7ef0a8}',
    '.nvr-copy{margin-left:auto;padding:6px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#dfe0ec;font-size:11px;cursor:pointer}',
    '.nvr-promo-hint{margin:9px 0 0;font-size:12px;line-height:1.55;color:#98a0b5}',
    '.nvr-promo-widget .nvr-row{margin-top:11px}',
    '@media (max-width:480px){.nvr-modal{padding:20px 15px}.nvr-card{min-height:130px}.nvr-card .nvr-value{font-size:12px}}',
    '@media (max-width:360px){.nvr-backdrop{padding:8px}.nvr-modal{padding:16px 11px;border-radius:16px;max-height:94vh}.nvr-title{font-size:21px}.nvr-cards{gap:6px}.nvr-card{min-height:115px}.nvr-actions{display:block}.nvr-btn{width:100%;margin-bottom:7px}.nvr-copy{margin-left:0}}',
    '@media (prefers-reduced-motion:reduce){.nvr-card-inner{transition:none}.nvr-front-mark{animation:none}.nvr-btn:hover:not(:disabled){transform:none}}'
  ].join('\n');
  var st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);

  var backdrop = document.createElement('div');
  backdrop.className = 'nvr-backdrop';
  backdrop.id = 'nvrBackdrop';
  backdrop.innerHTML =
    '<div class="nvr-modal" role="dialog" aria-modal="true" aria-labelledby="nvrTitle">' +
      '<button class="nvr-close" id="nvrClose" aria-label="Закрыть">×</button>' +
      '<div class="nvr-kicker">Ежедневная награда</div>' +
      '<h2 class="nvr-title" id="nvrTitle">Награда</h2>' +
      '<p class="nvr-sub">Каждый день — 3 карты. Выбери любые 2, они перевернутся и начислят награду.</p>' +
      '<div class="nvr-balance">' +
        '<div>Бета: <b data-beta-days>0</b> дн. <span id="nvrForever"></span></div>' +
      '</div>' +
      '<div class="nvr-cards" id="nvrCards"><div class="nvr-empty">Нажми «Открыть 3 карты», затем выбери 2 из них.</div></div>' +
      '<div class="nvr-actions">' +
        '<button class="nvr-btn primary" id="nvrFreeBtn" type="button">🎁 Открыть 3 карты</button>' +
        '<button class="nvr-btn" id="nvrPromoBtn" type="button">🔑 Промокод</button>' +
      '</div>' +
      '<div class="nvr-msg" id="nvrMsg"></div>' +
      '<div class="nvr-section" id="nvrPromoSection" hidden>' +
        '<h3>Промокод — выбери сам</h3>' +
        '<div class="nvr-row"><input class="nvr-input" id="nvrPromoInput" placeholder="Введи промокод" maxlength="64" autocomplete="off">' +
        '<button class="nvr-small" id="nvrApplyBtn" type="button">Активировать</button></div>' +
        '<div class="nvr-code-list" id="nvrCodeList"></div>' +
        '<div class="nvr-msg" id="nvrPromoMsg"></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(backdrop);

  function say(text, err) {
    var el = document.getElementById('nvrMsg');
    if (el) { el.textContent = text || ''; el.className = 'nvr-msg' + (err ? ' err' : ''); }
  }
  function sayPromo(text, err, widget) {
    var el = document.getElementById(widget ? 'nvrWidgetMsg' : 'nvrPromoMsg');
    if (el) { el.textContent = text || ''; el.className = 'nvr-msg' + (err ? ' err' : ''); }
  }

  function renderBalances() {
    var betaEls = document.querySelectorAll('[data-beta-days]');
    for (var j = 0; j < betaEls.length; j++) betaEls[j].textContent = String(state.betaDays);
    var forever = document.getElementById('nvrForever');
    if (forever) forever.textContent = state.betaForever ? '· навсегда 👑' : '';
    var freeBtn = document.getElementById('nvrFreeBtn');
    if (freeBtn) {
      dailyClaimed = lsGet(FREE_KEY) === dateStr();
      freeBtn.textContent = dailyClaimed ? 'Карты уже были сегодня' : '🎁 Открыть 3 карты';
      freeBtn.disabled = dailyClaimed;
    }
    renderPromoWidgets(true);
  }

  function rollCard() {
    var x = Math.random();
    if (x < 0.62) return { type: 'betaDays', days: randInt(1, 30), rarity: 'epic' };
    if (x < 0.84) return { type: 'color', color: pick(COLORS), rarity: 'rare' };
    if (x < 0.95) return { type: 'config', rarity: 'common' };
    return { type: 'forever', rarity: 'mythic' };
  }

  function cardInfo(r) {
    if (r.type === 'betaDays') return { icon: '🔷', value: r.days === 30 ? 'Бета: 1 месяц' : 'Бета: ' + r.days + ' дн.', desc: 'Дни беты добавлены' };
    if (r.type === 'color') return { icon: '🎨', value: 'Цвет ника', desc: 'Редкий цвет для чата' };
    if (r.type === 'config') return { icon: '⚙️', value: 'Конфиг', desc: 'Готовый конфиг (демо)' };
    return { icon: '👑', value: 'Бета навсегда', desc: 'Мифическая карта' };
  }

  function applyReward(r) {
    if (r.type === 'betaDays') state.betaDays += r.days;
    else if (r.type === 'color') state.nickColor = r.color;
    else if (r.type === 'config') state.nickColor = state.nickColor || '#b89bff';
    else if (r.type === 'forever') state.betaForever = true;
    state.cardsOpened += 1;
    state.history.unshift({ type: r.type, rarity: r.rarity, at: Date.now() });
    state.history = state.history.slice(0, 20);
  }

  function renderCards() {
    var wrap = document.getElementById('nvrCards');
    if (!wrap) return;
    if (!currentCards.length) {
      wrap.innerHTML = '<div class="nvr-empty">Нажми «Открыть 3 карты», затем выбери 2 из них.</div>';
      return;
    }
    wrap.innerHTML = currentCards.map(function (r, i) {
      var c = cardInfo(r);
      var cls = 'nvr-card nvr-' + r.rarity + (picked.indexOf(i) !== -1 ? ' picked' : '') + (picked.length >= 2 && picked.indexOf(i) === -1 ? ' flipped' : '');
      return '<div class="' + cls + '" data-index="' + i + '" role="button" tabindex="0">' +
        '<div class="nvr-card-inner">' +
          '<div class="nvr-face nvr-front"><div class="nvr-front-mark">✦</div><div class="nvr-front-text">ВЫБЕРИ</div></div>' +
          '<div class="nvr-face nvr-back">' +
            '<div class="nvr-rarity">' + RARITY_LABEL[r.rarity] + '</div>' +
            '<div class="nvr-icon">' + c.icon + '</div>' +
            '<div class="nvr-value">' + c.value + '</div>' +
            '<div class="nvr-desc">' + c.desc + '</div>' +
          '</div>' +
        '</div></div>';
    }).join('');
    var cards = wrap.querySelectorAll('.nvr-card');
    for (var k = 0; k < cards.length; k++) {
      (function (card) {
        function choose() {
          var idx = Number(card.getAttribute('data-index'));
          if (picked.indexOf(idx) !== -1 || picked.length >= 2) return;
          picked.push(idx);
          applyReward(currentCards[idx]);
          saveState();
          renderCards();
          if (picked.length === 2) {
            var names = picked.map(function (i) { return cardInfo(currentCards[i]).value; });
            say('Получено: ' + names.join(', ') + '. Третья карта не выбрана.');
          }
        }
        card.addEventListener('click', choose);
        card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
      })(cards[k]);
    }
  }

  function openCards() {
    if (dailyClaimed) { say('Карты уже были сегодня. Завтра снова.', true); return; }
    lsSet(FREE_KEY, dateStr());
    dailyClaimed = true;
    picked = [];
    currentCards = [rollCard(), rollCard(), rollCard()];
    renderCards();
    var freeBtn = document.getElementById('nvrFreeBtn');
    if (freeBtn) { freeBtn.textContent = 'Карты уже были сегодня'; freeBtn.disabled = true; }
    say('Выбери 2 карты из трёх.');
  }

  function applyDiscount(percent) {
    lsSet(DISCOUNT_KEY, percent);
    lsSet(DISCOUNT_UNTIL_KEY, String(new Date(2099, 11, 31).getTime()));
  }

  function redeem(rawValue, reporter, widget) {
    var v = String(rawValue || '').trim().toUpperCase();
    if (!v) { reporter('Введите промокод', true, widget); return; }
    var used = loadUsed();
    if (used.indexOf(v) !== -1) { reporter('Этот промокод уже активирован', true, widget); return; }
    var d = DISCOUNT_CODES[v];
    if (d) {
      applyDiscount(d);
      used.push(v);
      lsSet(USED_KEY, JSON.stringify(used));
      reporter('Промокод ' + v + ' активирован: скидка ' + d + '% навсегда', false, widget);
      return;
    }
    reporter('Промокод не найден', true, widget);
  }

  function renderCodeList() {
    var list = document.getElementById('nvrCodeList');
    if (!list) return;
    list.innerHTML = Object.keys(DISCOUNT_CODES).map(function (code) {
      return '<button class="nvr-code" type="button" data-code="' + code + '">' + code + ' · −' + DISCOUNT_CODES[code] + '%</button>';
    }).join('');
    var buttons = list.querySelectorAll('.nvr-code');
    for (var i = 0; i < buttons.length; i++) {
      (function (b) {
        b.addEventListener('click', function () {
          var input = document.getElementById('nvrPromoInput');
          if (input) input.value = b.getAttribute('data-code');
          redeem(b.getAttribute('data-code'), sayPromo, false);
        });
      })(buttons[i]);
    }
  }

  function renderPromoWidgets(force) {
    var slots = document.querySelectorAll('[data-rewards-promo]');
    for (var i = 0; i < slots.length; i++) {
      var el = slots[i];
      if (el.getAttribute('data-ready') === '1' && !force) continue;
      el.setAttribute('data-ready', '1');
      el.innerHTML =
        '<div class="nvr-promo-widget">' +
          '<div class="nvr-promo-top"><span class="nvr-promo-badge">ПРОМОКОД</span><b>' + OWN_PROMO + '</b>' +
            '<span class="nvr-promo-off">−10%</span><button class="nvr-copy" id="nvrWidgetCopy" type="button">Копировать</button></div>' +
          '<p class="nvr-promo-hint">Введи промокод — он будет действовать всегда. Можно выбрать любой из списка.</p>' +
          '<div class="nvr-row"><input class="nvr-input" id="nvrWidgetInput" placeholder="Введи промокод" maxlength="64" autocomplete="off">' +
          '<button class="nvr-small" id="nvrWidgetBtn" type="button">Применить</button></div>' +
          '<div class="nvr-msg" id="nvrWidgetMsg"></div>' +
        '</div>';
      var copy = document.getElementById('nvrWidgetCopy');
      if (copy) copy.addEventListener('click', function () {
        try { navigator.clipboard.writeText(OWN_PROMO); } catch (e) {}
        sayPromo('Промокод ' + OWN_PROMO + ' скопирован', false, true);
      });
      var input = document.getElementById('nvrWidgetInput');
      var btn = document.getElementById('nvrWidgetBtn');
      if (btn) btn.addEventListener('click', function () { if (input) redeem(input.value, sayPromo, true); });
      if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && btn) btn.click(); });
    }
  }

  function open() { renderBalances(); renderCards(); backdrop.classList.add('open'); backdrop.setAttribute('aria-hidden', 'false'); }
  function close() { backdrop.classList.remove('open'); backdrop.setAttribute('aria-hidden', 'true'); }

  document.getElementById('nvrClose').addEventListener('click', close);
  backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && backdrop.classList.contains('open')) close(); });
  document.getElementById('nvrFreeBtn').addEventListener('click', openCards);
  document.getElementById('nvrPromoBtn').addEventListener('click', function () {
    var sec = document.getElementById('nvrPromoSection');
    if (sec) { sec.hidden = !sec.hidden; renderCodeList(); }
  });
  document.getElementById('nvrApplyBtn').addEventListener('click', function () {
    redeem(document.getElementById('nvrPromoInput').value, sayPromo, false);
  });
  document.getElementById('nvrPromoInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('nvrApplyBtn').click();
  });

  function bindOpeners() {
    document.querySelectorAll('.js-rewards-open').forEach(function (btn) {
      if (btn.getAttribute('data-rewards-bound') === '1') return;
      btn.setAttribute('data-rewards-bound', '1');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var menu = document.getElementById('nav-mobile-menu');
        if (menu) menu.classList.remove('open');
        open();
      });
    });
  }

  renderBalances();
  renderCards();
  renderCodeList();
  bindOpeners();
  window.addEventListener('auth-changed', function () { renderBalances(); bindOpeners(); });
  window.addEventListener('storage', function () { state = loadState(); renderBalances(); renderCards(); });
  window.addEventListener('nv-rewards-updated', function () { renderPromoWidgets(true); bindOpeners(); });

  window.NebulaRewards = {
    open: open,
    close: close,
    getState: function () { return JSON.parse(JSON.stringify(state)); },
    hasBeta: function () { return state.betaForever || state.betaDays > 0 || !!lsGet('nvSubscription'); },
    redeem: function (code) { redeem(code, sayPromo, false); },
    render: renderBalances
  };
})();
