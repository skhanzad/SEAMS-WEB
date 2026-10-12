/* fig-measure.js — figures for Parts III–VI:
   Figure 11 calibration lab, 12 identified set, 13 team builder,
   14 paper's selection results, 15 your-data protocol tool. */
(function (root) {
  'use strict';
  const C = root.Core, U = root.UI, h = U.h, Figs = root.Figs;
  const svgEl = root.PlotUtil.svgEl;
  const fmt = C.fmtNum, pct = C.fmtPct;

  // merge LP atoms that sit on neighbouring grid points into single atoms
  function mergeAtoms(at) {
    const out = [];
    at.d.forEach((d, i) => {
      const w = at.w[i];
      const last = out[out.length - 1];
      if (last && d > 0 && last.d > 0 && Math.abs(d - last.d) < 0.03) {
        const W = last.w + w;
        last.d = (last.d * last.w + d * w) / W;
        last.w = W;
      } else out.push({ d, w });
    });
    return out;
  }

  /* ================================================================== */
  /* Figure 11: calibration lab                                          */
  /* ================================================================== */
  Figs.calibration = function (body, fig) {
    let N = 1000, K = 16, j = 4, seed = 5;
    let est = null, flags = null, reps = null, repsStale = false;
    const pc = U.popControls(body, 'cl', U.POP_PRESETS.one, () => { fresh(); }, { presets: ['div', 'one', 'cor', 'bs'], preset: 'one' });
    const ctl = h('div', { class: 'controls' });
    body.appendChild(ctl);
    U.slider(ctl, { id: 'cl-n', label: 'Labelled defects <i>N</i>', scale: 'log', min: 50, max: 20000, int: true, value: N, fmt: (v) => v.toLocaleString('en-US') }).on((v, why) => { N = v; if (why !== 'input') fresh(); else throttledFresh(); });
    const kSeg = U.seg(ctl, { idPrefix: 'cl-k', label: 'Agents per defect K', value: String(K), items: [4, 8, 16, 32, 64].map((x) => ({ id: String(x), label: String(x) })), onChange: (v) => { K = +v; if (j > K / 2) j = K / 2; buildJ(); fresh(); } });
    const jWrap = h('div');
    ctl.appendChild(jWrap);
    let jSeg = null;
    function buildJ() {
      jWrap.textContent = '';
      const items = [];
      for (let x = 1; x <= K / 2; x *= 2) items.push({ id: String(x), label: String(x) });
      jSeg = U.seg(jWrap, { idPrefix: 'cl-j', label: 'Exponent at j', value: String(j), items, onChange: (v) => { j = +v; render(); } });
    }
    buildJ();
    void kSeg; void jSeg;
    const tools = h('div', { class: 'fig-tools' });
    body.appendChild(tools);
    U.button(tools, 'Run a new calibration', () => { seed++; fresh(); }, '', 'cl-run');
    const repBtn = U.button(tools, 'Repeat 200 times', () => repeat(), 'primary', 'cl-rep');

    const row = h('div', { class: 'row3' });
    body.appendChild(row);
    const mk = (title, sub) => {
      const d = h('div');
      d.appendChild(h('p', { class: 'panel-title', text: title }));
      const s = h('p', { class: 'panel-sub', text: sub });
      d.appendChild(s);
      const b = h('div');
      d.appendChild(b);
      row.appendChild(d);
      return { b, s };
    };
    const c1 = mk('How many agents flagged each defect', 'This histogram is all the data there is.');
    const c2 = mk('Estimated miss curve', 'Dots ±2 standard errors; line is the truth.');
    const c3 = mk('Spread of â(j) over 200 calibrations', 'Press "Repeat 200 times".');
    const ro = U.readouts(body, [
      { id: 'ahat', label: 'Estimate <i>â</i>(<i>j</i>) ± data-based s.e.', key: true },
      { id: 'atrue', label: 'True <i>a</i>(<i>j</i>)' },
      { id: 'se11', label: 'Eq. (11) standard error' },
      { id: 'obs', label: 'Observed spread (200 runs)' },
      { id: 'nm', label: '<i>N</i>·<i>M</i>(2<i>j</i>): defects a 2<i>j</i>-team still misses' },
      { id: 'need', label: 'Defects needed for ±0.1' },
    ]);
    const say = h('p', { class: 'say' });
    body.appendChild(say);
    const tbl = U.tableToggle(fig);
    const p1 = new root.Plot(c1.b, { height: 210, margin: { l: 44, r: 10, t: 8, b: 38 }, x: { type: 'lin', domain: [-0.5, 16.5], label: 'flags out of K' }, y: { type: 'lin', domain: [0, 0.3], label: 'share', fmt: (v) => Math.round(v * 100) + '%' } });
    const p2 = new root.Plot(c2.b, { height: 210, margin: { l: 50, r: 10, t: 8, b: 38 }, x: { type: 'log', base: 2, domain: [1, 16], label: 'team size j' }, y: { type: 'log', domain: [1e-4, 1], label: 'M(j)' } });
    const p3 = new root.Plot(c3.b, { height: 210, margin: { l: 40, r: 10, t: 8, b: 38 }, x: { type: 'lin', domain: [0, 2], label: 'â(j)' }, y: { type: 'lin', domain: [0, 1], label: 'runs', ticks: [] } });

    const throttledFresh = U.debounce(() => fresh(), 120);
    function fresh() {
      flags = C.simulateFlags(pc.pop, N, K, C.mulberry32(seed * 7717 + K));
      est = C.estimateMissCurve(flags, K);
      if (reps) repsStale = true;
      render();
    }
    function repeat() {
      repBtn.disabled = true;
      repBtn.textContent = 'Running…';
      setTimeout(() => {
        const rng = C.mulberry32(seed * 31 + 7);
        const vals = [];
        for (let r = 0; r < 200; r++) {
          const e = C.estimateMissCurve(C.simulateFlags(pc.pop, N, K, rng), K);
          const a = Math.log2(e.Mhat[j] / e.Mhat[2 * j]);
          vals.push(a);
        }
        reps = { vals, j, K, N };
        repsStale = false;
        repBtn.disabled = false;
        repBtn.textContent = 'Repeat 200 times';
        render();
      }, 20);
    }

    function render() {
      const pop = pc.pop;
      const hist = est.hist;
      p1.setX({ domain: [-0.5, K + 0.5], ticks: K <= 16 ? null : [0, K / 4, K / 2, (3 * K) / 4, K] });
      let hmax = 0;
      for (let f = 0; f <= K; f++) hmax = Math.max(hmax, hist[f] / N);
      p1.setY({ domain: [0, Math.max(0.05, hmax * 1.15)] });
      p1.draw = (pl) => {
        const w = Math.min(0.42, 0.42 * 16 / K + 0.1);
        for (let f = 0; f <= K; f++) if (hist[f]) pl.rectV(f - w, 0, f + w, hist[f] / N, 'bar ' + (f === 0 ? 'c-pen' : 's1'));
        if (hist[0]) pl.text(0, hist[0] / N, 'missed by all', 'pen small', 'start', 6, 2);
      };
      p1.render();

      const se = (x) => est.sd[x] / Math.sqrt(N);
      const pts = [];
      for (let x = 1; x <= K; x++) pts.push([x, est.Mhat[x]]);
      const truth = U.logGrid(1, K, 60).map((x) => [x, pop.M(x)]);
      let lo = 1;
      pts.forEach((p) => { if (p[1] > 0) lo = Math.min(lo, p[1] - 2 * se(p[0])); });
      truth.forEach((p) => { lo = Math.min(lo, p[1]); });
      p2.setX({ domain: [1, K] });
      p2.setY({ domain: [Math.max(1e-6, Math.min(0.5, lo > 0 ? lo / 2 : 1 / (N * 4))), 1.2] });
      p2.draw = (pl) => {
        pl.line(truth, 'c-ink thin');
        pts.forEach(([x, v]) => {
          const s2 = 2 * se(x);
          const yl = Math.max(pl.o.y.domain[0], v - s2);
          if (v > 0) {
            pl.seg(x, yl, x, v + s2, 'ln s1 thin');
            pl.dot(x, v, 3.5, x === j || x === 2 * j ? 's2' : 's1');
          } else {
            pl.dot(x, pl.o.y.domain[0] * 1.15, 3.5, 's1 hollow');
          }
        });
        pl.crosshair([{ name: 'estimate', cls: 's1', pts }, { name: 'truth', cls: 'c-ink', pts: truth }], { xName: 'j', xFmt: (v) => fmt(v) });
      };
      p2.render();

      const ahat = Math.log2(est.Mhat[j] / est.Mhat[2 * j]);
      const seData = C.seAFromData(est, j);
      const se11 = C.seA(pop.M, j, N);
      ro.set('ahat', isFinite(ahat) ? ahat.toFixed(2) + ' ± ' + (isFinite(seData) ? seData.toFixed(2) : '∞') : 'undefined', isFinite(ahat) ? '' : '(no defect missed by 2j agents)');
      ro.set('atrue', pop.aExp(j).toFixed(3));
      ro.set('se11', se11.toFixed(3), '(U observed exactly)');
      const nm = N * pop.M(2 * j);
      ro.set('nm', fmt(nm), nm > 30 ? '≫ 1, fine' : nm > 5 ? 'borderline' : 'too few');
      ro.set('need', fmt(Math.ceil(N * Math.pow(Math.max(seData || se11, se11) / 0.1, 2))));

      if (reps && !repsStale && reps.j === j && reps.K === K && reps.N === N) {
        const vals = reps.vals.filter(isFinite);
        const mean = vals.reduce((x, y) => x + y, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((x, y) => x + (y - mean) * (y - mean), 0) / (vals.length - 1));
        ro.set('obs', sd.toFixed(3), vals.length < 200 ? `(${200 - vals.length} runs undefined)` : '');
        c3.s.textContent = 'Each bar counts calibrations whose estimate landed there. Red line: truth.';
        const lo3 = Math.min(...vals, pop.aExp(j)) - 0.1, hi3 = Math.max(...vals, pop.aExp(j)) + 0.1;
        p3.setX({ domain: [lo3, hi3], ticks: null });
        const NB = 20, bw = (hi3 - lo3) / NB;
        const cnt = new Array(NB).fill(0);
        vals.forEach((v) => { cnt[Math.min(NB - 1, Math.max(0, Math.floor((v - lo3) / bw)))]++; });
        p3.setY({ domain: [0, Math.max(...cnt) * 1.15] });
        p3.draw = (pl) => {
          cnt.forEach((n, i) => { if (n) pl.rectV(lo3 + i * bw + bw * 0.08, 0, lo3 + (i + 1) * bw - bw * 0.08, n, 'bar s1'); });
          const at = pop.aExp(j);
          pl.vline(at, 'pen solid');
          pl.text(at, pl.o.y.domain[1], 'true ' + at.toFixed(2), 'pen small', 'start', 4, 12);
          pl.seg(at - se11, pl.o.y.domain[1] * 0.08, at + se11, pl.o.y.domain[1] * 0.08, 'ln s2');
          pl.text(at + se11, pl.o.y.domain[1] * 0.08, '±Eq. (11)', 'small', 'start', 4, 4);
        };
        p3.render();
      } else {
        ro.set('obs', reps ? 'stale' : '–', reps ? '(settings changed)' : '');
        c3.s.textContent = reps ? 'Settings changed. Press "Repeat 200 times" to refresh.' : 'Press "Repeat 200 times".';
        p3.draw = null;
        p3.render();
      }
      say.textContent = '';
      say.appendChild(h('b', { text: nm < 5 ? 'Too few hard defects. ' : 'Reading: ' }));
      say.appendChild(document.createTextNode(nm < 5
        ? `Only about ${fmt(nm)} of the ${N.toLocaleString('en-US')} defects would slip past a ${2 * j}-agent team, so M(${2 * j}) and the exponent rest on a handful of cases. Raise N or look at a smaller j.`
        : `Eq. (11) treats each defect's miss probability as known. With ${K} agents per defect the panel adds its own noise, which is why the data-based error is larger; the gap closes as K grows.`));
      const rows = [];
      for (let x = 1; x <= K; x *= 2) rows.push([String(x), est.Mhat[x].toFixed(5), (2 * se(x)).toFixed(5), pop.M(x).toFixed(5)]);
      tbl.update([{ title: 'Estimated miss curve', cols: ['j', 'M̂(j)', '±2 s.e.', 'true M(j)'], rows }]);
    }
    fresh();
    repeat();
  };

  /* ================================================================== */
  /* Figure 12: the identified set                                       */
  /* ================================================================== */
  Figs.identify = function (body, fig) {
    let K = 8;
    const KP = 64;
    const pc = U.popControls(body, 'id', U.POP_PRESETS.one, () => schedule(), { presets: ['div', 'one', 'cor', 'bs', 'big'], preset: 'one' });
    const ctl = h('div', { class: 'controls' });
    body.appendChild(ctl);
    U.slider(ctl, { id: 'id-k', label: 'Agents in calibration <i>K</i>', min: 2, max: 10, step: 1, int: true, value: K, fmt: String }).on((v) => { K = v; schedule(); });

    const row = h('div', { class: 'row-side' });
    body.appendChild(row);
    const L = h('div'), R = h('div', { style: 'display:grid;gap:10px;align-content:start' });
    row.appendChild(L); row.appendChild(R);
    L.appendChild(h('p', { class: 'panel-title', text: 'Miss curve: measured, identified, true' }));
    const b1 = h('div');
    L.appendChild(b1);
    const leg = h('div', { class: 'legend' });
    L.appendChild(leg);
    root.PlotUtil.legend(leg, [
      { name: 'measured M(1..K)', cls: 's1', kind: 'dot' },
      { name: 'identified interval, Eq. (12)', cls: 's1', kind: 'band' },
      { name: 'truth (unknown in practice)', cls: 'c-ink', kind: 'line' },
      { name: 'trivial bound M(k′) ≤ M(K)', cls: 'c-muted', kind: 'dash' },
    ]);
    const ro = U.readouts(R, [
      { id: 'int', label: '<i>M</i>(64) is somewhere in', key: true },
      { id: 'truth', label: 'True <i>M</i>(64)' },
      { id: 'hor', label: 'Horizon uncertainty for 64 agents' },
      { id: 'pi', label: 'π<sub>0</sub> is somewhere in', key: true },
      { id: 'pit', label: 'True π<sub>0</sub>' },
      { id: 'triv', label: 'Upper bound vs trivial <i>M</i>(<i>K</i>)' },
    ]);
    const say = h('p', { class: 'say' });
    R.appendChild(say);
    const row2 = h('div', { class: 'row3' });
    body.appendChild(row2);
    const mk = (title, sub) => {
      const d = h('div');
      d.appendChild(h('p', { class: 'panel-title', text: title }));
      const s = h('p', { class: 'panel-sub', text: sub });
      d.appendChild(s);
      const b = h('div');
      d.appendChild(b);
      row2.appendChild(d);
      return { b, s };
    };
    const e1 = mk('Optimistic population', 'Matches your data; smallest possible M(64).');
    const e2 = mk('Pessimistic population', 'Matches your data; largest possible M(64).');
    const e3 = mk('What K agents actually measure', 'Share of defects flagged by exactly f of the K agents.');
    const tbl = U.tableToggle(fig);
    const p1 = new root.Plot(b1, { height: 280, margin: { l: 50, r: 14, t: 10, b: 40 }, x: { type: 'log', base: 2, domain: [1, 128], label: 'team size' }, y: { type: 'log', domain: [1e-4, 1], label: 'M' } });
    const pe1 = new root.Plot(e1.b, { height: 150, margin: { l: 40, r: 10, t: 8, b: 34 }, x: { type: 'lin', domain: [-0.04, 1.02], label: 'Δ', ticks: [0, 0.5, 1] }, y: { type: 'lin', domain: [0, 1], label: 'mass', ticks: [0, 0.5, 1] } });
    const pe2 = new root.Plot(e2.b, { height: 150, margin: { l: 40, r: 10, t: 8, b: 34 }, x: { type: 'lin', domain: [-0.04, 1.02], label: 'Δ', ticks: [0, 0.5, 1] }, y: { type: 'lin', domain: [0, 1], label: 'mass', ticks: [0, 0.5, 1] } });
    const pe3 = new root.Plot(e3.b, { height: 150, margin: { l: 40, r: 10, t: 8, b: 34 }, x: { type: 'lin', domain: [-0.6, 8.6], label: 'f flags of K' }, y: { type: 'lin', domain: [0, 1], label: 'share', fmt: (v) => Math.round(v * 100) + '%' } });

    let timer = null;
    function schedule() { clearTimeout(timer); timer = setTimeout(compute, 40); }
    function stems(pl, atoms, cls) {
      let ymax = 0;
      atoms.forEach((a) => { ymax = Math.max(ymax, a.w); });
      atoms.forEach((a) => {
        pl.seg(a.d, 0, a.d, a.w, 'stem ' + (a.d === 0 ? 'c-pen' : cls));
        pl.dot(a.d, a.w, 4, a.d === 0 ? 'c-pen' : cls);
      });
      const z = atoms.find((a) => a.d === 0);
      if (z && z.w > 0.002) pl.text(0, z.w, 'blind ' + pct(z.w), 'pen small', 'start', 6, 4);
      return ymax;
    }
    function compute() {
      const pop = pc.pop;
      const disc = pop.discretize(40, 90);
      const kList = [];
      for (const x of U.logGrid(K + 1, 128, 16)) { const r = Math.round(x); if (!kList.includes(r)) kList.push(r); }
      if (!kList.includes(KP)) kList.push(KP);
      kList.sort((a, b) => a - b);
      const res = C.identify(disc, K, kList, { extremalAt: KP });
      const meas = [];
      for (let x = 1; x <= K; x++) meas.push([x, res.truthM(x)]);
      const truth = U.logGrid(1, 128, 90).map((x) => [x, res.truthM(x)]);
      const lo = kList.map((x, i) => [x, res.lo[i]]), hi = kList.map((x, i) => [x, res.hi[i]]);
      const bandLo = [[K, res.trivial]].concat(lo), bandHi = [[K, res.trivial]].concat(hi);
      let ymin = 1;
      truth.concat(lo).forEach((p) => { if (p[1] > 0) ymin = Math.min(ymin, p[1]); });
      p1.setY({ domain: [Math.max(1e-8, ymin / 3), 1.2] });
      p1.draw = (pl) => {
        pl.area(bandHi, bandLo.map((p) => [p[0], Math.max(p[1], pl.o.y.domain[0])]), 's1 band');
        pl.line(bandHi, 's1 thin');
        pl.line(bandLo, 's1 thin');
        pl.seg(K, res.trivial, 128, res.trivial, 'ln c-muted dash');
        pl.line(truth, 'c-ink thin');
        meas.forEach(([x, v]) => pl.dot(x, v, 4, 's1'));
        pl.vline(KP, 'solid');
        pl.text(KP, res.hi[kList.indexOf(KP)], 'k′ = 64', 'small', 'end', -6, -8);
        pl.vline(K + 0.5, '');
        pl.text(K, pl.o.y.domain[0], 'measured ← → extrapolated', 'small', 'middle', 0, -8);
        pl.crosshair([
          { name: 'upper end', cls: 's1', pts: hi },
          { name: 'truth', cls: 'c-ink', pts: kList.map((x) => [x, res.truthM(x)]) },
          { name: 'lower end', cls: 's1', pts: lo },
        ], { xName: 'k′', xFmt: (v) => String(Math.round(v)) });
      };
      p1.render();

      const ex = res.extremal;
      const A1 = ex ? mergeAtoms(ex.lo) : [], A2 = ex ? mergeAtoms(ex.hi) : [];
      const ym = Math.max(0.1, ...A1.map((a) => a.w), ...A2.map((a) => a.w)) * 1.2;
      pe1.setY({ domain: [0, ym], ticks: [0, +(ym / 2).toFixed(2)] });
      pe2.setY({ domain: [0, ym], ticks: [0, +(ym / 2).toFixed(2)] });
      pe1.draw = (pl) => stems(pl, A1, 's3');
      pe2.draw = (pl) => stems(pl, A2, 's2');
      pe1.render(); pe2.render();
      if (ex) {
        e1.s.textContent = `Matches your data exactly. M(64) = ${fmt(ex.loVal)}, horizon ∝ ${fmt(1 / ex.loVal)}.`;
        e2.s.textContent = `Matches your data exactly. M(64) = ${fmt(ex.hiVal)}, horizon ∝ ${fmt(1 / ex.hiVal)}.`;
      }
      const b = res.bvec; // b[j] = P(exactly j of K miss) -> f = K - j flags
      pe3.setX({ domain: [-0.6, K + 0.6], ticks: null });
      let bm = 0.05;
      b.forEach((x) => { bm = Math.max(bm, x); });
      pe3.setY({ domain: [0, bm * 1.15] });
      pe3.draw = (pl) => { for (let jj = 0; jj <= K; jj++) { const f = K - jj; pl.rectV(f - 0.35, 0, f + 0.35, b[jj], 'bar ' + (f === 0 ? 'c-pen' : 's1')); } };
      pe3.render();

      const i64 = kList.indexOf(KP);
      const lo64 = res.lo[i64], hi64 = res.hi[i64];
      ro.set('int', `[${fmt(lo64)}, ${fmt(hi64)}]`);
      ro.set('truth', fmt(res.truth[i64]));
      ro.set('hor', '×' + fmt(hi64 / Math.max(lo64, 1e-300)), 'between ends');
      ro.set('pi', `[${fmt(res.pi0.lo)}, ${fmt(res.pi0.hi)}]`);
      ro.set('pit', fmt(res.pi0.truth));
      ro.set('triv', '×' + fmt(res.trivial / hi64), 'tighter');
      say.textContent = '';
      say.appendChild(h('b', { text: res.pi0.lo <= 1e-9 ? 'The lower bound on π₀ is 0. ' : 'Boundary case. ' }));
      say.appendChild(document.createTextNode(res.pi0.lo <= 1e-9
        ? `Even ${res.pi0.truth > 0 ? 'with a true blind spot of ' + pct(res.pi0.truth) : 'here'}, some population with no blind spot fits the ${K} measured moments exactly, so the data can never prove more agents would not help. The upper end ${fmt(hi64)} is a guarantee: a 64-agent team misses at most that often.`
        : `This population has only a few distinct visibility levels, so its moments sit on the edge of the moment cone and pin it down. Real, noisy data never sits exactly on that edge.`));
      tbl.update([{ title: 'Identified intervals', cols: ['k′', 'lower', 'true', 'upper'], rows: kList.map((x, i) => [String(x), fmt(res.lo[i]), fmt(res.truth[i]), fmt(res.hi[i])]) }]);
    }
    compute();
  };

  /* ================================================================== */
  /* Figure 13: team builder                                             */
  /* ================================================================== */
  Figs.teams = function (body, fig) {
    let presetKey = 'gs', k = 4, eta = 0.4, S = [];
    function buildPool() {
      if (presetKey === 'gs') {
        const mu = [1 - eta], types = ['A'];
        for (let i = 1; i <= k; i++) { mu.push(eta / k); types.push('B' + i); }
        const q = [], names = [];
        for (let i = 0; i < k; i++) { q.push(mu.map((_, t) => (t === 0 ? 1 : 0))); names.push('Generalist ' + (i + 1)); }
        for (let i = 0; i < k; i++) { q.push(mu.map((_, t) => (t === i + 1 ? 1 : 0))); names.push('Specialist B' + (i + 1)); }
        return { mu, q, names, types };
      }
      if (presetKey === 'roles') {
        const mu = [0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.09, 0.09, 0.10];
        const types = mu.map((_, t) => 'T' + (t + 1));
        const scope = (on, val, extra) => mu.map((_, t) => (on.includes(t) ? val : (extra && extra[t]) || 0));
        const A = [0, 1, 2, 3, 4, 5];
        const q = [
          scope(A, 0.85, { 6: 0.1 }), scope(A, 0.8, { 7: 0.2 }), scope([0, 1, 2, 3, 4], 0.9, { 5: 0.5 }), scope(A, 0.85),
          scope([6, 7, 8], 0.8), scope([6, 7, 8], 0.75), scope([6, 7], 0.85, { 8: 0.4 }),
          scope([9, 10], 0.8), scope([9, 10], 0.7, { 11: 0.2 }),
          scope([11], 0.85), scope([11], 0.8, { 0: 0.3 }), scope([5, 8], 0.7),
        ];
        const names = ['Planner audit 1', 'Planner audit 2', 'Planner audit 3', 'Planner audit 4', 'Interface 1', 'Interface 2', 'Interface 3', 'Numerics 1', 'Numerics 2', 'Security 1', 'Security 2', 'Edge cases'];
        return { mu, q, names, types };
      }
      // nested: one scalar difficulty, detection non-increasing in it
      const mu = [0.25, 0.2, 0.15, 0.12, 0.1, 0.08, 0.05, 0.03, 0.02];
      const types = mu.map((_, t) => 'd' + (t + 1));
      const spec = [[8, 0.6], [7, 0.7], [6, 0.8], [5, 0.85], [4, 0.9], [3, 0.95], [2, 0.6], [5, 0.5], [8, 0.3], [1, 0.9]];
      const q = spec.map(([thr, s]) => mu.map((_, t) => (t <= thr ? s : 0)));
      const names = spec.map(([thr, s]) => `up to d${thr + 1}, skill ${s}`);
      return { mu, q, names, types };
    }
    let pool = buildPool();

    const ctl = h('div', { class: 'controls' });
    body.appendChild(ctl);
    const pre = U.seg(ctl, {
      idPrefix: 'tm-pre', label: 'Pool', value: presetKey,
      items: [{ id: 'gs', label: 'Generalists vs specialists' }, { id: 'roles', label: 'Role templates' }, { id: 'nested', label: 'Nested blind spots' }],
      onChange: (v) => { presetKey = v; etaWrap.hidden = v !== 'gs'; if (v !== 'gs') k = Math.min(k, 6); pool = buildPool(); S = C.selectTopK(pool, k); render(); },
    });
    pre.el.style.gridColumn = '1 / -1';
    const sK = U.slider(ctl, { id: 'tm-k', label: 'Team size <i>k</i>', min: 2, max: 6, step: 1, int: true, value: k, fmt: String });
    sK.on((v) => { k = v; if (presetKey === 'gs') pool = buildPool(); S = C.selectTopK(pool, k); render(); });
    const etaWrap = h('div');
    ctl.appendChild(etaWrap);
    U.slider(etaWrap, { id: 'tm-eta', label: 'Mass of rare kinds η', min: 0.05, max: 0.9, step: 0.01, value: eta, fmt: (v) => v.toFixed(2) }).on((v) => { eta = v; pool = buildPool(); render(); });
    const rules = h('div', { class: 'fig-tools' });
    body.appendChild(rules);
    rules.appendChild(h('span', { class: 'seg-label', text: 'Choose by' }));
    U.button(rules, 'Most accurate k', () => { S = C.selectTopK(pool, k); render(); }, '', 'tm-top');
    U.button(rules, 'Greedy coverage', () => { S = C.selectGreedy(pool, k); render(); }, '', 'tm-greedy');
    U.button(rules, 'Best possible', () => { S = C.selectOptimal(pool, k); render(); }, '', 'tm-opt');
    let rs = 1;
    U.button(rules, 'Random', () => { const r = C.mulberry32(rs++ * 977); const idx = pool.q.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; } S = idx.slice(0, k); render(); }, '', 'tm-rand');
    U.button(rules, 'Clear', () => { S = []; render(); }, 'quiet', 'tm-clear');

    const row = h('div', { class: 'row-side' });
    body.appendChild(row);
    const L = h('div'), R = h('div', { style: 'display:grid;gap:10px;align-content:start' });
    row.appendChild(L); row.appendChild(R);
    L.appendChild(h('p', { class: 'panel-title', text: 'Pool (click a row to add or remove that agent)' }));
    const mbox = h('div');
    L.appendChild(mbox);
    const ro = U.readouts(R, [
      { id: 'size', label: 'Team' },
      { id: 'm', label: 'Team miss rate <i>M</i>(<i>S</i>)', key: true },
      { id: 'lam', label: 'Coverage exponent Λ(<i>S</i>)' },
      { id: 'rel', label: 'Horizon vs best team of this size' },
      { id: 'g', label: 'Greedy’s (1 − 1/e) promise, as a miss rate' },
      { id: 'sub', label: 'Submodularity of Λ in this pool' },
    ]);
    const say = h('p', { class: 'say' });
    R.appendChild(say);
    L.appendChild(h('p', { class: 'panel-title', text: 'Relative horizon 1/M(S) by selection rule' }));
    const cbox = h('div');
    L.appendChild(cbox);
    const leg = h('div', { class: 'legend' });
    L.appendChild(leg);
    root.PlotUtil.legend(leg, [{ name: 'best possible', cls: 's1', kind: 'line' }, { name: 'greedy coverage', cls: 's2', kind: 'line' }, { name: 'random (average)', cls: 's3', kind: 'line' }, { name: 'most accurate', cls: 's4', kind: 'line' }]);
    const cplot = new root.Plot(cbox, { height: 210, margin: { l: 50, r: 12, t: 8, b: 38 }, x: { type: 'lin', domain: [1, 8], label: 'team size' }, y: { type: 'log', domain: [1, 100], label: '1 / M(S)' } });
    const tbl = U.tableToggle(fig);

    function drawMatrix() {
      mbox.textContent = '';
      const m = pool.q.length, T = pool.mu.length;
      const NW = 132, AW = 40, RH = 20, GW = 420, TOPH = 18, MISSH = 46;
      const W = NW + AW + GW + 4, H = TOPH + m * RH + 10 + MISSH + 18;
      const svg = svgEl('svg', { class: 'teams', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Agents by defect kinds' });
      mbox.appendChild(svg);
      const xs = [NW + AW];
      pool.mu.forEach((w) => xs.push(xs[xs.length - 1] + w * GW));
      for (let t = 0; t < T; t++) {
        const wpx = xs[t + 1] - xs[t];
        if (wpx > 16) { const tx = svgEl('text', { x: (xs[t] + xs[t + 1]) / 2, y: 12, class: 'tick', 'text-anchor': 'middle' }, svg); tx.textContent = pool.types[t]; }
      }
      const acc = pool.q.map((_, i) => C.agentAcc(pool, i));
      const amax = Math.max(...acc);
      for (let i = 0; i < m; i++) {
        const y = TOPH + i * RH;
        const sel = S.includes(i);
        const bg = svgEl('rect', { x: 0, y, width: W, height: RH, class: 'row-bg' + (sel ? ' sel' : ''), tabindex: 0, role: 'button', 'aria-pressed': sel ? 'true' : 'false', 'aria-label': `${pool.names[i]}, accuracy ${pct(acc[i])}` }, svg);
        const toggle = () => { if (S.includes(i)) S = S.filter((x) => x !== i); else S = S.concat([i]); render(); };
        bg.addEventListener('click', toggle);
        bg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
        if (sel) svgEl('rect', { x: 0, y: y + 5, width: 4, height: RH - 10, rx: 2, class: 'selmark' }, svg);
        const nm = svgEl('text', { x: 9, y: y + RH / 2 + 4, class: 'nm' + (sel ? ' sel' : '') }, svg);
        nm.textContent = pool.names[i];
        svgEl('rect', { x: NW, y: y + 6, width: Math.max(1, (AW - 8) * acc[i] / amax), height: RH - 12, rx: 2, class: 'accbar' }, svg);
        for (let t = 0; t < T; t++) {
          const qv = pool.q[i][t];
          if (qv > 0) { const r = svgEl('rect', { x: xs[t] + 1, y: y + 2, width: Math.max(0.5, xs[t + 1] - xs[t] - 2), height: RH - 4, rx: 2, class: 'q' }, svg); r.style.fillOpacity = (0.15 + 0.85 * qv).toFixed(2); r.style.pointerEvents = 'none'; }
        }
      }
      const yM = TOPH + m * RH + 10;
      const lb = svgEl('text', { x: 9, y: yM + MISSH / 2 + 4, class: 'nm sel' }, svg);
      lb.textContent = 'Team misses';
      for (let t = 0; t < T; t++) {
        let pr = 1;
        S.forEach((i) => { pr *= 1 - pool.q[i][t]; });
        svgEl('rect', { x: xs[t] + 1, y: yM, width: Math.max(0.5, xs[t + 1] - xs[t] - 2), height: MISSH, class: 'misscol' }, svg);
        if (pr > 0) svgEl('rect', { x: xs[t] + 1, y: yM + MISSH * (1 - pr), width: Math.max(0.5, xs[t + 1] - xs[t] - 2), height: MISSH * pr, class: 'missfill' }, svg);
      }
      const acl = svgEl('text', { x: NW, y: 12, class: 'tick' }, svg);
      acl.textContent = 'acc.';
      const fl = svgEl('text', { x: NW + AW, y: H - 4, class: 'tick' }, svg);
      fl.textContent = 'column width = how common each kind of defect is';
    }

    function render() {
      drawMatrix();
      const m = pool.q.length;
      const MS = S.length ? C.teamMiss(pool, S) : 1;
      const opt = S.length ? C.selectOptimal(pool, S.length) : [];
      const Mopt = S.length ? C.teamMiss(pool, opt) : 1;
      ro.set('size', `${S.length} of ${m}`);
      ro.set('m', fmt(MS));
      ro.set('lam', MS > 0 ? (-Math.log(MS)).toFixed(2) : '∞');
      ro.set('rel', S.length ? (MS > 0 ? pct(Mopt / MS, 0) : '100%') : '–', S.length ? 'of the best' : '');
      ro.set('g', S.length ? '≤ ' + fmt(Math.exp(-1) + (1 - Math.exp(-1)) * Mopt) : '–', S.length ? `while best is ${fmt(Mopt)}` : '');
      const probe = C.submodularityProbe(pool, C.mulberry32(7), 2500);
      if (probe && probe.v > 1e-9) {
        const gB = probe.gB > 40 ? '∞' : probe.gB.toFixed(2);
        ro.set('sub', 'violated', `adding ${pool.names[probe.e]} gains ${probe.gA.toFixed(2)} alone, ${gB} on top of others`);
      } else ro.set('sub', 'holds', '(no violation found)');
      // chart: best / greedy / random / top-k by size
      const maxK = Math.min(8, m - 1);
      cplot.setX({ domain: [1, maxK], ticks: Array.from({ length: maxK }, (_, i) => i + 1) });
      const ser = { opt: [], gr: [], rnd: [], top: [] };
      const rr = C.mulberry32(99);
      const CAP = 1000;
      const inv = (m) => Math.min(CAP, 1 / Math.max(1e-12, m));
      for (let kk = 1; kk <= maxK; kk++) {
        ser.opt.push([kk, inv(C.teamMiss(pool, C.selectOptimal(pool, kk)))]);
        ser.gr.push([kk, inv(C.teamMiss(pool, C.selectGreedy(pool, kk)))]);
        ser.rnd.push([kk, inv(C.randomTeamMean(pool, kk, rr, 300))]);
        ser.top.push([kk, inv(C.teamMiss(pool, C.selectTopK(pool, kk)))]);
      }
      let ymax = 2;
      Object.values(ser).forEach((s) => s.forEach((p) => { ymax = Math.max(ymax, p[1]); }));
      cplot.setY({ domain: [0.8, Math.min(CAP * 2.5, ymax * 2)] });
      cplot.draw = (pl) => {
        const L4 = [['opt', 's1', 'best'], ['gr', 's2', 'greedy'], ['rnd', 's3', 'random'], ['top', 's4', 'most accurate']];
        pl.line(ser.opt, 's1 halo');
        L4.forEach(([key, cls]) => { pl.line(ser[key], cls); ser[key].forEach(([x, y]) => pl.dot(x, y, 3, cls)); });
        const capped = ser.opt.filter((p) => p[1] >= CAP);
        if (capped.length) pl.text(capped[0][0], CAP, '∞: these teams cover every kind of defect', 'small', capped[0][0] > maxK / 2 ? 'end' : 'start', 0, -10);
        if (S.length) { pl.vline(S.length, 'solid'); }
        pl.crosshair(L4.map(([key, cls, name]) => ({ name, cls, pts: ser[key] })), { xName: 'team size', xFmt: (v) => String(Math.round(v)), yFmt: (v) => (v >= CAP ? '∞ (covers all)' : fmt(v)) });
      };
      cplot.render();
      say.textContent = '';
      const topM = C.teamMiss(pool, C.selectTopK(pool, k)), grM = C.teamMiss(pool, C.selectGreedy(pool, k)), opM = C.teamMiss(pool, C.selectOptimal(pool, k));
      say.appendChild(h('b', { text: `At k = ${k}: ` }));
      say.appendChild(document.createTextNode(`most accurate misses ${fmt(topM)}, greedy coverage ${fmt(grM)}, best possible ${fmt(opM)}. ` +
        (presetKey === 'gs' ? `Proposition 6.2 predicts η = ${eta.toFixed(2)} against η/k = ${fmt(eta / k)}: a horizon ratio of exactly ${k}.` :
          presetKey === 'nested' ? 'With nested blind spots the rules nearly agree, as Proposition 6.1 suggests.' :
            'The most accurate agents share one template, so they share its blind spots.')));
      tbl.update([{ title: 'Agents', cols: ['agent', 'accuracy', 'in team'], rows: pool.names.map((n, i) => [n, pct(C.agentAcc(pool, i), 1), S.includes(i) ? 'yes' : '']) }]);
    }
    etaWrap.hidden = presetKey !== 'gs';
    S = C.selectTopK(pool, k);
    render();
  };

  /* ================================================================== */
  /* Figure 14: the paper's selection numbers                            */
  /* ================================================================== */
  Figs.results = function (body, fig) {
    const rows = [
      { name: 'Coverage-greedy', depth: 12.2, m: 0.13, kappa: 0.009 },
      { name: 'Random selection', depth: 4.3, m: 0.45, kappa: null },
      { name: 'Accuracy ranking', depth: 2.3, m: 0.71, kappa: 0.045 },
    ];
    const row = h('div', { class: 'row2' });
    body.appendChild(row);
    const mk = (title) => { const d = h('div'); d.appendChild(h('p', { class: 'panel-title', text: title })); const b = h('div'); d.appendChild(b); row.appendChild(d); return b; };
    const b1 = mk('Safe depth reached (stages)');
    const b2 = mk('Team miss rate M(S)');
    function bars(box, key, max, fmtv) {
      const p = new root.Plot(box, { height: 150, margin: { l: 128, r: 46, t: 6, b: 30 }, x: { type: 'lin', domain: [0, max], label: '' }, y: { type: 'lin', domain: [0, 3], ticks: [] } });
      p.draw = (pl) => {
        rows.forEach((r, i) => {
          const y0 = 2.75 - i, y1 = 2.25 - i;
          pl.rectV(0, y1, r[key], y0, 'bar ' + (i === 0 ? 's1' : 'c-muted'));
          pl.textPx(pl.x0 - 8, pl.y((y0 + y1) / 2) + 4, r.name, 'strong', 'end');
          pl.text(r[key], (y0 + y1) / 2, fmtv(r[key]), 'strong', 'start', 6, 4);
        });
      };
      p.render();
    }
    bars(b1, 'depth', 14, (v) => v.toFixed(1));
    bars(b2, 'm', 0.8, (v) => v.toFixed(2));
    const ro = U.readouts(body, [
      { id: 'k1', label: 'Per-stage risk κ̂, greedy' },
      { id: 'k2', label: 'Per-stage risk κ̂, accuracy ranking' },
      { id: 's1', label: 'Re-review partial sum, siloed' },
      { id: 's2', label: 'Re-review partial sum, diverse', key: true },
    ]);
    ro.set('k1', '0.009');
    ro.set('k2', '0.045');
    ro.set('s1', '112.6', 'diverging');
    ro.set('s2', '0.80', 'converging');
    const tbl = U.tableToggle(fig);
    tbl.update([{ title: 'Selection on the broad pool (paper, §7.3)', cols: ['rule', 'M(S)', 'κ̂', 'depth'], rows: rows.map((r) => [r.name, r.m.toFixed(2), r.kappa === null ? 'not reported' : r.kappa.toFixed(3), r.depth.toFixed(1)]) }]);
  };

  /* ================================================================== */
  /* Figure 15: run the measurement protocol on your own counts          */
  /* ================================================================== */
  Figs.yourData = function (body, fig) {
    const ex = (() => {
      const pop = C.makePop({ acc: 0.5, a: 1.3, pi0: 0 });
      const f = C.simulateFlags(pop, 400, 8, C.mulberry32(2027));
      return Array.from(f).join(' ');
    })();
    const inRow = h('div', { class: 'inline-in' });
    body.appendChild(inRow);
    inRow.appendChild(h('label', { for: 'yd-k', text: 'Agents per defect K' }));
    const kIn = h('input', { type: 'number', id: 'yd-k', min: 1, max: 40, value: 8 });
    inRow.appendChild(kIn);
    U.button(inRow, 'Example: random team', () => { ta.value = ex; kIn.value = 8; run(); }, 'quiet', 'yd-ex');
    U.button(inRow, 'Example: anti-correlated team', () => {
      // on every defect exactly 2 of 4 agents flag, a pattern no random team can produce
      const r = C.mulberry32(4);
      const vals = [];
      for (let i = 0; i < 300; i++) vals.push(r() < 0.9 ? 2 : (r() < 0.5 ? 1 : 3));
      ta.value = vals.join(' ');
      kIn.value = 4;
      run();
    }, 'quiet', 'yd-ex2');
    const ta = h('textarea', { class: 'data-in', id: 'yd-data', spellcheck: 'false', 'aria-label': 'Flag counts, one per defect' });
    ta.value = ex;
    body.appendChild(ta);
    const status = h('div', { class: 'status ok' });
    body.appendChild(status);
    const row = h('div', { class: 'row-side' });
    body.appendChild(row);
    const L = h('div'), R = h('div', { style: 'display:grid;gap:10px;align-content:start' });
    row.appendChild(L); row.appendChild(R);
    L.appendChild(h('p', { class: 'panel-title', text: 'Your miss curve and what it implies beyond K' }));
    const box = h('div');
    L.appendChild(box);
    const leg = h('div', { class: 'legend' });
    L.appendChild(leg);
    root.PlotUtil.legend(leg, [{ name: 'M̂(j) ± 2 s.e.', cls: 's1', kind: 'dot' }, { name: 'identified interval for larger teams, widened by sampling error', cls: 's1', kind: 'band' }]);
    const plot = new root.Plot(box, { height: 250, margin: { l: 50, r: 12, t: 8, b: 38 }, x: { type: 'log', base: 2, domain: [1, 32], label: 'team size' }, y: { type: 'log', domain: [1e-3, 1], label: 'M' } });
    const ro = U.readouts(R, [
      { id: 'n', label: 'Defects <i>N</i>' },
      { id: 'acc', label: 'Per-agent detection 1 − <i>M̂</i>(1)' },
      { id: 'mk', label: 'All <i>K</i> miss: <i>M̂</i>(<i>K</i>)' },
      { id: 'a', label: '<i>â</i> at the largest measurable <i>j</i>', key: true },
    ]);
    const dec = h('div', { style: 'display:grid;gap:8px' });
    R.appendChild(dec);
    const tbl = U.tableToggle(fig);
    let timer = null;
    ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 250); });
    kIn.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 250); });

    function setStatus(ok, text) {
      status.className = 'status ' + (ok ? 'ok' : 'bad');
      status.textContent = '';
      status.appendChild(h('span', { class: 'ic', text: ok ? '✓' : '✗' }));
      status.appendChild(h('span', { text }));
    }
    function decision(ok, title, text) {
      dec.appendChild(h('div', { class: 'status ' + (ok === null ? 'ok' : ok ? 'ok' : 'bad') }, h('span', { class: 'ic', text: ok === null ? '•' : ok ? '✓' : '✗' }), h('span', null, h('b', { text: title + ' ' }), document.createTextNode(text))));
    }
    function run() {
      const K = Math.round(+kIn.value);
      const toks = ta.value.split(/[\s,;]+/).filter((s) => s.length);
      if (!(K >= 1 && K <= 40)) { setStatus(false, 'K must be a whole number from 1 to 40.'); return; }
      const f = [];
      for (const t of toks) {
        const v = Number(t);
        if (!Number.isInteger(v) || v < 0 || v > K) { setStatus(false, `"${t.slice(0, 20)}" is not a whole number between 0 and ${K}. Each entry is how many of the K agents flagged one defect.`); return; }
        f.push(v);
      }
      if (f.length < 10) { setStatus(false, 'Paste at least 10 counts (one per labelled defect).'); return; }
      const N = f.length;
      const est = C.estimateMissCurve(Int32Array.from(f), K);
      const bvec = [];
      for (let j = 0; j <= K; j++) bvec.push(est.hist[K - j] / N);
      const kList = [];
      if (K < 32) for (const x of U.logGrid(K + 1, Math.max(4 * K, 32), 10)) { const r = Math.round(x); if (r > K && !kList.includes(r)) kList.push(r); }
      const res = Object.assign({ feasible: true }, C.identifyRelaxed(bvec, K, kList, N));
      if (res.lo.some((v) => !isFinite(v))) res.feasible = false;
      const nMiss = bvec.map((b) => Math.round(b * N));
      const test = C.exchangeabilityTest(nMiss, K, C.mulberry32(17), 99);
      setStatus(true, `Read ${N} defects judged by ${K} agents each.`);
      const se = (x) => est.sd[x] / Math.sqrt(N);
      const pts = [];
      for (let x = 1; x <= K; x++) pts.push([x, est.Mhat[x]]);
      const kmax = Math.max(32, kList.length ? kList[kList.length - 1] : K);
      plot.setX({ domain: [1, kmax] });
      let lo = 1;
      pts.forEach((p) => { if (p[1] > 0) lo = Math.min(lo, p[1]); });
      if (res.feasible) res.lo.forEach((v) => { if (v > 0) lo = Math.min(lo, v); });
      plot.setY({ domain: [Math.max(1e-6, lo / 3), 1.2] });
      plot.draw = (pl) => {
        if (res.feasible && kList.length) {
          const hi = kList.map((x, i) => [x, res.hi[i]]);
          const lw = kList.map((x, i) => [x, Math.max(res.lo[i], pl.o.y.domain[0])]);
          pl.area(hi, lw, 's1 band');
          pl.line(hi, 's1 thin');
        }
        pts.forEach(([x, v]) => {
          if (v > 0) { pl.seg(x, Math.max(pl.o.y.domain[0], v - 2 * se(x)), x, v + 2 * se(x), 'ln s1 thin'); pl.dot(x, v, 3.5, 's1'); }
        });
        pl.crosshair([{ name: 'M̂', cls: 's1', pts }], { xName: 'j', xFmt: (v) => fmt(v) });
      };
      plot.render();
      // largest j with 2j <= K and M̂(2j) > 0
      let jBest = 0;
      for (let x = 1; 2 * x <= K; x++) if (est.Mhat[2 * x] > 0) jBest = x;
      const aH = jBest ? Math.log2(est.Mhat[jBest] / est.Mhat[2 * jBest]) : NaN;
      const seD = jBest ? C.seAFromData(est, jBest) : NaN;
      ro.set('n', String(N));
      ro.set('acc', (1 - est.Mhat[1]).toFixed(3));
      ro.set('mk', fmt(est.Mhat[K]));
      ro.set('a', isFinite(aH) ? `${aH.toFixed(2)} ± ${seD.toFixed(2)}` : 'n/a', isFinite(aH) ? `(j = ${jBest})` : '(need K ≥ 2 and misses at 2j)');
      dec.textContent = '';
      const pTxt = test.p <= 0.0101 ? 'p ≤ 0.01' : 'p = ' + test.p.toFixed(2);
      const broken = test.p <= 0.0101;
      if (broken) {
        decision(false, 'Model ok?', `No. The counts are significantly inconsistent with every exchangeable population (bootstrap ${pTxt}, misfit G² = ${test.G2.toFixed(1)}). Agents may be anti-correlated, influence each other, or come from different design distributions. The bounds in this course do not apply as stated, so the two readings below are not meaningful.`);
      } else if (test.p <= 0.05) {
        decision(null, 'Model ok?', `Borderline (${pTxt}): mild evidence against an exchangeable population. Collect more defects before relying on the readings below.`);
      } else {
        decision(true, 'Model ok?', `Yes. The counts fit an exchangeable population up to sampling noise (bootstrap ${pTxt}), so the theory applies.`);
      }
      if (broken) {
        decision(null, 'Hire the next agent?', 'Not assessable while the model check fails.');
      } else if (isFinite(aH)) {
        const z = (aH - 1) / (seD || 1e-9);
        decision(Math.abs(z) < 2 ? null : z > 0, 'Hire the next agent?',
          Math.abs(z) < 2 ? `Can't tell yet: â is within two standard errors of 1. Roughly ${fmt(Math.ceil(N * Math.pow(seD / 0.1, 2)))} defects would resolve it to ±0.1.`
            : z > 0 ? 'â is clearly above 1: each added agent buys more horizon than the last (if false alarms stay below the miss rate).'
              : 'â is clearly below 1: horizon gains shrink as the team grows. Look for agents that see different defects.');
      } else decision(null, 'Hire the next agent?', 'Not enough data: need K ≥ 2 and some defects missed by 2j agents.');
      if (!broken && res.feasible && kList.length) {
        const i2 = kList.indexOf(kList.find((x) => x >= 2 * K) || kList[kList.length - 1]);
        decision(null, 'Extrapolate?', `For a team of ${kList[i2]}, M is anywhere in [${fmt(res.lo[i2])}, ${fmt(res.hi[i2])}] once sampling error is allowed for. Only the upper end is a guarantee. The blind-spot mass π₀ is anywhere in [${fmt(res.pi0.lo)}, ${fmt(res.pi0.hi)}].`);
      }
      const rows = [];
      for (let x = 1; x <= K; x++) rows.push([String(x), est.Mhat[x].toFixed(5), (2 * se(x)).toFixed(5)]);
      const tabs = [{ title: 'Estimated miss curve', cols: ['j', 'M̂(j)', '±2 s.e.'], rows }];
      if (res.feasible && kList.length) tabs.push({ title: 'Identified intervals', cols: ['k′', 'lower', 'upper'], rows: kList.map((x, i) => [String(x), fmt(res.lo[i]), fmt(res.hi[i])]) });
      tbl.update(tabs);
    }
    run();
  };
})(window);
