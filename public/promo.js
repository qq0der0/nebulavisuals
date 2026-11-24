/* Nebula Visuals — покупка беты, промокоды и активация ключей.
   Подключён на главной и в профиле. */
(function () {
  'use strict';

  // --- Реквизиты: ЗАМЕНИ НА СВОИ, чтобы деньги реально приходили ---
  var PAY = {
    sbp:      { title: 'СБП по номеру телефона', value: '+7 (999) 000-00-00', note: 'Укажи свой номер' },
    yoomoney: { title: 'ЮMoney', value: '4100 0000 0000 0000', note: 'Укажи свой кошелёк' },
    tgstars:  { title: 'Telegram Stars', value: '@your_bot', note: 'Укажи своего бота' },
    usdt:     { title: 'USDT (TRC-20)', value: 'TQ0000000000000000000000000000000', note: 'Укажи свой адрес' },
    funpay:   { title: 'FunPay', value: 'https://funpay.com/users/0/', note: 'Укажи ссылку на профиль' },
    boosty:   { title: 'Boosty', value: 'https://boosty.to/yourname', note: 'Укажи свою страницу' },
    kofi:     { title: 'Ko-fi', value: 'https://ko-fi.com/yourname', note: 'Укажи свою страницу' },
    donation: { title: 'DonationAlerts', value: 'https://donationalerts.com/r/yourname', note: 'Укажи свою страницу' }
  };

  var PROMOS = {
    qqc0d:  { discount: 10, label: 'Промокод qqc0d — скидка 10%' },
    nebula: { discount: 10, label: 'Промокод Nebula — скидка 10%' }
  };

  var PRICE = 199;
  var css = [
    '.nv-promo-modal{position:fixed;inset:0;z-index:1200;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(5,6,14,.78);backdrop-filter:blur(8px)}',
    '.nv-promo-modal.open{display:flex}',
    '.nv-promo-card{width:min(460px,100%);max-height:88vh;overflow:auto;border-radius:20px;padding:22px;background:linear-gradient(160deg,rgba(32,27,58,.98),rgba(14,14,28,.98));border:1px solid rgba(180,150,255,.25);box-shadow:0 24px 70px rgba(0,0,0,.6);color:#f0f2fa}',
    '.nv-promo-head{display:flex;align-items:center;gap:10px;margin-bottom:6px}',
    '.nv-promo-head img{width:38px;height:38px;object-fit:contain}',
    '.nv-promo-title{font-size:19px;font-weight:800}',
    '.nv-promo-sub{font-size:12.5px;color:#9aa4b8;margin-bottom:16px}',
    '.nv-promo-price{font-size:28px;font-weight:800;background:linear-gradient(90deg,#c9b6ff,#8ad8ff);-webkit-background-clip:text;background-clip:text;color:transparent}',
    '.nv-promo-old{color:#8a90a5;text-decoration:line-through;font-size:14px;margin-left:8px}',
    '.nv-promo-ok{color:#7ef0a8;font-size:13px;min-height:18px;margin:8px 0}',
    '.nv-promo-err{color:#ff8d8d;font-size:13px;min-height:18px;margin:8px 0}',
    '.nv-promo-row{display:flex;gap:8px;margin:12px 0}',
    '.nv-promo-input{flex:1;min-width:0;padding:11px 13px;border-radius:11px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;outline:none}',
    '.nv-promo-input:focus{border-color:rgba(170,125,255,.7)}',
    '.nv-promo-btn{padding:11px 15px;border:0;border-radius:11px;background:linear-gradient(135deg,#9b7bff,#5aa9ff);color:#fff;font-weight:700;cursor:pointer}',
    '.nv-pay-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}',
    '.nv-pay-btn{padding:10px;border-radius:11px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#e8e6f4;cursor:pointer;font-size:12.5px;text-align:left}',
    '.nv-pay-btn:hover{border-color:rgba(170,125,255,.55);background:rgba(170,125,255,.1)}',
    '.nv-pay-note{font-size:11px;color:#7b8296;margin-top:12px;line-height:1.5}',
    '.nv-promo-close{position:absolute;top:14px;right:16px;background:none;border:0;color:#9aa4b8;font-size:22px;cursor:pointer}',
    '.nv-buy-btn{padding:9px 15px;border-radius:999px;border:1px solid rgba(255,150,190,.4);background:linear-gradient(135deg,rgba(255,120,165,.2),rgba(168,107,255,.22));color:#fff;font-weight:700;cursor:pointer}'
  ].join('\n');
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  var modal = document.createElement('div');
  modal.className = 'nv-promo-modal';
  modal.id = 'nvPromoModal';
  modal.innerHTML =
    '<div class="nv-promo-card" style="position:relative">' +
      '<button class="nv-promo-close" id="nvPromoClose" aria-label="Закрыть">×</button>' +
      '<div class="nv-promo-head"><img src="/logo-nav.png" alt=""><div class="nv-promo-title" id="nvPromoTitle">Бета-доступ</div></div>' +
      '<div class="nv-promo-sub" id="nvPromoSub">Бета Nebula Visuals — 199 ₽. Есть промокод? Введите его ниже.</div>' +
      '<div><span class="nv-promo-price" id="nvPromoPrice">199 ₽</span><span class="nv-promo-old" id="nvPromoOld"></span></div>' +
      '<div class="nv-promo-ok" id="nvPromoOk"></div><div class="nv-promo-err" id="nvPromoErr"></div>' +
      '<div class="nv-promo-row"><input class="nv-promo-input" id="nvPromoInput" placeholder="Промокод или ключ NebulaVisuals_..." maxlength="64" autocomplete="off">' +
      '<button class="nv-promo-btn" id="nvPromoApply">Активировать</button></div>' +
      '<div style="font-size:12px;color:#9aa4b8;margin-top:10px">Способы оплаты (бесплатные, без карты/Google):</div>' +
      '<div class="nv-pay-grid" id="nvPayGrid"></div>' +
      '<div class="nv-pay-note">Реквизиты пока заглушки — замени их в promo.js на свои, иначе деньги не придут. Промокоды: <b>qqc0d</b> и <b>Nebula</b> — скидка 10%.</div>' +
    '</div>';
  document.body.appendChild(modal);

  var grid = document.getElementById('nvPayGrid');
  Object.keys(PAY).forEach(function (k) {
    var b = document.createElement('button');
    b.className = 'nv-pay-btn';
    b.type = 'button';
    b.innerHTML = '<b>' + PAY[k].title + '</b><br><span style="color:#8e96aa">' + PAY[k].value + '</span>';
    b.addEventListener('click', function () {
      try { navigator.clipboard.writeText(PAY[k].value); } catch (e) {}
      document.getElementById('nvPromoErr').textContent = '';
      document.getElementById('nvPromoOk').textContent = PAY[k].title + ': ' + PAY[k].value + ' (скопировано)';
    });
    grid.appendChild(b);
  });

  function renderPrice() {
    var d = Number(localStorage.getItem('nvPromoDiscount') || 0);
    var price = d ? (PRICE * (1 - d / 100)).toFixed(2).replace('.00', '') : String(PRICE);
    document.getElementById('nvPromoPrice').textContent = price + ' ₽';
    document.getElementById('nvPromoOld').textContent = d ? PRICE + ' ₽' : '';
  }

  function apply() {
    var v = document.getElementById('nvPromoInput').value.trim();
    var ok = document.getElementById('nvPromoOk');
    var err = document.getElementById('nvPromoErr');
    ok.textContent = ''; err.textContent = '';
    if (!v) { err.textContent = 'Введите промокод или ключ'; return; }
    var p = PROMOS[v.toLowerCase()];
    if (p) {
      localStorage.setItem('nvPromoDiscount', p.discount);
      ok.textContent = p.label;
      renderPrice();
      return;
    }
    if (v.toUpperCase().indexOf('NEBULAVISUALS_') === 0) {
      // ключ из списка 150 сгенерированных
      fetch('/keys.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (keys) {
        if (keys.indexOf(v) !== -1) {
          var used = JSON.parse(localStorage.getItem('nvUsedKeys') || '[]');
          if (used.indexOf(v) !== -1) { err.textContent = 'Этот ключ уже активирован'; return; }
          used.push(v);
          localStorage.setItem('nvUsedKeys', JSON.stringify(used));
          ok.textContent = 'Ключ активирован: ' + v;
        } else {
          err.textContent = 'Ключ не найден';
        }
      }).catch(function () { err.textContent = 'Не удалось проверить ключ'; });
      return;
    }
    err.textContent = 'Неизвестный промокод или ключ';
  }

  document.getElementById('nvPromoApply').addEventListener('click', apply);
  document.getElementById('nvPromoInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') apply(); });
  document.getElementById('nvPromoClose').addEventListener('click', function () { modal.classList.remove('open'); });
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.classList.remove('open'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') modal.classList.remove('open'); });

  window.NebulaPromo = {
    open: function (mode) {
      document.getElementById('nvPromoTitle').textContent = mode === 'code' ? 'Ввести промокод' : 'Купить бета-доступ';
      document.getElementById('nvPromoSub').textContent = mode === 'code'
        ? 'Активируйте промокод (qqc0d, Nebula — скидка 10%) или ключ NebulaVisuals_...'
        : 'Бета Nebula Visuals — 199 ₽. Промокод qqc0d или Nebula даёт скидку 10%.';
      document.getElementById('nvPayGrid').style.display = mode === 'code' ? 'none' : 'grid';
      renderPrice();
      modal.classList.add('open');
      setTimeout(function () { document.getElementById('nvPromoInput').focus(); }, 60);
    },
    addButtons: function () {
      var hero = document.querySelector('.hero-buttons, .actions');
      if (hero && !document.getElementById('nvBuyBtn')) {
        var buy = document.createElement('button');
        buy.id = 'nvBuyBtn';
        buy.className = 'btn btn-primary btn-lg';
        buy.type = 'button';
        buy.innerHTML = '<span class="btn-text">Купить бета · 199 ₽</span><span class="btn-icon">💎</span>';
        buy.addEventListener('click', function () { window.NebulaPromo.open('buy'); });
        hero.appendChild(buy);
      }
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.NebulaPromo.addButtons(); });
  } else {
    window.NebulaPromo.addButtons();
  }
})();
