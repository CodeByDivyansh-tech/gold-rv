/*
 * footer.js: the halftone wordmark footer at the end of the intro.
 * "gold rv" is set huge in Geist, cropped by the bottom edge, and printed as a field of gold dots.
 * Each dot is sized by how much of the letter covers its cell, so the type keeps its edges.
 * Move across it and the dots part around the pointer on springs, brightening from gold to pale foil;
 * click and a ripple runs through the word. With "reduce motion" the dots stay still.
 * (Idea from a reference React component; written here as plain JS for this static site.)
 */
(function () {
  'use strict';
  var root = document.querySelector('.hwf-root');
  if (!root) return;
  var canvas = root.querySelector('canvas'), ctx = canvas.getContext('2d');
  if (!ctx) return;
  var OPT = { word: 'gold rv', gap: 6, radius: 90, crop: 0.06, grain: 0.5, face: '800 100px Geist, "Segoe UI", system-ui, sans-serif',
    bg: '#0E0A05', ink: [201, 161, 90], warm: [248, 219, 151] };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var w = 0, h = 0, dpr = 1, px = -1e5, py = -1e5, raf = 0, visible = true, awake = true, ring = { x: 0, y: 0, t: -1 };
  var dots = new Float32Array(0), count = 0, grain = null;

  function radiusFor(cov, gap) { var c = Math.max(0, Math.min(1, cov)); return Math.sqrt(c) * gap * 0.56; }

  function layout() {
    var rect = root.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width)); h = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    var mask = document.createElement('canvas'); mask.width = w; mask.height = h;
    var m = mask.getContext('2d', { willReadFrequently: true });
    m.font = OPT.face;
    var fit = (w * 1.02) / m.measureText(OPT.word).width * 100;
    m.font = OPT.face.replace('100px', fit + 'px');
    var box = m.measureText(OPT.word), cap = box.actualBoundingBoxAscent || fit * 0.72;
    m.fillStyle = '#000'; m.textBaseline = 'alphabetic';
    m.fillText(OPT.word, (w - box.width) / 2, h + cap * OPT.crop);
    var img = m.getImageData(0, 0, w, h).data, gap = w < 600 ? 5 : OPT.gap;
    var cols = Math.ceil(w / gap), rows = Math.ceil(h / gap), tmp = [];
    for (var gy = 0; gy < rows; gy++) for (var gx = 0; gx < cols; gx++) {
      var sum = 0;
      for (var sy = 0; sy < 3; sy++) for (var sx = 0; sx < 3; sx++) {
        var x = Math.min(w - 1, Math.floor(gx * gap + (sx + 0.5) * gap / 3)), y = Math.min(h - 1, Math.floor(gy * gap + (sy + 0.5) * gap / 3));
        sum += img[(y * w + x) * 4 + 3];
      }
      var cov = sum / (9 * 255);
      if (cov < 0.06) continue;
      var hx = gx * gap + gap / 2, hy = gy * gap + gap / 2;
      tmp.push(hx, hy, 0, 0, hx, hy, radiusFor(cov, gap));
    }
    dots = new Float32Array(tmp); count = tmp.length / 7;
    grain = document.createElement('canvas'); grain.width = grain.height = 256;
    var g = grain.getContext('2d'), id = g.createImageData(256, 256);
    for (var i = 0; i < id.data.length; i += 4) { var v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = Math.random() < 0.5 ? 0 : 255; }
    g.putImageData(id, 0, 0);
    awake = true;
  }

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = OPT.bg; ctx.fillRect(0, 0, w, h);
    var r = reduced ? 0 : OPT.radius, age = ring.t < 0 ? 1e9 : now - ring.t, rr = age * 0.9, moving = false;
    for (var i = 0; i < count; i++) {
      var j = i * 7, x = dots[j], y = dots[j + 1], vx = dots[j + 2], vy = dots[j + 3], hx = dots[j + 4], hy = dots[j + 5];
      if (!reduced) {
        if (age < 900) {
          var ddx = hx - ring.x, ddy = hy - ring.y, dd = Math.sqrt(ddx * ddx + ddy * ddy) + 0.001;
          var band = 1 - Math.min(1, Math.abs(dd - rr) / 26);
          if (band > 0) { var f0 = band * 3.2 * (1 - age / 900); vx += ddx / dd * f0; vy += ddy / dd * f0; }
        }
        var dx = x - px, dy = y - py, d2 = dx * dx + dy * dy;
        if (r > 0 && d2 < r * r) { var d = Math.sqrt(d2) + 0.001, f = (1 - d / r) * 2.6; vx += dx / d * f; vy += dy / d * f; }
        vx = (vx + (hx - x) * 0.05) * 0.84; vy = (vy + (hy - y) * 0.05) * 0.84; x += vx; y += vy;
        if (Math.abs(vx) + Math.abs(vy) > 0.02 || Math.abs(x - hx) + Math.abs(y - hy) > 0.05) moving = true;
        else { x = hx; y = hy; vx = 0; vy = 0; }
        dots[j] = x; dots[j + 1] = y; dots[j + 2] = vx; dots[j + 3] = vy;
      }
      var k = Math.min(1, Math.hypot(x - hx, y - hy) / 28);
      ctx.fillStyle = 'rgb(' + Math.round(OPT.ink[0] + (OPT.warm[0] - OPT.ink[0]) * k) + ',' + Math.round(OPT.ink[1] + (OPT.warm[1] - OPT.ink[1]) * k) + ',' + Math.round(OPT.ink[2] + (OPT.warm[2] - OPT.ink[2]) * k) + ')';
      ctx.beginPath(); ctx.arc(x, y, dots[j + 6], 0, 6.2832); ctx.fill();
    }
    if (grain) {
      ctx.globalAlpha = OPT.grain * 0.09; ctx.globalCompositeOperation = 'overlay';
      var pat = ctx.createPattern(grain, 'repeat'); if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, 0, w, h); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    awake = moving || age < 900 || px > -1e4;
  }
  function loop(now) { raf = 0; if (!visible) return; draw(now); if (awake) raf = requestAnimationFrame(loop); }
  function wake() { awake = true; if (!raf && visible) raf = requestAnimationFrame(loop); }
  function local(e) { var b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; }

  layout(); draw(performance.now()); wake();
  root.addEventListener('pointermove', function (e) { var p = local(e); px = p[0]; py = p[1]; wake(); });
  root.addEventListener('pointerleave', function () { px = py = -1e5; wake(); });
  root.addEventListener('pointerdown', function (e) {
    if (reduced || e.target.closest('a,button')) return;
    var p = local(e); ring = { x: p[0], y: p[1], t: performance.now() }; wake();
  });
  if (window.ResizeObserver) new ResizeObserver(function () { layout(); wake(); }).observe(root);
  if (window.IntersectionObserver) new IntersectionObserver(function (en) {
    visible = en[0] ? en[0].isIntersecting : true; if (visible) wake();
    document.documentElement.classList.toggle('foot-in', visible);   // the chapter dots step aside for the footer
  }).observe(root);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layout(); wake(); });
  var up = root.querySelector('.hwf-up');
  if (up) up.addEventListener('click', function () { scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); });
  window.__footer = { get dots() { return count; } };
})();
