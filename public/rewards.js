/* Nebula Visuals — награды: ежедневные карты, рубли, бета и промокоды.
   Демо-режим: всё хранится в localStorage, реальные платежи не выполняются. */
(function () {
  'use strict';

  var STATE_KEY = 'nvRewardsState';
  var FREE_KEY = 'nvRewardsFreeDate';
  var USED_KEY = 'nvRewardsUsedPromos';
  var DISCOUNT_KEY = 'nvPromoDiscount';           // совместимо с promo.js / keys.js
  var DISCOUNT_UNTIL_KEY = 'nvPromoDiscountUntil';
  var CARD_PRICE = 19;                            // 3 карты за 19 рублей
  var OWN_PROMO = 'qqc0d';                        // «свой» промокод автора: −10%, только с бетой

  // Те же коды записаны в E:\иконки для визуалов\опенкод\ключи\promo-rubles.txt
  var RUBLES_CODES = [
    'Nebula_GFQ-OMY15', 'Nebula_IPD-LGV15', 'Nebula_CLI-TTK15', 'Nebula_CHR-FIX15', 'Nebula_IMF-FUM15',
    'Nebula_SRD-MDI25', 'Nebula_BLA-DWN25', 'Nebula_JBA-GHV25', 'Nebula_CJR-QQV25', 'Nebula_HCX-EVH25',
    'Nebula_TUE-MRA50', 'Nebula_KVX-ZEB50', 'Nebula_UXH-NEK50', 'Nebula_ENZ-YRE50', 'Nebula_VIY-GDQ50',
    'Nebula_SDT-QRE100', 'Nebula_TTM-KNU100', 'Nebula_EFU-HHH100', 'Nebula_AYN-GYU100', 'Nebula_QXS-HFH100',
    'Nebula_IWF-KPV150', 'Nebula_RXT-CUV150', 'Nebula_ROV-XWC150', 'Nebula_CLE-HPU150', 'Nebula_IWQ-ORA150',
    'Nebula_HIB-HOZ200', 'Nebula_YKQ-BGG200', 'Nebula_EAP-YQU200', 'Nebula_KAU-EPB200', 'Nebula_YOR-SKK200',
    'Nebula_VPF-VRD250', 'Nebula_UEH-SVV250', 'Nebula_BNU-MBG250', 'Nebula_IMN-AFX250', 'Nebula_RJE-CYQ250',
    'Nebula_MSU-OAX500', 'Nebula_VQW-VXH500', 'Nebula_IEK-MEG500', 'Nebula_RWP-JLO500', 'Nebula_HYV-ORH500',
    'Nebula_BKR-GER1000', 'Nebula_YJH-XZE1000', 'Nebula_GLK-HSU1000', 'Nebula_OSY-BFP1000', 'Nebula_DXV-TEY1000'
  ];
  var RUBLES_CODES_UPPER = RUBLES_CODES.map(function (c) { return c.toUpperCase(); });

  // Однодневные промокоды на скидку (expiry включительно). См. promo-discount.txt
  var DISCOUNT_CODES = {
    'NEBULA15-2711': { discount: 15, expires: '2026-11-27' },
    'NEBULA18-2711': { discount: 18, expires: '2026-11-27' },
    'NEBULA20-2811': { discount: 20, expires: '2026-11-28' },
    'NEBULA22-2811': { discount: 22, expires: '2026-11-28' },
    'NEBULA25-0112': { discount: 25, expires: '2026-12-01' }
  };

  var COLORS = ['#ff83bc', '#9b7bff', '#69a8ff', '#7ef0a8', '#ffd66b', '#ff9a5c'];
  var RARITY_LABEL = {
    common: 'ОБЫЧНЫЙ', rare: 'РЕДКИЙ', epic: 'ЭПИЧЕСКАЯ',
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
      rubles: num(raw.rubles),
      betaDays: num(raw.betaDays),
      betaForever: !!raw.betaForever,
      nickColor: String(raw.nickColor || ''),
      cardsOpened: num(raw.cardsOpened),
      history: Array.isArray(raw.history) ? raw.history.slice(0, 20) : []
    };
  }

  var state = loadState();

  function saveState() {
    lsSet(STATE_KEY, JSON.stringify(state));
    syncSubscription();
    renderBalances();
    try { window.dispatchEvent(new CustomEvent('nv-rewards-updated')); } catch (e) {}
  }

  // Мягкая синхронизация с keys.js: бета из карт тоже считается бетой.
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

  function currentUser() {
    try { return JSON.parse(lsGet('nebula_auth') || 'null') || {}; } catch (e) { return {}; }
  }

  function hasBeta() {
    if (state.betaForever || state.betaDays > 0) return true;
    var sub = null;
    try { sub = JSON.parse(lsGet('nvSubscription') || 'null'); } catch (e) { sub = null; }
    if (sub && sub.active) return true;
    return String(currentUser().username || '').toLowerCase() === 'qqc0d';
  }

  function loadUsed() {
    try { var a = JSON.parse(lsGet(USED_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }

  /* ---------- styling (self-contained, как keys.js/promo.js) ---------- */
  var CSS = [
    '.nvr-backdrop{position:fixed;inset:0;z-index:1500;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(4,5,12,.82);backdrop-filter:blur(9px)}',
    '.nvr-backdrop.open{display:flex}',
    '.nvr-modal{position:relative;width:min(520px,100%);max-height:90vh;overflow:auto;border-radius:22px;padding:24px;color:#f2f2fa;background:linear-gradient(160deg,rgba(34,28,62,.99),rgba(12,13,25,.99));border:1px solid rgba(180,150,255,.28);box-shadow:0 30px 90px rgba(0,0,0,.7)}',
    '.nvr-close{position:absolute;top:12px;right:16px;background:none;border:0;color:#a0a6bb;font-size:26px;line-height:1;cursor:pointer}',
    '.nvr-kicker{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#b89bff;font-weight:800}',
    '.nvr-title{margin:6px 0 6px;font-size:25px;font-weight:800;letter-spacing:-.02em}',
    '.nvr-sub{margin:0 0 16px;font-size:13px;line-height:1.55;color:#a2a9bd}',
    '.nvr-balance{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}',
    '.nvr-balance>div{flex:1 1 150px;padding:10px 13px;border-radius:13px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);font-size:13px;color:#cfd3e2}',
    '.nvr-balance b{color:#ffd66b;font-size:15px}',
    '.nvr-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:6px 0 16px;min-height:40px}',
    '.nvr-empty{grid-column:1/-1;text-align:center;padding:22px 12px;border:1px dashed rgba(180,150,255,.25);border-radius:16px;color:#8e95a9;font-size:13px;line-height:1.5}',
    '.nvr-card{perspective:900px;aspect-ratio:3/4;min-height:170px;cursor:default}',
    '.nvr-card-inner{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .7s cubic-bezier(.2,.8,.25,1)}',
    '.nvr-card.flipped .nvr-card-inner{transform:rotateY(180deg)}',
    '.nvr-face{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:12px;text-align:center;border-radius:16px;backface-visibility:hidden;-webkit-backface-visibility:hidden;border:1px solid rgba(255,255,255,.12)}',
    '.nvr-front{background:radial-gradient(circle at 50% 30%,rgba(160,120,255,.45),rgba(20,18,40,.98) 65%);box-shadow:inset 0 0 22px rgba(160,120,255,.2)}',
    '.nvr-front-mark{font-size:38px;color:#d7c4ff;animation:nvrPulse 1.8s ease-in-out infinite}',
    '.nvr-front-text{font-size:12px;letter-spacing:.18em;color:#b8a7e8;font-weight:800}',
    '.nvr-back{transform:rotateY(180deg);background:linear-gradient(160deg,rgba(46,38,78,.98),rgba(16,17,30,.98))}',
    '.nvr-rarity{font-size:10px;letter-spacing:.14em;font-weight:800;color:#9aa4b8}',
    '.nvr-icon{font-size:34px;line-height:1}',
    '.nvr-value{font-size:18px;font-weight:800;color:#fff}',
    '.nvr-desc{font-size:11px;line-height:1.4;color:#a7aec1}',
    '.nvr-common{border-color:rgba(180,190,210,.4)}.nvr-common .nvr-rarity{color:#c4cbd9}',
    '.nvr-rare{border-color:rgba(90,170,255,.55);box-shadow:0 0 18px rgba(70,150,255,.18)}.nvr-rare .nvr-rarity{color:#7fc4ff}',
    '.nvr-epic{border-color:rgba(180,120,255,.6);box-shadow:0 0 20px rgba(160,90,255,.22)}.nvr-epic .nvr-rarity{color:#c69bff}',
    '.nvr-legendary{border-color:rgba(255,190,80,.65);box-shadow:0 0 24px rgba(255,175,60,.24)}.nvr-legendary .nvr-rarity{color:#ffd66b}',
    '.nvr-mythic{border-color:rgba(255,110,180,.7);box-shadow:0 0 28px rgba(255,90,170,.28)}.nvr-mythic .nvr-rarity{color:#ff9ed0}',
    '@keyframes nvrPulse{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.12);opacity:1}}',
    '.nvr-actions{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:8px}',
    '.nvr-btn{flex:1 1 160px;min-height:42px;padding:10px 14px;border-radius:13px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#f2f2fa;font-weight:700;font-size:13px;cursor:pointer;transition:.18s}',
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
    '.nvr-input:disabled{opacity:.5}',
    '.nvr-small{padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);color:#fff;font-weight:700;font-size:13px;cursor:pointer}',
    '.nvr-small:disabled{opacity:.5;cursor:not-allowed}',
    '.nvr-amounts{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:9px}',
    '.nvr-amount{padding:9px 13px;border-radius:11px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#dfe0ec;font-weight:700;font-size:13px;cursor:pointer}',
    '.nvr-amount.active{border-color:#b89bff;background:rgba(169,139,255,.16);color:#fff}',
    '.nvr-note{margin:9px 0 0;font-size:11px;line-height:1.55;color:#7b8296}',
    '.nvr-promo-slot{margin-top:20px;max-width:560px;margin-left:auto;margin-right:auto}',
    '.nvr-promo-widget{padding:16px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(180,150,255,.2)}',
    '.nvr-promo-top{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font-size:14px}',
    '.nvr-promo-top b{font-size:17px;color:#c9b6ff;letter-spacing:.04em}',
    '.nvr-promo-badge{padding:4px 9px;border-radius:999px;background:rgba(169,139,255,.18);border:1px solid rgba(169,139,255,.35);font-size:10px;font-weight:800;letter-spacing:.08em;color:#c9b6ff}',
    '.nvr-promo-off{font-size:13px;font-weight:800;color:#7ef0a8}',
    '.nvr-copy{margin-left:auto;padding:6px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#dfe0ec;font-size:11px;cursor:pointer}',
    '.nvr-promo-hint{margin:9px 0 0;font-size:12px;line-height:1.55;color:#98a0b5}',
    '.nvr-promo-widget .nvr-row{margin-top:11px}',
    '@media (max-width:480px){.nvr-modal{padding:20px 15px}.nvr-card{min-height:150px}.nvr-card .nvr-value{font-size:15px}}',
    '@media (max-width:360px){.nvr-backdrop{padding:8px}.nvr-modal{padding:16px 11px;border-radius:16px;max-height:94vh}.nvr-title{font-size:21px}.nvr-cards{gap:8px}.nvr-card{min-height:135px}.nvr-actions{display:block}.nvr-btn{width:100%;margin-bottom:7px}.nvr-copy{margin-left:0}}',
    '@media (prefers-reduced-motion:reduce){.nvr-card-inner{transition:none}.nvr-front-mark{animation:none}.nvr-btn:hover:not(:disabled){transform:none}}'
  ].join('\n');
  var st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);

  /* ---------- modal ---------- */
  var backdrop = document.createElement('div');
  backdrop.className = 'nvr-backdrop';
  backdrop.id = 'nvrBackdrop';
  backdrop.innerHTML =
    '<div class="nvr-modal" role="dialog" aria-modal="true" aria-labelledby="nvrTitle">' +
      '<button class="nvr-close" id="nvrClose" aria-label="Закрыть">×</button>' +
      '<div class="nvr-kicker">Ежедневная награда</div>' +
      '<h2 class="nvr-title" id="nvrTitle">Награда</h2>' +
      '<p class="nvr-sub">Каждый день — 2 карты бесплатно. Редкие карты дают бету, цвет ника и много рублей. Карты переворачиваются при открытии.</p>' +
      '<div class="nvr-balance">' +
        '<div>💠 Баланс: <b data-rubles>0</b> ₽</div>' +
        '<div>Бета: <b data-beta-days>0</b> дн. <span id="nvrForever"></span></div>' +
      '</div>' +
      '<div class="nvr-cards" id="nvrCards"><div class="nvr-empty">Карты ещё не открыты. Нажмите «Открыть 2 карты бесплатно».</div></div>' +
      '<div class="nvr-actions">' +
        '<button class="nvr-btn primary" id="nvrFreeBtn" type="button">🎁 Открыть 2 карты бесплатно</button>' +
        '<button class="nvr-btn" id="nvrPaidBtn" type="button">3 карты за ' + CARD_PRICE + ' ₽</button>' +
      '</div>' +
      '<div class="nvr-msg" id="nvrMsg"></div>' +
      '<div class="nvr-section">' +
        '<h3>Промокод</h3>' +
        '<div class="nvr-row"><input class="nvr-input" id="nvrPromoInput" placeholder="Nebula_XXX-XXX15 или NEBULA15-2711" maxlength="64" autocomplete="off">' +
        '<button class="nvr-small" id="nvrPromoBtn" type="button">Активировать</button></div>' +
        '<div class="nvr-msg" id="nvrPromoMsg"></div>' +
      '</div>' +
      '<div class="nvr-section">' +
        '<h3>Пополнить баланс (демо)</h3>' +
        '<div class="nvr-amounts" id="nvrAmounts"></div>' +
        '<button class="nvr-btn primary" id="nvrBuyBtn" type="button">Пополнить баланс — демо</button>' +
        '<p class="nvr-note">Демо-оплата: реальные деньги не списываются и никуда не отправляются. Рубли начисляются только в этом браузере.</p>' +
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
    var rublesEls = document.querySelectorAll('[data-rubles]');
    for (var i = 0; i < rublesEls.length; i++) rublesEls[i].textContent = String(state.rubles);
    var betaEls = document.querySelectorAll('[data-beta-days]');
    for (var j = 0; j < betaEls.length; j++) betaEls[j].textContent = String(state.betaDays);
    var forever = document.getElementById('nvrForever');
    if (forever) forever.textContent = state.betaForever ? '· навсегда 👑' : '';
    var freeBtn = document.getElementById('nvrFreeBtn');
    if (freeBtn) {
      var claimed = lsGet(FREE_KEY) === dateStr();
      freeBtn.textContent = claimed ? 'Забрано сегодня — завтра ещё' : '🎁 Открыть 2 карты бесплатно';
      freeBtn.disabled = claimed;
    }
    var paidBtn = document.getElementById('nvrPaidBtn');
    if (paidBtn) paidBtn.disabled = state.rubles < CARD_PRICE;
    renderPromoWidgets(true);
  }

  /* ---------- cards ---------- */
  function rarityByValue(v) {
    if (v <= 10) return 'common';
    if (v <= 20) return 'rare';
    if (v <= 35) return 'epic';
    return 'legendary';
  }

  function rollCard() {
    var x = Math.random();
    if (x < 0.60) {
      var v = randInt(1, 55);
      return { type: 'rubles', value: v, rarity: rarityByValue(v) };
    }
    if (x < 0.80) return { type: 'betaDays', days: randInt(1, 30), rarity: 'epic' };
    if (x < 0.94) return { type: 'color', color: pick(COLORS), rarity: 'rare' };
    return { type: 'forever', rarity: 'mythic' };
  }

  function cardInfo(r) {
    if (r.type === 'rubles') return { icon: '💠', value: '+' + r.value + ' ₽', desc: 'Рубли зачислены на баланс' };
    if (r.type === 'betaDays') return { icon: '🔷', value: r.days === 30 ? 'Бета: 1 месяц' : 'Бета: ' + r.days + ' дн.', desc: 'Дни беты добавлены в профиль' };
    if (r.type === 'color') return { icon: '🎨', value: 'Цвет ника', desc: r.color + ' — цвет появления в чате (демо)' };
    return { icon: '👑', value: 'Бета навсегда', desc: 'Мифическая карта' };
  }

  function applyReward(r) {
    if (r.type === 'rubles') state.rubles += r.value;
    else if (r.type === 'betaDays') state.betaDays += r.days;
    else if (r.type === 'color') state.nickColor = r.color;
    else if (r.type === 'forever') state.betaForever = true;
    state.cardsOpened += 1;
    state.history.unshift({ type: r.type, value: r.value || r.days || r.color || 1, rarity: r.rarity, at: Date.now() });
    state.history = state.history.slice(0, 20);
  }

  function openCards(count) {
    var rewards = [];
    for (var i = 0; i < count; i++) {
      var r = rollCard();
      applyReward(r);
      rewards.push(r);
    }
    saveState();

    var wrap = document.getElementById('nvrCards');
    if (!wrap) return;
    wrap.innerHTML = rewards.map(function (r) {
      var c = cardInfo(r);
      return '<div class="nvr-card nvr-' + r.rarity + '">' +
        '<div class="nvr-card-inner">' +
          '<div class="nvr-face nvr-front"><div class="nvr-front-mark">✦</div><div class="nvr-front-text">NEBULA</div></div>' +
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
      (function (card, idx) {
        setTimeout(function () { card.classList.add('flipped'); }, 300 + idx * 260);
      })(cards[k], k);
    }
    var names = rewards.map(function (r) { return cardInfo(r).value; });
    say('Карты открыты: ' + names.join(', ') + '. Награды зачислены.');
  }

  function claimFree() {
    if (lsGet(FREE_KEY) === dateStr()) { say('Бесплатные карты уже получены сегодня. Зайдите завтра.', true); return; }
    lsSet(FREE_KEY, dateStr());
    openCards(2);
  }

  function buyCards() {
    if (state.rubles < CARD_PRICE) {
      say('Недостаточно рублей: нужно ' + CARD_PRICE + ' ₽. Пополните баланс в демо-режиме или используйте промокод.', true);
      return;
    }
    state.rubles -= CARD_PRICE;
    saveState();
    openCards(3);
  }

  /* ---------- promo codes ---------- */
  function applyDiscount(percent) {
    var until = new Date();
    until.setDate(until.getDate() + 1); // скидка активна один день после активации
    lsSet(DISCOUNT_KEY, percent);
    lsSet(DISCOUNT_UNTIL_KEY, String(until.getTime()));
  }

  function redeem(rawValue, reporter, widget) {
    var v = String(rawValue || '').trim().toUpperCase();
    if (!v) { reporter('Введите промокод', true, widget); return; }
    var used = loadUsed();
    if (used.indexOf(v) !== -1) { reporter('Этот промокод уже активирован', true, widget); return; }

    if (RUBLES_CODES_UPPER.indexOf(v) !== -1) {
      var m = v.match(/(\d+)$/);
      var amount = m ? num(m[1]) : 0;
      if (!amount) { reporter('Не удалось определить номинал промокода', true, widget); return; }
      state.rubles += amount;
      used.push(v);
      lsSet(USED_KEY, JSON.stringify(used));
      saveState();
      if (reporter) reporter('Промокод активирован: +' + amount + ' ₽', false, widget);
      return;
    }

    var d = DISCOUNT_CODES[v];
    if (d) {
      if (dateStr() > d.expires) { reporter('Срок действия промокода истёк (' + d.expires + ')', true, widget); return; }
      applyDiscount(d.discount);
      used.push(v);
      lsSet(USED_KEY, JSON.stringify(used));
      reporter('Скидка ' + d.discount + '% активна один день (до ' + d.expires + ')', false, widget);
      return;
    }

    if (v === OWN_PROMO.toUpperCase()) {
      if (!hasBeta()) { reporter('Свой промокод доступен только пользователям с бетой', true, widget); return; }
      applyDiscount(10);
      used.push(v);
      lsSet(USED_KEY, JSON.stringify(used));
      reporter('Промокод qqc0d активирован: скидка 10% на один день', false, widget);
      return;
    }

    reporter('Промокод не найден', true, widget);
  }

  /* ---------- beta-gated media widget ---------- */
  function renderPromoWidgets(force) {
    var slots = document.querySelectorAll('[data-rewards-promo]');
    for (var i = 0; i < slots.length; i++) {
      var el = slots[i];
      if (el.getAttribute('data-ready') === '1' && !force) continue;
      el.setAttribute('data-ready', '1');
      var beta = hasBeta();
      el.innerHTML =
        '<div class="nvr-promo-widget">' +
          '<div class="nvr-promo-top"><span class="nvr-promo-badge">СВОЙ ПРОМОКОД</span><b>' + OWN_PROMO + '</b>' +
            '<span class="nvr-promo-off">−10%</span><button class="nvr-copy" id="nvrWidgetCopy" type="button">Копировать</button></div>' +
          '<p class="nvr-promo-hint">' + (beta
            ? 'Скидка 10% на бета-доступ. Промокод можно ввести прямо здесь.'
            : 'Промокод автора можно ввести только при наличии беты.') + '</p>' +
          '<div class="nvr-row"><input class="nvr-input" id="nvrWidgetInput" placeholder="Введите промокод" maxlength="64" autocomplete="off"' + (beta ? '' : ' disabled') + '>' +
          '<button class="nvr-small" id="nvrWidgetBtn" type="button"' + (beta ? '' : ' disabled') + '>Применить</button></div>' +
          '<div class="nvr-msg" id="nvrWidgetMsg"></div>' +
        '</div>';
      var copy = document.getElementById('nvrWidgetCopy');
      if (copy) copy.addEventListener('click', function () {
        try { navigator.clipboard.writeText(OWN_PROMO); } catch (e) {}
        sayPromo('Промокод ' + OWN_PROMO + ' скопирован', false, true);
      });
      var input = document.getElementById('nvrWidgetInput');
      var btn = document.getElementById('nvrWidgetBtn');
      if (btn) btn.addEventListener('click', function () {
        if (input) redeem(input.value, sayPromo, true);
      });
      if (input) input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && btn) btn.click();
      });
    }
  }

  /* ---------- fake/local ruble purchase ---------- */
  var selectedAmount = 100;
  var amountsEl = document.getElementById('nvrAmounts');
  [50, 100, 200, 500, 1000].forEach(function (amount) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'nvr-amount' + (amount === selectedAmount ? ' active' : '');
    b.textContent = amount + ' ₽';
    b.addEventListener('click', function () {
      selectedAmount = amount;
      amountsEl.querySelectorAll('.nvr-amount').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
    });
    amountsEl.appendChild(b);
  });

  /* ---------- wiring ---------- */
  function open() {
    renderBalances();
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
  }
  function close() {
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
  }

  document.getElementById('nvrClose').addEventListener('click', close);
  backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && backdrop.classList.contains('open')) close(); });
  document.getElementById('nvrFreeBtn').addEventListener('click', claimFree);
  document.getElementById('nvrPaidBtn').addEventListener('click', buyCards);
  document.getElementById('nvrPromoBtn').addEventListener('click', function () {
    redeem(document.getElementById('nvrPromoInput').value, sayPromo, false);
  });
  document.getElementById('nvrPromoInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('nvrPromoBtn').click();
  });
  document.getElementById('nvrBuyBtn').addEventListener('click', function () {
    state.rubles += selectedAmount;
    saveState();
    say('Демо-пополнение: +' + selectedAmount + ' ₽. Реальные деньги не списывались.');
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
  bindOpeners();
  window.addEventListener('auth-changed', function () { renderBalances(); bindOpeners(); });
  window.addEventListener('storage', function () { state = loadState(); renderBalances(); });
  window.addEventListener('nv-rewards-updated', function () { renderPromoWidgets(true); bindOpeners(); });

  window.NebulaRewards = {
    open: open,
    close: close,
    getState: function () { return JSON.parse(JSON.stringify(state)); },
    hasBeta: hasBeta,
    redeem: function (code) { redeem(code, sayPromo, false); },
    render: renderBalances
  };
})();
