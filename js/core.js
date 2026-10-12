/* core.js
   Numerical engine for the "Coverage, Not Accuracy" course.
   Everything here is plain math with no DOM access, so it runs in the browser
   and in node (for testing). Exposed as window.Core / module.exports. */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Random numbers                                                      */
  /* ------------------------------------------------------------------ */

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randn(rng) {
    let u = 0;
    while (u === 0) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }

  // log of a Gamma(shape, 1) draw; working in logs keeps tiny shapes from underflowing
  function logRandGamma(rng, shape) {
    if (shape < 1) {
      let u = rng();
      while (u === 0) u = rng();
      return logRandGamma(rng, shape + 1) + Math.log(u) / shape;
    }
    const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x, v;
      do { x = randn(rng); v = 1 + c * x; } while (v <= 0);
      v = v * v * v;
      const u = rng();
      if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return Math.log(d * v);
      }
    }
  }

  function randBeta(rng, a, b) {
    const lx = logRandGamma(rng, a), ly = logRandGamma(rng, b);
    return 1 / (1 + Math.exp(ly - lx));
  }

  function randBinom(rng, n, p) {
    if (p <= 0) return 0;
    if (p >= 1) return n;
    if (p > 0.5) return n - randBinom(rng, n, 1 - p);
    const q = 1 - p, s = p / q;
    let pmf = Math.pow(q, n), cdf = pmf, k = 0;
    const u = rng();
    while (u > cdf && k < n) {
      pmf *= s * (n - k) / (k + 1);
      k++;
      cdf += pmf;
    }
    return k;
  }

  /* ------------------------------------------------------------------ */
  /* Special functions                                                   */
  /* ------------------------------------------------------------------ */

  const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1;
    let a = LANCZOS[0];
    const t = x + 7.5;
    for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }

  function gammaFn(x) { return Math.exp(lgamma(x)); }

  function logChoose(n, k) {
    if (k < 0 || k > n) return -Infinity;
    return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
  }

  // exact-ish binomial coefficient as a float (fine for n <= ~1000)
  function choose(n, k) {
    if (k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    let r = 1;
    for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return r;
  }

  function betacf(a, b, x) {
    const MAXIT = 400, EPS = 1e-15, FPMIN = 1e-300;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }

  // regularized incomplete beta I_x(a, b)
  function ibeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const lbt = lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log1p(-x);
    if (x < (a + 1) / (a + b + 2)) return Math.exp(lbt) * betacf(a, b, x) / a;
    return 1 - Math.exp(lbt) * betacf(b, a, 1 - x) / b;
  }

  function betaQuantile(p, a, b) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 80; i++) {
      const mid = 0.5 * (lo + hi);
      if (ibeta(mid, a, b) < p) lo = mid; else hi = mid;
    }
    return 0.5 * (lo + hi);
  }

  function betaPdf(x, a, b) {
    if (x <= 0 || x >= 1) return 0;
    return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log1p(-x) - (lgamma(a) + lgamma(b) - lgamma(a + b)));
  }

  // Riemann zeta for s > 1 (used in the re-review team size)
  function zeta(s) {
    if (s <= 1) return Infinity;
    let sum = 0;
    const N = 2000;
    for (let n = 1; n < N; n++) sum += Math.pow(n, -s);
    // Euler-Maclaurin tail
    sum += Math.pow(N, 1 - s) / (s - 1) + 0.5 * Math.pow(N, -s) + s * Math.pow(N, -s - 1) / 12;
    return sum;
  }

  /* ------------------------------------------------------------------ */
  /* Populations                                                         */
  /*                                                                     */
  /* A population is the law of Delta (discriminative power) across      */
  /* defects. The parametric family used throughout the course:          */
  /*   Delta ~ pi0 * (atom at 0)  +  (1 - pi0) * Beta(a, b),              */
  /* with b chosen so the overall mean E[Delta] equals `acc`.            */
  /* a -> infinity is the homogeneous population (Delta = constant), and */
  /* a -> 0 is the all-or-nothing population (Delta is 0 or 1).          */
  /* ------------------------------------------------------------------ */

  const A_HOM = 400;   // treat a >= this as "infinity" (homogeneous)
  const A_BERN = 0.02; // treat a <= this as 0 (all-or-nothing)

  function makePop(opts) {
    const o = Object.assign({ acc: 0.5, a: 1, pi0: 0 }, opts || {});
    let pi0 = Math.max(0, Math.min(0.98, o.pi0));
    let acc = Math.max(1e-4, Math.min(0.999, o.acc));
    if (acc > (1 - pi0) * 0.999) acc = (1 - pi0) * 0.999;
    const cc = acc / (1 - pi0); // mean of the continuous part
    let kind = 'beta';
    let a = o.a;
    if (!(a < A_HOM)) { kind = 'hom'; a = Infinity; }
    else if (a <= A_BERN) { kind = 'bern'; a = 0; }
    const b = kind === 'beta' ? a * (1 - cc) / cc : NaN;
    const lgab = kind === 'beta' ? lgamma(a + b) - lgamma(b) : 0;

    // E[(1-Delta)^k] for the continuous part, k real >= 0
    function R(k) {
      if (k <= 0) return 1;
      if (kind === 'hom') return Math.pow(1 - cc, k);
      if (kind === 'bern') return 1 - cc;
      if (Number.isInteger(k) && k <= 200) {
        let r = 1;
        for (let j = 0; j < k; j++) r *= (b + j) / (a + b + j);
        return r;
      }
      return Math.exp(lgamma(b + k) - lgamma(a + b + k) + lgab);
    }
    function M(k) { return pi0 + (1 - pi0) * R(k); }

    const blind = pi0 + (kind === 'bern' ? (1 - pi0) * (1 - cc) : 0);
    // large-k behaviour: M(k) ~ blind + C k^{-aEff}
    const aEff = kind === 'beta' ? a : (kind === 'hom' ? Infinity : 0);
    const C = kind === 'beta' ? (1 - pi0) * Math.exp(lgab) : NaN;

    function sampleDelta(rng) {
      if (pi0 > 0 && rng() < pi0) return 0;
      if (kind === 'hom') return cc;
      if (kind === 'bern') return rng() < cc ? 1 : 0;
      return randBeta(rng, a, b);
    }

    // density of the continuous part, weighted by (1 - pi0)
    function pdf(x) {
      if (kind !== 'beta') return 0;
      return (1 - pi0) * betaPdf(x, a, b);
    }

    // Discrete approximation of the law of Delta: support points d[] with weights w[].
    // Cells are geometric near 0 (where the large-k behaviour lives) and linear above.
    function discretize(nGeo, nLin) {
      nGeo = nGeo || 48; nLin = nLin || 110;
      const d = [], w = [];
      if (blind > 0 && kind !== 'beta') {
        // atoms only
      }
      if (pi0 > 0) { d.push(0); w.push(pi0); }
      if (kind === 'hom') { d.push(cc); w.push(1 - pi0); return { d, w }; }
      if (kind === 'bern') {
        d.push(0); w.push((1 - pi0) * (1 - cc));
        d.push(1); w.push((1 - pi0) * cc);
        return mergeAtoms(d, w);
      }
      const edges = [0];
      const g0 = 1e-7, g1 = 0.02;
      for (let i = 0; i <= nGeo; i++) edges.push(g0 * Math.pow(g1 / g0, i / nGeo));
      for (let i = 1; i <= nLin; i++) edges.push(g1 + (1 - g1) * i / nLin);
      const meanFrac = a / (a + b);
      let prevI = 0, prevJ = 0;
      for (let i = 1; i < edges.length; i++) {
        const e = edges[i];
        const Ie = ibeta(e, a, b), Je = ibeta(e, a + 1, b);
        const mass = Ie - prevI;
        if (mass > 1e-15) {
          let pt = meanFrac * (Je - prevJ) / mass;
          const lo = edges[i - 1];
          if (!(pt >= lo && pt <= e)) pt = 0.5 * (lo + e);
          d.push(pt); w.push((1 - pi0) * mass);
        }
        prevI = Ie; prevJ = Je;
      }
      // renormalise tiny numerical drift in the continuous part
      let tot = 0;
      for (let i = 0; i < w.length; i++) tot += w[i];
      for (let i = 0; i < w.length; i++) w[i] /= tot;
      return { d, w };
    }

    let label;
    if (kind === 'hom') label = 'Homogeneous';
    else if (kind === 'bern') label = 'All-or-nothing';
    else label = 'a = ' + fmtNum(a);

    return {
      kind, acc, a, b, cc, pi0, blind, aEff, C, label,
      M, R, sampleDelta, pdf, discretize,
      aExp: (k) => Math.log2(M(k) / M(2 * k)),
      Lambda: (k) => -Math.log(M(k)),
    };
  }

  function mergeAtoms(d, w) {
    const map = new Map();
    for (let i = 0; i < d.length; i++) map.set(d[i], (map.get(d[i]) || 0) + w[i]);
    const keys = Array.from(map.keys()).sort((x, y) => x - y);
    return { d: keys, w: keys.map((k) => map.get(k)) };
  }

  // A population given directly as a finite list of (Delta, weight) pairs
  function discretePop(d, w) {
    let tot = 0;
    for (const x of w) tot += x;
    const W = w.map((x) => x / tot);
    function M(k) {
      let s = 0;
      for (let i = 0; i < d.length; i++) {
        const u = 1 - d[i];
        s += W[i] * (u <= 0 ? (k <= 0 ? 1 : 0) : Math.pow(u, k));
      }
      return s;
    }
    let acc = 0, blind = 0;
    for (let i = 0; i < d.length; i++) { acc += W[i] * d[i]; if (d[i] === 0) blind += W[i]; }
    return {
      kind: 'discrete', acc, blind, pi0: blind, d: d.slice(), w: W, M,
      aExp: (k) => Math.log2(M(k) / M(2 * k)),
      Lambda: (k) => -Math.log(M(k)),
      sampleDelta(rng) {
        let u = rng(), i = 0;
        while (i < W.length - 1 && u > W[i]) { u -= W[i]; i++; }
        return d[i];
      },
      discretize() { return { d: d.slice(), w: W.slice() }; },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Horizon arithmetic (Theorem: horizon law)                           */
  /* ------------------------------------------------------------------ */

  // n*(eps) = ln(1/(1-eps)) / ln(1/(1 - beta (M - phibar)))
  function nStar(Mk, beta, eps, phibar) {
    const p = beta * (Mk - (phibar || 0));
    if (p <= 0) return Infinity;
    if (p >= 1) return 0;
    return Math.log(1 / (1 - eps)) / -Math.log1p(-p);
  }

  /* ------------------------------------------------------------------ */
  /* Moment-sequence checks (Proposition: shape of the miss curve)       */
  /* ------------------------------------------------------------------ */

  // j-th forward alternating difference at k: sum_i (-1)^i C(j,i) M(k+i)
  function altDiff(Mseq, k, j) {
    let s = 0;
    for (let i = 0; i <= j; i++) s += (i % 2 ? -1 : 1) * choose(j, i) * Mseq[k + i];
    return s;
  }

  /* ------------------------------------------------------------------ */
  /* Linear programming: dense two-phase simplex with Bland's rule.      */
  /* min (or max) c.x  s.t.  A x = b, x >= 0, with b >= 0.               */
  /* Sizes here are tiny (<= 10 rows, a few hundred columns).            */
  /* ------------------------------------------------------------------ */

  function lpSolve(A, b, c, maximize) {
    const m = A.length, n = c.length, W = n + m + 1;
    const T = [];
    for (let i = 0; i < m; i++) {
      const row = new Float64Array(W);
      const sg = b[i] < 0 ? -1 : 1; // keep every right-hand side non-negative
      for (let j = 0; j < n; j++) row[j] = sg * A[i][j];
      row[n + i] = 1;
      row[W - 1] = sg * b[i];
      T.push(row);
    }
    const basis = new Int32Array(m);
    for (let i = 0; i < m; i++) basis[i] = n + i;

    const cost1 = new Float64Array(n + m);
    for (let j = n; j < n + m; j++) cost1[j] = 1;
    runSimplex(T, basis, cost1, n, W);
    let infeas = 0;
    for (let i = 0; i < m; i++) if (basis[i] >= n) infeas += T[i][W - 1];
    if (infeas > 1e-8) return { status: 'infeasible', residual: infeas };
    for (let i = 0; i < m; i++) {
      if (basis[i] >= n) {
        let piv = -1, best = 1e-9;
        for (let j = 0; j < n; j++) if (Math.abs(T[i][j]) > best) { best = Math.abs(T[i][j]); piv = j; }
        if (piv >= 0) pivot(T, basis, i, piv, W);
      }
    }
    const cost2 = new Float64Array(n + m);
    for (let j = 0; j < n; j++) cost2[j] = maximize ? -c[j] : c[j];
    const ok = runSimplex(T, basis, cost2, n, W);
    const x = new Float64Array(n);
    for (let i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = Math.max(0, T[i][W - 1]);
    let value = 0;
    for (let j = 0; j < n; j++) value += c[j] * x[j];
    return { status: ok ? 'optimal' : 'unbounded', x, value };
  }

  // nEnter: only columns < nEnter may enter the basis (artificials never re-enter)
  function runSimplex(T, basis, cost, nEnter, W) {
    const m = T.length;
    const isBasic = new Uint8Array(W);
    for (let i = 0; i < m; i++) isBasic[basis[i]] = 1;
    for (let iter = 0; iter < 20000; iter++) {
      let enter = -1;
      for (let j = 0; j < nEnter; j++) {
        if (isBasic[j]) continue;
        let dj = cost[j];
        for (let i = 0; i < m; i++) dj -= cost[basis[i]] * T[i][j];
        if (dj < -1e-12) { enter = j; break; }
      }
      if (enter < 0) return true;
      let leave = -1, best = Infinity;
      for (let i = 0; i < m; i++) {
        const aij = T[i][enter];
        if (aij > 1e-13) {
          const r = T[i][W - 1] / aij;
          if (r < best - 1e-14 || (Math.abs(r - best) <= 1e-14 && leave >= 0 && basis[i] < basis[leave])) {
            best = r; leave = i;
          }
        }
      }
      if (leave < 0) return false;
      isBasic[basis[leave]] = 0;
      pivot(T, basis, leave, enter, W);
      isBasic[enter] = 1;
    }
    return true;
  }

  function pivot(T, basis, r, c, W) {
    const pr = T[r], pv = pr[c];
    for (let j = 0; j < W; j++) pr[j] /= pv;
    for (let i = 0; i < T.length; i++) {
      if (i === r) continue;
      const f = T[i][c];
      if (f !== 0) {
        const row = T[i];
        for (let j = 0; j < W; j++) row[j] -= f * pr[j];
      }
    }
    basis[r] = c;
  }

  /* ------------------------------------------------------------------ */
  /* Sharp partial identification (Theorem: identified set)              */
  /*                                                                     */
  /* Knowing M(1..K) is the same as knowing, for a K-agent panel, the    */
  /* distribution of how many of the K agents miss a defect:             */
  /*   b_j = P(exactly j of K miss) = E[ C(K,j) U^j (1-U)^(K-j) ],        */
  /* with U = 1 - Delta. These Bernstein coefficients are the same       */
  /* information as the moments and make a well-conditioned LP.          */
  /* ------------------------------------------------------------------ */

  function bernsteinRow(K, j, u) {
    if (u <= 0) return j === 0 ? 1 : 0;
    if (u >= 1) return j === K ? 1 : 0;
    return Math.exp(logChoose(K, j) + j * Math.log(u) + (K - j) * Math.log1p(-u));
  }

  // bvec[j] = P(exactly j of K agents miss). Returns sharp intervals for M(k'), k' in kList,
  // and for pi0. opts.support adds candidate Delta points; opts.extremalAt keeps the two
  // extremal laws for that k'.
  function identifyB(bvec, K, kList, opts) {
    opts = opts || {};
    const pts = new Set([0, 1]);
    if (opts.support) opts.support.forEach((x) => pts.add(x));
    for (let i = 1; i <= 40; i++) pts.add(Math.pow(10, -6 + 4.5 * i / 40));
    for (let i = 1; i < 80; i++) pts.add(i / 80);
    const grid = Array.from(pts).sort((x, y) => x - y); // Delta values
    const U = grid.map((x) => 1 - x);
    const n = grid.length;
    const A = [];
    for (let j = 0; j <= K; j++) {
      const row = new Float64Array(n);
      for (let i = 0; i < n; i++) row[i] = bernsteinRow(K, j, U[i]);
      A.push(row);
    }
    const b = Float64Array.from(bvec, (x) => Math.max(0, x));
    const out = { K, kList: kList.slice(), lo: [], hi: [], grid, bvec: Array.from(b), feasible: true };
    const feas = lpSolve(A, b, new Float64Array(n), false);
    if (feas.status !== 'optimal') { out.feasible = false; return out; }
    for (const kp of kList) {
      const c = U.map((u) => Math.pow(u, kp));
      const lo = lpSolve(A, b, c, false);
      const hi = lpSolve(A, b, c, true);
      out.lo.push(lo.status === 'optimal' ? lo.value : NaN);
      out.hi.push(hi.status === 'optimal' ? hi.value : NaN);
      if (opts.extremalAt === kp) out.extremal = { k: kp, lo: atomsOf(grid, lo.x), hi: atomsOf(grid, hi.x), loVal: lo.value, hiVal: hi.value };
    }
    const c0 = grid.map((x) => (x === 0 ? 1 : 0));
    const p0lo = lpSolve(A, b, c0, false), p0hi = lpSolve(A, b, c0, true);
    out.pi0 = { lo: p0lo.value, hi: p0hi.value };
    return out;
  }

  function identify(disc, K, kList, opts) {
    const bvec = new Float64Array(K + 1);
    for (let j = 0; j <= K; j++) {
      let s = 0;
      for (let i = 0; i < disc.d.length; i++) s += disc.w[i] * bernsteinRow(K, j, 1 - disc.d[i]);
      bvec[j] = s;
    }
    const truthM = (k) => {
      let s = 0;
      for (let i = 0; i < disc.d.length; i++) s += disc.w[i] * Math.pow(1 - disc.d[i], k);
      return s;
    };
    const out = identifyB(bvec, K, kList, Object.assign({ support: disc.d }, opts || {}));
    out.truth = kList.map(truthM);
    let p0true = 0;
    for (let i = 0; i < disc.d.length; i++) if (disc.d[i] === 0) p0true += disc.w[i];
    if (out.pi0) out.pi0.truth = p0true;
    out.trivial = truthM(K);
    out.truthM = truthM;
    return out;
  }

  // Same programme for noisy data: each frequency may differ from its measured value by
  // up to two standard errors, so the interval also covers sampling error.
  function identifyRelaxed(bvec, K, kList, N) {
    const pts = new Set([0, 1]);
    for (let i = 1; i <= 40; i++) pts.add(Math.pow(10, -6 + 4.5 * i / 40));
    for (let i = 1; i < 80; i++) pts.add(i / 80);
    const grid = Array.from(pts).sort((x, y) => x - y);
    const U = grid.map((x) => 1 - x);
    const n = grid.length, m = K + 1, cols = n + 2 * m;
    const rows = [], rhs = [];
    const one = new Float64Array(cols);
    for (let i = 0; i < n; i++) one[i] = 1;
    rows.push(one); rhs.push(1);
    for (let sgn = 0; sgn < 2; sgn++) {
      for (let j = 0; j <= K; j++) {
        const r = new Float64Array(cols);
        for (let i = 0; i < n; i++) r[i] = bernsteinRow(K, j, U[i]);
        const bj = bvec[j];
        const t = Math.max(2 * Math.sqrt(bj * (1 - bj) / N), 2 / N);
        if (sgn === 0) { r[n + j] = 1; rows.push(r); rhs.push(bj + t); }
        else { r[n + m + j] = -1; rows.push(r); rhs.push(bj - t); }
      }
    }
    const out = { K, kList: kList.slice(), lo: [], hi: [] };
    for (const kp of kList) {
      const c = new Float64Array(cols);
      for (let i = 0; i < n; i++) c[i] = Math.pow(U[i], kp);
      const lo = lpSolve(rows, rhs, c, false), hi = lpSolve(rows, rhs, c, true);
      out.lo.push(lo.status === 'optimal' ? lo.value : NaN);
      out.hi.push(hi.status === 'optimal' ? hi.value : NaN);
    }
    const c0 = new Float64Array(cols);
    c0[grid.indexOf(0)] = 1;
    out.pi0 = { lo: lpSolve(rows, rhs, c0, false).value, hi: lpSolve(rows, rhs, c0, true).value };
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Is a flag-count histogram consistent with ANY exchangeable          */
  /* population? Fit the best mixture of binomials (nonparametric MLE on */
  /* a grid, by EM), measure the misfit G², and calibrate it by a        */
  /* parametric bootstrap. nMiss[j] = defects missed by exactly j of K.  */
  /* ------------------------------------------------------------------ */

  function npmle(nMiss, K, iters) {
    iters = iters || 300;
    const G = 101;
    const L = [];
    for (let i = 0; i < G; i++) {
      const row = new Float64Array(K + 1);
      for (let j = 0; j <= K; j++) row[j] = binomPmf(K, j, i / (G - 1));
      L.push(row);
    }
    let N = 0;
    for (let j = 0; j <= K; j++) N += nMiss[j];
    let w = new Float64Array(G).fill(1 / G);
    const q = new Float64Array(K + 1);
    const mix = () => {
      q.fill(0);
      for (let i = 0; i < G; i++) { const wi = w[i]; if (wi > 0) { const Li = L[i]; for (let j = 0; j <= K; j++) q[j] += wi * Li[j]; } }
    };
    for (let it = 0; it < iters; it++) {
      mix();
      const nw = new Float64Array(G);
      for (let i = 0; i < G; i++) {
        if (w[i] === 0) continue;
        let s = 0;
        const Li = L[i];
        for (let j = 0; j <= K; j++) if (nMiss[j]) s += nMiss[j] * Li[j] / q[j];
        nw[i] = w[i] * s / N;
      }
      w = nw;
    }
    mix();
    let G2 = 0;
    for (let j = 0; j <= K; j++) if (nMiss[j]) G2 += 2 * nMiss[j] * Math.log((nMiss[j] / N) / Math.max(q[j], 1e-300));
    return { w, q: Float64Array.from(q), G2, N };
  }

  function exchangeabilityTest(nMiss, K, rng, B) {
    B = B || 50;
    const fit = npmle(nMiss, K);
    const cdf = [];
    let c = 0;
    for (let j = 0; j <= K; j++) { c += fit.q[j]; cdf.push(c); }
    let ge = 0;
    for (let b = 0; b < B; b++) {
      const sim = new Array(K + 1).fill(0);
      for (let n = 0; n < fit.N; n++) {
        const r = rng() * c;
        let j = 0;
        while (j < K && r > cdf[j]) j++;
        sim[j]++;
      }
      if (npmle(sim, K).G2 >= fit.G2 - 1e-9) ge++;
    }
    return { G2: fit.G2, p: (ge + 1) / (B + 1), fit };
  }

  function atomsOf(grid, x) {
    const d = [], w = [];
    if (!x) return { d, w };
    for (let i = 0; i < grid.length; i++) if (x[i] > 1e-9) { d.push(grid[i]); w.push(x[i]); }
    return { d, w };
  }

  /* ------------------------------------------------------------------ */
  /* Protocols (Theorem: scrutiny bound)                                 */
  /* Agents flag a defective artifact with prob Q = p + (1-p) d and a    */
  /* clean one with prob P = p, where d is the population's skill.       */
  /* So Delta = Q - P = (1-p) d.                                         */
  /* ------------------------------------------------------------------ */

  function protocolSetup(pop, k, p) {
    const disc = pop.discretize(30, 70);
    // P1[c]: prob a pattern with c flags arises on the defective artifact, summed over patterns
    const P1 = new Float64Array(k + 1), P0 = new Float64Array(k + 1);
    for (let i = 0; i < disc.d.length; i++) {
      const Q = p + (1 - p) * disc.d[i];
      for (let c = 0; c <= k; c++) P1[c] += disc.w[i] * binomPmf(k, c, Q);
    }
    for (let c = 0; c <= k; c++) P0[c] = binomPmf(k, c, p);
    let Mk = 0;
    for (let i = 0; i < disc.d.length; i++) Mk += disc.w[i] * Math.pow(1 - (1 - p) * disc.d[i], k);
    return { k, p, P1, P0, Mk, bound: 1 - Mk };
  }

  function binomPmf(n, c, q) {
    if (q <= 0) return c === 0 ? 1 : 0;
    if (q >= 1) return c === n ? 1 : 0;
    return Math.exp(logChoose(n, c) + c * Math.log(q) + (n - c) * Math.log1p(-q));
  }

  // f[c] = probability of FLAG given c flags among the k verdicts
  function protocolPoint(S, f) {
    let phi = 0, delta = 0;
    for (let c = 0; c <= S.k; c++) { phi += f[c] * S.P0[c]; delta += f[c] * S.P1[c]; }
    return { phi, delta };
  }

  function thresholdRule(k, t) {
    const f = new Float64Array(k + 1);
    for (let c = 0; c <= k; c++) f[c] = c >= t ? 1 : 0;
    return f;
  }

  // Adaptive escalation: ask one agent; PASS if it passes; otherwise ask the
  // remaining k-1 and FLAG if at least half of them flag. Uses <= k verdicts.
  function escalationRule(k) {
    const f = new Float64Array(k + 1);
    if (k === 1) { f[1] = 1; return f; }
    // given c flags among k exchangeable verdicts, the first one is a flag w.p. c/k;
    // then the other k-1 hold c-1 flags.
    for (let c = 0; c <= k; c++) {
      const firstFlag = c / k;
      const rest = c - 1;
      f[c] = firstFlag * (rest >= Math.ceil((k - 1) / 2) ? 1 : 0);
    }
    return f;
  }

  // Two-round debate: after seeing round-1 verdicts, each agent switches to the
  // round-1 majority with prob gamma; final verdict is the round-2 majority.
  function debateRule(k, gamma) {
    const f = new Float64Array(k + 1);
    for (let c = 0; c <= k; c++) {
      const majFlag = 2 * c > k ? 1 : (2 * c === k ? 0.5 : 0);
      // number of round-2 flags = (flaggers who stay) + (passers who switch to flag)
      let pf = 0;
      for (let side = 0; side < 2; side++) {
        const w = side === 0 ? majFlag : 1 - majFlag; // side 0: majority is FLAG
        if (w === 0) continue;
        // flaggers stay flag unless majority is PASS and they switch
        const pStay = side === 0 ? 1 : 1 - gamma;   // flagger keeps FLAG
        const pSwitch = side === 0 ? gamma : 0;     // passer turns into FLAG
        // distribution of round-2 flags: Bin(c, pStay) + Bin(k-c, pSwitch)
        let prob = 0;
        for (let x = 0; x <= c; x++) {
          const px = binomPmf(c, x, pStay);
          if (px === 0) continue;
          for (let y = 0; y <= k - c; y++) {
            const py = binomPmf(k - c, y, pSwitch);
            if (py === 0) continue;
            const tot = x + y;
            const out = 2 * tot > k ? 1 : (2 * tot === k ? 0.5 : 0);
            prob += px * py * out;
          }
        }
        pf += w * prob;
      }
      f[c] = pf;
    }
    return f;
  }

  // Neyman-Pearson frontier: best detection at each false-alarm level
  function npFrontier(S) {
    const idx = [];
    for (let c = 0; c <= S.k; c++) idx.push(c);
    const lr = (c) => (S.P0[c] <= 1e-300 ? Infinity : S.P1[c] / S.P0[c]);
    idx.sort((x, y) => lr(y) - lr(x));
    const pts = [{ phi: 0, delta: 0 }];
    let phi = 0, delta = 0;
    for (const c of idx) { phi += S.P0[c]; delta += S.P1[c]; pts.push({ phi, delta }); }
    return pts;
  }

  /* ------------------------------------------------------------------ */
  /* Pipelines (Theorem: horizon law)                                    */
  /* ------------------------------------------------------------------ */

  // Sound agents, "flag if anyone flags", reliable repair.
  // Returns the fraction of pipelines still clean after each depth n.
  function simulatePipelines(pop, k, beta, depth, trials, rng) {
    const firstEscape = new Int32Array(trials).fill(depth + 1);
    for (let t = 0; t < trials; t++) {
      for (let s = 1; s <= depth; s++) {
        if (rng() < beta) {
          const d = pop.sampleDelta(rng);
          if (rng() < Math.pow(1 - d, k)) { firstEscape[t] = s; break; }
        }
      }
    }
    const surv = new Float64Array(depth + 1);
    const counts = new Int32Array(depth + 2);
    for (let t = 0; t < trials; t++) counts[firstEscape[t]]++;
    let alive = trials;
    surv[0] = 1;
    for (let n = 1; n <= depth; n++) { alive -= counts[n]; surv[n] = alive / trials; }
    return surv;
  }

  /* ------------------------------------------------------------------ */
  /* Finite optimal team size (Eq. kappa)                                */
  /* ------------------------------------------------------------------ */

  // M_P(k) = E[(1-P)^k] with P ~ Beta(mean pbar, concentration conc); conc = Infinity -> constant P
  function falseAlarmCurve(pbar, conc) {
    if (!(conc < 1e6)) return (k) => Math.pow(1 - pbar, k);
    const aP = pbar * conc, bP = (1 - pbar) * conc;
    const l0 = lgamma(aP + bP) - lgamma(bP);
    return (k) => (k <= 0 ? 1 : Math.exp(lgamma(bP + k) - lgamma(aP + bP + k) + l0));
  }

  function kappaParts(MQ, MP, beta, rho, betaR, k) {
    const floor = beta * (1 - rho);
    const miss = beta * rho * MQ(k);
    const harm = (1 - beta) * betaR * (1 - MP(k));
    return { floor, miss, harm, total: floor + miss + harm };
  }

  /* ------------------------------------------------------------------ */
  /* Calibration (Section: measuring the coverage exponent)              */
  /* ------------------------------------------------------------------ */

  function simulateFlags(pop, N, K, rng) {
    const f = new Int32Array(N);
    for (let i = 0; i < N; i++) f[i] = randBinom(rng, K, pop.sampleDelta(rng));
    return f;
  }

  // Unbiased miss-curve estimate from flag counts: mean of C(K - f, j) / C(K, j)
  function estimateMissCurve(f, K) {
    const N = f.length;
    const Mhat = new Float64Array(K + 1), sd = new Float64Array(K + 1);
    const hist = new Int32Array(K + 1);
    for (let i = 0; i < N; i++) hist[f[i]]++;
    for (let j = 0; j <= K; j++) {
      const cK = choose(K, j);
      let s = 0, s2 = 0;
      for (let fv = 0; fv <= K; fv++) {
        if (!hist[fv]) continue;
        const x = choose(K - fv, j) / cK;
        s += hist[fv] * x; s2 += hist[fv] * x * x;
      }
      Mhat[j] = s / N;
      sd[j] = Math.sqrt(Math.max(0, s2 / N - Mhat[j] * Mhat[j]));
    }
    return { Mhat, sd, hist, N, K };
  }

  // Delta-method standard error of a_hat(j) = log2 M(j)/M(2j), as in the paper
  function seA(Mf, j, N) {
    const Mj = Mf(j), M2 = Mf(2 * j), M3 = Mf(3 * j), M4 = Mf(4 * j);
    const Vj = M2 - Mj * Mj, V2 = M4 - M2 * M2, Cj = M3 - Mj * M2;
    const br = Vj / (Mj * Mj) + V2 / (M2 * M2) - 2 * Cj / (Mj * M2);
    return Math.sqrt(Math.max(0, br)) / (Math.sqrt(N) * Math.LN2);
  }

  // The same delta method, but with variances taken from the per-defect estimators
  // themselves. This includes the extra noise from seeing each defect through only K agents.
  function seAFromData(est, j) {
    const { hist, K, N } = est;
    if (2 * j > K) return NaN;
    const c1 = choose(K, j), c2 = choose(K, 2 * j);
    let m1 = 0, m2 = 0, s11 = 0, s22 = 0, s12 = 0;
    for (let fv = 0; fv <= K; fv++) {
      if (!hist[fv]) continue;
      const x = choose(K - fv, j) / c1, y = choose(K - fv, 2 * j) / c2, h = hist[fv];
      m1 += h * x; m2 += h * y; s11 += h * x * x; s22 += h * y * y; s12 += h * x * y;
    }
    m1 /= N; m2 /= N;
    const v1 = s11 / N - m1 * m1, v2 = s22 / N - m2 * m2, cv = s12 / N - m1 * m2;
    const br = v1 / (m1 * m1) + v2 / (m2 * m2) - 2 * cv / (m1 * m2);
    return Math.sqrt(Math.max(0, br)) / (Math.sqrt(N) * Math.LN2);
  }

  /* ------------------------------------------------------------------ */
  /* Team selection (Section: choosing who verifies)                     */
  /* pool: { mu: [type masses], q: [[agent][type] detection prob] }      */
  /* ------------------------------------------------------------------ */

  function teamMiss(pool, S) {
    let m = 0;
    for (let t = 0; t < pool.mu.length; t++) {
      let pr = 1;
      for (const i of S) pr *= 1 - pool.q[i][t];
      m += pool.mu[t] * pr;
    }
    return m;
  }

  function agentAcc(pool, i) {
    let s = 0;
    for (let t = 0; t < pool.mu.length; t++) s += pool.mu[t] * pool.q[i][t];
    return s;
  }

  function selectTopK(pool, k) {
    const idx = pool.q.map((_, i) => i);
    idx.sort((x, y) => agentAcc(pool, y) - agentAcc(pool, x) || x - y);
    return idx.slice(0, k);
  }

  function selectGreedy(pool, k) {
    const S = [];
    for (let step = 0; step < k; step++) {
      let best = -1, bestM = Infinity;
      for (let i = 0; i < pool.q.length; i++) {
        if (S.includes(i)) continue;
        const m = teamMiss(pool, S.concat([i]));
        if (m < bestM - 1e-15) { bestM = m; best = i; }
      }
      if (best < 0) break;
      S.push(best);
    }
    return S;
  }

  function selectOptimal(pool, k) {
    const n = pool.q.length;
    let best = null, bestM = Infinity;
    const S = [];
    (function rec(start) {
      if (S.length === k) {
        const m = teamMiss(pool, S);
        if (m < bestM - 1e-15) { bestM = m; best = S.slice(); }
        return;
      }
      for (let i = start; i <= n - (k - S.length); i++) { S.push(i); rec(i + 1); S.pop(); }
    })(0);
    return best || [];
  }

  function randomTeamMean(pool, k, rng, draws) {
    const n = pool.q.length;
    let s = 0;
    for (let d = 0; d < draws; d++) {
      const idx = pool.q.map((_, i) => i);
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
      s += teamMiss(pool, idx.slice(0, k));
    }
    return s / draws;
  }

  // Search for the largest violation of submodularity of Lambda(S) = -log M(S):
  // a gain that grows when the base team grows.
  function submodularityProbe(pool, rng, tries) {
    const n = pool.q.length;
    const L = (S) => -Math.log(Math.max(1e-300, teamMiss(pool, S)));
    let worst = null;
    for (let t = 0; t < tries; t++) {
      const perm = pool.q.map((_, i) => i);
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp; }
      const e = perm[0];
      const sizeB = 1 + Math.floor(rng() * Math.min(4, n - 2));
      const B = perm.slice(1, 1 + sizeB);
      const sizeA = Math.floor(rng() * sizeB);
      const A = B.slice(0, sizeA);
      const gA = L(A.concat([e])) - L(A), gB = L(B.concat([e])) - L(B);
      const v = gB - gA;
      if (isFinite(v) && (!worst || v > worst.v)) worst = { v, A, B, e, gA, gB };
    }
    return worst;
  }

  /* ------------------------------------------------------------------ */
  /* Formatting                                                          */
  /* ------------------------------------------------------------------ */

  function fmtNum(x, digits) {
    if (x === Infinity) return '∞';
    if (x === -Infinity) return '−∞';
    if (!isFinite(x)) return '–';
    const ax = Math.abs(x);
    let s;
    if (digits !== undefined) s = x.toFixed(digits);
    else if (ax === 0) s = '0';
    else if (ax >= 1e5) s = Math.round(x).toLocaleString('en-US');
    else if (ax >= 100) s = x.toFixed(0);
    else if (ax >= 10) s = x.toFixed(1);
    else if (ax >= 1) s = x.toFixed(2);
    else if (ax >= 0.01) s = x.toFixed(3);
    else if (ax >= 0.001) s = x.toFixed(4);
    else s = x.toExponential(1).replace('e-', '×10⁻').replace(/⁻(\d+)/, (m, g) => '⁻' + supDigits(g));
    return s.replace('-', '−');
  }
  function supDigits(g) {
    const map = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
    return String(g).split('').map((c) => map[c] || c).join('');
  }
  function fmtPct(x, digits) {
    if (!isFinite(x)) return '–';
    const v = 100 * x;
    if (digits !== undefined) return v.toFixed(digits) + '%';
    if (v >= 10) return v.toFixed(0) + '%';
    if (v >= 1) return v.toFixed(1) + '%';
    if (v >= 0.1) return v.toFixed(2) + '%';
    return v.toPrecision(2) + '%';
  }

  const Core = {
    mulberry32, randn, randBeta, randBinom, logRandGamma,
    lgamma, gammaFn, logChoose, choose, ibeta, betaQuantile, betaPdf, zeta,
    makePop, discretePop, nStar, altDiff,
    lpSolve, identify, identifyB, identifyRelaxed, npmle, exchangeabilityTest, bernsteinRow,
    protocolSetup, protocolPoint, thresholdRule, escalationRule, debateRule, npFrontier, binomPmf,
    simulatePipelines, falseAlarmCurve, kappaParts,
    simulateFlags, estimateMissCurve, seA, seAFromData,
    teamMiss, agentAcc, selectTopK, selectGreedy, selectOptimal, randomTeamMean, submodularityProbe,
    fmtNum, fmtPct, supDigits,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  else root.Core = Core;
})(typeof window !== 'undefined' ? window : globalThis);
