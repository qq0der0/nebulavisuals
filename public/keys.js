/* Nebula Visuals — ключи, подписка и оплата (ТГ + FunPay) */
(function () {
  'use strict';
  var PRICE = 199;
  var FUNPAY = 'https://funpay.com/lots/offer?id=83124206';
  var TELEGRAM = 'https://t.me/paynebulabot';
  var PROMOS = {
    qqc0d: { d: 10, label: 'Промокод qqc0d — скидка 10%' },
    nebula: { d: 10, label: 'Промокод Nebula — скидка 10%' }
  };

  var css = [
    '.nk-btn{padding:9px 16px;border-radius:999px;border:1px solid rgba(180,150,255,.45);background:linear-gradient(135deg,rgba(160,110,255,.22),rgba(80,160,255,.18));color:#fff;font-weight:700;cursor:pointer;transition:.2s}',
    '.nk-btn:hover{background:linear-gradient(135deg,rgba(160,110,255,.38),rgba(80,160,255,.3));transform:translateY(-1px)}',
    '.nk-modal{position:fixed;inset:0;z-index:1300;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(4,5,12,.78);backdrop-filter:blur(10px)}',
    '.nk-modal.open{display:flex}',
    '.nk-card{width:min(430px,100%);max-height:90vh;overflow:auto;position:relative;border-radius:20px;padding:26px;background:linear-gradient(160deg,#1c1a2c,#101019);border:1px solid rgba(255,255,255,.09);box-shadow:0 30px 80px rgba(0,0,0,.65);color:#f2f2f8}',
    '.nk-close{position:absolute;top:20px;right:22px;background:none;border:0;color:#9298ab;font-size:24px;cursor:pointer}',
    '.nk-kicker{font-size:12.5px;color:#a98bff;font-weight:700}',
    '.nk-title{font-size:26px;font-weight:800;margin-top:4px}',
    '.nk-price{font-size:38px;font-weight:800;margin:14px 0 4px;letter-spacing:-1px}',
    '.nk-old{font-size:15px;color:#777e92;text-decoration:line-through;margin-left:10px}',
    '.nk-divider{height:1px;background:rgba(255,255,255,.08);margin:18px 0}',
    '.nk-label{font-size:12.5px;color:#9aa1b5;margin-bottom:9px}',
    '.nk-methods{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '.nk-method{border:1px solid rgba(255,255,255,.1);border-radius:13px;padding:13px 12px;background:rgba(255,255,255,.035);cursor:pointer;position:relative;transition:.18s;text-align:left;color:#eee}',
    '.nk-method:hover{border-color:rgba(170,125,255,.5)}',
    '.nk-method.active{border-color:#a98bff;background:rgba(169,139,255,.12)}',
    '.nk-method .check{position:absolute;top:10px;right:11px;color:#a98bff;opacity:0;font-weight:800}',
    '.nk-method.active .check{opacity:1}',
    '.nk-method b{display:block;font-size:13.5px;margin-bottom:3px}',
    '.nk-method span{font-size:11px;color:#8e95a9}',
    '.nk-row{display:flex;gap:9px;margin-top:8px}',
    '.nk-input{flex:1;min-width:0;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.045);color:#fff;outline:none;font-size:14px}',
    '.nk-input:focus{border-color:rgba(169,139,255,.7)}',
    '.nk-small{padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font-weight:700;cursor:pointer}',
    '.nk-pay{width:100%;margin-top:18px;padding:15px;border:0;border-radius:14px;background:linear-gradient(135deg,#a98bff,#6aa8ff);color:#fff;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 10px 30px rgba(140,100,255,.28)}',
    '.nk-note{text-align:center;font-size:11px;color:#6f7689;margin-top:12px;line-height:1.5}',
    '.nk-msg{font-size:13px;min-height:19px;margin-top:10px;color:#8fe6ad}',
    '.nk-msg.err{color:#ff9090}',
    '.nk-have{margin-top:10px;padding:12px;border-radius:12px;background:rgba(50,200,110,.14);border:1px solid rgba(80,220,130,.45);color:#7ef0a8;font-weight:700;text-align:center}',
    '.sub-badge{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:14px;background:linear-gradient(135deg,rgba(169,139,255,.2),rgba(90,160,255,.14));border:1px solid rgba(169,139,255,.4);font-weight:700}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var sub = JSON.parse(localStorage.getItem('nvSubscription') || 'null');
  function active() { return !!(sub && sub.active); }
  function hasBeta() {
    var u = currentUser();
    return active() || String(u.username || '').toLowerCase() === 'qqc0d';
  }
  function openPay() {
    var have = document.getElementById('nkHave');
    var btn = document.getElementById('nkPayBtn');
    var methods = payModal.querySelector('.nk-methods');
    if (hasBeta()) {
      if (have) have.style.display = '';
      if (btn) btn.style.display = 'none';
      if (methods) methods.style.display = 'none';
    } else {
      if (have) have.style.display = 'none';
      if (btn) btn.style.display = '';
      if (methods) methods.style.display = '';
    }
    payModal.classList.add('open');
  }

  function modal(id, inner) {
    var m = document.createElement('div');
    m.className = 'nk-modal'; m.id = id;
    m.innerHTML = '<div class="nk-card"><button class="nk-close" data-close>×</button>' + inner + '</div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.hasAttribute('data-close')) m.classList.remove('open');
    });
    return m;
  }

  var keyModal = modal('nkKeyModal',
    '<div class="nk-kicker">Активация</div><div class="nk-title">Ввести ключ</div>' +
    '<div class="nk-msg" id="nkKeyMsg"></div>' +
    '<div class="nk-row"><input class="nk-input" id="nkKeyInput" placeholder="NebulaVisuals_XXXX-XXXX-XXXX" maxlength="64" autocomplete="off">' +
    '<button class="nk-small" id="nkKeyApply">Активировать</button></div>');

  var payModal = modal('nkPayModal',
    '<div class="nk-kicker">Оплата заказа</div><div class="nk-title">Бета Nebula Visuals</div>' +
    '<div class="nk-price"><span id="nkPrice">199 ₽</span><span class="nk-old" id="nkOld" style="display:none"></span></div>' +
    '<div class="nk-divider"></div><div class="nk-label">Способ оплаты</div>' +
    '<div class="nk-methods">' +
      '<button class="nk-method active" data-method="tg" type="button"><span class="check">✓</span><b>Telegram</b><span>Оплата через @paynebulabot</span></button>' +
      '<button class="nk-method" data-method="funpay" type="button"><span class="check">✓</span><b>FunPay</b><span>Оплата через FunPay</span></button>' +
    '</div><div class="nk-divider"></div>' +
    '<div class="nk-have" id="nkHave" style="display:none">У вас уже есть бета</div>' +
    '<button class="nk-pay" id="nkPayBtn">Оплатить 199 ₽</button>' +
    '<div class="nk-note">Нажимая «Оплатить», вы соглашаетесь с правилами и политикой конфиденциальности.</div>');

  var method = 'tg';
  var discount = 0;
  function renderPrice() {
    var p = discount ? (PRICE * (1 - discount / 100)).toFixed(2).replace('.00', '') : String(PRICE);
    document.getElementById('nkPrice').textContent = p + ' ₽';
    document.getElementById('nkPayBtn').textContent = 'Оплатить ' + p + ' ₽';
    var old = document.getElementById('nkOld');
    old.style.display = discount ? 'inline' : 'none';
    old.textContent = PRICE + ' ₽';
  }
  payModal.querySelectorAll('.nk-method').forEach(function (b) {
    b.addEventListener('click', function () {
      payModal.querySelectorAll('.nk-method').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active'); method = b.dataset.method;
    });
  });
  document.getElementById('nkPayBtn').addEventListener('click', function () {
    window.open(method === 'funpay' ? FUNPAY : TELEGRAM, '_blank', 'noopener');
  });

  function keyApply() {
    var inp = document.getElementById('nkKeyInput').value.trim();
    var msg = document.getElementById('nkKeyMsg');
    msg.className = 'nk-msg'; msg.textContent = '';
    if (!inp) { msg.className = 'nk-msg err'; msg.textContent = 'Введите ключ'; return; }
    if (active()) { msg.className = 'nk-msg err'; msg.textContent = 'У вас уже есть подписка'; return; }
    var used = JSON.parse(localStorage.getItem('nvUsedKeys') || '[]');
    if (used.indexOf(inp) !== -1) { msg.className = 'nk-msg err'; msg.textContent = 'Этот ключ уже был использован!'; return; }
    Promise.all([
      fetch('/keys.json', { cache: 'no-store' }).then(function (r) { return r.json(); }),
      fetch('/keys-tg.json', { cache: 'no-store' }).then(function (r) { return r.json(); })
    ]).then(function (arr) {
      const keys = arr[0].concat(arr[1]);
      if (keys.indexOf(inp) === -1) {
        msg.className = 'nk-msg err';
        msg.textContent = inp.indexOf('NEBULAVISUALS_') === 0 ? 'Ключ не найден' : 'Ключ должен начинаться с NebulaVisuals_';
        return;
      }
      used.push(inp); localStorage.setItem('nvUsedKeys', JSON.stringify(used));
      sub = { active: true, forever: true, key: inp, since: Date.now() };
      localStorage.setItem('nvSubscription', JSON.stringify(sub));
      msg.className = 'nk-msg';
      msg.textContent = 'Ключ активирован! Подписка «Бета» — навсегда.';
      renderSub();
    }).catch(function () { msg.className = 'nk-msg err'; msg.textContent = 'Не удалось проверить ключ'; });
  }
  document.getElementById('nkKeyApply').addEventListener('click', keyApply);
  document.getElementById('nkKeyInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') keyApply(); });

  function currentUser() {
    try { return JSON.parse(localStorage.getItem('nebula_auth') || 'null') || {}; } catch (e) { return {}; }
  }
  function renderSub() {
    var targets = [];
    var prof = document.getElementById('sub-status');
    if (prof) targets.push(prof);
    if (!targets.length) return;
    var html = '';
    var u = currentUser();
    if (String(u.username || '').toLowerCase() === 'qqc0d') {
      html = '<div style="color:#f0f2fa;font-size:15px;font-weight:700">Подписка: Фулл + навсегда By qqc0d</div>' +
        '<div style="margin-top:8px;color:#9aa1b5;font-size:14px">Бета: есть</div>';
    } else if (active()) {
      html = '<div style="color:#9aa1b5;font-size:14px">Подписка: Бета</div>' +
        '<div style="margin-top:8px;color:#9aa1b5;font-size:14px">Бета: есть</div>';
    } else {
      html = '<div style="color:#9aa1b5;font-size:14px">Подписка: Фри</div>' +
        '<div style="margin-top:8px;color:#9aa1b5;font-size:14px">Бета: нету</div>';
    }
    targets.forEach(function (el) { el.innerHTML = html; });
  }

  function addButtons() {
    var keyBtn = document.getElementById('nkKeyBtn');
    if (keyBtn && !keyBtn.dataset.bound) {
      keyBtn.dataset.bound = '1';
      keyBtn.addEventListener('click', function () { keyModal.classList.add('open'); setTimeout(function(){document.getElementById('nkKeyInput').focus();},60); });
    }
    var heroBuy = document.getElementById('nkHeroBuy');
    if (heroBuy && !heroBuy.dataset.bound) {
      heroBuy.dataset.bound = '1';
      heroBuy.addEventListener('click', openPay);
    }
    // Скачать файл и бету — доступно всем пользователям
    var canBeta = true;
    var dl = document.getElementById('download-btn');
    if (dl) dl.style.display = '';
    if (canBeta && !document.getElementById('nkBetaDownload')) {
      var betaBtn = document.createElement('button');
      betaBtn.id = 'nkBetaDownload'; betaBtn.className = 'nk-btn'; betaBtn.type = 'button';
      betaBtn.textContent = 'Скачать Nebula Visuals Beta';
      betaBtn.style.marginLeft = '8px';
      betaBtn.addEventListener('click', function () {
        var a = document.createElement('a');
        a.href = '/files/Nebula Visuals Beta.exe';
        a.download = 'Nebula Visuals Beta.exe';
        document.body.appendChild(a); a.click(); a.remove();
      });
      var actions = document.querySelector('#tab-home .actions');
      if (actions) actions.appendChild(betaBtn);
    }
    // кнопка покупки в профиле больше не нужна — бета доступна всем

    renderSub();
  }
  window.NebulaKeys = { addButtons: addButtons, renderSub: renderSub };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButtons);
  else addButtons();
})();
