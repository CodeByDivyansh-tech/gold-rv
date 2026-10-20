/*
 * pdf.js — a small PDF writer for the download panel, with no outside libraries.
 *
 *   GRVPdf.make({ title, subtitle, landscape, blocks, foot })       ->  Uint8Array (a complete .pdf file)
 *   GRVPdf.makeSmall(same)   ->  Promise of the same file with compressed pages (what the site downloads)
 *
 * blocks, drawn top to bottom, with page breaks where needed:
 *   { t: 'h2', text }                       section heading
 *   { t: 'p', text, muted }                 paragraph (text may be segments, below)
 *   { t: 'box', lines: [segments, …] }      bordered summary box
 *   { t: 'ul', items: [text, …] }           bulleted list
 *   { t: 'table', head: [...], rows: [[...]] }   header repeats on every page; number columns align right
 * segments: a string, or [[text, bold], …] for mixed bold and regular text.
 *
 * Uses the PDF standard fonts (Helvetica, Helvetica-Bold), so nothing is embedded and files stay small.
 * Those fonts have no rupee sign, so ₹ is written "Rs"; other characters outside Windows-1252 are replaced.
 * Every page carries the title, "Page n of N" and the not-investment-advice line.
 */
(function (root) {
  'use strict';
  // Helvetica advance widths (1/1000 em) for ASCII 32-126, from the Adobe core-font metrics
  var W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  var W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
  // Windows-1252 characters we use beyond ASCII: unicode -> [byte, regular width, bold width]
  var EXTRA = { '·': [0xB7, 278, 278], '–': [0x96, 556, 556], '—': [0x97, 1000, 1000], '‘': [0x91, 222, 278], '’': [0x92, 222, 278],
    '“': [0x93, 333, 500], '”': [0x94, 333, 500], '…': [0x85, 1000, 1000], '•': [0x95, 350, 350], '×': [0xD7, 584, 584],
    '°': [0xB0, 400, 400], '±': [0xB1, 584, 584] };
  var BYTEW = {}; Object.keys(EXTRA).forEach(function (k) { BYTEW[EXTRA[k][0]] = EXTRA[k]; });
  var SWAP = { '₹': 'Rs ', '→': '->', '←': '<-', '−': '-', '≈': '~', '≥': '>=', '≤': '<=', ' ': ' ', ' ': ' ', ' ': ' ', '​': '', '﻿': '' };

  // text -> a string whose every char code is the Windows-1252 byte to write
  function enc(s) {
    s = s == null ? '' : String(s);
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i], c = s.charCodeAt(i);
      if (c >= 32 && c <= 126) out += ch;
      else if (EXTRA[ch]) out += String.fromCharCode(EXTRA[ch][0]);
      else if (SWAP[ch] != null) out += SWAP[ch];
      else if (c === 10 || c === 9) out += ' ';
      else if (c >= 0xD800 && c <= 0xDBFF) { out += '?'; i++; }
      else out += '?';
    }
    return out.replace(/Rs  +/g, 'Rs ');
  }
  function width(e, bold, size) {
    var t = 0, A = bold ? W_BOLD : W_REG;
    for (var i = 0; i < e.length; i++) {
      var c = e.charCodeAt(i);
      t += c >= 32 && c <= 126 ? A[c - 32] : (BYTEW[c] ? BYTEW[c][bold ? 2 : 1] : 556);
    }
    return t * size / 1000;
  }
  function lit(e) {   // a PDF string literal
    var o = '(';
    for (var i = 0; i < e.length; i++) {
      var c = e.charCodeAt(i), ch = e[i];
      if (ch === '(' || ch === ')' || ch === '\\') o += '\\' + ch;
      else if (c > 126) o += '\\' + ('00' + c.toString(8)).slice(-3);
      else o += ch;
    }
    return o + ')';
  }
  function n(x) { return (Math.round(x * 100) / 100).toString(); }
  function rgb(hex) { var v = parseInt(hex.slice(1), 16); return [(v >> 16) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255].map(function (x) { return n(x); }).join(' '); }

  var INK = '#111111', MUTED = '#555555', RULE = '#D6D6D6', HEAD = '#F2EEE6', BOX = '#BBBBBB', GOLD = '#975600';

  // split encoded text into lines no wider than maxW (long words are broken)
  function wrapWords(words, maxW, size) {   // words: [{e, bold}]
    var lines = [], cur = [], curW = 0, sp = function (b) { return width(' ', b, size); };
    words.forEach(function (w) {
      var ww = width(w.e, w.bold, size);
      if (ww > maxW) {   // break a word that cannot fit on any line
        var part = '';
        for (var i = 0; i < w.e.length; i++) {
          if (width(part + w.e[i], w.bold, size) > maxW - (cur.length ? curW + sp(w.bold) : 0) && (part || cur.length)) {
            if (part) cur.push({ e: part, bold: w.bold });
            lines.push(cur); cur = []; curW = 0; part = '';
          }
          part += w.e[i];
        }
        w = { e: part, bold: w.bold }; ww = width(part, w.bold, size);
      }
      var add = cur.length ? sp(w.bold) + ww : ww;
      if (cur.length && curW + add > maxW) { lines.push(cur); cur = [w]; curW = ww; }
      else { cur.push(w); curW += add; }
    });
    if (cur.length || !lines.length) lines.push(cur);
    return lines;
  }
  function toWords(seg) {
    var parts = typeof seg === 'string' || typeof seg === 'number' || seg == null ? [[seg == null ? '' : String(seg), false]] : seg;
    var out = [];
    parts.forEach(function (p) {
      enc(p[0]).split(' ').forEach(function (w) {
        if (w === '') return;
        var last = out[out.length - 1];
        if (last && /^-?Rs$/.test(last.e) && last.bold === !!p[1]) last.e += ' ' + w;   // "Rs 1,63,171" never splits
        else out.push({ e: w, bold: !!p[1] });
      });
    });
    return out;
  }

  function layout(doc) {
    var landscape = !!doc.landscape;
    var PW = landscape ? 841.89 : 595.28, PH = landscape ? 595.28 : 841.89, M = 40;
    var CW = PW - 2 * M, TOP = PH - M, BOTTOM = M + 26;
    var pages = [], ops = null, y = 0;
    var title = enc(doc.title || 'Gold RV Intelligence');

    function text(x, yy, e, bold, size, color) {
      ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + n(size) + ' Tf ' + rgb(color || INK) + ' rg 1 0 0 1 ' + n(x) + ' ' + n(yy) + ' Tm ' + lit(e) + ' Tj ET');
    }
    function line(words, x, yy, size, color) {
      var cx = x;
      words.forEach(function (w, i) {
        if (i) cx += width(' ', w.bold, size);
        text(cx, yy, w.e, w.bold, size, color); cx += width(w.e, w.bold, size);
      });
    }
    function rect(x, yy, w, h, fill, stroke) {
      if (fill) ops.push(rgb(fill) + ' rg ' + n(x) + ' ' + n(yy) + ' ' + n(w) + ' ' + n(h) + ' re f');
      if (stroke) ops.push(rgb(stroke) + ' RG 0.6 w ' + n(x) + ' ' + n(yy) + ' ' + n(w) + ' ' + n(h) + ' re S');
    }
    function hline(x1, x2, yy, color, w) { ops.push(rgb(color) + ' RG ' + n(w || 0.5) + ' w ' + n(x1) + ' ' + n(yy) + ' m ' + n(x2) + ' ' + n(yy) + ' l S'); }
    function mark(x, yy, s) {   // the site's mark: two gold bars, as in the logo
      var P = [[8, 28], [12, 18], [44, 18], [48, 28]], Q = [[16, 46], [20, 36], [52, 36], [56, 46]];
      [P, Q].forEach(function (pts) {
        ops.push(rgb(GOLD) + ' rg ' + pts.map(function (p, i) { return n(x + (p[0] - 8) * s) + ' ' + n(yy - (p[1] - 18) * s) + (i ? ' l' : ' m'); }).join(' ') + ' h f');
      });
    }
    function newPage() {
      ops = []; pages.push(ops);
      if (pages.length === 1) {
        mark(M, TOP, 0.42);
        text(M + 24, TOP - 11, enc('Gold RV Intelligence'), true, 13, INK);
        y = TOP - 38;
        wrapWords(toWords(doc.title), CW, 17).forEach(function (l) { line(l, M, y, 17, INK); y -= 21; });
        if (doc.subtitle) { y += 4; wrapWords(toWords(doc.subtitle), CW, 9).forEach(function (l) { line(l, M, y, 9, MUTED); y -= 12; }); }
        y -= 8;
      } else {
        text(M, TOP - 8, enc('Gold RV Intelligence  ·  ') + title, false, 8, MUTED);
        hline(M, PW - M, TOP - 14, RULE);
        y = TOP - 30;
      }
    }
    function need(h) { if (y - h < BOTTOM) { newPage(); return true; } return false; }

    function para(seg, size, color, indent) {
      var lh = size * 1.4, lines = wrapWords(toWords(seg), CW - (indent || 0), size);
      lines.forEach(function (l) { need(lh); line(l, M + (indent || 0), y - size, size, color); y -= lh; });
    }

    function table(head, rows) {
      var cols = head.length, size = cols > 10 ? 6.8 : cols > 7 ? 7.4 : 8.2, pad = 4, vp = 3, lh = size * 1.3;
      var H = head.map(function (h) { return String(h); });
      var R = rows.map(function (r) { return r.map(function (v) { return v == null ? '–' : String(v); }); });
      var HE = H.map(enc), RE = R.map(function (r) { return r.map(enc); });   // encoded copies, for measuring
      var isNum = H.map(function (_, j) {
        var any = false;
        var ok = RE.every(function (r) { var v = r[j]; if (v === '' || v === '-' || v === enc('–')) return true; any = true; return /^-?(Rs )?-?[\d,]+(\.\d+)?%?$/.test(v); });
        return ok && any;
      });
      // column widths: as wide as the content, headers wrap at word boundaries, then fit the page
      var minW = [], want = [];
      for (var j = 0; j < cols; j++) {
        var cell = 0;
        for (var i = 0; i < RE.length; i++) { var cw = width(RE[i][j] || '', false, size); if (cw > cell) cell = cw; }
        var word = 0; HE[j].split(' ').forEach(function (w) { word = Math.max(word, width(w, true, size)); });
        minW.push(Math.max(word, Math.min(cell, 150)) + 2 * pad);
        want.push(Math.max(cell, Math.min(width(HE[j], true, size), 120)) + 2 * pad);
      }
      var sum = function (a) { return a.reduce(function (s, x) { return s + x; }, 0); };
      var w = want.slice();
      if (sum(w) > CW) {
        // shrink the widest columns toward their minimum first
        var extra = sum(w) - CW, room = w.map(function (x, k) { return Math.max(0, x - minW[k]); }), rs = sum(room);
        w = w.map(function (x, k) { return rs ? x - room[k] * Math.min(1, extra / rs) : x; });
        if (sum(w) > CW) { var f = CW / sum(w); w = w.map(function (x) { return x * f; }); }
      } else {
        var f2 = CW / sum(w); w = w.map(function (x) { return x * f2; });
      }
      var xs = [M]; for (var k = 0; k < cols; k++) xs.push(xs[k] + w[k]);
      function cellLines(v, j, bold) { return wrapWords(toWords([[v, bold]]), w[j] - 2 * pad, size); }
      function drawRow(cells, bold, fill) {
        var L = cells.map(function (e, j) { return cellLines(e, j, bold); });
        var h = Math.max.apply(null, L.map(function (l) { return l.length; })) * lh + 2 * vp;
        if (fill) rect(M, y - h, CW, h, fill);
        L.forEach(function (lines, j) {
          lines.forEach(function (l, li) {
            var lw = l.reduce(function (s, wd, i) { return s + width(wd.e, wd.bold, size) + (i ? width(' ', wd.bold, size) : 0); }, 0);
            var x = isNum[j] ? xs[j + 1] - pad - lw : xs[j] + pad;
            line(l, x, y - vp - size * 0.95 - li * lh, size, INK);
          });
        });
        y -= h; hline(M, M + CW, y, bold ? '#999999' : RULE, bold ? 0.7 : 0.4);
      }
      function rowH(cells, bold) { return Math.max.apply(null, cells.map(function (e, j) { return cellLines(e, j, bold).length; })) * lh + 2 * vp; }
      var hh = rowH(H, true);
      need(hh + (R.length ? rowH(R[0], false) : 0));
      drawRow(H, true, HEAD);
      R.forEach(function (r) {
        if (y - rowH(r, false) < BOTTOM) { newPage(); drawRow(H, true, HEAD); }
        drawRow(r, false, null);
      });
      y -= 10;
    }
    newPage();
    (doc.blocks || []).forEach(function (b) {
      if (b.t === 'h2') { y -= 8; need(40); para([[b.text, true]], 11.5, INK); y -= 3; }
      else if (b.t === 'p') { para(b.text, 9, b.muted ? MUTED : INK); y -= 5; }
      else if (b.t === 'ul') { b.items.forEach(function (it) { need(13); text(M + 2, y - 9, enc('•'), false, 9, INK); para(it, 9, INK, 12); y -= 2; }); y -= 4; }
      else if (b.t === 'box') {
        var size = 9.5, lh = size * 1.45, all = [];
        b.lines.forEach(function (l, i) { wrapWords(toWords(l), CW - 24, size).forEach(function (wl) { all.push(wl); }); if (i < b.lines.length - 1) all.push(null); });
        var h = all.reduce(function (s, l) { return s + (l ? lh : 4); }, 0) + 18;
        need(h);
        rect(M, y - h, CW, h, '#FBF8F2', BOX);
        var yy = y - 9;
        all.forEach(function (l) { if (!l) { yy -= 4; return; } line(l, M + 12, yy - size, size, INK); yy -= lh; });
        y -= h + 12;
      }
      else if (b.t === 'table') table(b.head, b.rows);
    });
    if (doc.foot) { y -= 6; para(doc.foot, 8, MUTED); }

    // footers, now that the page count is known
    var N = pages.length;
    pages.forEach(function (p, i) {
      ops = p;
      hline(M, PW - M, M + 14, RULE);
      text(M, M + 2, enc('Gold RV Intelligence  ·  Team NEXORA  ·  Research project, not investment advice'), false, 7.5, MUTED);
      var pg = enc('Page ' + (i + 1) + ' of ' + N);
      text(PW - M - width(pg, false, 7.5), M + 2, pg, false, 7.5, MUTED);
    });

    return { pages: pages.map(function (p) { return p.join('\n'); }), PW: PW, PH: PH, title: title };
  }

  function bin(str) { var b = new Uint8Array(str.length); for (var i = 0; i < str.length; i++) b[i] = str.charCodeAt(i) & 255; return b; }

  // the file: catalog, page tree, two fonts, info, then each page and its content stream
  function assemble(L, streams, flate) {
    var N = L.pages.length, objs = [];
    var kids = L.pages.map(function (_, i) { return (6 + 2 * i) + ' 0 R'; }).join(' ');
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = '<< /Type /Pages /Kids [' + kids + '] /Count ' + N + ' >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    var d = new Date(), z = function (v) { return ('0' + v).slice(-2); };
    var stamp = 'D:' + d.getUTCFullYear() + z(d.getUTCMonth() + 1) + z(d.getUTCDate()) + z(d.getUTCHours()) + z(d.getUTCMinutes()) + z(d.getUTCSeconds()) + 'Z';
    objs[5] = '<< /Title ' + lit(enc('Gold RV Intelligence: ') + L.title) + ' /Author (Team NEXORA) /Creator (Gold RV Intelligence, Team NEXORA) /Producer (Gold RV Intelligence) /CreationDate (' + stamp + ') >>';
    var chunks = [], len = 0, off = [];
    function put(x) { var b = typeof x === 'string' ? bin(x) : x; chunks.push(b); len += b.length; }
    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    for (var o = 1; o <= 5; o++) { off[o] = len; put(o + ' 0 obj\n' + objs[o] + '\nendobj\n'); }
    L.pages.forEach(function (_, i) {
      var po = 6 + 2 * i, co = po + 1, st = streams[i];
      off[po] = len;
      put(po + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + n(L.PW) + ' ' + n(L.PH) + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + co + ' 0 R >>\nendobj\n');
      off[co] = len;
      put(co + ' 0 obj\n<< /Length ' + st.length + (flate ? ' /Filter /FlateDecode' : '') + ' >>\nstream\n'); put(st); put('\nendstream\nendobj\n');
    });
    var total = 6 + 2 * N, xref = len, x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (var q = 1; q < total; q++) x += ('0000000000' + off[q]).slice(-10) + ' 00000 n \n';
    put(x + 'trailer\n<< /Size ' + total + ' /Root 1 0 R /Info 5 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    var out = new Uint8Array(len), p = 0;
    chunks.forEach(function (c) { out.set(c, p); p += c.length; });
    return out;
  }

  // GRVPdf.make(doc): the file, uncompressed (simple, synchronous)
  function make(doc) { var L = layout(doc); return assemble(L, L.pages.map(bin), false); }

  // GRVPdf.makeSmall(doc): a promise of the same file with compressed pages, where the browser can compress
  // (all current browsers); otherwise the uncompressed file
  function makeSmall(doc) {
    var L = layout(doc);
    if (typeof CompressionStream === 'undefined' || typeof Response === 'undefined') return Promise.resolve(assemble(L, L.pages.map(bin), false));
    return Promise.all(L.pages.map(function (p) {
      var cs = new Blob([bin(p)]).stream().pipeThrough(new CompressionStream('deflate'));
      return new Response(cs).arrayBuffer().then(function (b) { return new Uint8Array(b); });
    })).then(function (streams) { return assemble(L, streams, true); }, function () { return assemble(L, L.pages.map(bin), false); });
  }

  root.GRVPdf = { make: make, makeSmall: makeSmall, enc: enc, width: width };
})(typeof window !== 'undefined' ? window : globalThis);
