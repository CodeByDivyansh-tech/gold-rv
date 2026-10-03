/*
 * dc.js — a small renderer for the site's page files (pages/*.dc.html).
 *
 * Each page file holds one HTML template plus one logic class:
 *   <x-dc> … template … </x-dc>
 *   <script type="text/x-dc" data-dc-script> class Component extends DCLogic { renderVals() { … } } </script>
 *
 * Template syntax handled here:
 *   {{ a.b }}                    dotted lookup into renderVals() (also literals: true, false, null, numbers)
 *   attr="{{ x }}"               whole-value hole → the raw value (functions become event handlers on on* attrs)
 *   attr="a {{ x }} b"           interpolated string
 *   <sc-for list="{{xs}}" as="x">  repeat, with {{x}} and {{$index}} in scope
 *   <sc-if value="{{cond}}">     render children only when cond is truthy
 *   <dc-import name="Card" …>    mount pages/Card.dc.html as a child; kebab-case attrs become camelCase props
 *   <helmet>                     <link>/<style> moved into document.head once
 *
 * Rendering builds a fresh DOM tree and morphs it into the live one, so focus,
 * scroll and input state survive every update.
 */
(function () {
  'use strict';

  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var EXACT = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  var EVENTS = {
    onclick: ['click'], onchange: ['input', 'change'], oninput: ['input'], onkeydown: ['keydown'],
    onpointerdown: ['pointerdown'], onpointermove: ['pointermove'], onpointerleave: ['pointerleave'],
    onpointerup: ['pointerup'], onfocus: ['focus'], onblur: ['blur'], onsubmit: ['submit']
  };

  // ------------------------------------------------------------------ values
  function lookup(scope, path) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^(['"]).*\1$/.test(path)) return path.slice(1, -1);
    var parts = path.split('.');
    var v = scope;
    for (var i = 0; i < parts.length; i++) {
      if (v === null || v === undefined) return undefined;
      v = v[parts[i]];
    }
    return v;
  }
  function interpolate(text, scope) {
    return text.replace(HOLE, function (_, p) {
      var v = lookup(scope, p);
      return v === null || v === undefined ? '' : String(v);
    });
  }

  // ------------------------------------------------------------------ parsing
  function parseFile(source, name) {
    var title = (source.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    var body = (source.match(/<x-dc>([\s\S]*)<\/x-dc>/) || [])[1];
    var scriptMatch = source.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/);
    if (!body || !scriptMatch) throw new Error('Not a page file: ' + name);
    var helmet = (body.match(/<helmet>([\s\S]*?)<\/helmet>/) || [])[1] || '';
    body = body.replace(/<helmet>[\s\S]*?<\/helmet>/, '');
    // <template> keeps repeats and conditions in place inside tables, where unknown tags would be moved
    body = body
      .replace(/<sc-for\b/g, '<template data-k="for"').replace(/<\/sc-for>/g, '</template>')
      .replace(/<sc-if\b/g, '<template data-k="if"').replace(/<\/sc-if>/g, '</template>')
      .replace(/<dc-import\b/g, '<template data-k="import"').replace(/<\/dc-import>/g, '</template>');
    var tpl = document.createElement('template');
    tpl.innerHTML = body;
    var Logic = new Function('DCLogic', scriptMatch[1] + '\nreturn Component;')(DCLogic);
    return { name: name, title: title.trim(), helmet: helmet, root: tpl.content, Logic: Logic };
  }

  var helmetsDone = {};
  function applyHelmet(def) {
    if (helmetsDone[def.name] || !def.helmet.trim()) return;
    helmetsDone[def.name] = true;
    var box = document.createElement('template');
    box.innerHTML = def.helmet;
    Array.prototype.slice.call(box.content.childNodes).forEach(function (n) {
      if (n.nodeType !== 1) return;
      var key = n.outerHTML;
      if (document.head.querySelector('[data-helmet="' + hash(key) + '"]')) return;
      var el = n.tagName === 'STYLE' ? document.createElement('style') : document.createElement(n.tagName.toLowerCase());
      Array.prototype.slice.call(n.attributes).forEach(function (a) { el.setAttribute(a.name, a.value); });
      if (n.tagName === 'STYLE') el.textContent = n.textContent;
      el.setAttribute('data-helmet', hash(key));
      document.head.appendChild(el);
    });
  }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h >>> 0); }

  // ------------------------------------------------------------------ components
  function DCLogic() { this.props = {}; this.state = {}; }
  DCLogic.prototype.setState = function (patch) {
    var next = typeof patch === 'function' ? patch(this.state || {}, this.props) : patch;
    this.state = Object.assign({}, this.state || {}, next || {});
    if (this.__host) this.__host.schedule();
  };
  DCLogic.prototype.forceUpdate = function () { if (this.__host) this.__host.schedule(); };

  var registry = {};   // name -> parsed definition
  var loading = {};    // name -> promise
  var base = 'pages/';
  function load(name) {
    if (registry[name]) return Promise.resolve(registry[name]);
    if (!loading[name]) {
      loading[name] = fetch(base + name + '.dc.html', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error('Could not load ' + name + ' (' + r.status + ')'); return r.text(); })
        .then(function (src) {
          var def = parseFile(src, name);
          registry[name] = def;
          var kids = [];
          src.replace(/<dc-import[^>]*\bname="([A-Za-z0-9_]+)"/g, function (_, n) { kids.push(n); return _; });
          return Promise.all(kids.map(load)).then(function () { return def; });
        });
    }
    return loading[name];
  }

  // Options a host page can set: rewrite links between page files into routes
  var options = { href: function (h) { return h; } };

  // ------------------------------------------------------------------ rendering
  function Host(mountEl) {
    this.el = mountEl;
    this.root = null;
    this.pending = false;
    this.mountQueue = [];
  }
  Host.prototype.schedule = function () {
    var self = this;
    if (self.pending) return;
    self.pending = true;
    (window.requestAnimationFrame || setTimeout)(function () { self.pending = false; self.render(); });
  };
  Host.prototype.mount = function (def, props) {
    this.unmount();
    var inst = new def.Logic();
    inst.props = props || {};
    inst.state = inst.state || {};
    inst.__host = this;
    inst.__def = def;
    inst.__kids = {};
    this.root = inst;
    applyHelmet(def);
    this.render();
    this.flushMounts();
    if (typeof inst.componentDidMount === 'function') inst.componentDidMount();
  };
  Host.prototype.unmount = function () {
    if (!this.root) return;
    unmountTree(this.root);
    this.root = null;
    this.el.textContent = '';
  };
  function unmountTree(inst) {
    Object.keys(inst.__kids || {}).forEach(function (k) { unmountTree(inst.__kids[k]); });
    inst.__kids = {};
    if (typeof inst.componentWillUnmount === 'function') { try { inst.componentWillUnmount(); } catch (e) { console.error(e); } }
    inst.__host = null;
  }
  Host.prototype.flushMounts = function () {
    var q = this.mountQueue; this.mountQueue = [];
    q.forEach(function (inst) { if (typeof inst.componentDidMount === 'function') inst.componentDidMount(); });
  };
  Host.prototype.render = function () {
    if (!this.root) return;
    var frag = document.createDocumentFragment();
    try {
      renderInstance(this.root, frag, this);
    } catch (e) {
      console.error(e);
      frag = document.createDocumentFragment();
      var p = document.createElement('p');
      p.setAttribute('role', 'alert');
      p.style.cssText = 'margin:24px;font:16px system-ui,sans-serif';
      p.textContent = 'Something went wrong while drawing this page. Please reload.';
      frag.appendChild(p);
    }
    morphChildren(this.el, frag);
    this.flushMounts();
  };

  function renderInstance(inst, parent, host) {
    var vals = inst.renderVals ? inst.renderVals() : {};
    var seen = {};
    var ctx = { inst: inst, host: host, seen: seen, counter: {} };
    renderNodes(inst.__def.root.childNodes, vals, parent, ctx);
    // children that were not rendered this time are unmounted
    Object.keys(inst.__kids).forEach(function (k) {
      if (!seen[k]) { unmountTree(inst.__kids[k]); delete inst.__kids[k]; }
    });
  }

  function renderNodes(nodes, scope, parent, ctx) {
    for (var i = 0; i < nodes.length; i++) renderNode(nodes[i], scope, parent, ctx);
  }

  function renderNode(node, scope, parent, ctx) {
    if (node.nodeType === 3) {
      var t = node.nodeValue;
      parent.appendChild(document.createTextNode(t.indexOf('{{') >= 0 ? interpolate(t, scope) : t));
      return;
    }
    if (node.nodeType !== 1) return;
    var kind = node.localName === 'template' ? node.getAttribute('data-k') : null;
    if (kind === 'for') {
      var list = holeValue(node.getAttribute('list'), scope) || [];
      var as = node.getAttribute('as') || 'item';
      for (var i = 0; i < list.length; i++) {
        var s = Object.create(scope);
        s[as] = list[i];
        s.$index = i;
        renderNodes(node.content.childNodes, s, parent, ctx);
      }
      return;
    }
    if (kind === 'if') {
      if (holeValue(node.getAttribute('value'), scope)) renderNodes(node.content.childNodes, scope, parent, ctx);
      return;
    }
    if (kind === 'import') {
      renderImport(node, scope, parent, ctx);
      return;
    }
    var el = node.namespaceURI && node.namespaceURI !== 'http://www.w3.org/1999/xhtml'
      ? document.createElementNS(node.namespaceURI, node.localName)
      : document.createElement(node.localName);
    var attrs = node.attributes;
    for (var a = 0; a < attrs.length; a++) {
      var name = attrs[a].name, raw = attrs[a].value;
      if (name.indexOf('hint-') === 0) continue;
      var exact = raw.match(EXACT);
      if (EVENTS[name]) {
        var fn = exact ? lookup(scope, exact[1]) : null;
        if (typeof fn === 'function') {
          el.__on = el.__on || {};
          EVENTS[name].forEach(function (type) { el.__on[type] = fn; });
        }
        continue;
      }
      var v = exact ? lookup(scope, exact[1]) : (raw.indexOf('{{') >= 0 ? interpolate(raw, scope) : raw);
      if (v === false || v === null || v === undefined) continue;
      if (v === true) v = '';
      if (name === 'href') v = options.href(String(v));
      el.setAttribute(name, String(v));
    }
    var kids = node.localName === 'template' ? node.content.childNodes : node.childNodes;
    renderNodes(kids, scope, el, ctx);
    bind(el);
    parent.appendChild(el);
  }

  function holeValue(raw, scope) {
    if (raw === null) return undefined;
    var m = raw.match(EXACT);
    return m ? lookup(scope, m[1]) : raw;
  }

  function camel(s) { return s.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); }); }

  function renderImport(node, scope, parent, ctx) {
    var name = node.getAttribute('name');
    var def = registry[name];
    if (!def) throw new Error('Component not loaded: ' + name);
    ctx.counter[name] = (ctx.counter[name] || 0) + 1;
    var key = name + '#' + ctx.counter[name];
    var props = {};
    var attrs = node.attributes;
    for (var a = 0; a < attrs.length; a++) {
      var an = attrs[a].name;
      if (an === 'name' || an === 'data-k' || an.indexOf('hint-') === 0) continue;
      var m = attrs[a].value.match(EXACT);
      props[camel(an)] = m ? lookup(scope, m[1]) : interpolate(attrs[a].value, scope);
    }
    var kids = ctx.inst.__kids;
    var inst = kids[key];
    if (!inst) {
      inst = new def.Logic();
      inst.state = inst.state || {};
      inst.__host = ctx.host;
      inst.__def = def;
      inst.__kids = {};
      kids[key] = inst;
      applyHelmet(def);
      ctx.host.mountQueue.push(inst);
    }
    inst.props = props;
    ctx.seen[key] = true;
    renderInstance(inst, parent, ctx.host);
  }

  // ------------------------------------------------------------------ events
  function bind(el) {
    if (!el.__on) return;
    el.__bound = el.__bound || {};
    Object.keys(el.__on).forEach(function (type) {
      if (el.__bound[type]) return;
      el.__bound[type] = true;
      el.addEventListener(type, function (e) {
        var f = el.__on && el.__on[type];
        if (typeof f === 'function') f(e);
      });
    });
  }

  // ------------------------------------------------------------------ morph
  function sameKind(a, b) {
    if (a.nodeType !== b.nodeType) return false;
    if (a.nodeType !== 1) return true;
    return a.localName === b.localName && a.namespaceURI === b.namespaceURI;
  }
  // Elements with an id or an accessible label keep their identity across renders,
  // so a focused control is moved, never replaced, when siblings appear before it.
  function keyOf(n) {
    if (n.nodeType !== 1) return null;
    var k = n.getAttribute('id') || n.getAttribute('aria-label');
    return k ? n.localName + '|' + k : null;
  }
  function morphChildren(live, next) {
    var nextNodes = Array.prototype.slice.call(next.childNodes);
    for (var i = 0; i < nextNodes.length; i++) {
      var b = nextNodes[i];
      var a = live.childNodes[i];
      if (!a) { live.appendChild(b); continue; }
      var kb = keyOf(b), ka = keyOf(a);
      if (kb !== ka) {
        // look further along for the element with b's key and move it into place
        var found = null;
        if (kb) {
          for (var j = i + 1; j < live.childNodes.length; j++) {
            if (keyOf(live.childNodes[j]) === kb && sameKind(live.childNodes[j], b)) { found = live.childNodes[j]; break; }
          }
        }
        if (found) { live.insertBefore(found, a); a = found; }
        else { live.insertBefore(b, a); continue; }
      }
      if (!sameKind(a, b)) { live.replaceChild(b, a); continue; }
      if (a.nodeType === 3 || a.nodeType === 8) {
        if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
        continue;
      }
      morphElement(a, b);
    }
    while (live.childNodes.length > nextNodes.length) live.removeChild(live.lastChild);
  }
  function morphElement(a, b) {
    var i, name;
    var bAttrs = b.attributes;
    for (i = 0; i < bAttrs.length; i++) {
      name = bAttrs[i].name;
      if (a.getAttribute(name) !== bAttrs[i].value) a.setAttribute(name, bAttrs[i].value);
    }
    var aAttrs = Array.prototype.slice.call(a.attributes);
    for (i = 0; i < aAttrs.length; i++) {
      if (!b.hasAttribute(aAttrs[i].name)) a.removeAttribute(aAttrs[i].name);
    }
    a.__on = b.__on;
    bind(a);
    if (a.localName === 'input') {
      var v = b.getAttribute('value');
      if (v !== null && a.value !== v) a.value = v;
      if (a.type === 'checkbox' || a.type === 'radio') a.checked = b.hasAttribute('checked');
    }
    morphChildren(a, b);
  }

  window.DC = {
    load: load,
    Host: Host,
    DCLogic: DCLogic,
    setBase: function (b) { base = b; },
    setHref: function (fn) { options.href = fn; }
  };
})();
