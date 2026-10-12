/* plot.js
   A small SVG plotting helper: linear/log scales, hairline axes, lines, areas,
   dots, labels, a snapping crosshair with tooltip, and a data-table twin.
   Colors come from CSS classes, so charts follow the page theme. */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  let uid = 0;

  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function niceStep(span, count) {
    const raw = span / Math.max(1, count);
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const r = raw / p;
    return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * p;
  }

  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  function pow10Label(e) { return e === 0 ? '1' : e === 1 ? '10' : '10' + String(e).split('').map((c) => SUP[c] || c).join(''); }

  function defaultTickFmt(v, axis) {
    if (axis.type === 'log' && axis.base !== 2) {
      const e = Math.round(Math.log10(v));
      if (Math.abs(v - Math.pow(10, e)) < 1e-9 * Math.pow(10, e)) {
        if (e <= -3 || e >= 5) return pow10Label(e);
      }
    }
    const av = Math.abs(v);
    if (av === 0) return '0';
    if (av >= 1e6) {
      const e = Math.floor(Math.log10(av)), mant = +(v / Math.pow(10, e)).toPrecision(2);
      return (mant === 1 ? '' : mant + '×') + pow10Label(e);
    }
    if (av >= 1000) return Math.round(v).toLocaleString('en-US');
    if (av >= 1) return String(+v.toFixed(2));
    return String(+v.toPrecision(2)).replace(/^0\./, '0.');
  }

  class Plot {
    constructor(container, opts) {
      this.box = container;
      this.box.classList.add('plot-box');
      this.o = Object.assign({ height: 260, margin: { l: 52, r: 20, t: 14, b: 42 } }, opts);
      this.o.margin = Object.assign({ l: 52, r: 20, t: 14, b: 42 }, opts.margin || {});
      this.id = 'p' + (++uid);
      this.svg = svgEl('svg', { class: 'plot', role: 'img', 'aria-label': this.o.aria || '' }, container);
      this.tip = document.createElement('div');
      this.tip.className = 'plot-tip';
      this.tip.hidden = true;
      container.appendChild(this.tip);
      this.draw = null;
      this.table = null;
      this._w = 0;
      if (typeof ResizeObserver !== 'undefined') {
        this.ro = new ResizeObserver(() => {
          const w = Math.round(this.box.clientWidth);
          if (w && w !== this._w) this.render();
        });
        this.ro.observe(container);
      }
    }

    setX(ax) { this.o.x = Object.assign({}, this.o.x, ax); }
    setY(ax) { this.o.y = Object.assign({}, this.o.y, ax); }

    _scale(ax, r0, r1) {
      const [d0, d1] = ax.domain;
      if (ax.type === 'log') {
        const l0 = Math.log(d0), l1 = Math.log(d1);
        const f = (v) => r0 + (Math.log(Math.max(v, 1e-300)) - l0) / (l1 - l0) * (r1 - r0);
        f.inv = (px) => Math.exp(l0 + (px - r0) / (r1 - r0) * (l1 - l0));
        return f;
      }
      const f = (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
      f.inv = (px) => d0 + (px - r0) / (r1 - r0) * (d1 - d0);
      return f;
    }

    _ticks(ax, lengthPx) {
      if (ax.ticks) return ax.ticks;
      const [d0, d1] = ax.domain;
      const lo = Math.min(d0, d1), hi = Math.max(d0, d1);
      if (ax.type === 'log') {
        const base = ax.base || 10;
        const t = [];
        const e0 = Math.ceil(Math.log(lo) / Math.log(base) - 1e-9), e1 = Math.floor(Math.log(hi) / Math.log(base) + 1e-9);
        for (let e = e0; e <= e1; e++) t.push(Math.pow(base, e));
        const maxN = Math.max(2, Math.floor(lengthPx / 38));
        if (t.length > maxN) {
          const stride = Math.ceil(t.length / maxN);
          return t.filter((_, i) => (t.length - 1 - i) % stride === 0);
        }
        if (base === 10 && t.length < 3) {
          const extra = [];
          for (let e = e0 - 1; e <= e1; e++) for (const m of [2, 5]) { const v = m * Math.pow(10, e); if (v >= lo && v <= hi) extra.push(v); }
          return t.concat(extra).sort((a, b) => a - b);
        }
        return t;
      }
      const step = niceStep(hi - lo, Math.max(2, Math.floor(lengthPx / 64)));
      const t = [];
      for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) t.push(Math.abs(v) < step * 1e-9 ? 0 : v);
      return t;
    }

    render() {
      const W = Math.max(260, Math.round(this.box.clientWidth || 600));
      this._w = W;
      const H = this.o.height;
      const m = this.o.margin;
      this.W = W; this.H = H;
      this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      this.svg.setAttribute('width', W);
      this.svg.setAttribute('height', H);
      while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
      this.y0 = H - m.b; this.y1 = m.t;
      // widen the left margin so tick labels never collide with the axis title
      const oy = this.o.y;
      const fy = oy.fmt || ((v) => defaultTickFmt(v, oy));
      let maxChars = 0;
      for (const v of this._ticks(oy, this.y0 - this.y1)) maxChars = Math.max(maxChars, String(fy(v)).length);
      const need = 9 + Math.ceil(maxChars * 6.7) + (oy.label ? 22 : 4);
      this.x0 = Math.min(Math.max(m.l, need), Math.round(W * 0.4)); this.x1 = W - m.r;
      this.x = this._scale(this.o.x, this.x0, this.x1);
      this.y = this._scale(this.o.y, this.y0, this.y1);
      const defs = svgEl('defs', null, this.svg);
      const cp = svgEl('clipPath', { id: this.id + 'c' }, defs);
      svgEl('rect', { x: this.x0, y: this.y1 - 6, width: this.x1 - this.x0, height: this.y0 - this.y1 + 12 }, cp);
      this.gGrid = svgEl('g', { class: 'g-grid' }, this.svg);
      this.gData = svgEl('g', { class: 'g-data', 'clip-path': `url(#${this.id}c)` }, this.svg);
      this.gTop = svgEl('g', { class: 'g-top' }, this.svg);
      this.gOver = svgEl('g', { class: 'g-over' }, this.svg);
      this._axes();
      this.crossSeries = null;
      if (this.draw) this.draw(this);
      this._bindCross();
    }

    _axes() {
      const ox = this.o.x, oy = this.o.y;
      const xt = this._ticks(ox, this.x1 - this.x0), yt = this._ticks(oy, this.y0 - this.y1);
      const fx = ox.fmt || ((v) => defaultTickFmt(v, ox)), fy = oy.fmt || ((v) => defaultTickFmt(v, oy));
      for (const v of yt) {
        const py = this.y(v);
        if (py < this.y1 - 1 || py > this.y0 + 1) continue;
        svgEl('line', { x1: this.x0, x2: this.x1, y1: py, y2: py, class: 'grid' }, this.gGrid);
        const t = svgEl('text', { x: this.x0 - 7, y: py, class: 'tick', 'text-anchor': 'end', 'dominant-baseline': 'middle' }, this.gGrid);
        t.textContent = fy(v);
      }
      for (const v of xt) {
        const px = this.x(v);
        if (px < this.x0 - 1 || px > this.x1 + 1) continue;
        if (ox.grid !== false) svgEl('line', { x1: px, x2: px, y1: this.y1, y2: this.y0, class: 'grid grid-v' }, this.gGrid);
        const t = svgEl('text', { x: px, y: this.y0 + 16, class: 'tick', 'text-anchor': 'middle' }, this.gGrid);
        t.textContent = fx(v);
      }
      svgEl('line', { x1: this.x0, x2: this.x1, y1: this.y0, y2: this.y0, class: 'axis' }, this.gGrid);
      if (ox.label) {
        const t = svgEl('text', { x: (this.x0 + this.x1) / 2, y: this.H - 6, class: 'axis-label', 'text-anchor': 'middle' }, this.gGrid);
        t.textContent = ox.label;
      }
      if (oy.label) {
        const t = svgEl('text', { x: 13, y: (this.y0 + this.y1) / 2, class: 'axis-label', 'text-anchor': 'middle', transform: `rotate(-90 13 ${(this.y0 + this.y1) / 2})` }, this.gGrid);
        t.textContent = oy.label;
      }
    }

    _pathD(pts) {
      let d = '', pen = false;
      for (const [vx, vy] of pts) {
        if (!isFinite(vx) || !isFinite(vy) || (this.o.y.type === 'log' && vy <= 0) || (this.o.x.type === 'log' && vx <= 0)) { pen = false; continue; }
        const px = this.x(vx), py = Math.max(-1e4, Math.min(1e4, this.y(vy)));
        d += (pen ? 'L' : 'M') + px.toFixed(1) + ',' + py.toFixed(1);
        pen = true;
      }
      return d;
    }

    line(pts, cls, attrs) {
      return svgEl('path', Object.assign({ d: this._pathD(pts), class: 'ln ' + (cls || '') }, attrs || {}), this.gData);
    }

    area(top, bottom, cls) {
      const pts = top.filter((p) => isFinite(p[0]) && isFinite(p[1]));
      const bot = bottom ? bottom.filter((p) => isFinite(p[0]) && isFinite(p[1])) : null;
      if (!pts.length) return null;
      let d = this._pathD(pts);
      if (bot) {
        const rev = bot.slice().reverse();
        d += 'L' + this._pathD(rev).slice(1);
      } else {
        const base = this.o.y.type === 'log' ? this.y0 : this.y(Math.max(this.o.y.domain[0], 0));
        d += `L${this.x(pts[pts.length - 1][0]).toFixed(1)},${base}L${this.x(pts[0][0]).toFixed(1)},${base}`;
      }
      return svgEl('path', { d: d + 'Z', class: 'ar ' + (cls || '') }, this.gData);
    }

    dot(vx, vy, r, cls, layer) {
      return svgEl('circle', { cx: this.x(vx), cy: this.y(vy), r: r || 4, class: 'dt ' + (cls || '') }, layer || this.gData);
    }

    rectV(vx0, vy0, vx1, vy1, cls, layer) {
      const x0 = this.x(vx0), x1 = this.x(vx1), y0 = this.y(vy0), y1 = this.y(vy1);
      return svgEl('rect', { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0), class: cls || '' }, layer || this.gData);
    }

    hline(vy, cls, layer) {
      const py = this.y(vy);
      return svgEl('line', { x1: this.x0, x2: this.x1, y1: py, y2: py, class: 'ref ' + (cls || '') }, layer || this.gData);
    }

    vline(vx, cls, layer) {
      const px = this.x(vx);
      return svgEl('line', { x1: px, x2: px, y1: this.y1, y2: this.y0, class: 'ref ' + (cls || '') }, layer || this.gData);
    }

    seg(vx0, vy0, vx1, vy1, cls, layer) {
      return svgEl('line', { x1: this.x(vx0), y1: this.y(vy0), x2: this.x(vx1), y2: this.y(vy1), class: cls || '' }, layer || this.gData);
    }

    text(vx, vy, str, cls, anchor, dx, dy) {
      const t = svgEl('text', { x: this.x(vx) + (dx || 0), y: this.y(vy) + (dy || 0), class: 'lbl ' + (cls || ''), 'text-anchor': anchor || 'start' }, this.gTop);
      t.textContent = str;
      return t;
    }

    textPx(px, py, str, cls, anchor) {
      const t = svgEl('text', { x: px, y: py, class: 'lbl ' + (cls || ''), 'text-anchor': anchor || 'start' }, this.gTop);
      t.textContent = str;
      return t;
    }

    // label placed just past the last visible point of a series (inside the plot)
    endLabel(pts, str, cls, opts) {
      opts = opts || {};
      let last = null;
      for (const p of pts) if (isFinite(p[1]) && (this.o.y.type !== 'log' || p[1] > 0)) last = p;
      if (!last) return null;
      let px = this.x(last[0]), py = this.y(last[1]) + (opts.dy || 0);
      py = Math.max(this.y1 + 10, Math.min(this.y0 - 6, py));
      const anchor = opts.anchor || (px > this.x1 - 90 ? 'end' : 'start');
      const t = svgEl('text', { x: px + (anchor === 'end' ? -6 : 6), y: py - (anchor === 'end' ? 8 : 0), class: 'lbl end-lbl ' + (cls || ''), 'text-anchor': anchor, 'dominant-baseline': 'middle' }, this.gTop);
      t.textContent = str;
      return t;
    }

    // series: [{name, cls, pts}] sharing (roughly) the same x grid
    crosshair(series, opts) {
      this.crossSeries = series;
      this.crossOpts = Object.assign({ xFmt: (v) => Core.fmtNum(v), yFmt: (v) => Core.fmtNum(v), xName: this.o.x.label || 'x' }, opts || {});
    }

    _bindCross() {
      if (!this.crossSeries || !this.crossSeries.length) { this.tip.hidden = true; return; }
      const self = this;
      const hit = svgEl('rect', { x: this.x0, y: this.y1, width: this.x1 - this.x0, height: this.y0 - this.y1, class: 'hit', tabindex: 0, role: 'presentation' }, this.gOver);
      hit.setAttribute('aria-label', 'Chart readout: use left and right arrow keys');
      const vl = svgEl('line', { y1: this.y1, y2: this.y0, class: 'cross', visibility: 'hidden' }, this.gOver);
      const dots = this.crossSeries.map((s) => svgEl('circle', { r: 4.5, class: 'cross-dot ' + (s.cls || ''), visibility: 'hidden' }, this.gOver));
      const base = this.crossSeries[0].pts.filter((p) => isFinite(p[0]));
      let idx = -1;
      function show(i) {
        if (i < 0 || i >= base.length) return;
        idx = i;
        const vx = base[i][0];
        const px = self.x(vx);
        vl.setAttribute('x1', px); vl.setAttribute('x2', px); vl.setAttribute('visibility', 'visible');
        const tip = self.tip;
        tip.textContent = '';
        const head = document.createElement('div');
        head.className = 'tip-head';
        head.textContent = self.crossOpts.xName + ' = ' + self.crossOpts.xFmt(vx);
        tip.appendChild(head);
        self.crossSeries.forEach((s, si) => {
          let best = null, bd = Infinity;
          for (const p of s.pts) { const dd = Math.abs(p[0] - vx); if (dd < bd) { bd = dd; best = p; } }
          const ok = best && Math.abs(self.x(best[0]) - px) < 10 && isFinite(best[1]) && (self.o.y.type !== 'log' || best[1] > 0);
          if (ok) {
            const py = self.y(best[1]);
            const inside = py >= self.y1 - 2 && py <= self.y0 + 2;
            dots[si].setAttribute('cx', self.x(best[0])); dots[si].setAttribute('cy', py);
            dots[si].setAttribute('visibility', inside ? 'visible' : 'hidden');
          } else dots[si].setAttribute('visibility', 'hidden');
          const row = document.createElement('div');
          row.className = 'tip-row';
          const key = document.createElement('span');
          key.className = 'tip-key ' + (s.cls || '');
          const val = document.createElement('strong');
          val.textContent = ok ? (s.fmt || self.crossOpts.yFmt)(best[1]) : '–';
          const nm = document.createElement('span');
          nm.className = 'tip-name';
          nm.textContent = s.name;
          row.appendChild(key); row.appendChild(val); row.appendChild(nm);
          tip.appendChild(row);
        });
        tip.hidden = false;
        const bw = self.box.clientWidth;
        const tw = tip.offsetWidth || 160;
        let left = px + 14;
        if (left + tw > bw - 4) left = px - tw - 14;
        tip.style.left = Math.max(4, left) + 'px';
        tip.style.top = Math.max(4, self.y1) + 'px';
      }
      function hide() {
        vl.setAttribute('visibility', 'hidden');
        dots.forEach((d) => d.setAttribute('visibility', 'hidden'));
        self.tip.hidden = true;
      }
      function nearest(px) {
        const vx = self.x.inv(px);
        let bi = 0, bd = Infinity;
        for (let i = 0; i < base.length; i++) {
          const d = Math.abs(self.x(base[i][0]) - self.x(vx));
          if (d < bd) { bd = d; bi = i; }
        }
        return bi;
      }
      hit.addEventListener('pointermove', (e) => {
        const r = self.svg.getBoundingClientRect();
        const px = (e.clientX - r.left) * (self.W / r.width);
        show(nearest(px));
      });
      hit.addEventListener('pointerleave', hide);
      hit.addEventListener('focus', () => show(idx < 0 ? Math.floor(base.length / 2) : idx));
      hit.addEventListener('blur', hide);
      hit.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { show(Math.min(base.length - 1, idx + 1)); e.preventDefault(); }
        if (e.key === 'ArrowLeft') { show(Math.max(0, idx - 1)); e.preventDefault(); }
        if (e.key === 'Escape') { hide(); hit.blur(); }
      });
    }
  }

  // Legend: items [{name, cls, kind: 'line'|'dash'|'rect'|'dot'}]
  function legend(el, items) {
    el.textContent = '';
    el.classList.add('legend');
    for (const it of items) {
      const s = document.createElement('span');
      s.className = 'lg-item';
      const k = document.createElement('span');
      k.className = 'lg-key lg-' + (it.kind || 'line') + ' ' + (it.cls || '');
      const t = document.createElement('span');
      t.textContent = it.name;
      s.appendChild(k); s.appendChild(t);
      el.appendChild(s);
    }
  }

  // Data-table twin: cols [names], rows [[...]]
  function dataTable(el, cols, rows) {
    el.textContent = '';
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const t = document.createElement('table');
    t.className = 'data';
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    for (const c of cols) { const th = document.createElement('th'); th.textContent = c; hr.appendChild(th); }
    thead.appendChild(hr);
    t.appendChild(thead);
    const tb = document.createElement('tbody');
    for (const r of rows) {
      const tr = document.createElement('tr');
      for (const v of r) { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); }
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    wrap.appendChild(t);
    el.appendChild(wrap);
  }

  root.Plot = Plot;
  root.PlotUtil = { svgEl, legend, dataTable, niceStep, pow10Label };
})(window);
