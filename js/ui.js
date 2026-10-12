/* ui.js — small DOM helpers shared by every figure: sliders, preset buttons,
   population controls, readout tiles, table toggles, throttling. */
(function (root) {
  'use strict';
  const C = root.Core;

  function h(tag, attrs) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v; // static, author-written strings only
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    for (let i = 2; i < arguments.length; i++) {
      const kid = arguments[i];
      if (kid == null) continue;
      if (Array.isArray(kid)) kid.forEach((x) => x != null && e.appendChild(typeof x === 'string' ? document.createTextNode(x) : x));
      else e.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    }
    return e;
  }

  /* Range slider with a live value readout.
     o: id, label (static HTML), min, max, step, value, fmt, scale 'lin'|'log',
        atMin / atMax (special values at the ends of a log slider), int, round, hint */
  function slider(parent, o) {
    const wrap = h('div', { class: 'ctl' });
    const out = h('output', { id: o.id + '-out', for: o.id });
    const lab = h('label', { for: o.id }, h('span', { class: 'ctl-name', html: o.label }), out);
    const isLog = o.scale === 'log';
    const input = h('input', {
      type: 'range', id: o.id,
      min: isLog ? 0 : o.min, max: isLog ? 1000 : o.max, step: isLog ? 1 : (o.step || 'any'),
    });
    wrap.appendChild(lab);
    wrap.appendChild(input);
    if (o.hint) wrap.appendChild(h('span', { class: 'hint', html: o.hint }));
    parent.appendChild(wrap);
    const toVal = (pos) => {
      pos = +pos;
      if (!isLog) return o.int ? Math.round(pos) : pos;
      if (o.atMin !== undefined && pos <= 0) return o.atMin;
      if (o.atMax !== undefined && pos >= 1000) return o.atMax;
      let v = o.min * Math.pow(o.max / o.min, pos / 1000);
      if (o.int) v = Math.round(v);
      else if (o.round) v = o.round(v);
      return v;
    };
    const toPos = (v) => {
      if (!isLog) return v;
      if (o.atMin !== undefined && v === o.atMin) return 0;
      if (o.atMax !== undefined && v === o.atMax) return 1000;
      return Math.max(0, Math.min(1000, Math.round(1000 * Math.log(v / o.min) / Math.log(o.max / o.min))));
    };
    let value = o.value;
    const fmt = o.fmt || ((v) => C.fmtNum(v));
    const listeners = [];
    const show = () => { out.textContent = fmt(value); };
    input.value = toPos(value);
    show();
    input.addEventListener('input', () => {
      value = toVal(input.value);
      show();
      listeners.forEach((f) => f(value, 'input'));
    });
    input.addEventListener('change', () => listeners.forEach((f) => f(value, 'change')));
    return {
      el: wrap, input,
      get value() { return value; },
      set(v, silent) {
        value = v; input.value = toPos(v); show();
        if (!silent) listeners.forEach((f) => f(value, 'set'));
      },
      on(f) { listeners.push(f); return this; },
    };
  }

  /* Row of toggle buttons. items: [{id, label}] */
  function seg(parent, o) {
    const wrap = h('div', { class: 'seg', role: 'group', 'aria-label': o.aria || o.label || 'Options' });
    if (o.label) wrap.appendChild(h('span', { class: 'seg-label', text: o.label }));
    const btns = {};
    const api = {
      el: wrap, value: o.value,
      set(v) {
        api.value = v;
        for (const k in btns) btns[k].setAttribute('aria-pressed', k === String(v) ? 'true' : 'false');
      },
    };
    for (const it of o.items) {
      const b = h('button', {
        type: 'button', id: o.idPrefix ? o.idPrefix + '-' + it.id : undefined,
        'aria-pressed': String(it.id) === String(o.value) ? 'true' : 'false', text: it.label,
      });
      b.addEventListener('click', () => {
        if (!o.momentary) api.set(it.id);
        if (o.onChange) o.onChange(it.id);
      });
      btns[it.id] = b;
      wrap.appendChild(b);
    }
    parent.appendChild(wrap);
    return api;
  }

  function button(parent, label, onClick, cls, id) {
    const b = h('button', { type: 'button', class: 'btn' + (cls ? ' ' + cls : ''), text: label, id });
    b.addEventListener('click', onClick);
    parent.appendChild(b);
    return b;
  }

  /* Readout tiles. items: [{id, label (static HTML), key}] */
  function readouts(parent, items) {
    const wrap = h('div', { class: 'readouts' });
    const vals = {};
    for (const it of items) {
      const v = h('span', { class: 'rv' });
      wrap.appendChild(h('div', { class: 'ro' + (it.key ? ' key' : '') }, h('span', { class: 'rl', html: it.label }), v));
      vals[it.id] = v;
    }
    parent.appendChild(wrap);
    return {
      el: wrap,
      set(id, text, sub) {
        const v = vals[id];
        v.textContent = text;
        if (sub) v.appendChild(h('small', { text: ' ' + sub }));
      },
    };
  }

  /* Population presets used across figures (all with per-agent accuracy 0.5) */
  const POP_PRESETS = {
    hom: { label: 'Homogeneous', acc: 0.5, a: Infinity, pi0: 0 },
    div: { label: 'Diverse (a = 2)', acc: 0.5, a: 2, pi0: 0 },
    one: { label: 'Borderline (a = 1)', acc: 0.5, a: 1, pi0: 0 },
    cor: { label: 'Correlated (a = 0.5)', acc: 0.5, a: 0.5, pi0: 0 },
    bs: { label: 'Blind spot (π₀ = 5%)', acc: 0.5, a: 2, pi0: 0.05 },
    big: { label: 'Big blind spot (π₀ = 40%)', acc: 0.45, a: 1, pi0: 0.4 },
    aon: { label: 'All-or-nothing', acc: 0.5, a: 0, pi0: 0 },
  };

  function fmtA(a) {
    if (a === Infinity) return '∞ (homogeneous)';
    if (a === 0) return '0 (all-or-nothing)';
    return a < 1 ? a.toFixed(2) : a.toFixed(1);
  }

  /* Population controls: accuracy E[Δ], tail exponent a, blind spot π0, presets.
     onChange(pop, params) fires on every change. */
  function popControls(parent, idp, init, onChange, opts) {
    opts = opts || {};
    const box = h('div', { class: 'pop-ctl' });
    box.appendChild(h('div', { class: 'pop-h', text: opts.title || 'Population of verifiers' }));
    const keys = opts.presets || ['hom', 'div', 'one', 'cor', 'bs', 'aon'];
    const preset = seg(box, {
      idPrefix: idp + '-pre', aria: 'Population presets',
      items: keys.map((k) => ({ id: k, label: POP_PRESETS[k].label })),
      value: opts.preset || null,
      onChange: (k) => { const p = POP_PRESETS[k]; setAll(p); fire(); },
    });
    const grid = h('div', { class: 'controls' });
    box.appendChild(grid);
    const params = { acc: init.acc, a: init.a, pi0: init.pi0 || 0 };
    const sAcc = slider(grid, {
      id: idp + '-acc', label: 'Per-agent accuracy <i>E</i>[Δ]', min: 0.05, max: 0.95, step: 0.01,
      value: params.acc, fmt: (v) => v.toFixed(2),
    });
    const sA = slider(grid, {
      id: idp + '-a', label: 'Tail exponent <i>a</i>', scale: 'log', min: 0.1, max: 30, atMin: 0, atMax: Infinity,
      value: params.a, fmt: fmtA, round: (v) => +v.toPrecision(2),
    });
    const sPi = opts.noPi ? null : slider(grid, {
      id: idp + '-pi', label: 'Blind spot π<sub>0</sub>', min: 0, max: 0.6, step: 0.01,
      value: params.pi0, fmt: (v) => v.toFixed(2),
    });
    parent.appendChild(box);
    let pop = C.makePop(params);

    function setAll(p) {
      params.acc = p.acc; params.a = p.a; params.pi0 = sPi ? p.pi0 : 0;
      sAcc.set(params.acc, true); sA.set(params.a, true); if (sPi) sPi.set(params.pi0, true);
    }
    function fire() {
      pop = C.makePop(params);
      onChange(pop, params);
    }
    sAcc.on((v) => {
      params.acc = v;
      if (sPi && params.acc > 0.95 * (1 - params.pi0)) { params.pi0 = Math.max(0, +(1 - params.acc / 0.95).toFixed(2)); sPi.set(params.pi0, true); }
      preset.set(null); fire();
    });
    sA.on((v) => { params.a = v; preset.set(null); fire(); });
    if (sPi) sPi.on((v) => {
      params.pi0 = v;
      if (params.acc > 0.95 * (1 - v)) { params.acc = +(0.95 * (1 - v)).toFixed(2); sAcc.set(params.acc, true); }
      preset.set(null); fire();
    });
    return {
      el: box,
      get pop() { return pop; },
      params,
      set(p, presetKey) { setAll(p); preset.set(presetKey || null); fire(); },
    };
  }

  /* "Show data table" toggle in a figure's footer */
  function tableToggle(fig) {
    let foot = fig.querySelector('.fig-foot');
    if (!foot) { foot = h('div', { class: 'fig-foot' }); fig.appendChild(foot); }
    const btn = h('button', { type: 'button', class: 'btn quiet', 'aria-expanded': 'false', text: 'Show data table' });
    const tools = h('div', { class: 'fig-tools' }, btn);
    foot.appendChild(tools);
    const box = h('div', { class: 'fig-tables', hidden: true });
    foot.appendChild(box);
    let data = [];
    function render() {
      box.textContent = '';
      for (const t of data) {
        box.appendChild(h('h6', { text: t.title }));
        const d = h('div');
        root.PlotUtil.dataTable(d, t.cols, t.rows);
        box.appendChild(d);
      }
    }
    btn.addEventListener('click', () => {
      const open = box.hidden;
      box.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Hide data table' : 'Show data table';
      if (open) render();
    });
    return { update(d) { data = d; if (!box.hidden) render(); } };
  }

  function throttle(fn) {
    let pending = false, args = null;
    return function () {
      args = arguments;
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; fn.apply(null, args); });
    };
  }

  function debounce(fn, ms) {
    let t = null;
    return function () {
      const a = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, a), ms);
    };
  }

  // log-spaced grid of real values
  function logGrid(lo, hi, n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(lo * Math.pow(hi / lo, i / (n - 1)));
    return out;
  }

  const pow2 = (lo, hi) => { const o = []; for (let v = lo; v <= hi; v *= 2) o.push(v); return o; };

  root.UI = { h, slider, seg, button, readouts, popControls, POP_PRESETS, fmtA, tableToggle, throttle, debounce, logGrid, pow2 };
  root.Figs = root.Figs || {};
})(window);
