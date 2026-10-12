/* fig-buy.js — figures for Part II (what verification can buy):
   Figure 4 protocols, 5 shape, 6 pipeline, 7 regimes, 8 lineup, 9 re-review, 10 team size. */
(function (root) {
  'use strict';
  const C = root.Core, U = root.UI, h = U.h, Figs = root.Figs;
  const svgEl = root.PlotUtil.svgEl;
  const fmt = C.fmtNum, pct = C.fmtPct;

  /* ================================================================== */
  /* Figure 4: every protocol under one line                             */
  /* ================================================================== */
  Figs.protocols = function (body, fig) {
    let k = 5, p = 0, seed = 11;
    const pc = U.popControls(body, 'pr', U.POP_PRESETS.one, () => render(), { presets: ['hom', 'div', 'one', 'cor', 'aon'], preset: 'one', noPi: true });
    const ctl = h('div', { class: 'controls' });
    body.appendChild(ctl);
    U.slider(ctl, { id: 'pr-k', label: 'Judgements per component <i>k</i>', min: 1, max: 8, step: 1, int: true, value: k, fmt: String }).on((v) => { k = v; render(); });
    U.slider(ctl, { id: 'pr-p', label: 'Agents’ false-alarm rate <i>p</i>', min: 0, max: 0.3, step: 0.01, value: p, fmt: (v) => v.toFixed(2) }).on((v) => { p = v; render(); });
    const tl = h('div', { class: 'fig-tools' });
    ctl.appendChild(tl);
    U.button(tl, 'New random protocols', () => { seed++; render(); }, '', 'pr-rand');

    const row = h('div', { class: 'row-side' });
    body.appendChild(row);
    const L = h('div'), R = h('div', { style: 'display:grid;gap:12px;align-content:start' });
    row.appendChild(L); row.appendChild(R);
    const box = h('div');
    L.appendChild(box);
    const leg = h('div', { class: 'legend' });
    L.appendChild(leg);
    root.PlotUtil.legend(leg, [
      { name: 'unreachable: δ − φ > 1 − M(k)', cls: 'c-pen', kind: 'wash' },
      { name: 'best possible (Neyman–Pearson)', cls: 's1', kind: 'line' },
      { name: 'named protocols', cls: 'c-ink', kind: 'dot' },
      { name: 'random protocols', cls: 'c-muted', kind: 'dot' },
    ]);
    const plot = new root.Plot(box, {
      height: 360, margin: { l: 50, r: 16, t: 10, b: 42 },
      x: { type: 'lin', domain: [0, 1], label: 'false-alarm rate φ (flags clean work)' },
      y: { type: 'lin', domain: [0, 1], label: 'detection rate δ' },
    });
    const ro = U.readouts(R, [
      { id: 'bound', label: 'Ceiling 1 − <i>M</i>(<i>k</i>)', key: true },
      { id: 'np', label: 'Best possible δ − φ' },
      { id: 'or', label: '“Any flag” δ − φ' },
      { id: 'maj', label: 'Majority δ − φ' },
      { id: 'esc', label: 'Escalation δ − φ' },
      { id: 'deb', label: 'Debate δ − φ' },
      { id: 'rnd', label: 'Best of 300 random rules' },
    ]);
    const status = h('div', { class: 'status ok' });
    R.appendChild(status);
    R.appendChild(h('p', { class: 'say', html: '<b>Escalation</b>: ask one agent; if it passes, stop; if it flags, ask the rest and follow their majority. <b>Debate</b>: after the first round each agent switches to the majority view with probability ½; the final vote decides. Both use at most <i>k</i> judgements.' }));
    const tbl = U.tableToggle(fig);

    function render() {
      const pop = pc.pop;
      const S = C.protocolSetup(pop, k, p);
      const B = S.bound;
      const named = [
        { name: 'Any flag', f: C.thresholdRule(k, 1) },
        { name: 'Majority', f: C.thresholdRule(k, Math.floor(k / 2) + 1) },
        { name: 'Unanimous', f: C.thresholdRule(k, k) },
        { name: 'Escalation', f: C.escalationRule(k) },
        { name: 'Debate', f: C.debateRule(k, 0.5) },
      ].map((o) => Object.assign(o, C.protocolPoint(S, o.f)));
      const rng = C.mulberry32(seed * 104729);
      const rand = [];
      for (let i = 0; i < 300; i++) {
        const f = new Float64Array(k + 1);
        const mode = rng();
        for (let c = 0; c <= k; c++) {
          const r = rng();
          f[c] = mode < 0.5 ? (r < 0.5 ? 0 : 1) : r;
        }
        rand.push(C.protocolPoint(S, f));
      }
      const front = C.npFrontier(S);
      let npBest = 0;
      front.forEach((q) => { npBest = Math.max(npBest, q.delta - q.phi); });
      let rBest = -1;
      rand.forEach((q) => { rBest = Math.max(rBest, q.delta - q.phi); });

      plot.draw = (pl) => {
        pl.area([[0, 1], [1 - B, 1]], [[0, B], [1 - B, 1]], 'c-pen');
        pl.seg(0, 0, 1, 1, 'ref');
        pl.text(0.86, 0.86, 'chance', 'small', 'start', 6, 10);
        rand.forEach((q) => { const c = pl.dot(q.phi, q.delta, 2.2, 'c-muted'); c.setAttribute('fill-opacity', '0.55'); c.setAttribute('stroke-width', '0'); });
        pl.line(front.map((q) => [q.phi, q.delta]), 's1');
        pl.seg(0, B, 1 - B, 1, 'ln c-pen');
        pl.text(0.015, 1, 'unreachable', 'pen small', 'start', 4, 14);
        const placed = [];
        named.slice().sort((a, b) => b.delta - a.delta).forEach((q) => {
          pl.dot(q.phi, q.delta, 5, 'c-ink');
          let px = pl.x(q.phi) + 9, py = pl.y(q.delta) + 4;
          for (const o of placed) if (Math.abs(o.px - px) < 70 && Math.abs(o.py - py) < 13) py = o.py + 13;
          placed.push({ px, py });
          pl.textPx(Math.min(px, pl.x1 - 4), py, q.name, 'strong', px > pl.x1 - 70 ? 'end' : 'start');
        });
      };
      plot.render();

      ro.set('bound', B.toFixed(3));
      ro.set('np', npBest.toFixed(3));
      const adv = (i) => (named[i].delta - named[i].phi).toFixed(3);
      ro.set('or', adv(0));
      ro.set('maj', adv(1));
      ro.set('esc', adv(3));
      ro.set('deb', adv(4));
      ro.set('rnd', rBest.toFixed(3));
      const worst = Math.max(npBest, rBest, ...named.map((q) => q.delta - q.phi));
      const ok = worst <= B + 1e-9;
      status.className = 'status ' + (ok ? 'ok' : 'bad');
      status.textContent = '';
      status.appendChild(h('span', { class: 'ic', text: ok ? '✓' : '✗' }));
      status.appendChild(h('span', { text: ok
        ? (p === 0 ? '"Any flag" sits exactly on the ceiling: sound agents, equality case of Theorem 4.1.' : 'Nothing crosses the line. False alarms keep every protocol strictly below it.')
        : 'Numerical issue: a protocol exceeded the bound.' }));
      tbl.update([{ title: 'Named protocols', cols: ['protocol', 'φ', 'δ', 'δ − φ'], rows: named.map((q) => [q.name, q.phi.toFixed(4), q.delta.toFixed(4), (q.delta - q.phi).toFixed(4)]) }]);
    }
    render();
  };

  /* ================================================================== */
  /* Figure 5: can this be a miss curve?                                 */
  /* ================================================================== */
  Figs.shape = function (body, fig) {
    const KMAX = 6;
    const curves = {
      uniform: [1, 1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 6, 1 / 7],
      blind: [0, 1, 2, 3, 4, 5, 6].map((k) => (k === 0 ? 1 : 0.3 + 0.7 / (k + 1))),
      line: [1, 0.85, 0.7, 0.55, 0.4, 0.25, 0.1],
      cliff: [1, 0.9, 0.85, 0.8, 0.5, 0.4, 0.35],
    };
    let M = curves.uniform.slice();
    let drag = -1, focusIdx = -1;
    const ctl = h('div', { class: 'controls' });
    body.appendChild(ctl);
    const pre = U.seg(ctl, {
      idPrefix: 'sh-pre', label: 'Load', value: 'uniform',
      items: [{ id: 'uniform', label: 'Uniform Δ (valid)' }, { id: 'blind', label: 'With blind spot (valid)' }, { id: 'line', label: 'Straight line' }, { id: 'cliff', label: 'Late cliff' }],
      onChange: (v) => { M = curves[v].slice(); render(); },
    });
    pre.el.style.gridColumn = '1 / -1';

    const row = h('div', { class: 'row2' });
    body.appendChild(row);
    const L = h('div'), R = h('div', { style: 'display:grid;gap:10px;align-content:start' });
    row.appendChild(L); row.appendChild(R);
    L.appendChild(h('p', { class: 'panel-title', text: 'Drag the points (or focus one and use ↑ ↓)' }));
    const box = h('div');
    L.appendChild(box);
    L.appendChild(h('p', { class: 'panel-title', text: 'Marginal catch of each new agent, M(k−1) − M(k)' }));
    L.appendChild(h('p', { class: 'panel-sub', text: 'Must never increase. A red bar is taller than the one before it.' }));
    const gbox = h('div');
    L.appendChild(gbox);
    R.appendChild(h('p', { class: 'panel-title', text: 'Alternating sums Σᵢ (−1)ⁱ C(j,i) M(k+i)' }));
    R.appendChild(h('p', { class: 'panel-sub', text: 'Row j, column k: the chance that k given agents miss and j other given agents all catch the same defect. Red cells are negative.' }));
    const tableBox = h('div', { class: 'hausdorff' });
    R.appendChild(tableBox);
    const checks = h('div', { style: 'display:grid;gap:8px' });
    R.appendChild(checks);

    const plot = new root.Plot(box, { height: 250, margin: { l: 46, r: 16, t: 12, b: 40 }, x: { type: 'lin', domain: [-0.3, 6.4], label: 'team size k', ticks: [0, 1, 2, 3, 4, 5, 6] }, y: { type: 'lin', domain: [0, 1.05], label: 'M(k)' } });
    const gplot = new root.Plot(gbox, { height: 150, margin: { l: 46, r: 16, t: 8, b: 36 }, x: { type: 'lin', domain: [0.4, 6.6], label: 'k', ticks: [1, 2, 3, 4, 5, 6] }, y: { type: 'lin', domain: [0, 0.6], label: 'gain' } });

    function onMove(e) {
      if (drag < 0) return;
      const r = plot.svg.getBoundingClientRect();
      const py = (e.clientY - r.top) * (plot.H / r.height);
      M[drag] = Math.max(0, Math.min(1, Math.round(plot.y.inv(py) * 1000) / 1000));
      pre.set(null);
      render();
    }
    function onUp() { drag = -1; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); render(); }

    function exactFeasible() {
      // Bernstein coefficients of degree 6: probabilities that exactly j of 6 agents miss
      const b = [];
      for (let j = 0; j <= KMAX; j++) b.push(C.choose(KMAX, j) * C.altDiff(M, j, KMAX - j));
      if (b.some((x) => x < -1e-12)) return { ok: false, why: 'b' };
      const grid = [];
      for (let i = 0; i <= 800; i++) grid.push(i / 800);
      const A = [];
      for (let j = 0; j <= KMAX; j++) A.push(Float64Array.from(grid.map((u) => C.bernsteinRow(KMAX, j, u))));
      const res = C.lpSolve(A, b.map((x) => Math.max(0, x)), grid.map(() => 0), false);
      if (res.status !== 'optimal') return { ok: false, why: 'lp' };
      let atoms = 0;
      res.x.forEach((v) => { if (v > 1e-9) atoms++; });
      return { ok: true, atoms };
    }

    function render() {
      plot.draw = (pl) => {
        const pts = M.map((v, k) => [k, v]);
        pl.line(pts, 's1');
        pl.dot(0, 1, 5, 'c-muted');
        for (let k = 1; k <= KMAX; k++) {
          const hit = svgEl('circle', { cx: pl.x(k), cy: pl.y(M[k]), r: 16, class: 'handle-hit' }, pl.gOver);
          const hd = svgEl('circle', { cx: pl.x(k), cy: pl.y(M[k]), r: 7, class: 'handle' + (drag === k ? ' drag' : ''), tabindex: 0, role: 'slider', 'aria-label': `M(${k})`, 'aria-valuemin': 0, 'aria-valuemax': 1, 'aria-valuenow': M[k].toFixed(3) }, pl.gOver);
          const start = (e) => { drag = k; e.preventDefault(); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); };
          hit.addEventListener('pointerdown', start);
          hd.addEventListener('pointerdown', start);
          hd.addEventListener('focus', () => { focusIdx = k; });
          hd.addEventListener('keydown', (e) => {
            const step = e.shiftKey ? 0.05 : 0.01;
            if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { M[k] = Math.min(1, +(M[k] + step).toFixed(3)); pre.set(null); render(); e.preventDefault(); }
            if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { M[k] = Math.max(0, +(M[k] - step).toFixed(3)); pre.set(null); render(); e.preventDefault(); }
          });
          pl.text(k, M[k], M[k].toFixed(2), 'small', 'middle', 0, -12);
        }
      };
      plot.render();
      if (focusIdx > 0) {
        const el = plot.svg.querySelectorAll('.handle')[focusIdx - 1];
        if (el && document.activeElement !== el && drag < 0) el.focus({ preventScroll: true });
      }

      gplot.draw = (pl) => {
        for (let k = 1; k <= KMAX; k++) {
          const g = M[k - 1] - M[k];
          const bad = k > 1 && g > M[k - 2] - M[k - 1] + 1e-12;
          pl.rectV(k - 0.28, 0, k + 0.28, Math.max(0, g), 'bar ' + (bad || g < 0 ? 'c-pen' : 's1'));
          if (g < 0) pl.text(k, 0, 'negative', 'pen small', 'middle', 0, -6);
        }
      };
      let gmax = 0.1;
      for (let k = 1; k <= KMAX; k++) gmax = Math.max(gmax, M[k - 1] - M[k]);
      gplot.setY({ domain: [0, Math.min(1, gmax * 1.2)] });
      gplot.render();

      // table of alternating sums
      tableBox.textContent = '';
      const t = h('table');
      const hr = h('tr', null, h('th', { text: 'j \\ k' }));
      for (let k = 0; k <= KMAX; k++) hr.appendChild(h('th', { text: String(k) }));
      t.appendChild(hr);
      let firstNeg = null;
      for (let j = 0; j <= KMAX; j++) {
        const tr = h('tr', null, h('th', { text: String(j) }));
        for (let k = 0; k <= KMAX; k++) {
          if (k + j > KMAX) { tr.appendChild(h('td', { class: 'na', text: '·' })); continue; }
          const v = C.altDiff(M, k, j);
          const neg = v < -1e-9;
          if (neg && !firstNeg) firstNeg = { j, k, v };
          tr.appendChild(h('td', { class: neg ? 'neg' : '', text: (neg ? '✗ ' : '') + v.toFixed(3) }));
        }
        t.appendChild(tr);
      }
      tableBox.appendChild(t);

      let lcBad = null;
      for (let k = 1; k < KMAX; k++) if (M[k] * M[k] > M[k - 1] * M[k + 1] + 1e-12) { lcBad = k; break; }
      const ex = exactFeasible();
      checks.textContent = '';
      const line = (ok, text) => checks.appendChild(h('div', { class: 'status ' + (ok ? 'ok' : 'bad') }, h('span', { class: 'ic', text: ok ? '✓' : '✗' }), h('span', { text })));
      line(!firstNeg, firstNeg
        ? `Not completely monotone: row j = ${firstNeg.j}, column k = ${firstNeg.k} is ${firstNeg.v.toFixed(3)}, a negative probability.`
        : 'Completely monotone: every alternating sum is ≥ 0.');
      line(lcBad === null, lcBad === null
        ? 'Log-convex: M(k)² ≤ M(k−1)·M(k+1) everywhere.'
        : `Not log-convex at k = ${lcBad}: M(${lcBad})² = ${(M[lcBad] ** 2).toFixed(3)} > M(${lcBad - 1})·M(${lcBad + 1}) = ${(M[lcBad - 1] * M[lcBad + 1]).toFixed(3)}.`);
      line(ex.ok, ex.ok
        ? `Exact test passed: a population with these six values exists (the solver found one with ${ex.atoms} visibility levels).`
        : 'Exact test failed: no population of any shape produces exactly these values.');
    }
    render();
  };

  /* ================================================================== */
  /* Figure 6: pipeline simulator and the horizon law                    */
  /* ================================================================== */
  Figs.pipeline = function (body, fig) {
    let k = 8, beta = 0.05, eps = 0.1, phibar = 0, runId = 0;
    const DEPTH_ANIM = 30;
    const pc = U.popControls(body, 'pl', U.POP_PRESETS.div, () => schedule(), { preset: 'div', presets: ['div', 'one', 'cor', 'bs', 'hom'] });
    const ctl = h('div', { class: 'controls' });
    body.appendChild(ctl);
    U.slider(ctl, { id: 'pl-k', label: 'Team size <i>k</i>', scale: 'log', min: 1, max: 64, int: true, value: k, fmt: String }).on((v) => { k = v; schedule(); });
    U.slider(ctl, { id: 'pl-b', label: 'Defect rate per stage β', min: 0.01, max: 0.5, step: 0.01, value: beta, fmt: (v) => v.toFixed(2) }).on((v) => { beta = v; schedule(); });
    U.slider(ctl, { id: 'pl-e', label: 'Risk budget ε', min: 0.01, max: 0.3, step: 0.01, value: eps, fmt: (v) => v.toFixed(2) }).on((v) => { eps = v; schedule(); });
    U.slider(ctl, { id: 'pl-f', label: 'False-alarm budget <span style="text-decoration:overline">φ</span>', min: 0, max: 0.2, step: 0.001, value: phibar, fmt: (v) => v.toFixed(3) }).on((v) => { phibar = v; schedule(); });

    // one pipeline, animated
    const one = h('div', { style: 'display:grid;gap:8px' });
    body.appendChild(one);
    const oneHead = h('div', { class: 'fig-tools' });
    one.appendChild(oneHead);
    oneHead.appendChild(h('span', { class: 'panel-title', text: 'One pipeline, 30 stages' }));
    const runBtn = U.button(oneHead, 'Run one pipeline', () => animate(), 'primary', 'pl-run');
    const strip = h('div', { class: 'pipe', role: 'img', 'aria-label': 'Animated pipeline stages' });
    one.appendChild(strip);
    const verdict = h('div', { class: 'pipe-verdict', 'aria-live': 'polite' });
    one.appendChild(verdict);
    const stages = [];
    for (let s = 0; s < DEPTH_ANIM; s++) {
      const el = h('div', { class: 'stg clean' }, h('span', { class: 'n', text: String(s + 1) }), h('span', { class: 'mk', text: '' }), h('span', { class: 'eyes' }));
      strip.appendChild(el);
      stages.push(el);
    }

    const row = h('div', { class: 'row-side' });
    body.appendChild(row);
    const L = h('div'), R = h('div', { style: 'display:grid;gap:10px;align-content:start' });
    row.appendChild(L); row.appendChild(R);
    L.appendChild(h('p', { class: 'panel-title', text: 'Share of 3,000 pipelines still clean at each depth' }));
    const box = h('div');
    L.appendChild(box);
    const leg = h('div', { class: 'legend' });
    L.appendChild(leg);
    root.PlotUtil.legend(leg, [
      { name: 'simulated', cls: 's1', kind: 'dot' },
      { name: 'Theorem 4.3: (1 − βM(k))ⁿ', cls: 's1', kind: 'line' },
      { name: 'ceiling with false-alarm budget φ̄', cls: 's2', kind: 'dash' },
      { name: '1 − ε', cls: 'c-pen', kind: 'dash' },
    ]);
    const plot = new root.Plot(box, { height: 270, margin: { l: 46, r: 16, t: 10, b: 40 }, x: { type: 'lin', domain: [0, 50], label: 'pipeline depth n' }, y: { type: 'lin', domain: [0, 1], label: 'share clean', fmt: (v) => Math.round(v * 100) + '%' } });
    const ro = U.readouts(R, [
      { id: 'm', label: 'Miss rate <i>M</i>(<i>k</i>)' },
      { id: 'leak', label: 'Leak per stage β<i>M</i>(<i>k</i>)' },
      { id: 'n', label: 'Horizon <i>n</i>*(ε), exact', key: true },
      { id: 'approx', label: 'First-order ε/(β<i>M</i>(<i>k</i>))' },
      { id: 'sim', label: 'Simulated depth at 1 − ε' },
      { id: 'cap', label: 'Ceiling for any protocol with false alarms ≤ <span style="text-decoration:overline">φ</span>' },
    ]);
    const say = h('p', { class: 'say' });
    R.appendChild(say);
    const tbl = U.tableToggle(fig);

    let pending = null;
    function schedule() { if (pending) return; pending = requestAnimationFrame(() => { pending = null; simulate(); }); }

    function simulate() {
      const pop = pc.pop;
      const Mk = pop.M(k);
      const nstar = C.nStar(Mk, beta, eps, 0);
      const ncap = C.nStar(Mk, beta, eps, phibar);
      const depth = Math.max(20, Math.min(1500, Math.ceil((isFinite(nstar) ? nstar : 500) * 2.6)));
      const surv = C.simulatePipelines(pop, k, beta, depth, 3000, C.mulberry32(97 + k * 31));
      let simCross = null;
      for (let n = 1; n <= depth; n++) if (surv[n] < 1 - eps) { simCross = n - 1; break; }
      plot.setX({ domain: [0, depth] });
      plot.draw = (pl) => {
        const step = Math.max(1, Math.ceil(depth / 70));
        const sim = [];
        for (let n = 0; n <= depth; n += step) sim.push([n, surv[n]]);
        const th = [];
        for (let i = 0; i <= 200; i++) { const n = depth * i / 200; th.push([n, Math.pow(1 - beta * Mk, n)]); }
        const cap = th.map(([n]) => [n, phibar >= Mk ? 1 : Math.pow(1 - beta * (Mk - phibar), n)]);
        pl.hline(1 - eps, 'pen');
        pl.text(depth, 1 - eps, '1 − ε', 'pen small', 'end', -4, -6);
        if (phibar > 0) pl.line(cap, 's2 dash');
        pl.line(th, 's1');
        sim.forEach(([n, v]) => pl.dot(n, v, 3, 's1'));
        if (isFinite(nstar) && nstar <= depth) {
          pl.vline(nstar, '');
          pl.text(nstar, 0.05, 'n* = ' + fmt(nstar), 'strong', 'start', 6, 0);
        }
        pl.crosshair([{ name: 'theory', cls: 's1', pts: th }, { name: 'simulated', cls: 's1', pts: sim }], { xName: 'depth n', xFmt: (v) => String(Math.round(v)), yFmt: (v) => pct(v) });
      };
      plot.render();
      ro.set('m', fmt(Mk));
      ro.set('leak', fmt(beta * Mk));
      ro.set('n', fmt(nstar), 'stages');
      ro.set('approx', fmt(eps / (beta * Mk)));
      ro.set('sim', simCross === null ? '> ' + depth : String(simCross));
      ro.set('cap', phibar >= Mk ? 'none' : fmt(ncap), phibar >= Mk ? '(φ̄ ≥ M(k): vacuous)' : 'stages');
      say.textContent = '';
      say.appendChild(h('b', { text: 'Reading: ' }));
      say.appendChild(document.createTextNode(phibar >= Mk
        ? `the false-alarm budget φ̄ = ${phibar.toFixed(3)} is at least the miss rate M(${k}) = ${fmt(Mk)}, so Theorem 4.3 no longer limits anything. This is the caveat of Corollary 4.4.`
        : `each stage leaks a defect with probability ${fmt(beta * Mk)}, so about 1 pipeline in ${fmt(1 / (beta * Mk))} stages picks up a permanent defect. With a ${pct(eps)} risk budget the safe depth is about ${fmt(nstar)} stages.`));
      const rows = [];
      for (const n of [1, 5, 10, 20, 50, 100, 200, 500, 1000]) if (n <= depth) rows.push([String(n), pct(surv[n], 1), pct(Math.pow(1 - beta * Mk, n), 1)]);
      tbl.update([{ title: 'Share clean by depth', cols: ['depth n', 'simulated', 'theory'], rows }]);
    }

    function animate(instant) {
      const id = ++runId;
      const pop = pc.pop;
      const rng = C.mulberry32((Date.now() & 0xffff) + id);
      let s = 0, leaked = 0, caught = 0;
      stages.forEach((el) => { el.className = 'stg clean'; el.querySelector('.mk').textContent = ''; el.querySelector('.eyes').textContent = ''; });
      verdict.textContent = 'Running…';
      runBtn.disabled = true;
      const reduce = instant === true || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      function step() {
        if (id !== runId) return;
        if (s >= DEPTH_ANIM) {
          verdict.textContent = leaked === 0
            ? `Final artifact clean ✓. ${caught} defect${caught === 1 ? ' was' : 's were'} caught and repaired.`
            : `Final artifact defective ✗. ${leaked} defect${leaked === 1 ? '' : 's'} slipped past every reviewer and stayed to the end.`;
          runBtn.disabled = false;
          return;
        }
        const el = stages[s];
        el.classList.add('cur');
        const eyes = el.querySelector('.eyes');
        eyes.textContent = '';
        if (rng() < beta) {
          const d = pop.sampleDelta(rng);
          let any = false;
          for (let a = 0; a < k; a++) {
            const fl = rng() < d;
            any = any || fl;
            if (a < 8) { const e = h('i'); if (fl) e.className = 'fl'; eyes.appendChild(e); }
          }
          if (any) { el.className = 'stg fixed cur'; el.querySelector('.mk').textContent = '✓'; caught++; }
          else { el.className = 'stg bug cur'; el.querySelector('.mk').textContent = '✗'; leaked++; }
          el.title = `Stage ${s + 1}: defect with visibility Δ = ${d.toFixed(2)}, ${any ? 'flagged and repaired' : 'missed by all ' + k + ' agents'}`;
        } else {
          el.querySelector('.mk').textContent = '·';
          el.title = `Stage ${s + 1}: no defect`;
        }
        const prev = el;
        s++;
        if (reduce) { prev.classList.remove('cur'); step(); return; }
        setTimeout(() => prev.classList.remove('cur'), 180);
        setTimeout(step, 140);
      }
      step();
    }
    simulate();
    animate(true);
  };

  /* helper: smallest real k with M(k) <= target (bisection on log k) */
  function kForMiss(pop, target, kmax) {
    kmax = kmax || 1e7;
    if (pop.M(1) <= target) return 1;
    if (pop.M(kmax) > target) return Infinity;
    let lo = 0, hi = Math.log(kmax);
    for (let i = 0; i < 48; i++) {
      const mid = 0.5 * (lo + hi);
      if (pop.M(Math.exp(mid)) > target) lo = mid; else hi = mid;
    }
    return Math.exp(hi);
  }

  /* ================================================================== */
  /* Figure 7: regimes — detection saturates, horizon may accelerate     */
  /* ================================================================== */
  Figs.regimes = function (body, fig) {
    let beta = 0.1, eps = 0.05;
    const pc = U.popControls(body, 'rg', U.POP_PRESETS.div, () => render(), { preset: 'div', presets: ['div', 'one', 'cor', 'bs', 'hom'] });
    const ctl = h('div', { class: 'controls' });
    body.appendChild(ctl);
    U.slider(ctl, { id: 'rg-b', label: 'Defect rate per stage β', min: 0.01, max: 0.5, step: 0.01, value: beta, fmt: (v) => v.toFixed(2) }).on((v) => { beta = v; render(); });
    U.slider(ctl, { id: 'rg-e', label: 'Risk budget ε', min: 0.01, max: 0.3, step: 0.01, value: eps, fmt: (v) => v.toFixed(2) }).on((v) => { eps = v; render(); });

    const mk = (parent, title, sub) => {
      const d = h('div');
      d.appendChild(h('p', { class: 'panel-title', text: title }));
      if (sub) d.appendChild(h('p', { class: 'panel-sub', text: sub }));
      const b = h('div');
      d.appendChild(b);
      parent.appendChild(d);
      return b;
    };
    const r1 = h('div', { class: 'row2' }), r2 = h('div', { class: 'row2' });
    body.appendChild(r1); body.appendChild(r2);
    const bDet = mk(r1, 'Detection 1 − M(k): always concave', 'Each agent adds less detection than the last (Proposition 4.2).');
    const bHor = mk(r1, 'Horizon n*(k): convex iff a > 1', 'The same data, read as safe pipeline depth.');
    const bLog = mk(r2, 'Horizon on log–log axes', 'Slope a for power tails; flat ceiling if π₀ > 0.');
    const bJ = mk(r2, 'Total judgements J(n) to reach depth n', 'Grows like n^(1+1/a): super-linear.');
    const leg = h('div', { class: 'legend' });
    body.appendChild(leg);
    root.PlotUtil.legend(leg, [{ name: 'your population', cls: 's1', kind: 'line' }, { name: 'same accuracy, a = 0.5 / 1 / 2', cls: 'c-ctx', kind: 'line' }, { name: 'blind-spot ceiling', cls: 'c-pen', kind: 'dash' }]);
    const ro = U.readouts(body, [
      { id: 'n8', label: 'Horizon with 8 agents' },
      { id: 'n64', label: 'Horizon with 64 agents' },
      { id: 'd8', label: 'Extra depth bought by agent #8' },
      { id: 'd64', label: 'Extra depth bought by agent #64', key: true },
      { id: 'cap', label: 'Ceiling ε/(βπ<sub>0</sub>)' },
      { id: 'j', label: 'Judgements for depth 100' },
    ]);
    const say = h('p', { class: 'say' });
    body.appendChild(say);
    const tbl = U.tableToggle(fig);

    const pDet = new root.Plot(bDet, { height: 200, margin: { l: 44, r: 12, t: 8, b: 38 }, x: { type: 'lin', domain: [1, 64], label: 'team size k' }, y: { type: 'lin', domain: [0, 1], label: 'detection', fmt: (v) => Math.round(v * 100) + '%' } });
    const pHor = new root.Plot(bHor, { height: 200, margin: { l: 50, r: 12, t: 8, b: 38 }, x: { type: 'lin', domain: [1, 64], label: 'team size k' }, y: { type: 'lin', domain: [0, 100], label: 'n* (stages)' } });
    const pLog = new root.Plot(bLog, { height: 210, margin: { l: 50, r: 12, t: 8, b: 38 }, x: { type: 'log', base: 2, domain: [1, 1024], label: 'team size k' }, y: { type: 'log', domain: [1, 1e6], label: 'n*' } });
    const pJ = new root.Plot(bJ, { height: 210, margin: { l: 50, r: 12, t: 8, b: 38 }, x: { type: 'log', domain: [1, 2000], label: 'target depth n' }, y: { type: 'log', domain: [1, 1e9], label: 'J(n)' } });

    function render() {
      const pop = pc.pop;
      const refs = [0.5, 1, 2].map((a) => ({ a, pop: C.makePop({ acc: pop.acc, a, pi0: 0 }) }));
      const ns = (P, kk) => C.nStar(P.M(kk), beta, eps, 0);
      const kLin = [];
      for (let kk = 1; kk <= 64; kk++) kLin.push(kk);
      const userDet = kLin.map((kk) => [kk, 1 - pop.M(kk)]);
      const userHor = kLin.map((kk) => [kk, ns(pop, kk)]);
      const cap = pop.blind > 0 ? C.nStar(pop.blind, beta, eps, 0) : Infinity;

      pDet.draw = (pl) => {
        refs.forEach((r) => {
          const pts = kLin.map((kk) => [kk, 1 - r.pop.M(kk)]);
          pl.line(pts, 'ctx');
        });
        pl.line(userDet, 's1');
        pl.crosshair([{ name: 'detection', cls: 's1', pts: userDet }], { xName: 'k', xFmt: (v) => String(Math.round(v)), yFmt: (v) => pct(v) });
      };
      pDet.render();

      let ymax = 0;
      userHor.forEach((p) => { if (isFinite(p[1])) ymax = Math.max(ymax, p[1]); });
      pHor.setY({ domain: [0, Math.max(5, ymax * 1.12)] });
      pHor.draw = (pl) => {
        const used = [];
        refs.slice().reverse().forEach((r) => {
          const pts = kLin.map((kk) => [kk, ns(r.pop, kk)]);
          pl.line(pts, 'ctx');
          const last = pts.filter((p) => p[1] <= ymax * 1.1).pop();
          if (!last) return;
          const py = pl.y(last[1]);
          if (used.some((u) => Math.abs(u - py) < 13)) return;
          used.push(py);
          pl.text(last[0], last[1], 'a = ' + r.a, 'small', last[0] > 50 ? 'end' : 'start', last[0] > 50 ? -4 : 4, -6);
        });
        if (isFinite(cap)) { pl.hline(cap, 'pen'); pl.text(2, cap, 'ceiling from π₀', 'pen small', 'start', 0, -5); }
        pl.line(userHor, 's1');
        pl.crosshair([{ name: 'horizon', cls: 's1', pts: userHor }], { xName: 'k', xFmt: (v) => String(Math.round(v)) });
      };
      pHor.render();

      const kLog = U.logGrid(1, 1024, 120);
      const userLog = kLog.map((kk) => [kk, ns(pop, kk)]);
      let lmax = 10;
      userLog.forEach((p) => { if (isFinite(p[1])) lmax = Math.max(lmax, p[1]); });
      pLog.setY({ domain: [Math.max(0.1, Math.min(1, userLog[0][1] * 0.5)), Math.min(1e9, lmax * 4)] });
      pLog.draw = (pl) => {
        refs.forEach((r) => pl.line(kLog.map((kk) => [kk, ns(r.pop, kk)]), 'ctx'));
        if (isFinite(cap)) { pl.hline(cap, 'pen'); pl.text(1.2, cap, 'ceiling ε/βπ₀', 'pen small', 'start', 0, -5); }
        pl.line(userLog, 's1');
        if (pop.kind === 'beta' && pop.blind === 0) pl.text(1024, userLog[userLog.length - 1][1], 'slope ≈ ' + fmt(pop.a), 'small', 'end', -4, 14);
        pl.crosshair([{ name: 'n*', cls: 's1', pts: userLog }], { xName: 'k', xFmt: (v) => fmt(v) });
      };
      pLog.render();

      const nGrid = U.logGrid(1, 2000, 60);
      const J = nGrid.map((n) => {
        const target = (1 - Math.pow(1 - eps, 1 / n)) / beta;
        const kk = kForMiss(pop, target);
        return [n, isFinite(kk) ? n * kk : NaN];
      });
      let jmax = 10;
      J.forEach((p) => { if (isFinite(p[1])) jmax = Math.max(jmax, p[1]); });
      pJ.setY({ domain: [1, Math.max(100, jmax * 3)] });
      pJ.draw = (pl) => {
        pl.line(nGrid.map((n) => [n, n]), 'ctx');
        pl.text(2000, 2000, 'J = n', 'small', 'end', -4, 14);
        pl.line(J, 's1');
        const inf = J.find((p) => !isFinite(p[1]));
        if (inf) { pl.vline(inf[0], 'pen'); pl.text(inf[0], Math.sqrt(jmax * 3), 'unreachable beyond here', 'pen small', 'end', -4, 0); }
        pl.crosshair([{ name: 'J(n)', cls: 's1', pts: J }], { xName: 'depth', xFmt: (v) => fmt(v) });
      };
      pJ.render();

      const n8 = ns(pop, 8), n64 = ns(pop, 64);
      ro.set('n8', fmt(n8), 'stages');
      ro.set('n64', fmt(n64), 'stages');
      ro.set('d8', '+' + fmt(n8 - ns(pop, 7)));
      ro.set('d64', '+' + fmt(n64 - ns(pop, 63)));
      ro.set('cap', isFinite(cap) ? fmt(cap) : 'none', isFinite(cap) ? 'stages' : '(π₀ = 0)');
      const j100 = J.reduce((best, p) => (Math.abs(Math.log(p[0] / 100)) < Math.abs(Math.log(best[0] / 100)) ? p : best), J[0]);
      ro.set('j', isFinite(j100[1]) ? fmt(j100[1]) : 'unreachable');
      say.textContent = '';
      const conv = pop.kind === 'hom' || (pop.kind === 'beta' && pop.a > 1 && pop.blind === 0);
      say.appendChild(h('b', { text: pop.blind > 0 ? 'Blind spot: ' : conv ? 'Above a = 1: ' : 'Below a = 1: ' }));
      say.appendChild(document.createTextNode(pop.blind > 0
        ? `whatever the team size, depth stays under about ${fmt(cap)} stages, because ${pct(pop.blind)} of defects are invisible to everyone.`
        : conv
          ? `agent #64 adds ${fmt(n64 - ns(pop, 63))} stages of depth, more than agent #8 added (${fmt(n8 - ns(pop, 7))}), even though it adds almost no detection.`
          : `agent #64 adds only ${fmt(n64 - ns(pop, 63))} stages, less than agent #8 (${fmt(n8 - ns(pop, 7))}). Both detection and horizon show diminishing returns.`));
      tbl.update([{ title: 'Detection and horizon by team size', cols: ['k', 'detection 1 − M(k)', 'horizon n*'], rows: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024].map((kk) => [String(kk), pct(1 - pop.M(kk), 2), fmt(ns(pop, kk))]) }]);
    }
    render();
  };

  /* ================================================================== */
  /* Figure 8: four judge pools with the same leaderboard score          */
  /* ================================================================== */
  Figs.lineup = function (body, fig) {
    let c = 0.6, k = 8;
    const ctl = h('div', { class: 'controls' });
    body.appendChild(ctl);
    U.slider(ctl, { id: 'lu-c', label: 'Per-agent accuracy <i>c</i> (all four)', min: 0.1, max: 0.9, step: 0.01, value: c, fmt: (v) => v.toFixed(2) }).on((v) => { c = v; render(); });
    U.slider(ctl, { id: 'lu-k', label: 'Team size <i>k</i>', scale: 'log', min: 1, max: 64, int: true, value: k, fmt: String }).on((v) => { k = v; render(); });
    const defs = [
      { name: 'Homogeneous', sub: 'a = ∞', a: Infinity, cls: 's1' },
      { name: 'Diverse', sub: 'a = 2', a: 2, cls: 's2' },
      { name: 'Correlated', sub: 'a = 0.5', a: 0.5, cls: 's3' },
      { name: 'All-or-nothing', sub: 'a → 0', a: 0, cls: 's4' },
    ];
    const smalls = h('div', { class: 'row2', style: 'grid-template-columns:repeat(auto-fit,minmax(180px,1fr))' });
    body.appendChild(smalls);
    defs.forEach((d) => {
      const col = h('div');
      col.appendChild(h('p', { class: 'panel-title' }, h('span', { class: 'lg-item' }, h('span', { class: 'lg-key ' + d.cls }), h('span', { text: d.name + ' · ' + d.sub }))));
      const b = h('div');
      col.appendChild(b);
      d.plot = new root.Plot(b, { height: 116, margin: { l: 10, r: 10, t: 8, b: 26 }, x: { type: 'lin', domain: [-0.05, 1.05], ticks: [0, 0.5, 1] }, y: { type: 'lin', domain: [0, 1], ticks: [] } });
      smalls.appendChild(col);
    });
    const row = h('div', { class: 'row-side' });
    body.appendChild(row);
    const L = h('div'), R = h('div');
    row.appendChild(L); row.appendChild(R);
    L.appendChild(h('p', { class: 'panel-title', text: 'Miss curves M(k)' }));
    const box = h('div');
    L.appendChild(box);
    const leg = h('div', { class: 'legend' });
    L.appendChild(leg);
    root.PlotUtil.legend(leg, defs.map((d) => ({ name: d.name, cls: d.cls, kind: 'line' })));
    const plot = new root.Plot(box, { height: 260, margin: { l: 50, r: 14, t: 10, b: 38 }, x: { type: 'log', base: 2, domain: [1, 64], label: 'team size k' }, y: { type: 'log', domain: [1e-6, 1], label: 'M(k)' } });
    R.appendChild(h('p', { class: 'panel-title', text: 'Leaderboard versus what the team achieves' }));
    const tbox = h('div', { class: 'table-wrap' });
    R.appendChild(tbox);
    const say = h('p', { class: 'say' });
    R.appendChild(say);

    function render() {
      defs.forEach((d) => { d.pop = C.makePop({ acc: c, a: d.a, pi0: 0 }); });
      defs.forEach((d) => {
        const pop = d.pop;
        const xs = [], ys = [];
        let cap = 1;
        if (pop.kind === 'beta') {
          for (let i = 1; i < 200; i++) { xs.push(i / 200); ys.push(pop.pdf(i / 200)); }
          const sorted = ys.slice().sort((a, b) => a - b);
          cap = Math.max(2, sorted[Math.floor(sorted.length * 0.9)] * 1.5);
        }
        d.plot.setY({ domain: [0, cap] });
        d.plot.draw = (pl) => {
          if (pop.kind === 'beta') {
            pl.area(xs.map((x, i) => [x, Math.min(cap, ys[i])]), null, d.cls);
            pl.line(xs.map((x, i) => [x, Math.min(cap, ys[i])]), d.cls);
          } else {
            const disc = pop.discretize();
            disc.d.forEach((x, i) => {
              pl.seg(x, 0, x, 0.95 * disc.w[i], 'stem ' + (x === 0 ? 'c-pen' : d.cls));
              pl.dot(x, 0.95 * disc.w[i], 4, x === 0 ? 'c-pen' : d.cls);
            });
          }
          pl.vline(c, '');
          pl.text(c, pl.o.y.domain[1], 'mean ' + c.toFixed(2), 'small', c > 0.6 ? 'end' : 'start', c > 0.6 ? -4 : 4, 12);
        };
        d.plot.render();
      });
      plot.draw = (pl) => {
        const grid = U.logGrid(1, 64, 90);
        const series = defs.map((d) => ({ name: d.name, cls: d.cls, pts: grid.map((x) => [x, d.pop.M(x)]) }));
        series.forEach((s) => pl.line(s.pts, s.cls));
        pl.vline(k, 'solid');
        defs.forEach((d) => pl.dot(k, d.pop.M(k), 4.5, d.cls));
        pl.crosshair(series, { xName: 'k', xFmt: (v) => fmt(v) });
      };
      plot.render();
      // table
      tbox.textContent = '';
      const t = h('table', { class: 'data' });
      t.appendChild(h('tr', null, h('th', { text: 'Population' }), h('th', { text: 'Leaderboard accuracy' }), h('th', { text: `${k} agents miss` }), h('th', { text: 'Depth vs all-or-nothing' })));
      const base = defs[3].pop.M(k);
      defs.forEach((d) => {
        const m = d.pop.M(k);
        t.appendChild(h('tr', null, h('td', null, h('span', { class: 'lg-item' }, h('span', { class: 'lg-key ' + d.cls }), h('span', { text: d.name }))), h('td', { text: c.toFixed(2) }), h('td', { text: fmt(m) }), h('td', { text: '×' + fmt(base / m) })));
      });
      tbox.appendChild(t);
      const ratio = Math.pow(1 - c, -(k - 1));
      say.textContent = '';
      say.appendChild(h('b', { text: 'Theorem 4.5: ' }));
      say.appendChild(document.createTextNode(`the homogeneous pool's horizon is 1/(1 − c)^(k−1) = ${fmt(ratio)} times the all-or-nothing pool's at k = ${k}. The accuracy column is identical in every row.`));
    }
    render();
  };

  /* ================================================================== */
  /* Figure 9: re-reviewing everything                                   */
  /* ================================================================== */
  Figs.rereview = function (body, fig) {
    let k = 4, beta = 0.1, mode = 'fresh', lam = 0.3, eps = 0.1;
    const NMAX = 10000;
    const pc = U.popControls(body, 'rr', { acc: 0.5, a: 0.8, pi0: 0 }, () => schedule(), { presets: ['div', 'one', 'cor', 'bs'] });
    const ctl = h('div', { class: 'controls' });
    body.appendChild(ctl);
    U.slider(ctl, { id: 'rr-k', label: 'Smallest team size <i>k</i>', scale: 'log', min: 1, max: 32, int: true, value: k, fmt: (v) => `${v} (also ${4 * v}, ${16 * v})` }).on((v) => { k = v; schedule(); });
    U.slider(ctl, { id: 'rr-b', label: 'Defect rate per stage β', min: 0.01, max: 0.3, step: 0.01, value: beta, fmt: (v) => v.toFixed(2) }).on((v) => { beta = v; schedule(); });
    const sch = U.seg(ctl, { idPrefix: 'rr-m', label: 'Who re-reviews', value: mode, items: [{ id: 'fresh', label: 'Fresh team each stage' }, { id: 'fixed', label: 'Fixed roster' }, { id: 'lam', label: 'Refresh a fraction λ' }], onChange: (v) => { mode = v; schedule(); } });
    sch.el.style.gridColumn = '1 / -1';
    U.slider(ctl, { id: 'rr-l', label: 'Refresh fraction λ', min: 0.05, max: 1, step: 0.05, value: lam, fmt: (v) => v.toFixed(2) }).on((v) => { lam = v; schedule(); });
    U.slider(ctl, { id: 'rr-e', label: 'Risk budget ε (cost chart)', min: 0.01, max: 0.3, step: 0.01, value: eps, fmt: (v) => v.toFixed(2) }).on((v) => { eps = v; schedule(); });

    const row = h('div', { class: 'row3' });
    body.appendChild(row);
    const mk = (title, sub) => {
      const d = h('div');
      d.appendChild(h('p', { class: 'panel-title', text: title }));
      d.appendChild(h('p', { class: 'panel-sub', text: sub }));
      const b = h('div');
      d.appendChild(b);
      row.appendChild(d);
      return b;
    };
    const b1 = mk('Chance the artifact is still clean', 'Eq. (7), exact, for three team sizes.');
    const b2 = mk('Partial sums Σ M(ks)', 'Bounded iff the left curves level off.');
    const b3 = mk('Cost to reach depth n at risk ε', 'Total judgements, fresh-team re-review against reviewing the change.');
    const leg = h('div', { class: 'legend' });
    body.appendChild(leg);
    const ro = U.readouts(body, [
      { id: 'conv', label: 'Does Σ M(ks) converge?', key: true },
      { id: 's', label: 'Σ M(ks) up to n = 10,000' },
      { id: 'p', label: 'Clean after 10,000 stages' },
      { id: 'p4', label: 'Same, with 16× the team' },
    ]);
    const tbl = U.tableToggle(fig);
    const p1 = new root.Plot(b1, { height: 220, margin: { l: 44, r: 10, t: 8, b: 38 }, x: { type: 'log', domain: [1, NMAX], label: 'stages n' }, y: { type: 'lin', domain: [0, 1], label: 'P(clean)', fmt: (v) => Math.round(v * 100) + '%' } });
    const p2 = new root.Plot(b2, { height: 220, margin: { l: 46, r: 10, t: 8, b: 38 }, x: { type: 'log', domain: [1, NMAX], label: 'stages n' }, y: { type: 'log', domain: [1e-3, 1e4], label: 'Σ M(ks)' } });
    const p3 = new root.Plot(b3, { height: 220, margin: { l: 50, r: 10, t: 8, b: 38 }, x: { type: 'log', domain: [2, 1000], label: 'target depth n' }, y: { type: 'log', domain: [1, 1e12], label: 'judgements' } });

    let pend = null, pendCost = null;
    function schedule() {
      if (!pend) pend = requestAnimationFrame(() => { pend = null; render(); });
      clearTimeout(pendCost);
      pendCost = setTimeout(renderCost, 160);
    }
    function argOf(K, s) {
      if (mode === 'fixed') return K;
      if (mode === 'lam') return K * (1 + lam * (s - 1));
      return K * s;
    }
    function curves(pop, K) {
      const grid = U.logGrid(1, NMAX, 140).map((x) => Math.round(x));
      let logP = 0, S = 0, gi = 0;
      const P = [], Ssum = [];
      for (let s = 1; s <= NMAX; s++) {
        const m = pop.M(argOf(K, s));
        logP += Math.log1p(-beta * m);
        S += m;
        while (gi < grid.length && grid[gi] === s) { P.push([s, Math.exp(logP)]); Ssum.push([s, S]); gi++; }
      }
      return { P, S: Ssum, total: S, last: Math.exp(logP) };
    }
    function render() {
      const pop = pc.pop;
      const sizes = [k, 4 * k, 16 * k];
      const cls = ['s1', 's2', 's3'];
      const cs = sizes.map((K) => curves(pop, K));
      root.PlotUtil.legend(leg, sizes.map((K, i) => ({ name: 'team of ' + K, cls: cls[i], kind: 'line' })).concat([{ name: 'reviewing the change instead', cls: 'c-muted', kind: 'dash' }]));
      p1.draw = (pl) => {
        cs.forEach((cv, i) => { pl.line(cv.P, cls[i]); });
        cs.forEach((cv, i) => pl.endLabel(cv.P, 'k=' + sizes[i], '', { dy: -6 }));
        pl.crosshair(cs.map((cv, i) => ({ name: 'k = ' + sizes[i], cls: cls[i], pts: cv.P })), { xName: 'n', xFmt: (v) => fmt(v), yFmt: (v) => pct(v) });
      };
      p1.render();
      let smin = 1e9, smax = 0;
      cs.forEach((cv) => cv.S.forEach((p) => { smin = Math.min(smin, p[1]); smax = Math.max(smax, p[1]); }));
      p2.setY({ domain: [Math.max(1e-6, smin / 2), Math.max(10, smax * 3)] });
      p2.draw = (pl) => {
        cs.forEach((cv, i) => pl.line(cv.S, cls[i]));
        pl.crosshair(cs.map((cv, i) => ({ name: 'k = ' + sizes[i], cls: cls[i], pts: cv.S })), { xName: 'n', xFmt: (v) => fmt(v) });
      };
      p2.render();
      const conv = mode !== 'fixed' && pop.blind === 0 && (pop.kind === 'hom' || (pop.kind === 'beta' && pop.a > 1));
      ro.set('conv', conv ? 'Yes' : 'No', mode === 'fixed' ? '(fixed roster: M(k) every term)' : pop.blind > 0 ? '(terms ≥ π₀)' : conv ? '(a > 1)' : '(a ≤ 1)');
      ro.set('s', fmt(cs[0].total), 'k = ' + sizes[0]);
      ro.set('p', pct(cs[0].last), 'k = ' + sizes[0]);
      ro.set('p4', pct(cs[2].last), 'k = ' + sizes[2]);
      tbl.update([{ title: 'P(clean after n)', cols: ['n'].concat(sizes.map((K) => 'k = ' + K)), rows: [1, 10, 100, 1000, 10000].map((n) => [String(n)].concat(cs.map((cv) => { const pt = cv.P.find((q) => q[0] >= n) || cv.P[cv.P.length - 1]; return pct(pt[1], 2); }))) }]);
    }
    function renderCost() {
      const pop = pc.pop;
      const ns = U.logGrid(2, 1000, 12).map((x) => Math.round(x));
      const change = [], rer = [];
      for (const n of ns) {
        const target = (1 - Math.pow(1 - eps, 1 / n)) / beta;
        const kc = kForMiss(pop, target);
        change.push([n, isFinite(kc) ? n * kc : NaN]);
        // fresh-team re-review: smallest real k with prod_{s<=n} (1 - beta M(k s)) >= 1 - eps
        const ok = (K) => { let lp = 0; for (let s = 1; s <= n; s++) { lp += Math.log1p(-beta * pop.M(K * s)); if (lp < Math.log(1 - eps)) return false; } return true; };
        let kr = NaN;
        if (ok(1)) kr = 1;
        else if (ok(1e7)) {
          let lo = 0, hi = Math.log(1e7);
          for (let i = 0; i < 30; i++) { const mid = 0.5 * (lo + hi); if (ok(Math.exp(mid))) hi = mid; else lo = mid; }
          kr = Math.exp(hi);
        }
        rer.push([n, isFinite(kr) ? kr * n * (n + 1) / 2 : NaN]);
      }
      let ymax = 100;
      change.concat(rer).forEach((p) => { if (isFinite(p[1])) ymax = Math.max(ymax, p[1]); });
      p3.setY({ domain: [1, ymax * 5] });
      p3.draw = (pl) => {
        pl.line(change, 'c-muted dash');
        pl.line(rer, 's1');
        pl.endLabel(change, 'change only', 'small', { dy: 10 });
        pl.endLabel(rer, 're-review', 'small', { dy: -8 });
        pl.crosshair([{ name: 're-review all', cls: 's1', pts: rer }, { name: 'review the change', cls: 'c-muted', pts: change }], { xName: 'depth', xFmt: (v) => fmt(v) });
      };
      p3.render();
    }
    render();
    renderCost();
  };

  /* ================================================================== */
  /* Figure 10: per-stage risk κ(k) and the best team size               */
  /* ================================================================== */
  Figs.teamSize = function (body, fig) {
    const st = { beta: 0.1, rho: 0.9, betaR: 0.15, pbar: 0.02, conc: Infinity };
    const pc = U.popControls(body, 'ts', { acc: 0.4, a: 1.2, pi0: 0 }, () => render(), { presets: ['div', 'one', 'cor', 'bs'] });
    const ctl = h('div', { class: 'controls' });
    body.appendChild(ctl);
    const rep = U.seg(ctl, {
      idPrefix: 'ts-rep', label: 'Repairer', value: 'mod',
      items: [{ id: 'good', label: 'Competent' }, { id: 'mod', label: 'Moderate damage (β_r = 0.15)' }, { id: 'scope', label: 'Scope-limited (β_r = 0.70)' }],
      onChange: (v) => {
        const P = { good: { rho: 0.97, betaR: 0.02 }, mod: { rho: 0.9, betaR: 0.15 }, scope: { rho: 0.6, betaR: 0.7 } }[v];
        st.rho = P.rho; st.betaR = P.betaR; sRho.set(st.rho, true); sBr.set(st.betaR, true); render();
      },
    });
    rep.el.style.gridColumn = '1 / -1';
    U.slider(ctl, { id: 'ts-b', label: 'Defect rate β', min: 0.01, max: 0.5, step: 0.01, value: st.beta, fmt: (v) => v.toFixed(2) }).on((v) => { st.beta = v; render(); });
    const sRho = U.slider(ctl, { id: 'ts-rho', label: 'Repair success ρ', min: 0.3, max: 1, step: 0.01, value: st.rho, fmt: (v) => v.toFixed(2) }).on((v) => { st.rho = v; rep.set(null); render(); });
    const sBr = U.slider(ctl, { id: 'ts-br', label: 'Damage on false alarm β<sub>r</sub>', min: 0, max: 0.9, step: 0.01, value: st.betaR, fmt: (v) => v.toFixed(2) }).on((v) => { st.betaR = v; rep.set(null); render(); });
    U.slider(ctl, { id: 'ts-p', label: 'Agent false-alarm rate <i>E</i>[P]', scale: 'log', min: 0.001, max: 0.1, value: st.pbar, round: (v) => +v.toPrecision(2), fmt: (v) => v.toFixed(3) }).on((v) => { st.pbar = v; render(); });
    U.slider(ctl, { id: 'ts-c', label: 'False alarms across agents', scale: 'log', min: 0.5, max: 200, atMax: Infinity, value: st.conc, round: (v) => +v.toPrecision(2), fmt: (v) => (v === Infinity ? 'independent' : 'correlated (concentration ' + fmt(v) + ')') }).on((v) => { st.conc = v; render(); });

    const row = h('div', { class: 'row2' });
    body.appendChild(row);
    const L = h('div'), R = h('div');
    row.appendChild(L); row.appendChild(R);
    L.appendChild(h('p', { class: 'panel-title', text: 'Per-stage risk κ(k), Eq. (8)' }));
    const b1 = h('div');
    L.appendChild(b1);
    const leg = h('div', { class: 'legend' });
    L.appendChild(leg);
    root.PlotUtil.legend(leg, [
      { name: 'floor β(1 − ρ)', cls: 'c-muted', kind: 'rect' },
      { name: 'missed defects βρM_Q(k)', cls: 's1', kind: 'rect' },
      { name: 'repair damage (1 − β)β_r(1 − M_P(k))', cls: 's2', kind: 'rect' },
      { name: 'total κ(k)', cls: 'c-ink', kind: 'line' },
    ]);
    R.appendChild(h('p', { class: 'panel-title', text: 'Does the k-th agent help? Eq. (9)' }));
    const b2 = h('div');
    R.appendChild(b2);
    const ro = U.readouts(body, [
      { id: 'tau', label: 'Exchange rate τ' },
      { id: 'best', label: 'Best team size (argmin κ)', key: true },
      { id: 'kd', label: '<i>k</i>†: last <i>k</i> with ratio > τ' },
      { id: 'kapx', label: 'Eq. (10) approximation' },
      { id: 'floor', label: 'Floor β(1 − ρ)' },
      { id: 'kbest', label: 'κ at best size' },
    ]);
    const tbl = U.tableToggle(fig);
    const p1 = new root.Plot(b1, { height: 250, margin: { l: 50, r: 12, t: 10, b: 38 }, x: { type: 'lin', domain: [0, 64], label: 'team size k' }, y: { type: 'lin', domain: [0, 0.1], label: 'risk per stage' } });
    const p2 = new root.Plot(b2, { height: 250, margin: { l: 50, r: 12, t: 10, b: 38 }, x: { type: 'lin', domain: [1, 64], label: 'k' }, y: { type: 'log', domain: [0.01, 100], label: '∇M_Q / ∇M_P' } });

    function render() {
      const pop = pc.pop;
      const MQ = pop.M, MP = C.falseAlarmCurve(st.pbar, st.conc);
      const tau = (1 - st.beta) * st.betaR / (st.beta * st.rho);
      const ks = [];
      for (let kk = 0; kk <= 64; kk++) ks.push(kk);
      const parts = ks.map((kk) => C.kappaParts(MQ, MP, st.beta, st.rho, st.betaR, kk));
      let best = 0;
      parts.forEach((pp, i) => { if (pp.total < parts[best].total - 1e-15) best = i; });
      const ratio = [];
      let kd = 0;
      for (let kk = 1; kk <= 64; kk++) {
        const r = (MQ(kk - 1) - MQ(kk)) / (MP(kk - 1) - MP(kk));
        ratio.push([kk, r]);
        if (r > tau) kd = kk;
      }
      const approx = pop.kind === 'beta' && pop.blind === 0 ? Math.pow(pop.a * pop.C / (tau * st.pbar), 1 / (pop.a + 1)) : NaN;
      let ymax = 0;
      parts.forEach((pp) => { ymax = Math.max(ymax, pp.total); });
      p1.setY({ domain: [0, ymax * 1.1] });
      p1.draw = (pl) => {
        const fl = parts.map((pp, i) => [ks[i], pp.floor]);
        const ms = parts.map((pp, i) => [ks[i], pp.floor + pp.miss]);
        const tot = parts.map((pp, i) => [ks[i], pp.total]);
        const zero = ks.map((kk) => [kk, 0]);
        pl.area(fl, zero, 'c-muted solid');
        pl.area(ms, fl, 's1 solid');
        pl.area(tot, ms, 's2 solid');
        pl.line(tot, 'c-ink');
        pl.vline(best, 'solid');
        pl.text(best, ymax * 1.05, 'best k = ' + best, 'strong', best > 40 ? 'end' : 'start', best > 40 ? -4 : 4, 4);
        if (isFinite(approx) && approx <= 64) { pl.vline(approx, ''); pl.text(approx, ymax * 0.9, 'Eq. (10): ' + fmt(approx), 'small', approx > 40 ? 'end' : 'start', approx > 40 ? -4 : 4, 4); }
        pl.crosshair([
          { name: 'total κ', cls: 'c-ink', pts: tot },
          { name: 'repair damage', cls: 's2', pts: parts.map((pp, i) => [ks[i], pp.harm]) },
          { name: 'missed defects', cls: 's1', pts: parts.map((pp, i) => [ks[i], pp.miss]) },
          { name: 'floor', cls: 'c-muted', pts: fl },
        ], { xName: 'k', xFmt: (v) => String(Math.round(v)), yFmt: (v) => v.toFixed(4) });
      };
      p1.render();
      let rmin = Infinity, rmax = 0;
      ratio.forEach((p) => { if (isFinite(p[1]) && p[1] > 0) { rmin = Math.min(rmin, p[1]); rmax = Math.max(rmax, p[1]); } });
      p2.setY({ domain: [Math.max(1e-4, Math.min(rmin, tau) / 2), Math.max(rmax, tau) * 2] });
      p2.draw = (pl) => {
        pl.hline(tau, 'pen');
        pl.text(64, tau, 'τ = ' + fmt(tau), 'pen', 'end', -4, -7);
        pl.text(64, tau, 'agent hurts below', 'small', 'end', -4, 14);
        pl.line(ratio, 's1');
        if (kd > 0) { pl.vline(kd, 'solid'); pl.text(kd, Math.max(rmax, tau), 'k† = ' + kd, 'strong', kd > 40 ? 'end' : 'start', kd > 40 ? -4 : 4, 12); }
        pl.crosshair([{ name: 'ratio', cls: 's1', pts: ratio }], { xName: 'k', xFmt: (v) => String(Math.round(v)) });
      };
      p2.render();
      ro.set('tau', fmt(tau));
      ro.set('best', String(best), best === 0 ? '(no verification)' : '');
      ro.set('kd', String(kd));
      ro.set('kapx', isFinite(approx) ? fmt(approx) : 'n/a', isFinite(approx) ? '' : '(needs π₀ = 0, a < ∞)');
      ro.set('floor', (st.beta * (1 - st.rho)).toFixed(4));
      ro.set('kbest', parts[best].total.toFixed(4), 'vs ' + parts[0].total.toFixed(4) + ' at k = 0');
      tbl.update([{ title: 'Risk decomposition', cols: ['k', 'floor', 'missed', 'damage', 'total κ'], rows: [0, 1, 2, 4, 8, 16, 32, 64].map((kk) => [String(kk), parts[kk].floor.toFixed(4), parts[kk].miss.toFixed(4), parts[kk].harm.toFixed(4), parts[kk].total.toFixed(4)]) }]);
    }
    render();
  };
})(window);
