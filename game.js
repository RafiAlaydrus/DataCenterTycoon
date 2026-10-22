'use strict';
/* Data Center Tycoon — vanilla JS, fully offline. Model first, UI after boot(). */

const SAVE_KEY = 'dct_save_v1';
const DEBUG = typeof location !== 'undefined' && /[?&]debug=1/.test(location.search);
const SPEED = DEBUG ? 10 : 1;
const RATE = 1;            // $ per TFLOPS per second
const GROW = 1.15;         // price growth per purchase
const BASE_POW = 24, BASE_COOL = 16;   // free kW at the start of a run
const SHARE_BONUS = 0.05, IPO_DIV = 1e8, RP_K = 0.03, TAP_MAX = 12, UNLOCK = 0.6;
const MILE = [25, 50, 100];
const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];

// ---------- data ----------
// b = base cost, c = TFLOPS, p = power kW, h = heat kW, a = capacity kW
const TIERS = [
  {n: 'Raspberry Pi Cluster', b: 15,     c: 1,     p: 0.4, h: 0.35},
  {n: '1U Rack Server',       b: 240,    c: 8,     p: 1.2, h: 1},
  {n: 'Blade Chassis',        b: 3.8e3,  c: 64,    p: 3.6, h: 3.1},
  {n: 'Storage Array',        b: 61e3,   c: 512,   p: 11,  h: 9.4},
  {n: 'GPU Rack',             b: 980e3,  c: 4096,  p: 32,  h: 28},
  {n: 'TPU Pod',              b: 15.7e6, c: 32.8e3, p: 97, h: 84},
  {n: 'AI Supercluster',      b: 250e6,  c: 262e3, p: 290, h: 250},
  {n: 'Quantum Node',         b: 4e9,    c: 2.1e6, p: 875, h: 760},
];
const POWERS = [
  {n: 'Grid Upgrade',      b: 32,    a: 4},
  {n: 'Diesel Generator',  b: 2.8e3, a: 40},
  {n: 'Solar Farm',        b: 360e3, a: 450},
  {n: 'Substation',        b: 45e6,  a: 5e3},
  {n: 'Small Modular Reactor', b: 6.6e9, a: 60e3},
];
const COOLS = [
  {n: 'Fans',            b: 28,    a: 4},
  {n: 'CRAC Units',      b: 2.1e3, a: 35},
  {n: 'Hot/Cold Aisle',  b: 280e3, a: 400},
  {n: 'Liquid Cooling',  b: 36e6,  a: 4.5e3},
  {n: 'Immersion Cooling', b: 5.5e9, a: 55e3},
];
const CAT = {srv: TIERS, pow: POWERS, cool: COOLS};
const KINDS = ['srv', 'pow', 'cool'];
const HUE = [140, 170, 195, 215, 265, 300, 340, 30];
const col = (k, i) => k === 'srv' ? `hsl(${HUE[i]},95%,58%)` : k === 'pow' ? '#ffd23f' : k === 'cool' ? '#4de1ff' : '#b478ff';

const RES = [
  {id: 'pue1', n: 'Airflow Tuning',    d: 'PUE −0.15 (less power overhead)', c: 25},
  {id: 'eff1', n: 'Firmware Tuning',   d: 'Server output +15%', c: 40},
  {id: 'con1', n: 'Sales Team',        d: 'Contract payouts +30%', c: 80},
  {id: 'pue2', n: 'Smart PDUs',        d: 'PUE −0.15', c: 150},
  {id: 'auto1', n: 'Auto-Negotiator',  d: 'Auto-accept contracts', c: 300},
  {id: 'eff2', n: 'Custom Silicon',    d: 'Server output +25%', c: 500},
  {id: 'off1', n: 'Redundant Uplinks', d: 'Offline cap 2h → 4h', c: 800},
  {id: 'auto2', n: 'Self-Healing Ops', d: 'Auto-fix random events', c: 1300},
  {id: 'con2', n: 'Enterprise SLAs',   d: 'Contract payouts +60%', c: 2200},
  {id: 'pue3', n: 'Free-Air Cooling',  d: 'PUE −0.15', c: 3500},
  {id: 'eff3', n: 'Compiler Magic',    d: 'Server output +40%', c: 6000},
  {id: 'off2', n: 'Edge Caching',      d: 'Offline cap 4h → 8h', c: 10000},
];
const CLIENTS = [['Startup', 2.0], ['Web Agency', 2.2], ['Biotech Lab', 2.5], ['Game Studio', 2.7], ['Bank', 3.0], ['Government', 3.4]];

const sum = a => a.reduce((x, y) => x + y, 0);
const ACH = [
  {id: 'tap1',  n: 'Hello World',      d: 'Deploy manually once',     t: () => S.st.taps >= 1},
  {id: 'tap100', n: 'Click Farm',      d: '100 manual deploys',       t: () => S.st.taps >= 100},
  {id: 'srv1',  n: 'Plug It In',       d: 'Own a server',             t: () => D.ns >= 1},
  {id: 'srv25', n: "Rack 'Em Up",      d: 'Own 25 servers',           t: () => D.ns >= 25},
  {id: 'srv100', n: 'Server Farm',     d: 'Own 100 servers',          t: () => D.ns >= 100},
  {id: 'ms',    n: 'Milestone',        d: 'Own 25 of one server',     t: () => S.own.srv.some(n => n >= 25)},
  {id: 'tiers', n: 'Full Stack',       d: 'Own every server tier',    t: () => S.own.srv.every(n => n > 0), b: 2},
  {id: 'm1m',   n: 'Millionaire',      d: 'Earn $1M lifetime',        t: () => S.all >= 1e6},
  {id: 'm1b',   n: 'Billionaire',      d: 'Earn $1B lifetime',        t: () => S.all >= 1e9},
  {id: 'm1t',   n: 'Trillionaire',     d: 'Earn $1T lifetime',        t: () => S.all >= 1e12, b: 2},
  {id: 'black', n: 'Lights Out',       d: 'Overload your power',      t: () => S.st.black > 0},
  {id: 'throt', n: 'Thermal Throttle', d: 'Overheat your servers',    t: () => S.st.throt > 0},
  {id: 'pow10', n: 'Grid Guru',        d: 'Own 10 power units',       t: () => sum(S.own.pow) >= 10},
  {id: 'cool10', n: 'Cool Customer',   d: 'Own 10 cooling units',     t: () => sum(S.own.cool) >= 10},
  {id: 'con1',  n: 'Closed a Deal',    d: 'Complete a contract',      t: () => S.st.con >= 1},
  {id: 'con20', n: 'Deal Machine',     d: 'Complete 20 contracts',    t: () => S.st.con >= 20},
  {id: 'ddos',  n: 'Firewall',         d: 'Mitigate a DDoS',          t: () => S.st.ddos >= 1},
  {id: 'surge', n: 'Breaker Flipped',  d: 'Reset a power surge',      t: () => S.st.surge >= 1},
  {id: 'boom',  n: 'Riding the Boom',  d: 'Experience an AI Boom',    t: () => S.st.boom >= 1},
  {id: 'res1',  n: 'Curious Mind',     d: 'Buy a research upgrade',   t: () => Object.keys(S.res).length >= 1},
  {id: 'ipo',   n: 'Ring the Bell',    d: 'Complete an IPO',          t: () => S.ipos >= 1, b: 3},
  {id: 'sh25',  n: 'Shareholder',      d: 'Hold 25 Shares',           t: () => S.shares >= 25, b: 2},
];

// ---------- formatting ----------
function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) {
    const s = Number.isInteger(n) ? String(n) : n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2);
    if (+s < 1000) return s;
  }
  let k = Math.max(1, Math.floor(Math.log10(n) / 3)), s = (n / Math.pow(1000, k)).toFixed(2);
  if (+s >= 1000) { k++; s = (n / Math.pow(1000, k)).toFixed(2); }
  return k < SUF.length ? s + SUF[k] : n.toExponential(2).replace('e+', 'e');
}
const $m = n => '$' + fmt(n);
const fmtT = s => s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s` : `${Math.floor(s)}s`;
const rnd = (a, b) => a + Math.random() * (b - a);
const pickI = n => Math.floor(Math.random() * n);

// ---------- state ----------
let S, D = {}, buyMode = 1, resetting = false;
const has = id => !!S.res[id];
const fresh = () => ({
  cash: 10, run: 0, all: 0, rp: 0, shares: 0, ipos: 0, tap: 0, runTime: 0,
  own: {srv: TIERS.map(() => 0), pow: POWERS.map(() => 0), cool: COOLS.map(() => 0)},
  unl: {srv: TIERS.map(() => false), pow: POWERS.map(() => false), cool: COOLS.map(() => false)},
  res: {}, offers: [], act: [], nid: 1, ev: null, evT: 210, offT: 45,
  ach: {}, st: {taps: 0, con: 0, ddos: 0, surge: 0, boom: 0, black: 0, throt: 0},
  mute: false, tut: 0, saved: Date.now(),
});
function sanitize(o) {
  const f = fresh();
  for (const k in f) if (o[k] !== undefined && typeof o[k] === typeof f[k]) f[k] = o[k];
  for (const k of KINDS) {
    f.own[k] = CAT[k].map((_, i) => Math.max(0, Math.floor(+(o.own && o.own[k] && o.own[k][i]) || 0)));
    f.unl[k] = CAT[k].map((_, i) => !!(o.unl && o.unl[k] && o.unl[k][i]));
  }
  f.st = Object.assign(fresh().st, o.st);
  ['cash', 'run', 'all', 'rp', 'shares', 'ipos', 'tap', 'runTime'].forEach(k => { if (!isFinite(f[k]) || f[k] < 0) f[k] = 0; });
  f.ev = null;
  if (!Array.isArray(f.offers)) f.offers = [];
  if (!Array.isArray(f.act)) f.act = [];
  return f;
}

// ---------- derived numbers ----------
const ms = n => n >= 100 ? 8 : n >= 50 ? 4 : n >= 25 ? 2 : 1;
const pue = () => 1.6 - 0.15 * (has('pue1') + has('pue2') + has('pue3'));
const cmult = () => (has('eff1') ? 1.15 : 1) * (has('eff2') ? 1.25 : 1) * (has('eff3') ? 1.4 : 1);
const conMult = () => 1 + (has('con1') ? 0.3 : 0) + (has('con2') ? 0.6 : 0);
const offCap = () => (has('off2') ? 8 : has('off1') ? 4 : 2) * 3600;
const achBonus = () => sum(ACH.map(a => S.ach[a.id] ? (a.b || 1) : 0));
const shareGain = () => Math.floor(Math.sqrt(S.run / IPO_DIV));
const rpRate = () => RP_K * Math.sqrt(D.eff);
const tapVal = () => (1 + 2 * S.tap + 0.04 * D.inc) * D.perm;
const tapCost = () => Math.ceil(40 * Math.pow(1.7, S.tap));

function calc() {
  let comp = 0, pu = 0, ht = 0, ns = 0, pc = BASE_POW, cc = BASE_COOL;
  TIERS.forEach((t, i) => { const n = S.own.srv[i]; ns += n; comp += n * t.c * ms(n); pu += n * t.p; ht += n * t.h; });
  POWERS.forEach((t, i) => { pc += S.own.pow[i] * t.a; });
  COOLS.forEach((t, i) => { cc += S.own.cool[i] * t.a; });
  pu *= pue();
  const e = S.ev && S.ev.k;
  if (e === 'heat') cc *= 0.7;
  const pf = e === 'surge' ? 0 : pu > pc ? pc / pu : 1;     // share of servers still powered
  const hl = ht * pf, cf = hl > cc ? cc / hl : 1;            // offline servers make no heat; cf = throttle
  comp *= cmult();
  const eff = comp * pf * cf, res = sum(S.act.map(c => c.req));
  const ok = eff >= res - 1e-9;
  const perm = (1 + SHARE_BONUS * S.shares) * (1 + achBonus() / 100);
  const evm = e === 'down' ? 0 : e === 'boom' ? 2 : 1;
  D = {comp, pu, pc, ht: hl, cc, pf, cf, eff, res, ok, perm, ns, inc: (ok ? Math.max(0, eff - res) : 0) * RATE * perm * evm};
}

// ---------- actions ----------
function addCash(x) { S.cash += x; S.run += x; S.all += x; }
const cost = (k, i, n, q) => { const t = CAT[k][i]; return t.b * Math.pow(GROW, n) * (Math.pow(GROW, q) - 1) / (GROW - 1); };
function maxQ(k, i) {
  const n = S.own[k][i], b = CAT[k][i].b;
  let q = Math.floor(Math.log(1 + S.cash * (GROW - 1) / (b * Math.pow(GROW, n))) / Math.log(GROW));
  while (q > 0 && cost(k, i, n, q) > S.cash) q--;
  return q;
}
const qty = (k, i) => buyMode === 'max' ? Math.max(1, maxQ(k, i)) : buyMode;
function buy(k, i) {
  const n = S.own[k][i], q = qty(k, i), c = cost(k, i, n, q);
  if (S.cash < c) { sfx('bad'); return; }
  S.cash -= c; S.own[k][i] += q; calc(); sfx('buy');
}
function buyRes(id) {
  const r = RES.find(x => x.id === id);
  if (!r || has(id)) return;
  if (S.rp < r.c) { sfx('bad'); return; }
  S.rp -= r.c; S.res[id] = 1; calc(); sfx('buy');
}
function buyTap() {
  const c = tapCost();
  if (S.tap >= TAP_MAX || S.cash < c) { sfx('bad'); return; }
  S.cash -= c; S.tap++; sfx('buy');
}
function accept(id, auto) {
  const i = S.offers.findIndex(o => o.id === id);
  if (i < 0) return false;
  const o = S.offers[i];
  if (o.req > D.eff - D.res + 1e-9) { if (!auto) { sfx('bad'); toast(`Need ${fmt(o.req)} free TFLOPS`, 'bad'); } return false; }
  S.offers.splice(i, 1);
  S.act.push({id: o.id, cl: o.cl, req: o.req, dur: o.dur, t: o.dur, pay: o.pay});
  calc(); sfx('buy');
  return true;
}
function newOffer() {
  if (D.eff < 3 || S.offers.length >= 3) return;
  const [cl, m] = CLIENTS[pickI(CLIENTS.length)], dur = [30, 45, 60, 90][pickI(4)];
  const req = Math.max(1, Math.round(D.eff * rnd(0.15, 0.4)));
  S.offers.push({id: S.nid++, cl, req, dur, ttl: rnd(60, 90), pay: req * dur * RATE * D.perm * m * rnd(0.9, 1.1)});
}
function ipo() {
  const g = shareGain();
  if (g < 1) { sfx('bad'); return; }
  if (!confirm(`Go public?\n\nEverything resets except Shares and achievements.\nYou gain +${g} Shares (+${g * 5}% income).`)) return;
  const k = fresh();
  Object.assign(k, {shares: S.shares + g, ipos: S.ipos + 1, all: S.all, ach: S.ach, st: S.st, mute: S.mute, tut: S.tut});
  S = k; calc(); resetViews(); save(); sfx('ipo');
  toast(`📈 IPO! +${g} Shares`, 'gold');
  showTab('srv');
}

// ---------- events ----------
function startEvent() {
  if (D.ns < 1) { S.evT = 30; return; }
  const k = [['ddos', 30], ['surge', 25], ['boom', 25], ['heat', 20]];
  let r = Math.random() * 100, kind = 'heat';
  for (const [n, w] of k) { if ((r -= w) < 0) { kind = n; break; } }
  if (kind === 'ddos') {
    if (has('auto2')) { S.st.ddos++; toast('🛡 Auto-mitigated a DDoS'); S.evT = rnd(120, 240); return; }
    S.ev = {k: 'ddos', t: 15, taps: 0};
  } else if (kind === 'surge') S.ev = {k: 'surge', t: has('auto2') ? 2 : 0};
  else if (kind === 'boom') { S.ev = {k: 'boom', t: 30}; S.st.boom++; }
  else S.ev = {k: 'heat', t: 60};
  if (kind !== 'boom') sfx('alarm'); else sfx('win');
  calc();
}
function endEv() { S.ev = null; S.evT = rnd(120, 240); calc(); }
function evTap() {
  const e = S.ev;
  if (!e) return;
  if (e.k === 'ddos') {
    sfx('tap');
    if (++e.taps >= 10) { S.st.ddos++; endEv(); sfx('win'); toast('🛡 Attack mitigated!'); }
  } else if (e.k === 'surge') { S.st.surge++; endEv(); sfx('win'); toast('⚡ Breaker reset'); }
}
function evStep(dt) {
  const e = S.ev;
  if (!e) { if ((S.evT -= dt) <= 0) startEvent(); return; }
  if (e.k === 'surge') { if (e.t > 0 && (e.t -= dt) <= 0) { S.st.surge++; endEv(); } return; }
  if ((e.t -= dt) > 0) return;
  if (e.k === 'ddos') { S.ev = {k: 'down', t: 30}; sfx('bad'); calc(); } else endEv();
}

// ---------- simulation ----------
let achT = 0;
function step(dt) {
  calc();
  addCash(D.inc * dt);
  S.rp += rpRate() * dt; S.runTime += dt;
  if (D.ok) S.act.forEach(c => { c.t -= dt; });
  S.act = S.act.filter(c => {
    if (c.t > 0) return true;
    const p = c.pay * conMult(); addCash(p); S.st.con++; sfx('win'); toast(`📜 ${c.cl} paid ${$m(p)}`);
    return false;
  });
  S.offers.forEach(o => { o.ttl -= dt; });
  S.offers = S.offers.filter(o => o.ttl > 0);
  if ((S.offT -= dt) <= 0) { S.offT = rnd(40, 50); newOffer(); }
  if (has('auto1')) [...S.offers].sort((a, b) => b.pay - a.pay).forEach(o => { calc(); accept(o.id, true); });
  evStep(dt);
  KINDS.forEach(k => CAT[k].forEach((t, i) => { if (!S.unl[k][i] && S.cash >= UNLOCK * t.b) S.unl[k][i] = true; }));
  calc();
  if (D.pf < 1 && !(S.ev && S.ev.k === 'surge')) S.st.black = 1;
  if (D.cf < 1) S.st.throt = 1;
  if ((achT -= dt) <= 0) { achT = 0.5; checkAch(); }
}
function checkAch() {
  for (const a of ACH) if (!S.ach[a.id] && a.t()) {
    S.ach[a.id] = 1; calc(); sfx('ach'); toast(`🏆 ${a.n} · +${a.b || 1}% income`, 'gold');
  }
}
function catchUp(secs) {
  secs = Math.min(secs, offCap());
  S.ev = null; S.evT = Math.max(S.evT, 60); calc();
  let gain = D.eff * RATE * D.perm * secs;
  S.act = S.act.filter(c => {
    c.t -= secs;
    if (c.t > 0) return true;
    gain += c.pay * conMult(); S.st.con++;
    return false;
  });
  S.offers = [];
  addCash(gain); S.rp += rpRate() * secs;
  calc(); checkAch();
  return gain;
}

// ---------- save / load ----------
function save() {
  if (resetting) return;
  try { S.saved = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage full/blocked */ }
}
function loadSave() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? sanitize(JSON.parse(raw)) : null; } catch (e) { return null; }
}
const enc = s => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const dec = b => new TextDecoder().decode(Uint8Array.from(atob(b.trim()), c => c.charCodeAt(0)));

// ---------- audio ----------
let AC;
const SFX = {
  tap: [[620, .04, 'square']], buy: [[420, .06, 'square'], [640, .09, 'square']], bad: [[150, .16, 'sawtooth']],
  win: [[520, .08], [660, .08], [880, .16]], ach: [[660, .08], [880, .08], [1320, .22]],
  alarm: [[880, .12, 'square'], [620, .12, 'square'], [880, .12, 'square']], ipo: [[440, .1], [554, .1], [659, .1], [880, .3]],
};
function unlockAudio() {
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state !== 'running') AC.resume(); } catch (e) { /* no audio */ }
}
function sfx(name) {
  if (typeof document === 'undefined' || S.mute || !AC || AC.state !== 'running') return;
  let t = AC.currentTime;
  for (const [f, d, w = 'sine'] of SFX[name]) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = w; o.frequency.value = f;
    g.gain.setValueAtTime(w === 'sine' ? 0.09 : 0.035, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d); t += d * 0.8;
  }
}

// ======================= UI =======================
let H = {}, EL = {}, hallSig = '', conSig = '', tab = 'srv', last = Date.now(), racks = [];
const $ = id => document.getElementById(id);
const txt = (el, s) => { if (el._t !== s) { el._t = s; el.textContent = s; } };
const setCls = (el, s) => { if (el._c !== s) { el._c = s; el.className = s; } };

function toast(msg, cls = '') {
  if (typeof document === 'undefined') return;
  const box = $('toasts'), d = document.createElement('div');
  d.className = 'toast ' + cls; d.textContent = msg; box.appendChild(d);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => d.remove(), 3100);
}
function modal(title, body, ok = 'OK') {
  const m = $('modal');
  m.querySelector('h2').textContent = title; m.querySelector('.mbody').innerHTML = body;
  m.querySelector('button').textContent = ok; m.hidden = false;
}
function floatText(x, y, s) {
  const d = document.createElement('div');
  d.className = 'ft'; d.textContent = s;
  d.style.left = (x + rnd(-14, 14)) + 'px'; d.style.top = (y - 18) + 'px';
  d.addEventListener('animationend', () => d.remove());
  const fx = $('fx'); fx.appendChild(d);
  while (fx.children.length > 14) fx.firstChild.remove();
}
function resetViews() { hallSig = ''; conSig = ''; }

function buildItems(k, list, box) {
  EL[k] = list.map((t, i) => {
    const b = document.createElement('button');
    b.className = 'item'; b.dataset.act = k === 'res' ? 'res' : 'buy'; b.dataset.k = k; b.dataset.i = i; if (t.id) b.dataset.id = t.id;
    b.style.setProperty('--c-i', col(k, i));
    b.innerHTML = '<span class="chip"></span><span class="meta"><b></b><small></small><small></small></span><span class="own"></span><span class="buy"><em></em><b></b></span>';
    box.appendChild(b);
    const sm = b.querySelectorAll('small');
    return {root: b, nm: b.querySelector('.meta b'), s1: sm[0], s2: sm[1], own: b.querySelector('.own'), q: b.querySelector('.buy em'), pr: b.querySelector('.buy b')};
  });
}
function updItems(k) {
  CAT[k].forEach((t, i) => {
    const e = EL[k][i], u = S.unl[k][i], teaser = !u && (i === 0 || S.unl[k][i - 1]);
    e.root.hidden = !(u || teaser);
    if (!u) { if (teaser) { setCls(e.root, 'item lock'); txt(e.nm, '🔒 ' + t.n); txt(e.s1, 'Unlocks near ' + $m(t.b * UNLOCK)); txt(e.s2, ''); } return; }
    const n = S.own[k][i], q = qty(k, i), c = cost(k, i, n, q);
    setCls(e.root, 'item ' + (S.cash >= c ? 'can' : 'no'));
    txt(e.nm, t.n); txt(e.own, String(n)); txt(e.q, '×' + q); txt(e.pr, $m(c));
    if (k === 'srv') {
      const m = ms(n);
      txt(e.s1, `${fmt(t.c * m * cmult())} TF · ${fmt(t.p * pue())} kW · ${fmt(t.h)} kW heat`);
      txt(e.s2, n < 100 ? `×2 output at ${MILE.find(x => x > n)} owned` + (m > 1 ? ` · now ×${m}` : '') : `MAX milestone · ×${m} output`);
    } else { txt(e.s1, `+${fmt(t.a)} kW capacity`); txt(e.s2, `Total +${fmt(n * t.a)} kW`); }
  });
}
function updRes() {
  txt($('rphead'), `🔬 ${fmt(S.rp)} Research Points  ·  +${fmt(rpRate())}/s`);
  RES.forEach((r, i) => {
    const e = EL.res[i], owned = has(r.id);
    setCls(e.root, 'item ' + (owned ? 'done' : S.rp >= r.c ? 'can' : 'no'));
    txt(e.nm, r.n); txt(e.s1, r.d); txt(e.s2, r.id === 'pue1' || r.id === 'pue2' || r.id === 'pue3' ? `PUE now ${pue().toFixed(2)}` : '');
    txt(e.own, owned ? '✔' : ''); txt(e.q, owned ? '' : 'cost'); txt(e.pr, owned ? 'OWNED' : fmt(r.c) + ' RP');
  });
}
function bar(b, f, label) {
  const w = Math.min(1, f) * 100 + '%';
  if (b.fill._w !== w) { b.fill._w = w; b.fill.style.width = w; }
  setCls(b.root, 'bar ' + (f > 1 ? 'over' : f > 0.85 ? 'warn' : ''));
  txt(b.lb, label);
}
function renderHall() {
  const counts = S.own.srv.map(n => n ? Math.min(6, Math.ceil(Math.sqrt(n))) : 0), sig = counts.join();
  if (sig !== hallSig) {
    hallSig = sig; H.hall.innerHTML = ''; racks = [];
    if (!sum(counts)) H.hall.innerHTML = '<span class="hint">Empty hall — deploy your first server!</span>';
    counts.forEach((n, i) => {
      if (!n) return;
      const lane = document.createElement('div'); lane.className = 'lane'; lane.style.setProperty('--c', col('srv', i));
      for (let j = 0; j < n; j++) {
        const r = document.createElement('div'); r.className = 'rack';
        r.style.setProperty('--d', (-Math.random() * 1.6).toFixed(2) + 's'); r.innerHTML = '<i></i><i></i><i></i>';
        lane.appendChild(r); racks.push(r);
      }
      H.hall.appendChild(lane);
    });
  }
  const off = Math.ceil(racks.length * (1 - D.pf) - 1e-9);
  racks.forEach((r, i) => r.classList.toggle('off', i >= racks.length - off));
  H.hall.classList.toggle('pwr', D.pf < 1);
  H.hall.classList.toggle('hot', D.cf < 1);
}
function renderEv() {
  const e = S.ev, b = H.evt;
  if (!e) { b.hidden = true; return; }
  b.hidden = false;
  const t = Math.ceil(e.t);
  const [cls, msg] = {
    ddos: ['bad', `🛡 DDoS ATTACK! TAP ×${10 - e.taps} MORE · ${t}s`],
    down: ['bad', `🚫 TRAFFIC BLOCKED · income offline ${t}s`],
    surge: ['bad', e.t > 0 ? `⚡ POWER SURGE · auto-reset in ${t}s` : '⚡ POWER SURGE! ALL OFFLINE · TAP TO RESET'],
    boom: ['good', `🚀 AI BOOM · 2× income · ${t}s`],
    heat: ['heat', `☀ HEATWAVE · cooling −30% · ${t}s`],
  }[e.k];
  setCls(b, cls); txt(b, msg);
}
function renderCon() {
  const sig = S.offers.map(o => o.id).join() + '|' + S.act.map(c => c.id).join();
  const A = $('con-act'), O = $('con-off');
  if (sig !== conSig) {
    conSig = sig;
    A.innerHTML = S.act.length ? S.act.map(c => `<div class="card act" data-id="${c.id}"><div class="ct"><b>${c.cl}</b> · ${fmt(c.req)} TFLOPS reserved</div><div class="tbar"><i></i></div><div class="cp">Pays <b></b> · <span></span></div></div>`).join('') : '<p class="mu">No active contracts.</p>';
    O.innerHTML = S.offers.length ? S.offers.map(o => `<div class="card offer" data-id="${o.id}"><div class="ct"><b>${o.cl}</b> needs <b>${fmt(o.req)} TFLOPS</b> for ${o.dur}s</div><div class="cp">Pays <b></b> · expires in <span></span></div><div class="tbar"><i></i></div><button class="btn" data-act="acc" data-id="${o.id}">Accept</button></div>`).join('') : '<p class="mu">No offers right now. A new client calls about every 45s.</p>';
  }
  S.act.forEach(c => {
    const el = A.querySelector(`[data-id="${c.id}"]`); if (!el) return;
    txt(el.querySelector('.cp b'), $m(c.pay * conMult()));
    txt(el.querySelector('.cp span'), D.ok ? fmtT(c.t) + ' left' : 'PAUSED · not enough compute');
    el.querySelector('i').style.width = (100 * (1 - c.t / c.dur)) + '%';
  });
  S.offers.forEach(o => {
    const el = O.querySelector(`[data-id="${o.id}"]`); if (!el) return;
    txt(el.querySelector('.cp b'), $m(o.pay * conMult()));
    txt(el.querySelector('.cp span'), fmtT(o.ttl));
    el.querySelector('i').style.width = Math.min(100, 100 * o.ttl / 90) + '%';
    setCls(el.querySelector('button'), 'btn ' + (o.req <= D.eff - D.res + 1e-9 ? 'can' : 'no'));
  });
}
function renderIpo() {
  const g = shareGain(), cur = SHARE_BONUS * S.shares, next = g + 1;
  txt($('i-run'), $m(S.run)); txt($('i-sh'), fmt(S.shares)); txt($('i-bon'), '+' + fmt(cur * 100) + '%');
  txt($('i-gain'), '+' + fmt(g)); txt($('i-new'), '+' + fmt((S.shares + g) * SHARE_BONUS * 100) + '%');
  const lo = g * g * IPO_DIV, hi = next * next * IPO_DIV;
  $('i-prog').style.width = (100 * (S.run - lo) / (hi - lo)) + '%';
  txt($('i-next'), `Next Share at ${$m(hi)} earned this run`);
  setCls($('i-btn'), 'btn big' + (g < 1 ? ' no' : ''));
  txt($('i-btn'), g < 1 ? `Need ${$m(IPO_DIV)} earned for 1 Share` : `GO PUBLIC  (+${fmt(g)} Shares)`);
}
function renderStats() {
  $('stats').innerHTML = [['Run time', fmtT(S.runTime)], ['Earned this run', $m(S.run)], ['Earned all-time', $m(S.all)], ['Manual deploys', fmt(S.st.taps)],
    ['Contracts done', fmt(S.st.con)], ['IPOs', fmt(S.ipos)], ['Income bonus', `+${fmt((achBonus()) + S.shares * 5)}%`]]
    .map(([a, b]) => `<div class="kv"><span>${a}</span><b>${b}</b></div>`).join('');
}

function render() {
  const pf = D.pu / D.pc, hf = D.ht / D.cc;
  txt(H.cash, $m(S.cash)); txt(H.inc, '+' + $m(D.inc) + '/s'); H.inc.classList.toggle('zero', D.ns > 0 && D.inc <= 0);
  bar(H.pow, pf, `${fmt(D.pu)} / ${fmt(D.pc)} kW · ${Math.round(pf * 100)}%`);
  bar(H.heat, hf, `${fmt(D.ht)} / ${fmt(D.cc)} kW · ${Math.round(hf * 100)}%`);
  const cf = D.comp ? D.eff / D.comp : 1;
  bar(H.comp, 0, '');            // compute bar: fill = efficiency, colour inverted (low = bad)
  H.comp.fill.style.width = (D.comp ? cf * 100 : 0) + '%';
  setCls(H.comp.root, 'bar ' + (cf < 0.6 ? 'over' : cf < 0.999 ? 'warn' : ''));
  txt(H.comp.lb, `${fmt(D.eff)} / ${fmt(D.comp)} TF · ${Math.round(cf * 100)}%`);
  const surge = S.ev && S.ev.k === 'surge';
  H.wPow.hidden = !(D.pf < 1 && !surge);
  if (!H.wPow.hidden) txt(H.wPow, `⚠ POWER OVERLOAD · ${Math.ceil(D.ns * (1 - D.pf))} of ${D.ns} servers offline`);
  H.wHeat.hidden = !(D.cf < 1);
  if (!H.wHeat.hidden) txt(H.wHeat, `🔥 THERMAL THROTTLING · ${Math.round(D.cf * 100)}% efficiency`);
  renderEv(); renderHall();
  H.dots[0].hidden = !S.offers.length;
  H.dots[1].hidden = !RES.some(r => !has(r.id) && S.rp >= r.c);
  H.dots[2].hidden = shareGain() < 1;
  if (tab === 'srv') {
    txt($('tapval'), '+' + $m(tapVal()));
    const c = tapCost(), maxed = S.tap >= TAP_MAX;
    setCls($('tapup'), S.cash >= c && !maxed ? 'can' : 'no');
    txt($('tapup'), maxed ? 'Scripts\nMAX' : `Scripts Lv${S.tap}\n${$m(c)}`);
    updItems('srv');
  } else if (tab === 'inf') { updItems('pow'); updItems('cool'); }
  else if (tab === 'con') renderCon();
  else if (tab === 'res') updRes();
  else if (tab === 'ipo') { renderIpo(); renderAch(); }
  else if (tab === 'set') renderStats();
}

function buildAch() {
  $('l-ach').innerHTML = ACH.map(a => `<div class="ach" id="ach-${a.id}"><div><b>${a.n}</b><small>${a.d}</small></div><em>+${a.b || 1}%</em></div>`).join('');
}
function renderAch() {
  ACH.forEach(a => $('ach-' + a.id).classList.toggle('got', !!S.ach[a.id]));
  txt($('a-cnt'), `${ACH.filter(a => S.ach[a.id]).length}/${ACH.length} · +${achBonus()}% income`);
}
function showTab(t) {
  tab = t;
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('on', p.id === 'p-' + t));
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $('buybar').classList.toggle('off', t !== 'srv' && t !== 'inf');
  if (t === 'con') conSig = '';
  render();
}
function setSound() { txt($('b-snd'), S.mute ? '🔇 Sound: OFF' : '🔊 Sound: ON'); }

// ---------- tutorial ----------
const TUT = [
  ['srv', '#tapbtn', 'Tap DEPLOY MANUALLY to earn your first dollars.'],
  ['srv', '#l-srv', 'Buy servers — they earn $ every second, even while you are away.'],
  ['srv', '#hud', 'Watch these bars! No spare power = servers go offline. Too much heat = servers throttle.'],
  ['inf', '#tabs [data-tab=inf]', 'Add Power and Cooling in Infra to keep growing. Contracts, Research and IPO unlock more.'],
];
function tut() {
  document.querySelectorAll('.hl').forEach(e => e.classList.remove('hl'));
  const st = TUT[S.tut], box = $('tut');
  box.hidden = !st;
  if (!st) return;
  showTab(st[0]); document.querySelector(st[1]).classList.add('hl');
  box.querySelector('p').textContent = `(${S.tut + 1}/${TUT.length}) ${st[2]}`;
}

// ---------- main loop ----------
function away(dt) {
  const g = catchUp(dt);
  if (dt >= 30 && g > 0) modal('While you were away', `${fmtT(dt)} offline${dt > offCap() ? ` (capped at ${fmtT(offCap())})` : ''}<b>+${$m(g)}</b>${fmt(rpRate() * Math.min(dt, offCap()))} RP gained`, 'Collect');
}
function tick() {
  const now = Date.now(), dt = Math.max(0, (now - last) / 1000);
  last = now;
  if (dt > 30) away(dt); else step(dt * (dt > 2 ? 1 : SPEED));
  render();
}

function boot() {
  const loaded = loadSave();
  S = loaded || fresh();
  H = {cash: $('cash'), inc: $('inc'), hall: $('hall'), evt: $('evt'), wPow: $('wPow'), wHeat: $('wHeat'),
    dots: document.querySelectorAll('#tabs .dot')};
  [['pow', 'bPow'], ['heat', 'bHeat'], ['comp', 'bComp']].forEach(([k, id]) => {
    const r = $(id); H[k] = {root: r, fill: r.querySelector('.fill'), lb: r.querySelector('.lb b')};
  });
  buildItems('srv', TIERS, $('l-srv')); buildItems('pow', POWERS, $('l-pow')); buildItems('cool', COOLS, $('l-cool')); buildItems('res', RES, $('l-res'));
  buildAch(); setSound();
  $('dbg').hidden = $('dbgchip').hidden = !DEBUG;

  $('tapbtn').addEventListener('pointerdown', e => {
    e.preventDefault(); unlockAudio();
    const v = tapVal(); addCash(v); S.st.taps++; floatText(e.clientX, e.clientY, '+' + $m(v)); sfx('tap');
  });
  $('evt').addEventListener('click', () => { evTap(); render(); });
  $('buybar').addEventListener('click', e => {
    const b = e.target.closest('[data-mode]'); if (!b) return;
    buyMode = b.dataset.mode === 'max' ? 'max' : +b.dataset.mode;
    document.querySelectorAll('#buybar button').forEach(x => x.classList.toggle('on', x === b)); render();
  });
  $('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });
  $('panels').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'buy') buy(b.dataset.k, +b.dataset.i);
    else if (a === 'res') buyRes(b.dataset.id);
    else if (a === 'tapup') buyTap();
    else if (a === 'acc') accept(+b.dataset.id);
    else if (a === 'ipo') ipo();
    else if (a === 'snd') { S.mute = !S.mute; setSound(); sfx('buy'); }
    else if (a === 'cheat') { addCash(1e9); sfx('win'); }
    else if (a === 'exp') {
      const ta = $('sv-text'); ta.value = enc(JSON.stringify(S)); ta.focus(); ta.select();
      try { navigator.clipboard.writeText(ta.value).then(() => toast('Save copied to clipboard')).catch(() => toast('Long-press the text to copy')); } catch (er) { toast('Long-press the text to copy'); }
    } else if (a === 'imp') {
      try {
        const o = JSON.parse(dec($('sv-text').value));
        if (!o || typeof o !== 'object' || !o.own) throw new Error('bad');
        S = sanitize(o); calc(); resetViews(); save(); setSound(); toast('Save imported');
      } catch (er) { toast('Invalid save text', 'bad'); }
    } else if (a === 'rst') {
      if (confirm('Reset ALL progress, including Shares and achievements? This cannot be undone.')) {
        resetting = true; try { localStorage.removeItem(SAVE_KEY); } catch (er) { /* ignore */ }
        location.reload();
      }
    }
    render();
  });
  $('modal').querySelector('button').addEventListener('click', () => { $('modal').hidden = true; });
  $('tut').querySelector('button').addEventListener('click', () => { S.tut++; tut(); render(); });
  ['touchend', 'click'].forEach(ev => document.addEventListener(ev, unlockAudio, {passive: true}));
  // native feel: no pinch/double-tap zoom, no selection/copy/paste/callouts (the save box stays usable)
  const inSave = e => e.target.closest && e.target.closest('#sv-text');
  ['copy', 'cut', 'paste', 'selectstart', 'dragstart', 'contextmenu'].forEach(ev => document.addEventListener(ev, e => { if (!inSave(e)) e.preventDefault(); }));
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, {passive: false});
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);

  calc();
  last = Date.now();
  if (loaded) { const gap = (last - S.saved) / 1000; if (gap > 2) away(gap); }
  if (S.tut < TUT.length) tut(); else showTab('srv');
  render();
  setInterval(tick, 100);
  setInterval(save, 5000);
  if (DEBUG) window.dct = {get S() { return S; }, get D() { return D; }, step, calc, catchUp, startEvent, newOffer, save, fresh, ACH};
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (typeof HEADLESS === 'undefined') boot();
