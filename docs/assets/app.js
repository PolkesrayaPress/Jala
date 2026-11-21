/* JALA: situs dokumentasi. Tema, animasi hero, dan bab video. */
(function () {
  'use strict';
  var root = document.documentElement;

  // Tema terang/gelap
  var btn = document.getElementById('theme');
  function label() { btn.setAttribute('aria-label', root.getAttribute('data-theme') === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'); }
  label();
  btn.addEventListener('click', function () {
    var t = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('jala-theme', t); } catch (e) {}
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#062523' : '#047D78');
    label();
  });

  // Animasi hero: sekali saat halaman dimuat, bisa diputar ulang
  var cast = document.querySelector('.cast');
  function play() {
    cast.classList.remove('play', 'done'); void cast.offsetWidth; cast.classList.add('play');
  }
  play();
  document.getElementById('replay').addEventListener('click', play);

  // Tautan chrome://extensions: Chrome memblokir pembukaan langsung dari situs, jadi alamat disalin
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t);
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); } finally { document.body.removeChild(ta); }
    });
  }
  document.querySelectorAll('[data-copy]').forEach(function (el) {
    el.addEventListener('click', function (ev) {
      ev.preventDefault();
      var box = el.closest('.ext-link'), hint = box.querySelector('.ext-hint'), t = el.getAttribute('data-copy');
      copyText(t).then(function () {
        hint.classList.add('done');
        hint.innerHTML = 'Alamat tersalin. Sekarang tekan <kbd>Ctrl</kbd>+<kbd>T</kbd> untuk tab baru, <kbd>Ctrl</kbd>+<kbd>V</kbd> untuk menempel, lalu <kbd>Enter</kbd>.';
        var b = box.querySelector('.copy-btn'); b.textContent = 'Tersalin';
        setTimeout(function () { b.textContent = 'Salin alamat'; }, 2500);
      }, function () {
        hint.textContent = 'Penyalinan otomatis tidak tersedia. Ketik chrome://extensions/ di address bar tab baru.';
      });
    });
  });

  // Bab video
  var CHAPTERS = window.JALA_CHAPTERS || [];
  var video = document.getElementById('video');
  var list = document.getElementById('steps');
  function fmt(s) { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  CHAPTERS.forEach(function (c, i) {
    var li = document.createElement('li');
    var b = document.createElement('button');
    b.type = 'button';
    var t = document.createElement('span'); t.className = 't'; t.textContent = fmt(c.t);
    var w = document.createElement('span');
    var g = document.createElement('span'); g.className = 'g'; g.textContent = c.group;
    w.appendChild(g); w.appendChild(document.createTextNode(c.title));
    b.appendChild(t); b.appendChild(w);
    b.addEventListener('click', function () { video.currentTime = c.t + 0.05; video.play(); });
    li.appendChild(b); list.appendChild(li);
    c.el = b;
  });
  video.addEventListener('timeupdate', function () {
    var cur = 0;
    CHAPTERS.forEach(function (c, i) { if (video.currentTime >= c.t) cur = i; });
    CHAPTERS.forEach(function (c, i) { c.el.setAttribute('aria-current', i === cur ? 'true' : 'false'); });
  });
})();
