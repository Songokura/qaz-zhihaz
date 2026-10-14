/* QAZ ZHIHAZ — «Один день» · interactions & animations */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  function metrika(goal) {
    if (typeof ym === 'function') { try { ym(113056592, 'reachGoal', goal); } catch (e) {} }
  }

  /* ---------- Google Ads конверсии (AW-18042242538) ----------
     Вешаем на реальные действия, дедуп 1/сессия + анти-бот (боты кликают
     без единого человеческого жеста - такие клики не засчитываем). */
  var humanSeen = false;
  ['pointermove', 'pointerdown', 'touchstart', 'scroll', 'keydown', 'wheel'].forEach(function (ev) {
    window.addEventListener(ev, function () { humanSeen = true; }, { once: true, passive: true });
  });
  function isBot() { return !!navigator.webdriver || !humanSeen; }
  function adsConv(sendTo, key) {
    if (typeof gtag !== 'function' || isBot()) return;
    try {
      var k = 'qz_conv_' + key;
      if (sessionStorage.getItem(k)) return;   // уже засчитали в этой сессии
      sessionStorage.setItem(k, '1');
    } catch (e) { /* приватный режим */ }
    gtag('event', 'conversion', { 'send_to': sendTo, 'value': 1.0, 'currency': 'USD' });
  }
  var ADS_PHONE = 'AW-18042242538/3BOfCITWgP8cEOqLm5tD';
  var ADS_FORM  = 'AW-18042242538/jbdQCI_th_8cEOqLm5tD';
  var ADS_WA    = 'AW-18042242538/Cu1GCLLrh_8cEOqLm5tD';

  /* ---------- hero intro ---------- */
  window.addEventListener('load', function () {
    document.body.classList.add('is-loaded');
  });
  // fallback if load hangs on slow media
  setTimeout(function () { document.body.classList.add('is-loaded'); }, 1800);

  // staggered hero words
  document.querySelectorAll('#heroTitle .ht-word').forEach(function (w, i) {
    w.style.transitionDelay = (0.12 + i * 0.07) + 's';
  });

  /* ---------- live clock ---------- */
  var clock = document.getElementById('liveClock');
  function tickClock() {
    var d = new Date();
    clock.textContent =
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  if (clock) { tickClock(); setInterval(tickClock, 15000); }

  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- header state ---------- */
  var header = document.getElementById('header');
  var lastY = 0;

  /* ---------- burger / mobile nav ---------- */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');
  function closeNav() {
    burger.classList.remove('is-open');
    nav.classList.remove('is-open');
    header.classList.remove('nav-open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    burger.classList.toggle('is-open', open);
    // при открытии убираем скрытие шапки и делаем её не-containing-block (см. .header.nav-open)
    header.classList.toggle('nav-open', open);
    if (open) header.classList.remove('is-hidden');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.style.overflow = open ? 'hidden' : '';
  });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) closeNav();
  });

  /* ---------- split words for section titles ---------- */
  document.querySelectorAll('.reveal-words').forEach(function (el) {
    if (reduceMotion) return;
    var nodes = Array.prototype.slice.call(el.childNodes);
    el.textContent = '';
    var delay = 0;
    nodes.forEach(function (node) {
      if (node.nodeType === 3) {
        node.textContent.split(/\s+/).forEach(function (word) {
          if (!word) return;
          el.appendChild(makeWord(word, null));
          el.appendChild(document.createTextNode(' '));
        });
      } else if (node.nodeName === 'BR') {
        el.appendChild(document.createElement('br'));
      } else if (node.nodeType === 1) {
        var cls = node.nodeName === 'EM' ? 'em' : null;
        node.textContent.split(/\s+/).forEach(function (word) {
          if (!word) return;
          el.appendChild(makeWord(word, cls));
          el.appendChild(document.createTextNode(' '));
        });
      }
    });
    function makeWord(word, cls) {
      var wrap = document.createElement('span');
      wrap.className = 'rw';
      var inner = document.createElement('span');
      inner.textContent = word;
      inner.style.transitionDelay = (delay += 0.05) + 's';
      wrap.appendChild(inner);
      if (cls === 'em') wrap.classList.add('rw-em');
      return wrap;
    }
  });
  // keep em color on split titles
  document.querySelectorAll('.reveal-words .rw-em').forEach(function (w) {
    var title = w.closest('.sec-title');
    if (!title) return;
    w.style.color = title.classList.contains('sec-title--dark') ? 'var(--gold-dark)'
      : title.classList.contains('sec-title--onGold') ? '#fff' : 'var(--gold)';
  });

  /* ---------- intersection reveals ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      // also reveal if already scrolled past (fast flicks / anchor jumps)
      if (en.isIntersecting || en.boundingClientRect.top < 0) {
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });

  document
    .querySelectorAll('.reveal-up, .reveal-clip, .reveal-words, .img-reveal, section .reveal-line')
    .forEach(function (el) {
      if (el.closest('.hero')) return; // hero handled by is-loaded
      io.observe(el);
    });

  /* ---------- counters ---------- */
  var counterIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      counterIO.unobserve(en.target);
      var el = en.target;
      var target = parseInt(el.dataset.count, 10);
      if (reduceMotion || target === 0) { el.textContent = target; return; }
      var start = null, dur = 1400;
      function step(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(eased * target);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('.count').forEach(function (el) { counterIO.observe(el); });

  /* ---------- scroll-driven: progress bar, hero parallax, day line, header ---------- */
  var progressBar = document.getElementById('progressBar');
  var heroImg = document.getElementById('heroImg');
  var dayLine = document.getElementById('dayLine');
  var dayTrack = document.querySelector('.day__track');
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY;
      var max = document.documentElement.scrollHeight - window.innerHeight;

      if (progressBar) progressBar.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';

      if (!reduceMotion && heroImg && y < window.innerHeight * 1.2) {
        heroImg.style.transform = 'translateY(' + y * 0.18 + 'px)';
      }

      if (dayLine && dayTrack) {
        var r = dayTrack.getBoundingClientRect();
        var vh = window.innerHeight;
        var p = (vh * 0.75 - r.top) / (r.height);
        dayLine.style.transform = 'scaleY(' + Math.max(0, Math.min(1, p)) + ')';
      }

      header.classList.toggle('is-scrolled', y > 30);
      if (y > 480 && y > lastY && !nav.classList.contains('is-open')) {
        header.classList.add('is-hidden');
      } else {
        header.classList.remove('is-hidden');
      }
      lastY = y;
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- tilt cards (desktop) ---------- */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll('.tilt').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var rx = ((e.clientY - r.top) / r.height - 0.5) * -5;
        var ry = ((e.clientX - r.left) / r.width - 0.5) * 5;
        card.style.transform = 'perspective(900px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateY(-4px)';
      });
      card.addEventListener('pointerleave', function () {
        card.style.transform = '';
      });
    });

    /* magnetic buttons */
    document.querySelectorAll('.btn--magnetic').forEach(function (btn) {
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.18;
        var y = (e.clientY - r.top - r.height / 2) * 0.3;
        btn.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      });
      btn.addEventListener('pointerleave', function () { btn.style.transform = ''; });
    });
  }

  /* ============================================================
     GALLERY
     ============================================================ */
  var galleryData = {
    kuhni: makePaths('kuhni', 10),
    spalni: makePaths('spalni', 9),
    shkafy: makePaths('shkafy', 7),
    prikhozhie: makePaths('prikhozhie', 9),
    detskie: makePaths('detskie', 4)
  };
  var catNames = { kuhni: 'Кухни', spalni: 'Спальни', shkafy: 'Шкафы', prikhozhie: 'Прихожие', detskie: 'Детские' };
  // Винительный падеж для авто-текста WhatsApp при заказе из каталога
  var catOrder = { kuhni: 'кухню', spalni: 'спальню', shkafy: 'шкаф', prikhozhie: 'прихожую', detskie: 'детскую мебель' };
  function makePaths(prefix, n) {
    var arr = [];
    for (var i = 1; i <= n; i++) arr.push('img/opt/' + prefix + '-' + String(i).padStart(2, '0') + '.webp');
    return arr;
  }

  var gallery = document.getElementById('gallery');
  var galImg = document.getElementById('galImg');
  var galCounter = document.getElementById('galCounter');
  var galWa = document.getElementById('galWa');
  var tabs = gallery.querySelectorAll('[data-tab]');
  var currentCat = 'kuhni';
  var currentIdx = 0;
  var lastFocus = null;

  function openGallery(cat) {
    currentCat = galleryData[cat] ? cat : 'kuhni';
    currentIdx = 0;
    lastFocus = document.activeElement;
    gallery.hidden = false;
    document.body.classList.add('gallery-open');
    renderGallery();
    metrika('open_gallery');
    metrika('open_gallery_' + currentCat);
  }
  function closeGallery() {
    gallery.hidden = true;
    document.body.classList.remove('gallery-open');
    if (lastFocus) lastFocus.focus();
  }
  function renderGallery() {
    var imgs = galleryData[currentCat];
    galImg.src = imgs[currentIdx];
    galImg.alt = catNames[currentCat] + ' QAZ ZHIHAZ — фото ' + (currentIdx + 1);
    galCounter.textContent = (currentIdx + 1) + ' / ' + imgs.length;
    tabs.forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.tab === currentCat);
      t.setAttribute('aria-selected', t.dataset.tab === currentCat ? 'true' : 'false');
    });
    galWa.href = 'https://wa.me/77478528001?text=' + encodeURIComponent(
      'Здравствуйте! Быстро хочу заказать ' + catOrder[currentCat] + '.'
    );
    // restart image fade
    galImg.style.animation = 'none';
    void galImg.offsetWidth;
    galImg.style.animation = '';
  }
  function galStep(dir) {
    var len = galleryData[currentCat].length;
    currentIdx = (currentIdx + dir + len) % len;
    renderGallery();
  }

  document.querySelectorAll('.cat-card').forEach(function (card) {
    card.addEventListener('click', function () { openGallery(card.dataset.cat); });
  });
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { currentCat = t.dataset.tab; currentIdx = 0; renderGallery(); });
  });
  gallery.querySelectorAll('[data-gallery-close]').forEach(function (el) {
    el.addEventListener('click', closeGallery);
  });
  document.getElementById('galPrev').addEventListener('click', function () { galStep(-1); });
  document.getElementById('galNext').addEventListener('click', function () { galStep(1); });

  document.addEventListener('keydown', function (e) {
    if (gallery.hidden) return;
    if (e.key === 'Escape') closeGallery();
    if (e.key === 'ArrowLeft') galStep(-1);
    if (e.key === 'ArrowRight') galStep(1);
  });

  // swipe on stage
  var touchX = null;
  gallery.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  gallery.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 46) galStep(dx > 0 ? -1 : 1);
    touchX = null;
  }, { passive: true });

  /* ============================================================
     ORDER FORM → WhatsApp
     ============================================================ */
  var form = document.getElementById('orderForm');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.name.value.trim();
    var phone = form.phone.value.trim();
    var what = form.what.value;
    if (!name || !phone) {
      (!name ? form.name : form.phone).focus();
      return;
    }
    var msg = 'Здравствуйте! Меня зовут ' + name + '. Нужна мебель: ' + what +
      '. Хочу доставку и сборку за 1 день. Мой телефон: ' + phone + '.';
    metrika('whatsapp_click');
    metrika('form_submit');
    adsConv(ADS_FORM, 'form');            // Google Ads: Отправка формы
    document.getElementById('orderDone').hidden = false;
    window.open('https://wa.me/77478528001?text=' + encodeURIComponent(msg), '_blank');
  });

  /* ============================================================
     METRIKA GOALS (delegated)
     ============================================================ */
  document.addEventListener('click', function (e) {
    var wa = e.target.closest('[data-wa]');
    if (wa) { metrika('whatsapp_click'); adsConv(ADS_WA, 'wa'); }        // Google Ads: Контакт (WhatsApp)
    var ph = e.target.closest('[data-phone]');
    if (ph) { metrika('phone_click'); adsConv(ADS_PHONE, 'phone'); }     // Google Ads: Телефон
  });

  /* section view goals */
  var viewIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      viewIO.unobserve(en.target);
      metrika('view_' + en.target.id);
    });
  }, { threshold: 0.4 });
  ['katalog', 'otzyvy', 'zayavka'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) viewIO.observe(el);
  });
})();

