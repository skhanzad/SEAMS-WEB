/* fig-model.js — figures for the opening and Part I:
   hero (two teams), Figure 1 (scopes → Δ), Figure 2 (judgement matrix),
   Figure 3 (miss-curve explorer). */
(function (root) {
  'use strict';
  const C = root.Core, U = root.UI, h = U.h, Figs = root.Figs;
  const svgEl = root.PlotUtil.svgEl;

  /* ================================================================== */
  /* Hero: two teams with identical per-agent accuracy                   */
  /* ================================================================== */
  Figs.hero = function (body, fig) {
    const N = 240, COLS = 20, ROWS = 12, CELL = 15, SQ = 12, MAXK = 24;
    const visA = new Float64Array(N).fill(0.5);
    const q = [];
    for (let i = 0; i < N; i++) q.push(C.betaQuantile((i + 0.5) / N, 0.25, 0.25));
    const r0 = C.mulberry32(20270503);
    for (let i = N - 1; i > 0; i--) { const j = Math.floor(r0() * (i + 1)); const t = q[i]; q[i] = q[j]; q[j] = t; }
    const visB = Float64Array.from(q);
    const teams = [
      { name: 'Team A', tag: 'independent blind spots', cls: 's1', vis: visA, pop: C.makePop({ acc: 0.5, a: Infinity }),
        sub: 'Every defect is visible to each agent with probability 0.5.' },
      { name: 'Team B', tag: 'shared blind spots', cls: 's2', vis: visB, pop: C.makePop({ acc: 0.5, a: 0.25 }),
        sub: 'Some defects are obvious to every agent and some to almost none. Average visibility is still 0.5.' },
    ];

    const fields = h('div', { class: 'fields' });
    body.appendChild(fields);
    for (const T of teams) {
      const col = h('div');
      col.appendChild(h('div', { class: 'field-h' },
        h('b', { text: T.name + ' · ' + T.tag }),
        h('span', { class: 'lg-item' }, h('span', { class: 'lg-key ' + T.cls }), h('span', { text: 'in chart' }))));
      col.appendChild(h('p', { class: 'field-sub', text: T.sub }));
      const svg = svgEl('svg', { class: 'field', viewBox: `0 0 ${COLS * CELL} ${ROWS * CELL}`, role: 'img' });
      T.svg = svg;
      T.rects = [];
      for (let i = 0; i < N; i++) {
        const x = (i % COLS) * CELL + (CELL - SQ) / 2, y = Math.floor(i / COLS) * CELL + (CELL - SQ) / 2;
        const r = svgEl('rect', { x, y, width: SQ, height: SQ, rx: 2.5, class: 'dz open' }, svg);
        r.style.fillOpacity = (0.16 + 0.84 * T.vis[i]).toFixed(3);
        T.rects.push(r);
      }
      col.appendChild(svg);
      T.agentsRow = h('div', { class: 'agents-row' });
      col.appendChild(T.agentsRow);
      T.ro = U.readouts(col, [
        { id: 'k', label: 'Agents' }, { id: 'last', label: 'Latest agent caught' }, { id: 'miss', label: 'Still uncaught' },
      ]);
      T.ro.el.className = 'field-stats';
      T.ro.el.setAttribute('aria-live', 'polite');
      fields.appendChild(col);
    }
    const sw = h('span', { class: 'sw' });
    [0.16, 0.37, 0.58, 0.79, 1].forEach((o) => { const i = h('i'); i.style.opacity = o; sw.appendChild(i); });
    body.appendChild(h('div', { class: 'shade-key' },
      h('span', { text: 'Uncaught defects are shaded by visibility Δ:' }), h('span', { text: 'hard to see' }), sw,
      h('span', { text: 'obvious. A caught defect keeps only its outline.' })));

    const row = h('div', { class: 'demo-chart' });
    const left = h('div');
    left.appendChild(h('p', { class: 'panel-title', text: 'Share of defects no agent has caught' }));
    left.appendChild(h('p', { class: 'panel-sub', text: 'Lines: expected value, the miss curve M(k). Dots: this run.' }));
    const chartBox = h('div');
    left.appendChild(chartBox);
    const verdict = h('div', { class: 'demo-verdict', 'aria-live': 'polite' });
    row.appendChild(left);
    row.appendChild(verdict);
    body.appendChild(row);
    const plot = new root.Plot(chartBox, {
      height: 210, margin: { l: 44, r: 14, t: 8, b: 38 },
      x: { type: 'lin', domain: [0, MAXK], label: 'agents on each team' },
      y: { type: 'lin', domain: [0, 1], label: 'share uncaught', fmt: (v) => Math.round(v * 100) + '%' },
    });

    let seed = 0, rng = null;
    function reset() {
      seed++;
      rng = C.mulberry32(seed * 7919 + 17);
      for (const T of teams) { T.caught = new Uint8Array(N); T.hist = [1]; T.agents = []; T.newly = []; }
    }
    function addAgent() {
      for (const T of teams) {
        if (T.agents.length >= MAXK) continue;
        let flags = 0;
        for (let i = 0; i < N; i++) {
          if (rng() < T.vis[i]) {
            flags++;
            if (!T.caught[i]) { T.caught[i] = 1; T.newly.push(i); }
          }
        }
        T.agents.push(flags / N);
        let m = 0;
        for (let i = 0; i < N; i++) if (!T.caught[i]) m++;
        T.hist.push(m / N);
      }
    }

    function drawChart(p) {
      const ks = [];
      for (let k = 0; k <= MAXK; k++) ks.push(k);
      const series = [];
      teams.forEach((T) => {
        const th = ks.map((k) => [k, T.pop.M(k)]);
        p.line(th, T.cls);
        series.push({ name: T.name + ' expected', cls: T.cls, pts: th });
        const obs = T.hist.map((v, k) => [k, v]);
        obs.forEach(([k, v]) => p.dot(k, v, 3.6, T.cls));
        series.push({ name: T.name + ' this run', cls: T.cls, pts: obs, fmt: (v) => C.fmtPct(v) });
      });
      p.endLabel(series[0].pts, 'Team A', '', { dy: -2 });
      p.endLabel(series[2].pts, 'Team B', '', { dy: -2 });
      p.crosshair(series, { xName: 'agents', xFmt: (v) => String(Math.round(v)), yFmt: (v) => C.fmtPct(v) });
    }

    function render() {
      for (const T of teams) {
        for (let i = 0; i < N; i++) {
          const want = T.caught[i] ? 'dz shut' : 'dz open';
          if (T.rects[i].getAttribute('class') !== want) T.rects[i].setAttribute('class', want);
        }
        T.newly.forEach((i) => T.rects[i].classList.add('pop'));
        T.agentsRow.textContent = '';
        const k = T.agents.length;
        T.agents.forEach((acc, j) => {
          T.agentsRow.appendChild(h('span', { class: 'agent-dot' + (j === k - 1 ? ' new' : ''), title: `Agent ${j + 1} caught ${C.fmtPct(acc)} of all defects` }));
        });
        if (!k) T.agentsRow.appendChild(h('span', { text: 'No agents yet' }));
        T.ro.set('k', String(k));
        T.ro.set('last', k ? C.fmtPct(T.agents[k - 1], 0) : '–');
        const m = Math.round(T.hist[k] * N);
        T.ro.set('miss', `${m} of ${N}`);
        T.svg.setAttribute('aria-label', `${T.name}: ${k} agents, ${m} of ${N} defects still uncaught`);
      }
      const done = teams.map((T) => T.newly.slice());
      teams.forEach((T) => { T.newly = []; });
      setTimeout(() => teams.forEach((T, ti) => done[ti].forEach((i) => T.rects[i].classList.remove('pop'))), 700);

      plot.draw = drawChart;
      plot.render();

      const k = teams[0].agents.length;
      const MA = teams[0].pop.M(k), MB = teams[1].pop.M(k);
      verdict.textContent = '';
      if (k === 0) {
        verdict.appendChild(h('span', { text: 'Add agents to both teams and compare what they leave behind.' }));
      } else {
        const ratio = MB / MA;
        verdict.appendChild(h('span', { class: 'big', text: (ratio < 10 ? ratio.toFixed(1) : C.fmtNum(Math.round(ratio))) + '×' }));
        verdict.appendChild(h('span', { text: `deeper pipeline for team A at the same risk, with ${k} agent${k > 1 ? 's' : ''} on each team. ` }));
        verdict.appendChild(h('span', { text: `Expected share missed by the whole team: A ${C.fmtPct(MA)}, B ${C.fmtPct(MB)}.` }));
      }
      const full = k >= MAXK;
      bAdd.disabled = full; bAdd5.disabled = full;
    }

    const actions = fig.querySelector('#hero-actions');
    const bAdd = U.button(actions, 'Add an agent', () => { addAgent(); render(); }, 'primary', 'hero-add');
    const bAdd5 = U.button(actions, 'Add 5', () => { for (let i = 0; i < 5; i++) addAgent(); render(); }, '', 'hero-add5');
    U.button(actions, 'Reset', () => { reset(); render(); }, 'quiet', 'hero-reset');

    reset();
    for (let i = 0; i < 3; i++) addAgent();
    teams.forEach((T) => { T.newly = []; });
    render();
  };

  /* ================================================================== */
  /* Figure 1: from scopes to Δ(θ)                                       */
  /* ================================================================== */
  Figs.scopes = function (body, fig) {
    const NC = 36, NT = 6;
    const range = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };
    const PRE = {
      siloed: [range(0, 11), range(3, 14), range(6, 17), range(9, 20), range(12, 23), range(18, 29)],
      overlap: [range(0, 11), range(6, 17), range(9, 20), range(18, 29), range(24, 35), range(28, 35).concat(range(0, 3))],
      diverse: [range(0, 11), range(6, 17), range(12, 23), range(18, 29), range(24, 35), range(30, 35).concat(range(0, 5))],
    };
    let scopes = PRE.siloed.map((a) => new Set(a));
    let s = 0.9, p = 0.05;
    let rngSeed = 3;

    const ctl = h('div', { class: 'controls' });
    body.appendChild(ctl);
    const preset = U.seg(ctl, {
      idPrefix: 'sc-pre', label: 'Scopes', value: 'siloed',
      items: [{ id: 'siloed', label: 'Siloed' }, { id: 'overlap', label: 'Overlapping' }, { id: 'diverse', label: 'Diverse' }, { id: 'random', label: 'Random' }],
      onChange: (k) => {
        if (k === 'random') {
          const rng = C.mulberry32(rngSeed++);
          scopes = [];
          for (let t = 0; t < NT; t++) {
            const idx = range(0, NC - 1);
            for (let i = NC - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp; }
            scopes.push(new Set(idx.slice(0, 12)));
          }
        } else scopes = PRE[k].map((a) => new Set(a));
        update();
      },
    });
    preset.el.style.gridColumn = '1 / -1';
    const sS = U.slider(ctl, { id: 'sc-s', label: 'Skill inside scope <i>s</i>', min: 0.3, max: 1, step: 0.01, value: s, fmt: (v) => v.toFixed(2) });
    const sP = U.slider(ctl, { id: 'sc-p', label: 'False-alarm rate <i>p</i>', min: 0, max: 0.3, step: 0.01, value: p, fmt: (v) => v.toFixed(2) });
    sS.on((v) => { s = v; update(); });
    sP.on((v) => { p = v; update(); });

    const row = h('div', { class: 'row-side' });
    body.appendChild(row);
    const leftCol = h('div');
    const rightCol = h('div', { style: 'display:grid;gap:14px;align-content:start' });
    row.appendChild(leftCol);
    row.appendChild(rightCol);

    // ---- matrix of scopes + Δ bars (hand-built SVG)
    const LW = 84, CW = 16, RH = 18, TOP = 20, GAP = 24, BH = 112;
    const W = LW + NC * CW + 4, H = TOP + NT * RH + GAP + BH + 34;
    leftCol.appendChild(h('p', { class: 'panel-title', text: 'Who checks which requirement' }));
    leftCol.appendChild(h('p', { class: 'panel-sub', text: 'Rows: role templates (an agent is one template, drawn at random). Bottom: for each requirement θ, the flag rate on a violation Q(θ) and on clean work P(θ). The gap is Δ(θ).' }));
    const svg = svgEl('svg', { class: 'scopes', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Template scopes and discriminative power per requirement' });
    leftCol.appendChild(svg);
    for (let c = 0; c < NC; c += 5) {
      const t = svgEl('text', { x: LW + c * CW + CW / 2, y: 11, class: 'rowlbl', 'text-anchor': 'middle' }, svg);
      t.textContent = c === 0 ? 'θ=1' : String(c + 1);
    }
    const cells = [];
    for (let t = 0; t < NT; t++) {
      const y = TOP + t * RH;
      const lb = svgEl('text', { x: 0, y: y + RH / 2 + 4, class: 'rowlbl' }, svg);
      lb.textContent = 'Template ' + (t + 1);
      cells.push([]);
      for (let c = 0; c < NC; c++) {
        const r = svgEl('rect', { x: LW + c * CW, y, width: CW, height: RH, class: 'cell off click', tabindex: -1 }, svg);
        r.addEventListener('click', () => {
          if (scopes[t].has(c)) scopes[t].delete(c); else scopes[t].add(c);
          preset.set(null);
          update();
        });
        cells[t].push(r);
      }
    }
    const by0 = TOP + NT * RH + GAP + BH, by1 = TOP + NT * RH + GAP;
    const yb = (v) => by0 - v * (by0 - by1);
    svgEl('line', { x1: LW, x2: LW + NC * CW, y1: by0, y2: by0, class: 'base' }, svg);
    [0, 0.5, 1].forEach((v) => {
      const t = svgEl('text', { x: LW - 6, y: yb(v) + 4, class: 'rowlbl', 'text-anchor': 'end' }, svg);
      t.textContent = v === 0 ? '0' : String(v);
      if (v > 0) svgEl('line', { x1: LW, x2: LW + NC * CW, y1: yb(v), y2: yb(v), class: 'base', 'stroke-opacity': 0.4 }, svg);
    });
    const lbQ = svgEl('text', { x: 0, y: by1 + 12, class: 'rowlbl' }, svg);
    lbQ.textContent = 'Q and P';
    const bars = [], blinds = [];
    for (let c = 0; c < NC; c++) {
      bars.push(svgEl('rect', { x: LW + c * CW + 2, width: CW - 4, class: 'dbar' }, svg));
      const bl = svgEl('text', { x: LW + c * CW + CW / 2, y: by0 + 13, class: 'rowlbl', 'text-anchor': 'middle', fill: 'currentColor' }, svg);
      bl.style.fill = 'var(--pen)';
      blinds.push(bl);
    }
    const pLine = svgEl('line', { x1: LW, x2: LW + NC * CW, class: 'pline' }, svg);
    const pLbl = svgEl('text', { x: LW + NC * CW, class: 'rowlbl', 'text-anchor': 'end' }, svg);
    const leg = h('div', { class: 'legend', style: 'margin-top:6px' });
    leftCol.appendChild(leg);
    root.PlotUtil.legend(leg, [
      { name: 'Δ(θ) = Q(θ) − P(θ)', cls: 's1', kind: 'rect' },
      { name: 'P(θ), false-alarm rate', cls: 's2', kind: 'line' },
      { name: '× blind: no template covers θ', cls: 'c-pen', kind: 'dot' },
    ]);

    // ---- right column: Δ histogram and miss curve
    rightCol.appendChild(h('p', { class: 'panel-title', text: 'How Δ is spread across requirements' }));
    const histBox = h('div');
    rightCol.appendChild(histBox);
    const hist = new root.Plot(histBox, {
      height: 150, margin: { l: 40, r: 12, t: 8, b: 36 },
      x: { type: 'lin', domain: [-0.03, 1], label: 'Δ', ticks: [0, 0.25, 0.5, 0.75, 1] },
      y: { type: 'lin', domain: [0, 1], label: 'share', fmt: (v) => Math.round(v * 100) + '%' },
    });
    rightCol.appendChild(h('p', { class: 'panel-title', text: 'Team miss rate M(k)' }));
    const mBox = h('div');
    rightCol.appendChild(mBox);
    const mplot = new root.Plot(mBox, {
      height: 170, margin: { l: 46, r: 12, t: 8, b: 36 },
      x: { type: 'log', base: 2, domain: [1, 32], label: 'agents k' },
      y: { type: 'log', domain: [1e-4, 1], label: 'M(k)' },
    });
    const mleg = h('div', { class: 'legend' });
    rightCol.appendChild(mleg);
    root.PlotUtil.legend(mleg, [
      { name: 'these scopes', cls: 's1', kind: 'line' },
      { name: 'same accuracy, every θ covered equally', cls: 'c-muted', kind: 'dash' },
    ]);

    const ro = U.readouts(body, [
      { id: 'q', label: 'Per-agent detection rate <i>E</i>[Q]' },
      { id: 'd', label: 'Average Δ (accuracy minus false alarms)' },
      { id: 'pi', label: 'Blind-spot share π<sub>0</sub>', key: true },
      { id: 'm4', label: 'Miss rate of 4 agents <i>M</i>(4)' },
      { id: 'm16', label: 'Miss rate of 16 agents <i>M</i>(16)' },
    ]);
    const tbl = U.tableToggle(fig);

    function update() {
      const cov = new Float64Array(NC);
      scopes.forEach((S) => S.forEach((c) => { cov[c] += 1 / NT; }));
      const D = [], Q = [];
      for (let c = 0; c < NC; c++) { const d = (1 - p) * s * cov[c]; D.push(d); Q.push(p + d); }
      const pop = C.discretePop(D, D.map(() => 1));
      const meanD = D.reduce((x, y) => x + y, 0) / NC;
      const ref = C.makePop({ acc: Math.max(1e-3, meanD), a: Infinity });

      for (let t = 0; t < NT; t++) for (let c = 0; c < NC; c++) {
        cells[t][c].setAttribute('class', 'cell click ' + (scopes[t].has(c) ? 'on' : 'off'));
      }
      for (let c = 0; c < NC; c++) {
        const y1 = yb(Q[c]), y0 = yb(p);
        bars[c].setAttribute('y', Math.min(y0, y1));
        bars[c].setAttribute('height', Math.max(0, Math.abs(y0 - y1)));
        blinds[c].textContent = D[c] === 0 ? '×' : '';
      }
      pLine.setAttribute('y1', yb(p)); pLine.setAttribute('y2', yb(p));
      pLbl.setAttribute('y', yb(p) - 4);
      pLbl.textContent = p > 0 ? 'P = ' + p.toFixed(2) : '';

      // histogram of distinct Δ values
      const counts = new Map();
      D.forEach((d) => { const key = +d.toFixed(4); counts.set(key, (counts.get(key) || 0) + 1); });
      let ymax = 0;
      counts.forEach((n) => { ymax = Math.max(ymax, n / NC); });
      hist.setY({ domain: [0, Math.min(1, Math.max(0.2, ymax * 1.15))] });
      hist.draw = (pl) => {
        counts.forEach((n, d) => {
          pl.rectV(d - 0.012, 0, d + 0.012, n / NC, 'bar ' + (d === 0 ? 'c-pen' : 's1'));
        });
        if (counts.get(0)) pl.text(0.02, counts.get(0) / NC, 'blind', 'pen small', 'start', 4, 4);
      };
      hist.render();
      mplot.draw = (pl) => {
        const ks = U.pow2(1, 32);
        const kk = [];
        for (let k = 1; k <= 32; k++) kk.push(k);
        const cur = kk.map((k) => [k, pop.M(k)]);
        const homo = kk.map((k) => [k, ref.M(k)]);
        pl.line(homo, 'c-muted dash');
        pl.line(cur, 's1');
        if (pop.blind > 0) { pl.hline(pop.blind, 'pen'); pl.text(1.1, pop.blind, 'π₀ floor', 'pen small', 'start', 0, -5); }
        pl.crosshair([{ name: 'these scopes', cls: 's1', pts: cur }, { name: 'equal coverage', cls: 'c-muted', pts: homo }], { xName: 'k', xFmt: (v) => String(Math.round(v)) });
        void ks;
      };
      mplot.render();

      const meanQ = Q.reduce((x, y) => x + y, 0) / NC;
      ro.set('q', meanQ.toFixed(3));
      ro.set('d', meanD.toFixed(3));
      ro.set('pi', C.fmtPct(pop.blind, 0), pop.blind > 0 ? '· M(k) can never go lower' : '');
      ro.set('m4', C.fmtNum(pop.M(4)));
      ro.set('m16', C.fmtNum(pop.M(16)));
      tbl.update([{
        title: 'Per requirement θ', cols: ['θ', 'templates covering', 'Q(θ)', 'P(θ)', 'Δ(θ)'],
        rows: D.map((d, c) => [String(c + 1), String(Math.round(cov[c] * NT)), Q[c].toFixed(3), p.toFixed(3), d.toFixed(3)]),
      }]);
    }
    update();
  };

  /* ================================================================== */
  /* Figure 2: judgement matrix (exchangeability and correlation)        */
  /* ================================================================== */
  Figs.matrix = function (body, fig) {
    const ND = 48, NA = 8;
    let rng = C.mulberry32(42);
    let pop = null, D = [], F = [];
    const pc = U.popControls(body, 'mx', U.POP_PRESETS.hom, (pp) => { pop = pp; resample(); render(); },
      { presets: ['hom', 'div', 'cor', 'bs', 'aon'], preset: 'hom' });
    pop = pc.pop;
    const tools = h('div', { class: 'fig-tools' });
    body.appendChild(tools);
    U.button(tools, 'Draw new defects and agents', () => { resample(); render(); }, '', 'mx-draw');

    const CW = 13, LW = 58, TB = 46, GAP = 8;
    const W = LW + ND * CW, H = TB + GAP + NA * CW + 20;
    const svg = svgEl('svg', { class: 'matrix', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Judgement matrix: agents by defects' });
    body.appendChild(svg);
    const lt = svgEl('text', { x: 0, y: TB - 4, class: 'lbl' }, svg);
    lt.textContent = 'Δ of defect';
    const visBars = [], cellsR = [];
    for (let j = 0; j < ND; j++) visBars.push(svgEl('rect', { x: LW + j * CW + 1.5, width: CW - 3, class: 'vis' }, svg));
    for (let a = 0; a < NA; a++) {
      const t = svgEl('text', { x: 0, y: TB + GAP + a * CW + CW - 3, class: 'lbl' }, svg);
      t.textContent = 'Agent ' + (a + 1);
      cellsR.push([]);
      for (let j = 0; j < ND; j++) cellsR[a].push(svgEl('rect', { x: LW + j * CW + 1, y: TB + GAP + a * CW + 1, width: CW - 2, height: CW - 2, rx: 2 }, svg));
    }
    const axl = svgEl('text', { x: LW, y: H - 4, class: 'lbl' }, svg);
    axl.textContent = 'defects, from most visible (left) to least visible (right)';
    const leg = h('div', { class: 'legend' });
    body.appendChild(leg);
    root.PlotUtil.legend(leg, [{ name: 'FLAG', cls: 'c-ink', kind: 'rect' }, { name: 'missed', cls: 'c-ctx', kind: 'rect' }, { name: 'visibility Δ', cls: 's1', kind: 'rect' }]);

    const ro = U.readouts(body, [
      { id: 'm1', label: 'One agent misses' },
      { id: 'm2', label: 'Two agents both miss' },
      { id: 'ind', label: 'Both miss, if misses were independent' },
      { id: 'rho', label: 'Correlation of two agents’ misses', key: true },
      { id: 'm8', label: 'All 8 agents miss' },
    ]);
    const say = h('p', { class: 'say' });
    body.appendChild(say);

    function resample() {
      D = [];
      for (let j = 0; j < ND; j++) D.push(pop.sampleDelta(rng));
      D.sort((x, y) => y - x);
      F = [];
      for (let a = 0; a < NA; a++) { F.push([]); for (let j = 0; j < ND; j++) F[a].push(rng() < D[j]); }
    }
    function render() {
      for (let j = 0; j < ND; j++) {
        const hgt = Math.max(0.5, D[j] * (TB - 12));
        visBars[j].setAttribute('y', TB - hgt);
        visBars[j].setAttribute('height', hgt);
      }
      let miss = 0, both = 0, pairs = 0, all = 0;
      for (let a = 0; a < NA; a++) for (let j = 0; j < ND; j++) {
        cellsR[a][j].setAttribute('class', F[a][j] ? 'f' : 'm');
        if (!F[a][j]) miss++;
      }
      for (let a = 0; a < NA; a++) for (let b = a + 1; b < NA; b++) {
        for (let j = 0; j < ND; j++) if (!F[a][j] && !F[b][j]) both++;
        pairs++;
      }
      for (let j = 0; j < ND; j++) { let any = false; for (let a = 0; a < NA; a++) if (F[a][j]) any = true; if (!any) all++; }
      const M1 = pop.M(1), M2 = pop.M(2);
      ro.set('m1', C.fmtNum(miss / (NA * ND)), 'theory M(1) = ' + C.fmtNum(M1));
      ro.set('m2', C.fmtNum(both / (pairs * ND)), 'theory M(2) = ' + C.fmtNum(M2));
      ro.set('ind', C.fmtNum(M1 * M1), '= M(1)²');
      const rho = M1 > 0 && M1 < 1 ? (M2 - M1 * M1) / (M1 * (1 - M1)) : 0;
      ro.set('rho', rho.toFixed(2), 'theory');
      ro.set('m8', C.fmtNum(all / ND), 'theory M(8) = ' + C.fmtNum(pop.M(8)));
      say.textContent = '';
      say.appendChild(h('b', { text: rho < 0.02 ? 'Misses are uncorrelated. ' : rho > 0.6 ? 'Misses travel together. ' : 'Misses cluster on hard defects. ' }));
      say.appendChild(document.createTextNode(`Two random agents both miss a defect ${C.fmtPct(M2)} of the time, against ${C.fmtPct(M1 * M1)} if they were independent. The gap, M(2) − M(1)² = ${C.fmtNum(M2 - M1 * M1)}, is the variance of 1 − Δ across defects.`));
    }
    resample();
    render();
  };

  /* ================================================================== */
  /* Figure 3: miss-curve explorer                                       */
  /* ================================================================== */
  Figs.missCurve = function (body, fig) {
    let kSel = 8, logX = false;
    const pc = U.popControls(body, 'mc', U.POP_PRESETS.div, () => render(), { preset: 'div' });
    const ctl = h('div', { class: 'controls' });
    body.appendChild(ctl);
    const sK = U.slider(ctl, { id: 'mc-k', label: 'Team size <i>k</i> to inspect', scale: 'log', min: 1, max: 256, int: true, value: kSel, fmt: (v) => String(v) });
    sK.on((v) => { kSel = v; render(); });
    const xs = U.seg(ctl, { idPrefix: 'mc-x', label: 'Δ axis', value: 'lin', items: [{ id: 'lin', label: 'Linear' }, { id: 'log', label: 'Log (zoom near 0)' }], onChange: (v) => { logX = v === 'log'; render(); } });
    void xs;

    const row = h('div', { class: 'row2' });
    body.appendChild(row);
    const L = h('div'), R = h('div');
    row.appendChild(L); row.appendChild(R);
    L.appendChild(h('p', { class: 'panel-title', text: 'Who is hard to see: the law of Δ' }));
    const lsub = h('p', { class: 'panel-sub' });
    L.appendChild(lsub);
    const dBox = h('div');
    L.appendChild(dBox);
    const dleg = h('div', { class: 'legend' });
    L.appendChild(dleg);
    R.appendChild(h('p', { class: 'panel-title', text: 'Miss curve M(k), log–log' }));
    R.appendChild(h('p', { class: 'panel-sub', text: 'Total orange area on the left equals the value marked here.' }));
    const mBox = h('div');
    R.appendChild(mBox);
    const row2 = h('div', { class: 'row2' });
    body.appendChild(row2);
    const L2 = h('div'), R2 = h('div');
    row2.appendChild(L2); row2.appendChild(R2);
    L2.appendChild(h('p', { class: 'panel-title', text: 'Coverage exponent a(k) = log₂ M(k)/M(2k)' }));
    const aBox = h('div');
    L2.appendChild(aBox);
    const ro = U.readouts(R2, [
      { id: 'acc', label: 'Per-agent accuracy <i>E</i>[Δ] = 1 − <i>M</i>(1)' },
      { id: 'mk', label: 'Miss rate <i>M</i>(<i>k</i>)', key: true },
      { id: 'm64', label: '<i>M</i>(64)' },
      { id: 'pi', label: 'Blind spot π<sub>0</sub>' },
      { id: 'ak', label: 'Coverage exponent <i>a</i>(<i>k</i>)', key: true },
      { id: 'gain', label: 'Horizon gain, 8 → 64 agents' },
    ]);
    const say = h('p', { class: 'say', style: 'margin-top:10px' });
    R2.appendChild(say);
    const tbl = U.tableToggle(fig);

    const dplot = new root.Plot(dBox, { height: 230, margin: { l: 46, r: 12, t: 10, b: 38 }, x: { type: 'lin', domain: [0, 1], label: 'visibility Δ' }, y: { type: 'lin', domain: [0, 1], label: 'share of defects' } });
    const mplot = new root.Plot(mBox, { height: 250, margin: { l: 50, r: 14, t: 10, b: 38 }, x: { type: 'log', base: 2, domain: [1, 1024], label: 'team size k' }, y: { type: 'log', domain: [1e-6, 1], label: 'M(k)' } });
    const aplot = new root.Plot(aBox, { height: 200, margin: { l: 46, r: 14, t: 10, b: 38 }, x: { type: 'log', base: 2, domain: [1, 512], label: 'team size k' }, y: { type: 'lin', domain: [0, 3], label: 'a(k)' } });
    root.PlotUtil.legend(dleg, [
      { name: 'all defects', cls: 's1', kind: 'rect' },
      { name: 'still missed by k agents', cls: 's2', kind: 'rect' },
      { name: 'blind spot (Δ = 0)', cls: 'c-pen', kind: 'rect' },
    ]);

    // mass in bins [lo, hi) for the continuous part and for the part still missed by k agents
    function bins(pop, k) {
      const edges = [];
      const NB = 24;
      if (logX) { for (let i = 0; i <= NB; i++) edges.push(1e-4 * Math.pow(1e4, i / NB)); edges[0] = 0; }
      else for (let i = 0; i <= NB; i++) edges.push(i / NB);
      const out = [];
      if (pop.kind === 'beta') {
        const a = pop.a, b = pop.b, w = 1 - pop.pi0, Rk = pop.R(k);
        let I0 = 0, J0 = 0;
        for (let i = 1; i <= NB; i++) {
          const I1 = C.ibeta(edges[i], a, b), J1 = C.ibeta(edges[i], a, b + k);
          out.push({ lo: edges[i - 1], hi: edges[i], all: w * (I1 - I0), miss: w * Rk * (J1 - J0) });
          I0 = I1; J0 = J1;
        }
      } else {
        // atoms only (homogeneous or all-or-nothing)
        const disc = pop.discretize();
        const atoms = disc.d.map((d, i) => [d, disc.w[i]]).filter(([d]) => d > 0);
        for (let i = 1; i <= NB; i++) {
          let all = 0, miss = 0;
          for (const [d, wt] of atoms) if (d >= edges[i - 1] && (d < edges[i] || (i === NB && d <= 1))) { all += wt; miss += wt * Math.pow(1 - d, k); }
          out.push({ lo: edges[i - 1], hi: edges[i], all, miss });
        }
      }
      return out;
    }

    function render() {
      const pop = pc.pop;
      const k = kSel;
      const Mk = pop.M(k);
      lsub.textContent = logX
        ? 'Bars hold the share of defects in each visibility band (log-spaced bands, so the hard tail near 0 is visible).'
        : 'Bars hold the share of defects in each visibility band. Orange is the part of each band that a team of k still misses.';

      // ---- law of Δ
      const B = bins(pop, k);
      const blind = pop.blind;
      dplot.setX(logX ? { type: 'log', domain: [5e-5, 1], label: 'visibility Δ (log scale)', ticks: [1e-4, 1e-3, 1e-2, 0.1, 1] } : { type: 'lin', domain: [-0.06, 1], label: 'visibility Δ', ticks: [0, 0.25, 0.5, 0.75, 1] });
      let ymax = blind;
      B.forEach((b) => { ymax = Math.max(ymax, b.all); });
      dplot.setY({ domain: [0, Math.max(0.05, ymax * 1.12)], fmt: (v) => (v < 0.1 ? (100 * v).toFixed(1) : Math.round(100 * v)) + '%' });
      dplot.draw = (pl) => {
        for (const b of B) {
          const lo = logX ? Math.max(b.lo, 5e-5) : b.lo;
          if (b.all > 0) pl.rectV(lo, 0, b.hi, b.all, 'bar s1 soft');
          if (b.miss > 1e-12) pl.rectV(lo, 0, b.hi, b.miss, 'bar s2');
        }
        if (blind > 0) {
          const x0 = logX ? 5e-5 : -0.05, x1 = logX ? 8e-5 : -0.01;
          pl.rectV(x0, 0, x1, blind, 'bar c-pen');
          pl.text(x1, blind, `π₀ = ${C.fmtPct(blind)}`, 'pen small', 'start', 4, 10);
        }
      };
      dplot.render();

      // ---- M(k)
      const grid = U.logGrid(1, 1024, 180);
      const curve = grid.map((x) => [x, pop.M(x)]);
      let minM = 1;
      curve.forEach((p) => { if (p[1] > 0) minM = Math.min(minM, p[1]); });
      const bottom = Math.max(1e-7, Math.pow(10, Math.floor(Math.log10(Math.max(minM, 1e-7)))));
      mplot.setY({ domain: [Math.min(bottom, 1e-2), 1.2] });
      mplot.draw = (pl) => {
        if (pop.kind === 'beta' && isFinite(pop.C)) {
          const asym = grid.map((x) => [x, pop.pi0 + pop.C * Math.pow(x, -pop.a)]);
          pl.line(asym, 'c-muted dash');
          pl.text(1024, pop.pi0 + pop.C * Math.pow(1024, -pop.a), `slope −${C.fmtNum(pop.a)}`, 'small', 'end', -4, -8);
        }
        if (blind > 0) { pl.hline(blind, 'pen'); pl.text(1.1, blind, 'π₀ floor', 'pen small', 'start', 0, -5); }
        pl.line(curve, 's1');
        pl.vline(k, 'solid');
        pl.dot(k, Mk, 5, 's2');
        pl.text(k, Mk, `M(${k}) = ${C.fmtNum(Mk)}`, 'strong', k > 64 ? 'end' : 'start', k > 64 ? -8 : 8, -8);
        pl.crosshair([{ name: 'M(k)', cls: 's1', pts: curve }], { xName: 'k', xFmt: (v) => C.fmtNum(v) });
      };
      mplot.render();

      // ---- a(k)
      const ag = U.logGrid(1, 512, 160).map((x) => [x, pop.aExp(x)]);
      let amax = 1.5;
      ag.forEach((p) => { if (isFinite(p[1])) amax = Math.max(amax, p[1]); });
      const tail = pop.aEff;
      const top = Math.min(8, Math.max(2.2, Math.min(amax, isFinite(tail) ? tail * 1.4 + 0.5 : amax) * 1.1));
      aplot.setY({ domain: [0, top] });
      aplot.draw = (pl) => {
        pl.hline(1, 'pen');
        pl.text(512, 1, 'a = 1', 'pen small', 'end', -4, -6);
        if (isFinite(tail) && tail > 0 && tail < top) { pl.hline(tail, ''); pl.text(1.05, tail, `tail exponent a = ${C.fmtNum(tail)}`, 'small', 'start', 2, -6); }
        pl.line(ag, 's1');
        const ak = pop.aExp(k);
        if (isFinite(ak) && ak <= top) pl.dot(k, ak, 5, 's2');
        pl.crosshair([{ name: 'a(k)', cls: 's1', pts: ag }], { xName: 'k', xFmt: (v) => C.fmtNum(v), yFmt: (v) => v.toFixed(2) });
      };
      aplot.render();

      const ak = pop.aExp(k);
      ro.set('acc', pop.acc.toFixed(2));
      ro.set('mk', C.fmtNum(Mk), `k = ${k}`);
      ro.set('m64', C.fmtNum(pop.M(64)));
      ro.set('pi', C.fmtPct(blind));
      ro.set('ak', isFinite(ak) ? ak.toFixed(2) : '∞', `at k = ${k}`);
      ro.set('gain', '×' + C.fmtNum(pop.M(8) / pop.M(64)));
      say.textContent = '';
      let msg;
      if (blind > 0 && Mk < 1.6 * blind) msg = `Most of what ${k} agents miss is the blind spot itself: ${C.fmtPct(blind / Mk)} of their misses have Δ = 0. Adding agents cannot fix those.`;
      else if (!isFinite(ak) || ak > 1) msg = `Doubling from ${k} to ${2 * k} agents divides the miss rate by ${isFinite(ak) ? C.fmtNum(Math.pow(2, ak)) : 'a huge factor'}, so the safe depth more than doubles.`;
      else msg = `Doubling from ${k} to ${2 * k} agents divides the miss rate by only ${C.fmtNum(Math.pow(2, ak))}, so the safe depth grows by less than 2×.`;
      say.appendChild(h('b', { text: 'Reading: ' }));
      say.appendChild(document.createTextNode(msg));
      const ks = U.pow2(1, 1024);
      tbl.update([{ title: 'Miss curve and coverage exponent', cols: ['k', 'M(k)', 'a(k)', 'Λ(k)'], rows: ks.map((x) => [String(x), C.fmtNum(pop.M(x)), x <= 512 ? pop.aExp(x).toFixed(3) : '', pop.Lambda(x).toFixed(3)]) }]);
    }
    render();
  };
})(window);
