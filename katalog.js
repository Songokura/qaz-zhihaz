/* QAZ ZHIHAZ - каталог мебели.
   Позиции зашиты в страницу (window.KAT), поверх подмешивается Google-таблица:
   владелец меняет цену, наличие, тексты и добавляет новые модели со ссылкой на фото. */
(function () {
  'use strict';
  if (!window.KAT_ITEMS) return;
  var K = {
    items: window.KAT_ITEMS, sheet: window.KAT_SHEET || '',
    base: document.body.dataset.base || '', page: { cat: document.body.dataset.cat || '' }
  };

  var WA_PHONE = '77478528001';
  var SITE = 'https://qaz-zhihaz.kz/';
  var CAT_SLUG = { 'спальни': 'spalni', 'кухни': 'kuhni', 'шкафы': 'shkafy', 'прихожие': 'prikhozhie', 'детские': 'detskie' };
  var CAT_PAGES = { spalni: 1, kuhni: 1, shkafy: 1 };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var grid = $('#kGrid');
  var countEl = $('#kCount');
  var state = { cat: K.page.cat || '', brand: '', price: '', lift: false, q: '', sort: '' };
  var items = [], groups = [], visible = [];
  var pick = {};                       // выбранный вариант в карточке: group -> id

  function metrika(goal) { if (typeof ym === 'function') { try { ym(113056592, 'reachGoal', goal); } catch (e) {} } }

  /* ---------- утилиты ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // 0 в колонке цены = цена по запросу
  function money(n) { if (!(n > 0)) return 'Цена по запросу'; return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₸'; }
  function plural(n, a, b, c) {
    var m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? a : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c);
  }
  var TR = 'a b v g d e e zh z i y k l m n o p r s t u f h ts ch sh sch  y  e yu ya'.split(' ');
  function slug(s) {
    return String(s).toLowerCase().replace(/[а-яё]/g, function (c) {
      return TR['абвгдеёжзийклмнопрстуфхцчшщъыьэюя'.indexOf(c)] || '';
    }).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function lines(s) { return String(s || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function src(p) { return /^https?:\/\//.test(p) ? p : K.base + p; }
  // Ссылка Google Диска -> прямая картинка; прочие http(s)-ссылки как есть
  function photoUrl(u) {
    u = u.trim();
    var m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1400';
    return /^https?:\/\//.test(u) ? u : '';
  }
  function partW(it, re) {
    for (var i = 0; i < it.parts.length; i++) {
      if (!re || re.test(it.parts[i])) { var m = it.parts[i].match(/Ш\s*(\d+)/); if (m) return +m[1]; }
    }
    return 0;
  }
  function meters(mm) { return (mm / 1000).toFixed(1).replace('.0', '').replace('.', ',') + ' м'; }
  function specLine(it) {
    if (it.cat === 'spalni') {
      var w = partW(it, /^(Шкаф|Шифоньер)/);
      return [w ? 'Шкаф ' + meters(w) : '', it.mattress ? 'матрас ' + it.mattress.replace(' мм', '') : ''].filter(Boolean).join(' · ');
    }
    if (it.cat === 'kuhni') {
      var k = partW(it, /^(Общий габарит|Габариты)/) || partW(it);
      return k ? 'Длина ' + meters(k) : '';
    }
    var s = partW(it);
    var h = (it.parts[0] || '').match(/В\s*(\d+)/);
    return [s ? 'Ширина ' + meters(s) : '', h ? 'высота ' + meters(+h[1]) : ''].filter(Boolean).join(' · ');
  }

  /* ---------- данные ---------- */
  function normalize(list) {
    return list.map(function (x) {
      var it = Object.assign({ show: true, stock: true, photos: [], parts: [], features: [] }, x);
      it.catName = it.catName || '';
      it.groupKey = (it.brand + '|' + it.cat + '|' + it.model).toLowerCase();
      return it;
    });
  }

  function parseCSV(text) {
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // Строки таблицы поверх зашитых данных. Пустая ячейка = значение со страницы.
  function mergeSheet(text) {
    var rows = parseCSV(text);
    if (rows.length < 2) return false;
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var col = function (r, name) { var i = head.indexOf(name); return i < 0 ? '' : String(r[i] || '').trim(); };
    if (head.indexOf('модель') < 0) return false;
    var base = {};
    items.forEach(function (it) { base[it.id] = it; });
    var out = [], used = {};
    rows.slice(1).forEach(function (r, n) {
      var model = col(r, 'модель'), id = col(r, 'id');
      if (!model && !id) return;
      var b = base[id] || {};
      var catName = col(r, 'категория');
      var cat = catName ? (CAT_SLUG[catName.toLowerCase()] || slug(catName)) : b.cat;
      var pcell = col(r, 'цена тг');
      var price = pcell === '' ? (b.price || 0) : (parseInt(pcell.replace(/[^\d]/g, ''), 10) || 0);
      var photos = col(r, 'фото').split(/[\s;]+/).map(photoUrl).filter(Boolean);
      var it = {
        id: id || slug([col(r, 'фабрика'), model, col(r, 'вариант')].join('-')) || 'row-' + n,
        cat: cat || 'drugoe',
        catName: catName || b.catName || '',
        kind: col(r, 'тип') || b.kind || catName,
        brand: col(r, 'фабрика') || b.brand || '',
        model: model || b.model,
        variant: col(r, 'вариант') || (id && base[id] ? b.variant : ''),
        price: price,
        color: col(r, 'цвет') || b.color || '',
        material: col(r, 'материал') || b.material || '',
        parts: col(r, 'состав и габариты') ? lines(col(r, 'состав и габариты')) : (b.parts || []),
        features: col(r, 'особенности') ? lines(col(r, 'особенности')) : (b.features || []),
        lift: col(r, 'подъёмный механизм') || b.lift || '',
        mattress: col(r, 'матрас') || b.mattress || '',
        headboard: col(r, 'изголовье') || b.headboard || '',
        photos: photos.length ? photos : (b.photos || []),
        thumb: photos.length ? photos[0] : b.thumb,
        order: parseFloat(col(r, 'порядок').replace(',', '.')) || b.order || 1000 + n,
        show: !/^нет/i.test(col(r, 'показывать')),
        stock: !/^нет/i.test(col(r, 'в наличии'))
      };
      if (!it.model || used[it.id]) return;
      used[it.id] = 1;
      out.push(it);
    });
    if (!out.length) return false;
    items = normalize(out);
    return true;
  }

  function buildGroups() {
    var map = {};
    groups = [];
    items.filter(function (it) { return it.show; })
      .sort(function (a, b) { return a.order - b.order; })
      .forEach(function (it) {
        var g = map[it.groupKey];
        if (!g) { g = map[it.groupKey] = { key: it.groupKey, list: [] }; groups.push(g); }
        g.list.push(it);
      });
    groups.forEach(function (g) {
      var priced = g.list.map(function (x) { return x.price; }).filter(function (v) { return v > 0; });
      g.min = priced.length ? Math.min.apply(null, priced) : 0;
      g.stock = g.list.some(function (x) { return x.stock; });
      g.head = g.list[0];
    });
  }
  function current(g) {
    var id = pick[g.key];
    for (var i = 0; i < g.list.length; i++) if (g.list[i].id === id) return g.list[i];
    return g.list[0];
  }
  function findItem(id) {
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  }
  function groupOf(it) {
    for (var i = 0; i < groups.length; i++) if (groups[i].key === it.groupKey) return groups[i];
    return null;
  }

  /* ---------- WhatsApp ---------- */
  function itemTitle(it) {
    return it.kind + ' «' + it.model + '»' + (it.variant ? ', ' + it.variant : '') + (it.brand ? ' (' + it.brand + ')' : '');
  }
  function waHref(text) { return 'https://wa.me/' + WA_PHONE + '?text=' + encodeURIComponent(text); }
  function waItem(it) {
    return waHref('Здравствуйте! Хочу заказать: ' + itemTitle(it) + ' - ' + money(it.price) +
      '.\n' + SITE + 'katalog/?m=' + it.id);
  }

  /* ---------- фильтры ---------- */
  var PRICES = { a: [0, 300000], b: [300000, 450000], c: [450000, Infinity] };
  function matches(g) {
    var h = g.head;
    if (state.cat && h.cat !== state.cat) return false;
    if (state.brand && h.brand !== state.brand) return false;
    if (state.price) {
      var r = PRICES[state.price];
      if (!g.list.some(function (x) { return x.price >= r[0] && x.price < r[1]; })) return false;
    }
    if (state.lift && h.cat === 'spalni' && !g.list.some(function (x) { return /^есть/i.test(x.lift); })) return false;
    if (state.lift && h.cat !== 'spalni') return false;
    if (state.q) {
      var hay = g.list.map(function (x) { return [x.model, x.kind, x.brand, x.variant, x.color, x.material].join(' '); }).join(' ').toLowerCase();
      var words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) < 0) return false;
    }
    return true;
  }

  function renderChips() {
    var brands = {};
    groups.forEach(function (g) { if (!state.cat || g.head.cat === state.cat) brands[g.head.brand] = 1; });
    var bWrap = $('#kBrands');
    var names = Object.keys(brands).filter(Boolean).sort();
    bWrap.innerHTML = '<button type="button" class="kchip" data-brand="" aria-pressed="' + (!state.brand) + '">Все фабрики</button>' +
      names.map(function (b) {
        return '<button type="button" class="kchip" data-brand="' + esc(b) + '" aria-pressed="' + (state.brand === b) + '">' + esc(b) + '</button>';
      }).join('');
    bWrap.closest('.kfilter').hidden = names.length < 2;
    $('#kPrice').querySelectorAll('[data-price]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.price === state.price));
    });
    var lift = $('#kLift');
    lift.hidden = state.cat !== 'spalni';
    lift.setAttribute('aria-pressed', String(state.lift));
    // вкладки категорий: новые категории из таблицы появляются сами
    var cats = {};
    groups.forEach(function (g) { if (!cats[g.head.cat]) cats[g.head.cat] = g.head.catName || g.head.kind; });
    var tabs = $('#kTabs');
    tabs.querySelectorAll('[data-dyn]').forEach(function (a) { a.remove(); });
    Object.keys(cats).forEach(function (c) {
      if (tabs.querySelector('[data-cat="' + c + '"]')) return;
      var a = document.createElement('a');
      a.className = 'ktab'; a.dataset.cat = c; a.dataset.dyn = '1';
      a.href = K.base + 'katalog/?cat=' + encodeURIComponent(c);
      a.textContent = cats[c];
      tabs.appendChild(a);
    });
    tabs.querySelectorAll('.ktab').forEach(function (a) {
      var on = (a.dataset.cat || '') === state.cat;
      a.classList.toggle('is-on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('#kReset').hidden = !(state.brand || state.price || state.lift || state.q);
  }

  /* ---------- карточки ---------- */
  var WA_ICON = '<svg width="18" height="18" aria-hidden="true"><use href="#ic-wa"/></svg>';
  function cardHTML(g, idx) {
    var it = current(g);
    var thumb = src(it.thumb || it.photos[0] || '');
    var variants = g.list.length > 1 ? '<div class="kc__vars" role="group" aria-label="Варианты">' + g.list.map(function (x) {
      return '<button type="button" class="kvar" data-id="' + esc(x.id) + '" aria-pressed="' + (x.id === it.id) + '">' + esc(x.variant || x.model) + '</button>';
    }).join('') + '</div>' : '';
    var inSet = setHas(it.id);
    return '<article class="kc' + (it.stock ? '' : ' is-out') + '" data-g="' + esc(g.key) + '" style="--i:' + (idx % 6) + '">' +
      '<a class="kc__media" href="?m=' + esc(it.id) + '" data-open="' + esc(it.id) + '" tabindex="-1" aria-hidden="true">' +
        '<img class="kc__bg" src="' + esc(thumb) + '" alt="" loading="lazy" decoding="async">' +
        '<img class="kc__img" src="' + esc(thumb) + '" alt="' + esc(it.kind + ' ' + it.model) + '" loading="lazy" decoding="async">' +
        '<span class="kc__stock">' + (it.stock ? 'В наличии · соберём сегодня' : 'Уточните наличие') + '</span>' +
      '</a>' +
      '<div class="kc__body">' +
        '<p class="kc__kind">' + esc(it.kind) + (it.brand ? ' · ' + esc(it.brand) : '') + '</p>' +
        '<h3 class="kc__name"><a href="?m=' + esc(it.id) + '" data-open="' + esc(it.id) + '">' + esc(it.model) + '</a></h3>' +
        '<p class="kc__spec">' + esc(specLine(it)) + '</p>' +
        variants +
        '<div class="kc__foot">' +
          '<b class="kc__price">' + money(it.price) + '</b>' +
          '<div class="kc__acts">' +
            '<button type="button" class="kc__add" data-add="' + esc(it.id) + '" aria-pressed="' + inSet + '" aria-label="' + (inSet ? 'Убрать из комплекта' : 'Добавить в комплект') + '">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>' +
            '<a class="kc__wa" data-wa href="' + esc(waItem(it)) + '" target="_blank" rel="noopener" aria-label="Заказать в WhatsApp: ' + esc(it.model) + '">' + WA_ICON + '</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  var revealIO = 'IntersectionObserver' in window && !reduceMotion ? new IntersectionObserver(function (en) {
    en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -5% 0px' }) : null;

  function render() {
    visible = groups.filter(matches);
    var sortMin = function (g) { return g.min || Infinity; };   // без цены - в конец
    if (state.sort === 'asc') visible.sort(function (a, b) { return sortMin(a) - sortMin(b); });
    if (state.sort === 'desc') visible.sort(function (a, b) { return (b.min || -1) - (a.min || -1); });
    visible.sort(function (a, b) { return (b.stock ? 1 : 0) - (a.stock ? 1 : 0); });
    grid.innerHTML = visible.map(cardHTML).join('');
    grid.querySelectorAll('.kc').forEach(function (c) {
      if (revealIO) revealIO.observe(c); else c.classList.add('is-in');
    });
    var n = visible.length;
    countEl.textContent = n ? 'Найдено: ' + n + ' ' + plural(n, 'модель', 'модели', 'моделей') : '';
    $('#kEmpty').hidden = n > 0;
    renderChips();
  }

  function updateCard(g) {
    var old = grid.querySelector('.kc[data-g="' + CSS.escape(g.key) + '"]');
    if (!old) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = cardHTML(g, 0);
    var fresh = tmp.firstChild;
    fresh.style.cssText = old.style.cssText;
    fresh.classList.add('is-in');
    old.replaceWith(fresh);
  }

  /* ---------- комплект (несколько позиций одной заявкой) ---------- */
  var set = [];
  try { set = JSON.parse(localStorage.getItem('qz_set') || '[]'); } catch (e) { set = []; }
  function setHas(id) { return set.indexOf(id) >= 0; }
  function setSave() { try { localStorage.setItem('qz_set', JSON.stringify(set)); } catch (e) {} }
  function setToggle(id) {
    var i = set.indexOf(id);
    if (i >= 0) set.splice(i, 1); else { set.push(id); metrika('kat_add_set'); }
    setSave();
    renderSet(i < 0);
    var it = findItem(id), g = it && groupOf(it);
    if (g) updateCard(g);
    if (modalItem && modalItem.id === id) renderModal(modalItem);
  }
  var bar = $('#kSet');
  function renderSet(bump) {
    set = set.filter(function (id) { var it = findItem(id); return it && it.show; });
    var list = set.map(findItem);
    bar.hidden = !list.length;
    document.body.classList.toggle('has-kset', list.length > 0);
    if (!list.length) { bar.classList.remove('is-open'); return; }
    var total = list.reduce(function (s, x) { return s + x.price; }, 0);
    $('#kSetCount').textContent = list.length + ' ' + plural(list.length, 'позиция', 'позиции', 'позиций');
    $('#kSetTotal').textContent = money(total);
    $('#kSetList').innerHTML = list.map(function (x) {
      return '<li><span>' + esc(x.kind + ' ' + x.model + (x.variant ? ', ' + x.variant : '')) + '</span><b>' + money(x.price) + '</b>' +
        '<button type="button" data-add="' + esc(x.id) + '" aria-label="Убрать: ' + esc(x.model) + '">✕</button></li>';
    }).join('');
    $('#kSetWa').href = waHref('Здравствуйте! Хочу заказать комплектом, доставка и сборка за один день:\n' +
      list.map(function (x, i) { return (i + 1) + '. ' + itemTitle(x) + ' - ' + money(x.price); }).join('\n') +
      '\nИтого: ' + money(total));
    if (bump && !reduceMotion) { bar.classList.remove('bump'); void bar.offsetWidth; bar.classList.add('bump'); }
  }
  $('#kSetToggle').addEventListener('click', function () {
    var open = bar.classList.toggle('is-open');
    this.setAttribute('aria-expanded', String(open));
  });
  $('#kSetClear').addEventListener('click', function () {
    set = []; setSave(); renderSet(); render();
    if (modalItem) renderModal(modalItem);
  });

  /* ---------- карточка модели (модалка) ---------- */
  var modal = $('#kModal');
  var modalItem = null, lastFocus = null, photoIdx = 0;
  function row(label, val) { return val ? '<div><dt>' + label + '</dt><dd>' + esc(val) + '</dd></div>' : ''; }
  function renderModal(it) {
    modalItem = it;
    var g = groupOf(it);
    var photos = it.photos.length ? it.photos : [it.thumb];
    if (photoIdx >= photos.length) photoIdx = 0;
    var inSet = setHas(it.id);
    $('#kmImg').src = src(photos[photoIdx]);
    $('#kmImg').alt = it.kind + ' ' + it.model;
    $('#kmBg').src = src(photos[photoIdx]);
    $('#kmThumbs').innerHTML = photos.length > 1 ? photos.map(function (p, i) {
      return '<button type="button" data-ph="' + i + '" aria-pressed="' + (i === photoIdx) + '" aria-label="Фото ' + (i + 1) + '"><img src="' + esc(src(p)) + '" alt="" loading="lazy"></button>';
    }).join('') : '';
    $('#kmKind').textContent = it.kind + (it.brand ? ' · ' + it.brand : '');
    $('#kmTitle').textContent = it.model;
    $('#kmVars').innerHTML = g && g.list.length > 1 ? g.list.map(function (x) {
      return '<button type="button" class="kvar" data-mid="' + esc(x.id) + '" aria-pressed="' + (x.id === it.id) + '">' + esc(x.variant || x.model) + '</button>';
    }).join('') : '';
    $('#kmPrice').textContent = money(it.price);
    $('#kmStock').textContent = it.stock ? 'В наличии - привезём и соберём сегодня' : 'Уточните наличие у менеджера';
    $('#kmStock').classList.toggle('is-out', !it.stock);
    $('#kmWa').href = waItem(it);
    var add = $('#kmAdd');
    add.setAttribute('aria-pressed', String(inSet));
    add.querySelector('span').textContent = inSet ? 'В комплекте ✓' : 'Добавить в комплект';
    $('#kmParts').innerHTML = it.parts.map(function (p) {
      var m = p.match(/^(.*?):\s*(.*)$/);
      return m ? '<li><span>' + esc(m[1]) + '</span><b>' + esc(m[2]) + '</b></li>' : '<li><span>' + esc(p) + '</span></li>';
    }).join('');
    $('#kmPartsWrap').hidden = !it.parts.length;
    $('#kmSpecs').innerHTML = row('Материал', it.material) + row('Цвет', it.color) + row('Изголовье', it.headboard) +
      row('Подъёмный механизм', it.lift) + row('Матрас', it.mattress) + row('Комплектация', it.features.join(', '));
    var pos = visible.indexOf(g);
    $('#kmPrev').disabled = pos <= 0;
    $('#kmNext').disabled = pos < 0 || pos >= visible.length - 1;
  }
  function openModal(id, push) {
    var it = findItem(id);
    if (!it || !it.show) return;
    if (!modalItem) lastFocus = document.activeElement;
    photoIdx = 0;
    renderModal(it);
    modal.hidden = false;
    document.body.classList.add('km-open');
    requestAnimationFrame(function () { modal.classList.add('is-on'); });
    $('#kmClose').focus({ preventScroll: true });
    if (push !== false) history.replaceState(null, '', '?m=' + encodeURIComponent(id) + location.hash);
    document.title = it.kind + ' ' + it.model + ' - ' + money(it.price) + ' | QAZ ZHIHAZ';
    metrika('kat_open_item');
  }
  var baseTitle = document.title;
  function closeModal() {
    if (!modalItem) return;
    modal.classList.remove('is-on');
    document.body.classList.remove('km-open');
    modalItem = null;
    setTimeout(function () { if (!modalItem) modal.hidden = true; }, reduceMotion ? 0 : 260);
    history.replaceState(null, '', location.pathname + catQuery());
    document.title = baseTitle;
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  function stepModal(dir) {
    var g = groupOf(modalItem), pos = visible.indexOf(g) + dir;
    if (pos >= 0 && pos < visible.length) { photoIdx = 0; openModal(current(visible[pos]).id); }
  }
  modal.addEventListener('click', function (e) {
    if (e.target.closest('[data-km-close]')) return closeModal();
    var v = e.target.closest('[data-mid]');
    if (v) { var it = findItem(v.dataset.mid); pick[it.groupKey] = it.id; photoIdx = 0; openModal(it.id); updateCard(groupOf(it)); return; }
    var ph = e.target.closest('[data-ph]');
    if (ph) { photoIdx = +ph.dataset.ph; renderModal(modalItem); }
  });
  $('#kmAdd').addEventListener('click', function () { setToggle(modalItem.id); });
  $('#kmPrev').addEventListener('click', function () { stepModal(-1); });
  $('#kmNext').addEventListener('click', function () { stepModal(1); });
  document.addEventListener('keydown', function (e) {
    if (!modalItem) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') stepModal(-1);
    if (e.key === 'ArrowRight') stepModal(1);
    if (e.key === 'Tab') {               // фокус не уходит из модалки
      var f = modal.querySelectorAll('button:not([disabled]), a[href]');
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  var touchX = null;
  modal.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  modal.addEventListener('touchend', function (e) {
    if (touchX === null || !e.target.closest('.km__media')) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) stepModal(dx > 0 ? -1 : 1);
    touchX = null;
  }, { passive: true });

  /* ---------- события страницы ---------- */
  function catQuery() { return !K.page.cat && state.cat ? '?cat=' + encodeURIComponent(state.cat) : ''; }
  document.addEventListener('click', function (e) {
    var t = e.target;
    var open = t.closest('[data-open]');
    if (open && !e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); openModal(open.dataset.open); return; }
    var add = t.closest('[data-add]');
    if (add) { setToggle(add.dataset.add); return; }
    var v = t.closest('.kc [data-id]');
    if (v) {
      var it = findItem(v.dataset.id);
      pick[it.groupKey] = it.id;
      updateCard(groupOf(it));
      var nb = grid.querySelector('.kc [data-id="' + CSS.escape(it.id) + '"]');
      if (nb) nb.focus({ preventScroll: true });
      return;
    }
    var b = t.closest('[data-brand]');
    if (b) { state.brand = b.dataset.brand; render(); return; }
    var p = t.closest('[data-price]');
    if (p) { state.price = state.price === p.dataset.price ? '' : p.dataset.price; render(); return; }
    if (t.closest('#kLift')) { state.lift = !state.lift; render(); return; }
    if (t.closest('[data-reset]')) {
      state.brand = state.price = state.q = ''; state.lift = false;
      $('#kSearch').value = ''; render(); return;
    }
    // на общей странице вкладки фильтруют на месте, без перезагрузки
    var tab = t.closest('.ktab');
    if (tab && !K.page.cat && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      state.cat = tab.dataset.cat || '';
      if (state.cat !== 'spalni') state.lift = false;
      history.replaceState(null, '', location.pathname + catQuery());
      render();
      metrika('kat_tab_' + (state.cat || 'all'));
    }
  });
  var qTimer;
  $('#kSearch').addEventListener('input', function () {
    clearTimeout(qTimer);
    var v = this.value;
    qTimer = setTimeout(function () { state.q = v.trim(); render(); }, 160);
  });
  $('#kSort').addEventListener('change', function () { state.sort = this.value; render(); });

  /* ---------- старт ---------- */
  items = normalize(K.items);
  var params = new URLSearchParams(location.search);
  if (!K.page.cat && params.get('cat')) state.cat = params.get('cat');
  buildGroups();
  render();
  renderSet();
  if (params.get('m')) openModal(params.get('m'), false);

  // Google-таблица: свежие цены, наличие и новые модели - читается при каждом открытии.
  function applySheet(text) {
    if (!mergeSheet(text)) return;
    buildGroups();
    render();
    renderSet();
    if (modalItem) { var it = findItem(modalItem.id); if (it) renderModal(it); else closeModal(); }
    else if (params.get('m') && !findItem(params.get('m'))) { /* позицию сняли с показа */ }
    else if (params.get('m')) openModal(params.get('m'), false);
  }
  if (K.sheet) {
    var CK = 'qz_kat_csv';
    var cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(CK) || 'null'); } catch (e) {}
    if (cached && cached.text) applySheet(cached.text);   // мгновенно прошлый ответ, свежий следом
    {
      var urls = ['https://docs.google.com/spreadsheets/d/' + K.sheet + '/export?format=csv',
                  'https://docs.google.com/spreadsheets/d/' + K.sheet + '/gviz/tq?tqx=out:csv'];
      (function tryUrl(i) {
        if (i >= urls.length) return;
        var ctrl = 'AbortController' in window ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
        fetch(urls[i], { signal: ctrl && ctrl.signal, cache: 'no-store' })
          .then(function (r) { if (!r.ok) throw 0; return r.text(); })
          .then(function (text) {
            clearTimeout(timer);
            if (/^\s*</.test(text)) throw 0;       // страница входа: доступ по ссылке не открыт
            try { sessionStorage.setItem(CK, JSON.stringify({ t: Date.now(), text: text })); } catch (e) {}
            if (!cached || cached.text !== text) applySheet(text);
          })
          .catch(function () { clearTimeout(timer); tryUrl(i + 1); });
      })(0);
    }
  }
})();
