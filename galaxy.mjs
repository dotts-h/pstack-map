// Galaxy theme. Layout, shaders, and motion follow design/concepts/galaxy.
// Zones are hand-picked. Textures are the CC BY 4.0 files credited in NOTICE.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/CSS2DRenderer.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import {
  bbLin, bbHex, ZONE_T, getGfx, setGfx, onGfx, quality,
  createBlackHole, BH_RS, makeStarMaterial, makePlanetMaterial, makeRingMaterial,
  fieldStarMaterial, createLensMaterial, createPipeline, STAR_U, PLAN_U,
} from './galaxy-fx.mjs';

const ZONES = [
  { id: 'build', name: 'Build', line: 'Make or change something.', col: '#A9C1FF', ids: ['feature', 'refactoring', 'prototype', 'visual-parity', 'authoring-a-skill', 'multi-phase-plan'] },
  { id: 'fix', name: 'Fix & Debug', line: 'Find out why it breaks, then fix it.', col: '#FFB070', ids: ['bug-fix', 'runtime-forensics', 'trace-forensics', 'perf-issue'] },
  { id: 'research', name: 'Research & Measure', line: 'Understand, test and improve against a number.', col: '#EEF0FF', ids: ['investigation', 'eval', 'hillclimb'] },
  { id: 'ship', name: 'Ship & Review', line: 'Get changes reviewed, green and merged.', col: '#FFE39A', ids: ['opening-a-pr', 'babysit', 'shipping', 'autopilot-stack', 'autopilot-full'] },
  { id: 'run', name: 'Run & Resume', line: 'Long runs, hand-offs, pauses and clean-up.', col: '#FF8F73', ids: ['autonomous-run', 'orchestrate', 'session-pickup', 'pause-safely', 'worktree-cleanup'] },
];

const PTEX = {
  skill: 'dust-mars-512.webp',
  agent: 'ice-neptune-512.webp',
  automation: 'dwarf-ceres_fictional-512.webp',
  principle: 'gas-jupiter-512.webp',
  reference: 'moon-moon-512.webp',
  script: 'rock-mercury-512.webp',
  other: 'moon-moon-512.webp',
};

export const CREDITS_HTML = `<p class="cred">Planet surfaces: <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener">Solar System Scope</a> (INOVE), CC BY 4.0. Milky Way backdrop: <a href="https://www.eso.org/public/images/eso0932a/" target="_blank" rel="noopener">ESO/S. Brunier</a>, CC BY 4.0. Everything else is procedural.</p>`;

export function galaxyGlyph(k, s, c) {
  const p = {
    router: `<circle cx="12" cy="12" r="8.5" fill="none" stroke="${c}" stroke-width="2.2"/><circle cx="12" cy="12" r="4.6" fill="#000"/>`,
    playbook: `<circle cx="12" cy="12" r="5.6" fill="${c}"/><circle cx="12" cy="12" r="9.5" fill="${c}" opacity=".22"/>`,
    skill: `<circle cx="12" cy="12" r="5.8" fill="${c}"/><ellipse cx="12" cy="12" rx="10" ry="3.2" fill="none" stroke="${c}" stroke-width="1.4" opacity=".75"/>`,
    agent: `<circle cx="12" cy="12" r="5.8" fill="${c}"/><ellipse cx="12" cy="12" rx="10" ry="3.2" fill="none" stroke="${c}" stroke-width="1.4" opacity=".75"/>`,
    automation: `<circle cx="12" cy="12" r="4.8" fill="${c}"/>`,
    principle: `<circle cx="12" cy="12" r="6.5" fill="${c}"/><path d="M6 10.2h12M5.8 13.6h12.4" stroke="#03040A" stroke-width="1.1" opacity=".55"/>`,
    reference: `<circle cx="12" cy="12" r="3.8" fill="${c}"/>`,
    script: `<circle cx="12" cy="12" r="3.6" fill="none" stroke="${c}" stroke-width="1.8"/>`,
    other: `<circle cx="12" cy="12" r="3.6" fill="${c}"/>`,
  }[k] || `<circle cx="12" cy="12" r="4" fill="${c}"/>`;
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" style="flex:none" aria-hidden="true">${p}</svg>`;
}

const clean = (s) => (s && s !== 'None' ? s : null);
const MID = new THREE.Vector3();
const YV = new THREE.Vector3(0, 1, 0);

export function galaxyTheme({ G, byId, kindOf, deg, css, reduced }) {
  const router = G.nodes.find((n) => n.kind === 'router');
  const zoneOfStar = new Map();
  ZONES.forEach((z) => {
    z.T = ZONE_T[z.id];
    z.col = bbHex(z.T);
    z.ids.forEach((s) => zoneOfStar.set('playbook:' + s, z));
  });
  const SP_IN = 1.4;
  const SP_ARM = 1.6;
  let gseed = 11;
  const grnd = () => (gseed = (gseed * 16807) % 2147483647) / 2147483647;
  const gauss = () => {
    let u = 0;
    for (let i = 0; i < 4; i++) u += grnd();
    return (u - 2) / 0.58;
  };
  const adj = new Map(G.nodes.map((n) => [n.id, new Set()]));
  G.edges.forEach((e) => {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  });
  const isStar = (id) => {
    const n = byId.get(id);
    return !!n && kindOf(n.kind) === 'playbook';
  };
  const SYS = new Map();
  const PARENT = new Map();
  G.nodes.forEach((n) => {
    const k = kindOf(n.kind);
    if (k === 'router' || k === 'playbook') return;
    const stars = [...adj.get(n.id)].filter(isStar);
    if (k === 'principle' && stars.length >= 4) {
      SYS.set(n.id, 'nebula');
      return;
    }
    const sc = new Map();
    stars.forEach((s) => {
      const nEdge = G.edges.filter((e) => (e.source === n.id && e.target === s) || (e.target === n.id && e.source === s)).length;
      sc.set(s, (sc.get(s) || 0) + nEdge);
    });
    const owner = clean(n.owner);
    if (owner && isStar(owner)) sc.set(owner, (sc.get(owner) || 0) + 3);
    let best = null;
    let bv = 0;
    for (const [s, v] of sc) {
      if (v > bv || (v === bv && deg(s) > deg(best))) {
        best = s;
        bv = v;
      }
    }
    if (best) {
      SYS.set(n.id, best);
      PARENT.set(n.id, best);
    }
  });
  for (let pass = 0; pass < 4; pass++) {
    G.nodes.forEach((n) => {
      const k = kindOf(n.kind);
      if (k === 'router' || k === 'playbook' || SYS.has(n.id)) return;
      const cands = [...adj.get(n.id)].filter((o) => {
        const s = SYS.get(o);
        return s && s !== 'nebula' && s !== 'core' && !isStar(o) && ['skill', 'agent', 'automation', 'other'].includes(kindOf(byId.get(o).kind));
      }).sort((a, b) => deg(b) - deg(a));
      if (!cands.length) return;
      const p = cands[0];
      SYS.set(n.id, SYS.get(p));
      PARENT.set(n.id, (k === 'reference' || k === 'script') ? p : SYS.get(p));
    });
  }
  G.nodes.forEach((n) => {
    const k = kindOf(n.kind);
    if (k === 'router' || k === 'playbook' || SYS.has(n.id)) return;
    SYS.set(n.id, k === 'principle' ? 'nebula' : 'core');
    PARENT.set(n.id, 'core');
  });

  const ORB = new Map();
  const RANKK = { agent: 0, skill: 0, other: 0, automation: 0, principle: 1, reference: 2, script: 2 };
  const sysR = new Map();
  const GOLD = Math.PI * (3 - Math.sqrt(5));
  G.nodes.filter((n) => isStar(n.id)).forEach((s) => {
    const kids = G.nodes.filter((n) => PARENT.get(n.id) === s.id).sort((a, b) => (
      RANKK[kindOf(a.kind)] - RANKK[kindOf(b.kind)] || deg(b.id) - deg(a.id)
    ));
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((grnd() - 0.5) * 0.3, 0, (grnd() - 0.5) * 0.3));
    let r = SP_IN * 9;
    let j = 0;
    let cap = Math.floor((2 * Math.PI * r) / (7 * SP_IN));
    let used = 0;
    kids.forEach((n) => {
      if (used >= cap) {
        j += 1;
        r = SP_IN * (9 + 4.2 * j);
        cap = Math.floor((2 * Math.PI * r) / (7 * SP_IN));
        used = 0;
      }
      ORB.set(n.id, { c: s.id, r, ph: (used / cap) * Math.PI * 2 + j * 0.9 + grnd() * 0.3, q });
      used += 1;
    });
    sysR.set(s.id, kids.length ? r + 3 : 6);
  });
  G.nodes.filter((n) => PARENT.has(n.id) && !isStar(PARENT.get(n.id)) && PARENT.get(n.id) !== 'core').forEach((n) => {
    const p = PARENT.get(n.id);
    const sib = G.nodes.filter((m) => PARENT.get(m.id) === p);
    const i = sib.indexOf(n);
    ORB.set(n.id, {
      c: p,
      r: SP_IN * (3.2 + i * 1.1),
      ph: i * GOLD * 2.4,
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0, 0.2)),
      moon: true,
    });
  });

  const homes = new Map();
  homes.set(router.id, new THREE.Vector3());
  const ARM_B = 0.95;
  const ARM_R0 = 115 * SP_IN;
  const armAt = (k, r) => {
    const t = (k * 2 * Math.PI) / 5 + 0.31 + ARM_B * Math.log(r / ARM_R0);
    return new THREE.Vector3(Math.cos(t) * r, 0, Math.sin(t) * r);
  };
  ZONES.forEach((z, k) => {
    const stars = z.ids.map((s) => 'playbook:' + s).filter((s) => byId.has(s)).sort((a, b) => deg(b) - deg(a));
    let r = ARM_R0;
    stars.forEach((s, j) => {
      if (j > 0) r += (sysR.get(stars[j - 1]) * 0.75 + sysR.get(s) * 0.75 + 9) * SP_ARM;
      const p = armAt(k, r);
      p.y = (grnd() - 0.5) * 6;
      homes.set(s, p);
    });
    z.rEnd = r;
    z.k = k;
    z.label = stars.length ? armAt(k, r + sysR.get(stars.at(-1)) + 24) : armAt(k, r + 24);
  });
  const neb = G.nodes.filter((n) => SYS.get(n.id) === 'nebula');
  const core = G.nodes.filter((n) => SYS.get(n.id) === 'core');
  neb.forEach((n, i) => {
    const a = (i / Math.max(1, neb.length)) * Math.PI * 2 + 0.4;
    const r = SP_IN * (66 + ((i * 37) % 5) * 6);
    homes.set(n.id, new THREE.Vector3(Math.cos(a) * r, (grnd() - 0.5) * 10, Math.sin(a) * r));
  });
  core.forEach((n, i) => {
    ORB.set(n.id, {
      c: 'core',
      r: SP_IN * (30 + (i % 3) * 7),
      ph: i * GOLD,
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0, -0.1)),
    });
  });
  ORB.forEach((o) => {
    const a0 = o.moon ? SP_IN * 3.2 : SP_IN * 9;
    const T0 = o.moon ? 50 : 150;
    const M = o.c === 'core' ? 4 : 1;
    o.T = (T0 * (o.r / a0) ** 1.5) / Math.sqrt(M);
    o.w = reduced ? 0 : (2 * Math.PI) / (o.T * 1000);
  });
  const centreOf = (c) => (c === 'core' ? new THREE.Vector3() : homes.get(c));
  const orbitPos = (id, t) => {
    const o = ORB.get(id);
    const v = new THREE.Vector3(Math.cos(o.ph + o.w * t) * o.r, 0, Math.sin(o.ph + o.w * t) * o.r).applyQuaternion(o.q);
    return v.add(centreOf(o.c));
  };
  [...ORB.keys()].filter((id) => !ORB.get(id).moon).forEach((id) => homes.set(id, orbitPos(id, 0)));
  [...ORB.keys()].filter((id) => ORB.get(id).moon).forEach((id) => homes.set(id, orbitPos(id, 0)));
  G.nodes.forEach((n) => {
    if (!homes.has(n.id)) homes.set(n.id, new THREE.Vector3(0, 20, 0));
  });
  const RMAX = Math.max(...ZONES.map((z) => z.label.length())) + 10;
  const zoneOfBody = (id) => {
    if (isStar(id)) return zoneOfStar.get(id) || null;
    const s = SYS.get(id);
    return s && isStar(s) ? zoneOfStar.get(s) : null;
  };
  const sameSystem = (x) => {
    const a = x.e.source;
    const b = x.e.target;
    const sa = isStar(a) ? a : SYS.get(a);
    const sb = isStar(b) ? b : SYS.get(b);
    return !!sa && sa === sb && isStar(sa);
  };

  const maxDeg = Math.max(1, ...G.nodes.filter((n) => n.kind !== 'router').map((n) => deg(n.id)));
  const MASS = (id) => Math.sqrt(deg(id) / maxDeg);
  const GP = new THREE.Vector3();
  const gravPull = (a, b, m, len) => {
    GP.set(0, 0, 0);
    const wells = [{ p: new THREE.Vector3(), mu: 0.45, eps: 90 * SP_IN }];
    G.nodes.filter((n) => isStar(n.id)).forEach((n) => {
      wells.push({ p: homes.get(n.id), mu: 0.2 * MASS(n.id), eps: (sysR.get(n.id) || 6) * 1.5 });
    });
    wells.forEach((w) => {
      if (w.p.distanceToSquared(a) < 1 || w.p.distanceToSquared(b) < 1) return;
      const dx = w.p.x - m.x;
      const dy = w.p.y - m.y;
      const dz = w.p.z - m.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      const d = Math.sqrt(d2) || 1;
      const f = (w.mu * len * w.eps * w.eps) / (d2 + w.eps * w.eps) / d;
      GP.x += dx * f;
      GP.y += dy * f;
      GP.z += dz * f;
    });
    const L = GP.length();
    const cap = 0.35 * len;
    if (L > cap) GP.multiplyScalar(cap / L);
    return GP;
  };
  const KMUL = { router: 1, playbook: 1.5, skill: 0.58, agent: 0.58, automation: 0.5, principle: 0.62, script: 0.42, reference: 0.42, other: 0.45 };
  const radiusOf = (n) => (n.kind === 'router' ? 6 : KMUL[kindOf(n.kind)] * (1.6 + 3.4 * Math.sqrt(deg(n.id) / maxDeg)));
  const GEO = {
    playbook: () => new THREE.SphereGeometry(1, 48, 32),
    skill: () => new THREE.SphereGeometry(1, 40, 28),
    agent: () => new THREE.SphereGeometry(1, 40, 28),
    automation: () => new THREE.SphereGeometry(1, 32, 22),
    principle: () => new THREE.SphereGeometry(1, 40, 28),
    reference: () => new THREE.SphereGeometry(1, 24, 16),
    script: () => new THREE.SphereGeometry(1, 24, 16),
    other: () => new THREE.SphereGeometry(1, 24, 16),
  };

  const homeCam = { az: 0.42, el: 0.95 };
  const sceneC = new THREE.Vector3();
  let rt = null;
  let gLast = performance.now();
  const gT0 = performance.now();
  let zView = null;
  let focusRings = null;
  let frMat = null;
  let diskMat = null;
  let bhMesh = null;
  let galaxyDust = null;
  let armGlow = null;
  let hiiCount = 36;
  let bulge = null;
  let bulge2 = null;
  let GRID = null;
  let LRT = null;
  let pipe = null;
  let lensScale = 1;
  const lenses = [];
  const spikes = [];
  let decorList = [];
  const LSRC = new Map();
  let orbitT = 0;
  let mclk = 0;
  let paused = new URLSearchParams(location.search).get('paused') === '1';
  let keyClose = false;
  let keyPin = false;
  const galaxyFx = [];
  const starLayers = [];
  const zoneLbls = [];
  const hubs = [];
  const stepMk = [];
  let sky0 = null;
  let texLoader = null;

  const tex = (file, srgb = true) => {
    const url = new URL('./assets/' + file, import.meta.url).href;
    const t = texLoader.load(url, () => rt?.dirty?.());
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };

  function noiseTex(seed, size = 256) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const img = x.createImageData(size, size);
    const P = new Uint8Array(512);
    let s = seed;
    for (let i = 0; i < 256; i++) P[i] = i;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const j = s % (i + 1);
      const tmp = P[i];
      P[i] = P[j];
      P[j] = tmp;
    }
    for (let i = 0; i < 256; i++) P[i + 256] = P[i];
    const fade = (t) => t * t * (3 - 2 * t);
    const vn = (X, Y) => {
      const xi = Math.floor(X) & 255;
      const yi = Math.floor(Y) & 255;
      const xf = X - Math.floor(X);
      const yf = Y - Math.floor(Y);
      const h = (a, b) => P[P[a] + b] / 255;
      const u = fade(xf);
      const v = fade(yf);
      return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
    };
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        let f = 0;
        let a = 0.5;
        let fr = (4 / size) * 1;
        for (let o = 0; o < 5; o++) {
          f += a * vn(i * fr * (size / 64), j * fr * (size / 64));
          a *= 0.5;
          fr *= 2;
        }
        const dx = i / size - 0.5;
        const dy = j / size - 0.5;
        const r = Math.sqrt(dx * dx + dy * dy) * 2;
        const fall = Math.max(0, 1 - r);
        const v = (Math.max(0, f - 0.32) * 1.6) ** 1.6 * fall * fall;
        const k = (j * size + i) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
        img.data[k + 3] = Math.min(255, v * 255);
      }
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  const api = {
    id: 'galaxy',
    homes,
    RMAX,
    YS: 1,
    sceneC,
    homeCam,
    gkeep: 0,
    pulse: { speed: 0.33, per: 2, size: 0.55, color: '#FFF1D6' },
    homeVX: 0,
    homeMax: 2600,
    showSel: true,
    stars: false,
    GEO,
    radiusOf,
    edgeSeg: 36,
    edgeSegHl: 48,
    idleMs: 700,
    motion: { REGROUP: 2000, TRAVEL: 1900, EXIT: 1800, STAGGER: 26, STAGGER_MAX: 520, DISPERSE: 1700 },
    zones: ZONES,
    bindRuntime(runtime) { rt = runtime; installRuntime(); },
    fitDist(w, h, mobile, vf) {
      const l = mobile ? 0 : 292;
      const ppu = Math.min(
        (h - 56 - (mobile ? 110 : 84)) / 2 / (RMAX * Math.sin(homeCam.el) * 1.24 + 10),
        (w - l - (mobile ? 24 : 56)) / 2 / (RMAX * 0.96),
      );
      return h / (2 * Math.tan(vf / 2) * Math.max(ppu, 0.001));
    },
    fog(d, focused, FS) {
      if (focused && FS) return { near: d + FS.Rb * 0.6, far: FS.shell * 1.35 };
      return { near: d, far: d + RMAX * 3.2 };
    },
    camLimits(Rb, dist) {
      return { min: Math.max(Rb * 1.1, 30), max: Math.min(dist * 2.2, 2600) };
    },
    paintBases(N) {
      N.forEach((o) => {
        if (o.k === 'playbook') {
          const z = zoneOfStar.get(o.id);
          if (z) {
            o.T = Math.round(z.T * (0.94 + 0.12 * Math.sqrt(deg(o.id) / maxDeg)));
            o.base = bbLin(o.T);
          }
        }
      });
    },
    material(k) {
      if (k === 'playbook') return makeStarMaterial();
      return makePlanetMaterial(PTEX[k] ? tex(PTEX[k]) : tex(PTEX.other));
    },
    hideHomeEdge: sameSystem,
    dashEdge: (x) => x.e.mode === 'conditional',
    curve(a, b, t, out, mode, side, FS) {
      const len = a.distanceTo(b);
      const m = MID.copy(a).add(b).multiplyScalar(0.5);
      if (mode === 'focus') {
        m.addScaledVector(YV, len * 0.22 + 2);
        if (FS?.Rv) m.addScaledVector(FS.Rv, side * len * 0.12);
      } else {
        m.applyAxisAngle(YV, 0.32 * Math.min(1, len / 260));
        m.y += len * 0.05;
        m.add(gravPull(a, b, m, len));
      }
      const mt = 1 - t;
      return out.set(
        a.x * mt * mt + 2 * m.x * mt * t + b.x * t * t,
        a.y * mt * mt + 2 * m.y * mt * t + b.y * t * t,
        a.z * mt * mt + 2 * m.z * mt * t + b.z * t * t,
      );
    },
    disperse(o) {
      return { p: homes.get(o.id).clone().add(new THREE.Vector3(0, -160, 0)), sc: o.r * 0.12 };
    },
    labelTier(o, hovered) {
      if (o.k === 'router' || o === hovered) return 0;
      if (o.k === 'playbook') return 1;
      if (o.k === 'script' || o.k === 'reference') return 3;
      return 2;
    },
    centreTarget() {
      const header = document.querySelector('header').getBoundingClientRect();
      const host = document.getElementById('scene').getBoundingClientRect();
      const pop = document.getElementById('pop');
      const focused = document.body.classList.contains('focus');
      const narrow = innerWidth < 760;
      let l = host.left;
      let r = host.right;
      let t = header.bottom;
      let b = host.bottom;
      const shown = pop && pop.classList.contains('show');
      if (focused) {
        const trail = document.getElementById('trail');
        const tb = trail && trail.firstElementChild ? trail.getBoundingClientRect().bottom : header.bottom + 56;
        t = Math.max(t, tb);
      }
      const key = document.querySelector('.key');
      const keyOpen = document.body.classList.contains('kopen');
      const keyClosed = document.body.classList.contains('kclose');
      if (!focused && !narrow && key && getComputedStyle(key).display !== 'none' && !(keyClosed && !keyOpen)) {
        l = key.getBoundingClientRect().right;
      }
      if (narrow) {
        if (focused) b = shown ? pop.getBoundingClientRect().top : innerHeight * 0.54;
      } else if (focused) {
        r = shown ? pop.getBoundingClientRect().left : innerWidth - 16 - 320;
      }
      return {
        x: host.width / 2 - ((l + r) / 2 - host.left),
        y: host.height / 2 - ((t + b) / 2 - host.top),
      };
    },
    inZone(o) {
      if (!zView) return true;
      if (o.k === 'router') return true;
      return zoneOfBody(o.id)?.id === zView;
    },
    scenery(scene, { HALO, mkLineMat }) {
      texLoader = new THREE.TextureLoader();
      const NEB = noiseTex(7);
      const NEB2 = noiseTex(23);
      const sky = new THREE.Group();
      scene.add(sky);
      const milky = new THREE.Mesh(
        new THREE.SphereGeometry(4200, 64, 32),
        new THREE.MeshBasicMaterial({ map: tex('milkyway-eso0932a-2048.webp'), side: THREE.BackSide, transparent: true, opacity: 0.3, depthWrite: false, fog: false }),
      );
      milky.rotation.set(0.9, 0, 0.35);
      milky.renderOrder = -10;
      sky.add(milky);
      sky0 = milky;
      const sfMat = fieldStarMaterial();
      const fieldT = () => {
        const u = grnd();
        return u < 0.7 ? 3000 + grnd() * 2200 : u < 0.92 ? 5200 + grnd() * 2300 : 7500 + grnd() ** 2 * 12500;
      };
      [[6400, 2600, 3600, 1.1, 0.55], [3800, 1500, 2300, 1.3, 0.7], [1700, 800, 1300, 1.6, 0.85], [900, 420, 800, 1.9, 0.9]].forEach(([n, r0, r1, sz, op], li) => {
        const p = new Float32Array(n * 3);
        const c = new Float32Array(n * 3);
        const z = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const u = grnd() * 2 - 1;
          const th = grnd() * Math.PI * 2;
          const r = r0 + grnd() * (r1 - r0);
          const s = Math.sqrt(1 - u * u);
          p.set([r * s * Math.cos(th), r * u, r * s * Math.sin(th)], i * 3);
          const mag = grnd() ** 5;
          const bright = op * (0.1 + mag * 1.1) * (mag > 0.6 ? 2.6 : 1);
          const col = bbLin(fieldT()).multiplyScalar(bright);
          c.set([col.r, col.g, col.b], i * 3);
          z[i] = sz * (0.75 + mag * 1.1);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(p, 3));
        g.setAttribute('col', new THREE.BufferAttribute(c, 3));
        g.setAttribute('sz', new THREE.BufferAttribute(z, 1));
        const mat = sfMat.clone();
        mat.uniforms.op.value = 1;
        const pts = new THREE.Points(g, mat);
        pts.userData.n = n;
        sky.add(pts);
        const periods = [5400, 3600, 2400, 1800];
        starLayers.push({ pts, w: ((2 * Math.PI) / (periods[li] * 1000)) * (li % 2 ? -1 : 1) });
      });
      sky.traverse((o) => o.layers.set(1));
      {
        const n = 8000;
        const p = new Float32Array(n * 3);
        const c = new Float32Array(n * 3);
        const warm = new THREE.Color('#FFE2C0');
        for (let i = 0; i < n; i++) {
          let x;
          let y;
          let z;
          let col;
          if (i < 2600) {
            const r = 14 + Math.abs(gauss()) * 30;
            const v = new THREE.Vector3(gauss(), gauss() * 0.45, gauss()).normalize().multiplyScalar(r);
            x = v.x; y = v.y; z = v.z;
            col = warm.clone().multiplyScalar(0.5 + grnd() * 0.5);
          } else {
            const k = Math.floor(grnd() * 5);
            const inter = grnd() < 0.1;
            const r = 55 * SP_IN + grnd() ** 0.8 * (RMAX - 30 * SP_IN);
            const th = (k * 2 * Math.PI) / 5 + 0.31 + ARM_B * Math.log(r / ARM_R0) + gauss() * (inter ? 0.5 : 0.1) * (1 + r / 500);
            x = Math.cos(th) * r;
            z = Math.sin(th) * r;
            y = gauss() * 3.5 * (1 - r / (RMAX * 1.3));
            col = new THREE.Color(ZONES[k].col).lerp(warm, 0.45).multiplyScalar((inter ? 0.25 : 0.35) + grnd() * 0.55);
          }
          p.set([x, y, z], i * 3);
          c.set([col.r, col.g, col.b], i * 3);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(p, 3));
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
        const m = new THREE.PointsMaterial({ map: HALO, size: 2.4, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
        g.setDrawRange(2600, 5400);
        galaxyDust = new THREE.Points(g, m);
        galaxyDust.layers.set(1);
        scene.add(galaxyDust);
        galaxyFx.push({ m, op: 0.55 });
        const bg = g.clone();
        bg.setDrawRange(0, 2600);
        const bulgePts = new THREE.Points(bg, m.clone());
        bulgePts.userData.noLens = true;
        bulgePts.renderOrder = -10;
        scene.add(bulgePts);
        galaxyFx.push({ m: bulgePts.material, op: 0.55 });
      }
      const hazePts = (list, map, size, op) => {
        const p = new Float32Array(list.length * 3);
        const c = new Float32Array(list.length * 3);
        list.forEach(([v, col], i) => {
          p.set([v.x, v.y, v.z], i * 3);
          c.set([col.r, col.g, col.b], i * 3);
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(p, 3));
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
        const m = new THREE.PointsMaterial({ map, size, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
        const o = new THREE.Points(g, m);
        scene.add(o);
        galaxyFx.push({ m, op });
        return o;
      };
      {
        const L = [];
        for (let i = 0; i < 640; i++) {
          const k = i % 5;
          const r = 64 * SP_IN + grnd() ** 0.85 * (RMAX - 64 * SP_IN);
          const off = gauss() * 0.07;
          const th = (k * 2 * Math.PI) / 5 + 0.31 + ARM_B * Math.log(Math.max(r, ARM_R0)) + off;
          const c = new THREE.Color(ZONES[k].col).lerp(off > 0 ? bbLin(12000) : new THREE.Color('#FFD9B0'), 0.45).multiplyScalar(0.75 + grnd() * 0.5 * (1 - r / RMAX * 0.5));
          L.push([new THREE.Vector3(Math.cos(th) * r, gauss() * 2, Math.sin(th) * r), c]);
        }
        armGlow = hazePts(L, NEB, 96, 0.34);
        armGlow.layers.set(1);
        armGlow.renderOrder = -10;
      }
      {
        const L = [];
        for (let i = 0; i < 46; i++) {
          const a = grnd() * Math.PI * 2;
          const r = SP_IN * (58 + grnd() * 36);
          L.push([new THREE.Vector3(Math.cos(a) * r, gauss() * 4, Math.sin(a) * r), new THREE.Color(i % 3 ? '#5FB8C9' : '#9A7FD6')]);
        }
        const nebula = hazePts(L, NEB2, 62, 0.2);
        nebula.layers.set(1);
        nebula.renderOrder = -10;
      }
      {
        const p = [];
        const c = [];
        for (let k = 0; k < 5; k++) {
          for (let i = 0; i < 150; i++) {
            const r = 62 * SP_IN + grnd() ** 0.9 * (RMAX - 70 * SP_IN);
            const th = (k * 2 * Math.PI) / 5 + 0.31 + ARM_B * Math.log(Math.max(r, ARM_R0)) - 0.11 + gauss() * 0.02;
            p.push(Math.cos(th) * r, gauss() * 1.4, Math.sin(th) * r);
            const a = 0.55 + grnd() * 0.45;
            c.push(a, a, a);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
        const m = new THREE.PointsMaterial({ map: NEB, size: 46, sizeAttenuation: true, vertexColors: false, color: 0x000000, transparent: true, opacity: 0.75, depthWrite: false, fog: false });
        m.onBeforeCompile = (sh) => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <premultiplied_alpha_fragment>', '#include <premultiplied_alpha_fragment>\n gl_FragColor.rgb=vec3(0.);');
        };
        const o = new THREE.Points(g, m);
        o.layers.set(1);
        o.renderOrder = -9;
        scene.add(o);
        galaxyFx.push({ m, op: 0.75 });
      }
      {
        const gs = quality();
        hiiCount = Math.round(36 * gs.hii);
        const puffs = [];
        const knots = [];
        const ob = [];
        const pink = new THREE.Color('#FF6FA0');
        const blue = bbLin(24000);
        for (let i = 0; i < 36; i++) {
          const k = i % 5;
          const r = 80 * SP_IN + grnd() * (RMAX - 90 * SP_IN);
          const th = (k * 2 * Math.PI) / 5 + 0.31 + ARM_B * Math.log(Math.max(r, ARM_R0)) + 0.04 + gauss() * 0.05;
          const C0 = new THREE.Vector3(Math.cos(th) * r, gauss() * 1.5, Math.sin(th) * r);
          puffs.push([C0, pink.clone().multiplyScalar(0.7 + grnd() * 0.4)]);
          for (let j = 0; j < 5; j++) knots.push([C0.clone().add(new THREE.Vector3(gauss() * 7, gauss() * 1.5, gauss() * 7)), pink.clone()]);
          for (let j = 0; j < 3; j++) ob.push(C0.clone().add(new THREE.Vector3(gauss() * 5, gauss() * 1.2, gauss() * 5)));
        }
        const puff = hazePts(puffs, NEB2, 54, 0.9);
        const knot = hazePts(knots, NEB, 15, 1);
        puff.layers.set(1);
        knot.layers.set(1);
        puff.geometry.setDrawRange(0, hiiCount);
        knot.geometry.setDrawRange(0, hiiCount * 5);
        const p = new Float32Array(ob.length * 3);
        const c = new Float32Array(ob.length * 3);
        const z = new Float32Array(ob.length);
        ob.forEach((v, i) => {
          p.set([v.x, v.y, v.z], i * 3);
          const b = blue.clone().multiplyScalar(1.4 + grnd() * 1.6);
          c.set([b.r, b.g, b.b], i * 3);
          z[i] = 2 + grnd() * 1.4;
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(p, 3));
        g.setAttribute('col', new THREE.BufferAttribute(c, 3));
        g.setAttribute('sz', new THREE.BufferAttribute(z, 1));
        const hm = fieldStarMaterial();
        const ho = new THREE.Points(g, hm);
        ho.layers.set(1);
        ho.geometry.setDrawRange(0, hiiCount * 3);
        scene.add(ho);
        api._hii = { puff, knot, ho };
      }
      const mkHaloG = (col, size, op) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: HALO, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
        s.scale.setScalar(size);
        scene.add(s);
        galaxyFx.push({ m: s.material, op });
        return s;
      };
      bulge = mkHaloG('#FFD9A8', 260, 0.3);
      bulge2 = mkHaloG('#FFF1DC', 90, 0.5);
      const guides = [];
      {
        const a = [];
        const col = [];
        const S = 96;
        const seen = new Set();
        ORB.forEach((o) => {
          if (o.moon || o.c === 'core' || seen.has(o.c + '|' + o.r)) return;
          seen.add(o.c + '|' + o.r);
          const z = zoneOfStar.get(o.c);
          const cc = new THREE.Color(z ? z.col : '#8899AA').multiplyScalar(0.55);
          const C0 = centreOf(o.c);
          for (let i = 0; i < S; i++) {
            const p = new THREE.Vector3(Math.cos((i / S) * Math.PI * 2) * o.r, 0, Math.sin((i / S) * Math.PI * 2) * o.r).applyQuaternion(o.q).add(C0);
            const q = new THREE.Vector3(Math.cos(((i + 1) / S) * Math.PI * 2) * o.r, 0, Math.sin(((i + 1) / S) * Math.PI * 2) * o.r).applyQuaternion(o.q).add(C0);
            a.push(p.x, p.y, p.z, q.x, q.y, q.z);
            col.push(cc.r, cc.g, cc.b, cc.r, cc.g, cc.b);
          }
        });
        const g = new LineSegmentsGeometry();
        g.setPositions(a);
        g.setColors(col);
        const l = new LineSegments2(g, mkLineMat({ vertexColors: true, linewidth: 1, opacity: 1 }));
        scene.add(l);
        guides.push(l);
      }
      {
        const RG = RMAX * 1.08;
        const NL = 36;
        const SUB = 150;
        const Y0 = -34;
        const wells = [{ x: 0, z: 0, A: 95, s: 30 * SP_IN }];
        G.nodes.filter((n) => isStar(n.id)).forEach((n) => {
          const p = homes.get(n.id);
          wells.push({ x: p.x, z: p.z, A: 6 + 24 * MASS(n.id), s: 7 + (sysR.get(n.id) || 6) * 0.55 });
        });
        const yAt = (x, z) => {
          let d = 0;
          wells.forEach((w) => {
            const dx = x - w.x;
            const dz = z - w.z;
            d += w.A / (1 + (dx * dx + dz * dz) / (w.s * w.s));
          });
          return Y0 - d;
        };
        const a = [];
        const col = [];
        const base = new THREE.Color('#6F8CC4');
        const push = (x0, z0, x1, z1) => {
          const y0 = yAt(x0, z0);
          const y1 = yAt(x1, z1);
          a.push(x0, y0, z0, x1, y1, z1);
          [[x0, y0, z0], [x1, y1, z1]].forEach(([x, y, z]) => {
            const r = Math.hypot(x, z) / RG;
            const fade = 1 - THREE.MathUtils.smoothstep(r, 0.55, 1);
            const glow = 1 + Math.min(1, (Y0 - y) / 40) * 1.6;
            const c = base.clone().multiplyScalar(0.05 * fade * glow);
            col.push(c.r, c.g, c.b);
          });
        };
        for (let i = 0; i <= NL; i++) {
          const u = -RG + (2 * RG * i) / NL;
          for (let s = 0; s < SUB; s++) {
            const v0 = -RG + (2 * RG * s) / SUB;
            const v1 = -RG + (2 * RG * (s + 1)) / SUB;
            if (Math.hypot(u, v0) > RG && Math.hypot(u, v1) > RG) continue;
            push(u, v0, u, v1);
            push(v0, u, v1, u);
          }
        }
        const g = new LineSegmentsGeometry();
        g.setPositions(a);
        g.setColors(col);
        GRID = new LineSegments2(g, mkLineMat({ vertexColors: true, linewidth: 1, opacity: 1, blending: THREE.AdditiveBlending }));
        GRID.userData.op = 1;
        GRID.userData.grid = true;
        GRID.renderOrder = -8;
        GRID.layers.set(1);
        scene.add(GRID);
        guides.push(GRID);
      }
      ZONES.forEach((z) => {
        const d = document.createElement('div');
        d.className = 'zlbl';
        d.innerHTML = `<i style="background:${z.col}"></i>${z.name}`;
        const o = new CSS2DObject(d);
        o.position.copy(z.label);
        o.position.y += 4;
        scene.add(o);
        zoneLbls.push({ o, d, z });
      });
      const bh = createBlackHole();
      diskMat = bh.mat;
      bhMesh = bh.mesh;
      scene.add(bhMesh);
      api.routerMesh = bhMesh;
      api.routerDim = (d) => { diskMat.uniforms.dim.value = d; };
      frMat = mkLineMat({ color: '#AFC0E0', linewidth: 1, opacity: 0 });
      api._scene = scene;
      api._mkLineMat = mkLineMat;
      const sunLight = new THREE.PointLight(0xFFD7A8, 1.1, 0, 0);
      const fill = new THREE.DirectionalLight(0xFFF0DC, 1.15);
      fill.position.set(-0.4, 1, 0.3);
      scene.add(new THREE.AmbientLight(0x8A96B8, 0.75));
      scene.add(sunLight);
      scene.add(fill);
      api.guides = guides;
      return { sunLight, fill, guides };
    },
    decor(starNode, N, mkHalo) {
      const decor = [];
      N.filter((o) => o.k === 'playbook').forEach((o) => {
        const c = '#' + o.base.getHexString();
        const inner = mkHalo(c, 1, 0.6);
        const outer = mkHalo(c, 1, 0.16);
        inner.material.color.multiplyScalar(1.8);
        outer.material.color.multiplyScalar(0.5);
        decor.push({ o, s: inner, f: 3.0, op: 0.6 }, { o, s: outer, f: 8.5, op: 0.16 });
      });
      if (quality().spikes) {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const x = c.getContext('2d');
        x.globalCompositeOperation = 'lighter';
        [0, Math.PI / 2].forEach((a) => {
          x.save();
          x.translate(128, 128);
          x.rotate(a);
          const g = x.createLinearGradient(-128, 0, 128, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(0.5, 'rgba(255,255,255,1)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          x.fillStyle = g;
          x.fillRect(-128, -1.2, 256, 2.4);
          x.restore();
        });
        const st = new THREE.CanvasTexture(c);
        st.colorSpace = THREE.SRGBColorSpace;
        N.filter((o) => o.k === 'playbook').sort((a, b) => deg(b.id) - deg(a.id)).slice(0, 3).forEach((o) => {
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, color: o.base.clone().multiplyScalar(1.6), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, rotation: 0.38 }));
          api._scene.add(s);
          decor.push({ o, s, f: 15, op: 0.5, spike: true });
          spikes.push(s);
        });
      }
      N.filter((o) => (o.k === 'skill' || o.k === 'agent') && deg(o.id) >= 16).forEach((o, j) => {
        const m = new THREE.Mesh(new THREE.RingGeometry(1.45, 2.2, 128, 1), makeRingMaterial(css('--k-' + o.k)));
        m.rotation.set(Math.PI / 2 - 0.95, 0, 0.3 * (j % 2 ? 1 : -1));
        m.updateMatrixWorld();
        api._scene.add(m);
        hubs.push({ o, m, n: new THREE.Vector3(0, 0, 1).applyQuaternion(m.quaternion) });
      });
      decorList = decor;
      return decor;
    },
    beforeCam() {
      if (!rt) return;
      const now = performance.now();
      const dt = Math.min(100, now - gLast);
      gLast = now;
      const moving = !reduced && !paused;
      if (moving) mclk += dt;
      if (moving) {
        starLayers.forEach((l) => { l.pts.rotation.y += l.w * dt; });
        if (sky0) sky0.rotation.y += starLayers[0].w * dt * 0.5;
        if (!rt.focus && !rt.drag && !rt.camTw) rt.cam.az += dt * ((2 * Math.PI) / 720000);
      }
      const orbiting = moving && !rt.focus && (rt.idle ?? 1) > 0.98 && !rt.camTw;
      if (orbiting) orbitT += dt;
      if (orbiting && rt.NB) {
        let moved = false;
        const step = (id) => {
          const nd = rt.NB.get(id);
          if (!nd || (nd.dur && now < nd.t0 + nd.dur)) return;
          const p = orbitPos(id, orbitT);
          homes.set(id, p);
          nd.from.copy(p);
          nd.to.copy(p);
          moved = true;
        };
        [...ORB.keys()].filter((id) => !ORB.get(id).moon).forEach(step);
        [...ORB.keys()].filter((id) => ORB.get(id).moon).forEach(step);
        if (moved) rt.dirty();
      }
      const close = !rt.focus && !rt.mobile() && rt.cam.dist < rt.fitDist() * 0.45;
      if (close !== keyClose) {
        keyClose = close;
        if (!close) {
          keyPin = false;
          document.body.classList.remove('kopen');
        }
        document.body.classList.toggle('kclose', close);
        const pill = document.querySelector('.kpill');
        if (pill) pill.setAttribute('aria-expanded', String(keyPin));
        rt.dirty();
      }
    },
    tick(idleAlpha) {
      const fa = 0.3 + 0.7 * idleAlpha;
      galaxyFx.forEach((f) => { f.m.opacity = f.op * fa; });
      zoneLbls.forEach((z) => {
        z.d.style.opacity = idleAlpha;
        z.o.visible = idleAlpha > 0.02 && (!zView || z.z.id === zView);
      });
      if (frMat) frMat.opacity = (1 - idleAlpha) * 0.4;
      if (GRID && rt) {
        const base = GRID.material.opacity;
        GRID.material.opacity = base * THREE.MathUtils.clamp((1.05 - Math.sin(rt.cam.el)) * 1.6, 0.15, 1);
      }
      const coreLc = bbLin(4500).multiplyScalar(1.1);
      if (rt?.NB) {
        rt.NB.forEach((o) => {
          if (!LSRC.has(o.id) || !o.im) return;
          const src = LSRC.get(o.id);
          const p = src ? src.pos : (rt.NB.get(router.id)?.pos || new THREE.Vector3());
          o.im.geometry.attributes.aLight?.setXYZ(o.i, p.x, p.y, p.z);
        });
        const seen = new Set();
        rt.NB.forEach((o) => {
          if (o.im && o.im.geometry.attributes.aLight && !seen.has(o.im)) {
            o.im.geometry.attributes.aLight.needsUpdate = true;
            seen.add(o.im);
          }
        });
        const f = rt.focus && rt.NB.get(rt.focus);
        let src = f && f.k === 'playbook' ? f : f && LSRC.get(f.id);
        if (src && src.dim < 0.5) {
          PLAN_U.uFocusL.value.copy(src.pos);
          PLAN_U.uFocusLC.value.copy(src.base).multiplyScalar(1.15);
        } else if (rt.camera) {
          PLAN_U.uFocusL.value.copy(rt.camera.position).addScaledVector(rt.camera.up, rt.cam.dist * 0.6);
          PLAN_U.uFocusLC.value.setRGB(1, 0.96, 0.9);
        }
        PLAN_U.uFocusMix.value = 1 - idleAlpha;
        hubs.forEach((p) => {
          const u = p.m.material.uniforms;
          const s = LSRC.get(p.o.id);
          u.pC.value.copy(p.o.pos);
          u.pR.value = p.o.sc;
          const fm = 1 - idleAlpha;
          u.lP.value.copy(s ? s.pos : new THREE.Vector3()).lerp(PLAN_U.uFocusL.value, fm);
          u.lC.value.copy(s ? s.base : coreLc).lerp(PLAN_U.uFocusLC.value, fm);
          u.dim.value = p.o.dim;
          p.m.position.copy(p.o.pos);
          p.m.scale.setScalar(p.o.sc);
          p.m.visible = p.o.dim < 0.98;
        });
      }
      decorList.forEach((d) => {
        if (!rt?.camera) return;
        const ad = THREE.MathUtils.smoothstep(rt.camera.position.distanceTo(d.o.pos) / Math.max(d.o.sc, 0.01), 8, 70);
        if (d.spike) {
          const r = rt.screenOf ? rt.screenOf(d.o).rad : 0;
          d.s.material.opacity *= 1 - THREE.MathUtils.smoothstep(r, 5, 14);
          d.s.visible = !!quality(rt.renderer).spikes && d.s.material.opacity > 0.01;
        } else d.s.material.opacity *= 0.3 + 0.7 * ad;
      });
      STAR_U.uTime.value = (reduced || paused) ? 0 : mclk / 1000;
      STAR_U.uGran.value = quality(rt?.renderer).gran && !reduced && !paused ? 1 : 0;
    },
    focusScale(o, ppu, id) {
      if (o.id === id) return Math.min(o.k === 'router' ? 7 : 5.5, 30 / Math.max(ppu, 0.001));
      return THREE.MathUtils.clamp(o.r * 0.9, 1.6, 3.2);
    },
    focusLayout({ id, C, camera, neighbours, mobile, W, H, vf, byId: nodes, kindOf: kind, deg: degree, KINDS }) {
      api.clearFocus();
      const { inc, out } = neighbours;
      const Rv = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      const Dv = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).normalize();
      const Rh = new THREE.Vector3(Rv.x, 0, Rv.z);
      if (Rh.lengthSq() < 1e-8) Rh.set(1, 0, 0);
      Rh.normalize();
      const Df = new THREE.Vector3(Dv.x, 0, Dv.z);
      if (Df.lengthSq() < 1e-8) Df.set(0, 0, 1);
      Df.normalize();
      const Y = new THREE.Vector3(0, 1, 0);
      const sortK = (list) => list.slice().sort((a, b) => (
        KINDS.indexOf(kind(nodes.get(a.id).kind)) - KINDS.indexOf(kind(nodes.get(b.id).kind)) || degree(b.id) - degree(a.id)
      ));
      const catOf = (nid) => {
        const k = kind(nodes.get(nid).kind);
        if (k === 'playbook' || k === 'router') return 'star';
        if (k === 'reference' || k === 'script') return 'moon';
        if (k === 'principle') return 'rule';
        return 'planet';
      };
      const grp = { planet: [], rule: [], moon: [], star: [] };
      sortK(out).forEach((x) => grp[catOf(x.id)].push(x));
      const up = sortK(inc).slice(0, 9);
      Object.keys(grp).forEach((key) => { grp[key] = grp[key].slice(0, 14); });
      const T2 = Math.PI * 2;
      const SF = 1.4;
      const r1 = Math.max(15 * SF, (grp.planet.length * 8 * SF) / T2);
      const r2 = Math.max(r1 + 10 * SF, (grp.rule.length * 8.5 * SF) / T2);
      const r3 = Math.max(r2 + 9 * SF, (grp.moon.length * 7 * SF) / T2);
      const r4 = Math.max(r3 + 12 * SF, (grp.star.length * 10 * SF) / T2);
      const radii = [];
      const at = (a, r, y) => C.clone().addScaledVector(Rh, Math.sin(a) * r).addScaledVector(Df, Math.cos(a) * r).addScaledVector(Y, y);
      const member = new Map([[id, { p: C.clone() }]]);
      const ring = (list, r, a0) => {
        if (!list.length) return;
        radii.push(r);
        list.forEach((x, i) => member.set(x.id, { p: at(a0 + (i / list.length) * T2, r, 0) }));
      };
      ring(grp.planet, r1, Math.PI / 2 + 0.3);
      ring(grp.rule, r2, Math.PI / 2 + 0.3 + Math.PI / Math.max(1, grp.rule.length));
      ring(grp.moon, r3, Math.PI / 2 + 0.1);
      ring(grp.star, r4, Math.PI / 2 + 0.55);
      const rOut = radii.length ? Math.max(...radii) : 15;
      const upY = rOut * 0.55 + 18 * SF;
      const upW = Math.max(Math.min(rOut, ((up.length - 1) * 16 * SF) / 2), ((up.length - 1) * 13 * SF) / 2);
      up.forEach((x, i) => {
        const t = up.length === 1 ? 0 : -upW + (2 * upW * i) / (up.length - 1);
        const st = up.length > 5 && i % 2 ? 1 : 0;
        member.set(x.id, { p: C.clone().addScaledVector(Rh, t).addScaledVector(Df, -rOut * 0.35 - st * 10 * SF).addScaledVector(Y, upY + st * 13 * SF) });
      });
      const el = rt?.cam?.el ?? homeCam.el;
      const hw = Math.max(rOut, upW) + 6;
      const top = Math.max(up.length ? (upY + (up.length > 5 ? 13 : 0)) * Math.cos(el) + rOut * 0.35 * Math.sin(el) : 0, rOut * Math.sin(el)) + 10;
      const bot = rOut * Math.sin(el) + 10;
      const visW = mobile ? W - 24 : W - 32 - 320 - 28;
      const ppu = Math.min((mobile ? H * 0.54 : H - 140) / (top + bot), (visW / 2 - (mobile ? 84 : 120)) / hw);
      const Rb = Math.hypot(hw, upY) + 4;
      const shell = THREE.MathUtils.clamp(Rb * 4.5, 520, 1100);
      const dist = H / (2 * Math.tan(vf / 2) * Math.max(ppu, 0.001));
      if (radii.length && api._scene && api._mkLineMat) {
        const a = [];
        const S = 128;
        radii.forEach((r) => {
          for (let i = 0; i < S; i++) {
            const p = at((i / S) * T2, r, 0);
            const q = at(((i + 1) / S) * T2, r, 0);
            a.push(p.x, p.y, p.z, q.x, q.y, q.z);
          }
        });
        const g = new LineSegmentsGeometry();
        g.setPositions(a);
        focusRings = new LineSegments2(g, frMat);
        api._scene.add(focusRings);
      }
      return {
        inc, out, member, Rb, shell, dist, ppu, rOut, Rv: Rh,
        viewX: mobile ? 0 : Math.round((320 + 28) / 2),
        viewY: mobile ? Math.round(H / 2 - H * 0.28) : Math.round((-(top - bot) / 2) * ppu) + 10,
        hwPx: hw * ppu,
      };
    },
    clearFocus() {
      if (focusRings && api._scene) {
        api._scene.remove(focusRings);
        focusRings.geometry.dispose();
        focusRings = null;
      }
    },
    dockCard({ pop, cardId, NB }) {
      if (!NB.get(cardId) || innerWidth < 760) return;
      const inset = 16;
      const top0 = document.querySelector('header').offsetHeight + 16;
      const w = pop.offsetWidth || 320;
      const h = pop.offsetHeight;
      pop.style.maxHeight = Math.min(580, innerHeight - inset - top0) + 'px';
      const y = top0 + Math.max(0, (innerHeight - top0 - inset - h) / 2);
      pop.className = pop.className.replace(/\b(below|above|side)\b/g, '').trim() + ' side';
      pop.style.left = Math.round(innerWidth - inset - w) + 'px';
      pop.style.top = Math.round(y) + 'px';
      pop.style.setProperty('--cx', Math.round(w / 2) + 'px');
    },
    onReset() { zView = null; },
    flyZone(zid) {
      const z = ZONES.find((q) => q.id === zid);
      if (!z || !rt) return;
      if (rt.focus) rt.exit();
      const stars = z.ids.map((i) => 'playbook:' + i).filter((i) => homes.has(i));
      if (!stars.length) return;
      const c = new THREE.Vector3();
      stars.forEach((i) => c.add(homes.get(i)));
      c.divideScalar(stars.length);
      c.lerp(z.label, 0.12);
      let rad = 0;
      stars.forEach((i) => { rad = Math.max(rad, homes.get(i).distanceTo(c) + (sysR.get(i) || 0)); });
      rad = Math.max(rad, z.label.distanceTo(c) * 0.8, 30);
      const mobile = rt.mobile();
      rt.viewX(mobile ? 0 : -200);
      let a = Math.atan2(c.x, c.z);
      while (a - rt.cam.az > Math.PI) a -= Math.PI * 2;
      while (a - rt.cam.az < -Math.PI) a += Math.PI * 2;
      const el = 0.82;
      const ppu = Math.min((rt.H() - 170) / 2 / (rad * Math.sin(el) + 14), (rt.W() - 96 - 300) / 2 / rad);
      zView = z.id;
      const dist = rt.H() / (2 * Math.tan(rt.vf / 2) * Math.max(ppu, 0.001));
      rt.camTo(c, dist, a, el, 2000);
    },
    keyExtras(edgeList) {
      const head = `<div class="zones"><h3><span>Zones</span> <span>what workflows are for</span></h3>${
        ZONES.map((z) => {
          const n = z.ids.filter((id) => byId.has('playbook:' + id)).length;
          return `<button class="krow tall zrow" type="button" data-z="${z.id}"><svg width="16" height="16" viewBox="0 0 24 24" style="flex:none;margin-top:2px" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="${z.col}"/><circle cx="12" cy="12" r="10" fill="${z.col}" opacity=".18"/></svg><span class="name">${z.name}<span class="ksub">${z.line}</span></span><span class="count">${n}</span></button>`;
        }).join('')
      }<div class="kdiv"></div></div>`;
      const mc = { always: 0, conditional: 0, step: 0 };
      edgeList.forEach((x) => { mc[x.e.mode] = (mc[x.e.mode] || 0) + 1; });
      const icon = {
        always: '<svg width="22" height="16" viewBox="0 0 22 16" style="flex:none"><path d="M1 11Q11 3 21 9" fill="none" stroke="#FFE7C2" stroke-width="1.6" stroke-linecap="round"/></svg>',
        conditional: '<svg width="22" height="16" viewBox="0 0 22 16" style="flex:none"><path d="M1 11Q11 3 21 9" fill="none" stroke="#FFE7C2" stroke-width="1.6" stroke-dasharray="2.6 2.6" stroke-linecap="round" opacity=".8"/></svg>',
        step: '<svg width="22" height="16" viewBox="0 0 22 16" style="flex:none"><path d="M1 12Q8 6 14 8" fill="none" stroke="#FFE7C2" stroke-width="1.6" stroke-linecap="round"/><circle cx="17" cy="7" r="4.6" fill="#03040A" stroke="#FFE7C2"/><text x="17" y="9.3" font-size="6.6" font-weight="700" text-anchor="middle" fill="#FFE7C2" font-family="sans-serif">1</text></svg>',
      };
      const beforeMore = `<div class="kdiv"></div><h3><span>Trails</span> <span>when a link is used</span></h3>${
        [['always', 'Always', 'steady trail'], ['conditional', 'Only when…', 'dotted'], ['step', 'Steps', 'numbered']]
          .map(([m, a, b]) => `<div class="krow" style="cursor:default">${icon[m]}<span class="name">${a} <span style="color:var(--text-3);font-weight:400">· ${b}</span></span><span class="count">${mc[m] || 0}</span></div>`)
          .join('')
      }`;
      return { head, beforeMore };
    },
    syncSteps({ focus, play, nodes, camera, idleAlpha, hot }) {
      hot.clear();
      if (play && play.k >= 0 && play.id === focus) play.S[play.k][1].forEach((t) => hot.add(t));
      let used = 0;
      const steps = focus && isStar(focus) ? stepsOf(G, focus) : [];
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      steps.forEach(([ord, ts], j) => {
        ts.forEach((tid) => {
          const nd = nodes.get(tid);
          if (!nd || nd.lmode === 'hide') return;
          const m = stepMk[used] || mkStep();
          used += 1;
          m.o.visible = true;
          m.o.position.copy(nd.pos).addScaledVector(up, nd.sc + 1.4);
          m.d.textContent = String(ord);
          const k = play && play.id === focus ? play.k : -1;
          m.d.className = 'stepno' + (k < 0 ? '' : j < k ? ' done' : j === k ? ' cur' : ' later');
          m.d.style.opacity = (1 - idleAlpha) * ((nd.prog > 0.7 || reduced) ? 1 : 0);
        });
      });
      for (let i = used; i < stepMk.length; i++) stepMk[i].o.visible = false;
    },
  };

  function updBH() {
    if (!bhMesh || !rt?.camera) return;
    const star = rt.NB.get(router.id);
    if (!star) return;
    bhMesh.quaternion.copy(rt.camera.quaternion);
    const u = diskMat.uniforms;
    u.bhPos.value.copy(star.pos);
    u.Rs.value = BH_RS * (star.sc / 6);
    u.uTime.value = (reduced || paused) ? 0 : mclk / 1000;
    u.uVP.value.multiplyMatrices(rt.camera.projectionMatrix, rt.camera.matrixWorldInverse);
  }
  function lensPass() {
    if (!rt || !LRT) return;
    const renderer = rt.renderer;
    const camera = rt.camera;
    const gs = quality(renderer);
    const half = gs.lensHalf || rt.mobile() || renderer.getPixelRatio() >= 2;
    lensScale = half ? 0.5 : 1;
    const buf = new THREE.Vector2();
    renderer.getDrawingBufferSize(buf);
    const w = Math.max(2, Math.round(buf.x * lensScale));
    const h = Math.max(2, Math.round(buf.y * lensScale));
    if (LRT.width !== w || LRT.height !== h) LRT.setSize(w, h);
    const host = document.getElementById('scene').getBoundingClientRect();
    const pr = renderer.getPixelRatio();
    const star = rt.NB.get(router.id);
    lenses.forEach((L) => {
      const o = L.o;
      const s = rt.screenOf(o);
      const ppw = s.rad / Math.max(o.sc, 0.01);
      const rEw = L.rE * (o.sc / Math.max(o.r, 0.01));
      const u = L.m.material.uniforms;
      u.res.value.set(buf.x, buf.y);
      u.c.value.set((s.x - host.left) * pr, (rt.H() - (s.y - host.top)) * pr);
      u.rE.value = rEw * ppw * pr;
      u.rQ.value = rEw * L.q * ppw * pr;
      u.dim.value = Math.min(1, o.dim * 1.2);
      const vd = o.pos.clone().sub(camera.position).normalize();
      L.m.position.copy(camera.position).addScaledVector(vd, 3000);
      L.m.quaternion.copy(camera.quaternion);
      L.m.scale.setScalar((u.rQ.value / pr) * 1.04 * 2 * Math.tan((camera.fov * Math.PI) / 360) * 3000 / Math.max(1, rt.H()));
      L.m.visible = s.z < 1 && u.rQ.value > 3;
    });
    const bf = THREE.MathUtils.smoothstep(rt.cam.dist, 220, 700);
    if (bulge) bulge.material.opacity *= bf;
    if (bulge2) bulge2.material.opacity *= bf;
    const n0 = camera.near;
    camera.near = Math.max(1, camera.position.distanceTo(star.pos) - star.sc * 2);
    camera.updateProjectionMatrix();
    const prev = renderer.getRenderTarget();
    camera.layers.set(1);
    renderer.setRenderTarget(LRT);
    renderer.clear();
    renderer.render(api._scene, camera);
    renderer.setRenderTarget(prev);
    camera.layers.set(0);
    camera.layers.enable(1);
    camera.near = n0;
    camera.updateProjectionMatrix();
    diskMat.uniforms.tBg.value = LRT.texture;
    diskMat.uniforms.bgOn.value = 1;
  }
  function applyGfx() {
    const gs = quality(rt.renderer);
    starLayers.forEach((l) => l.pts.geometry.setDrawRange(0, Math.round(l.pts.userData.n * gs.stars)));
    if (galaxyDust) galaxyDust.geometry.setDrawRange(2600, Math.round(5400 * (gs.dust < 1 ? 0.6 : 1)));
    if (armGlow) armGlow.geometry.setDrawRange(0, Math.round(640 * (gs.glow < 1 ? 0.55 : 1)));
    if (api._hii) {
      const n = Math.round(36 * gs.hii);
      api._hii.puff.geometry.setDrawRange(0, n);
      api._hii.knot.geometry.setDrawRange(0, n * 5);
      api._hii.ho.geometry.setDrawRange(0, n * 3);
    }
    diskMat.defines.STEPS = gs.bhSteps;
    diskMat.defines.LITE = gs.bhLite;
    diskMat.needsUpdate = true;
    spikes.forEach((s) => { s.visible = !!gs.spikes; });
    pipe?.invalidate();
    document.querySelectorAll('[data-g]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.g === getGfx())));
    rt.dirty();
  }
  function installRuntime() {
    const coreLc = bbLin(4500).multiplyScalar(1.1);
    const dressed = new Set();
    rt.NB.forEach((o) => {
      if (!o.im || o.k === 'playbook' || dressed.has(o.im)) return;
      dressed.add(o.im);
      const n = o.im.count;
      const g = o.im.geometry;
      g.setAttribute('aLight', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('aLCol', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('aRing', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4));
    });
    rt.NB.forEach((o) => {
      if (o.k === 'router' || o.k === 'playbook') return;
      const sys = SYS.get(o.id);
      LSRC.set(o.id, sys && isStar(sys) ? rt.NB.get(sys) : null);
      if (!o.im?.geometry.attributes.aLCol) return;
      const src = LSRC.get(o.id);
      const c = src?.base ? src.base.clone().multiplyScalar(1.15) : coreLc;
      o.im.geometry.attributes.aLCol.setXYZ(o.i, c.r, c.g, c.b);
    });
    hubs.forEach((p) => {
      const ring = p.o.im?.geometry.attributes.aRing;
      if (ring) ring.setXYZW(p.o.i, p.n.x, p.n.y, p.n.z, 1);
    });
    dressed.forEach((im) => {
      im.geometry.attributes.aLCol.needsUpdate = true;
      im.geometry.attributes.aRing.needsUpdate = true;
    });
    const lensOn = new URLSearchParams(location.search).get('lens') !== '0';
    LRT = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, type: THREE.HalfFloatType });
    [...rt.NB.values()].filter((o) => o.k === 'playbook').sort((a, b) => deg(b.id) - deg(a.id)).slice(0, 6).forEach((o) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), createLensMaterial(LRT));
      m.renderOrder = -9;
      m.frustumCulled = false;
      m.visible = false;
      api._scene.add(m);
      lenses.push({ o, m, rE: 5 + 7 * MASS(o.id), q: 3.4 });
    });
    rt.camera.layers.enable(1);
    pipe = createPipeline(rt.renderer);
    api.renderFrame = (renderer, scene, camera) => {
      updBH();
      if (lensOn) lensPass();
      else diskMat.uniforms.bgOn.value = 0;
      pipe.render(scene, camera);
      api.lastStats = { ...pipe.stats, lrt: [LRT.width, LRT.height], bloom0: pipe.bloom0(), hdr: pipe.hdr(), gfx: getGfx() };
    };
    const reset = document.getElementById('reset');
    const dock = document.createElement('div');
    dock.className = 'gseg';
    dock.id = 'gfxDock';
    dock.setAttribute('role', 'group');
    dock.setAttribute('aria-label', 'Graphics quality');
    dock.innerHTML = '<button type="button" data-g="high">High</button><button type="button" data-g="balanced">Balanced</button>';
    reset.parentNode.insertBefore(dock, reset);
    const pauseI = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3.5 2.5h2.2v9H3.5zM8.3 2.5h2.2v9H8.3z"/></svg>';
    const playI = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M4 2.2l7.5 4.8L4 11.8z"/></svg>';
    const motion = document.createElement('button');
    motion.className = 'btn icon';
    motion.id = 'motionBtn';
    motion.type = 'button';
    motion.hidden = reduced;
    const setPaused = (p) => {
      paused = p;
      motion.innerHTML = p ? playI : pauseI;
      motion.setAttribute('aria-pressed', String(p));
      motion.setAttribute('aria-label', p ? 'Resume motion' : 'Pause motion');
      motion.title = (p ? 'Resume' : 'Pause') + ' motion (Space)';
      rt.dirty();
    };
    motion.onclick = () => setPaused(!paused);
    reset.parentNode.insertBefore(motion, reset);
    setPaused(paused);
    addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || reduced || rt.focus || /INPUT|TEXTAREA|BUTTON|SELECT/.test(document.activeElement?.tagName || '')) return;
      e.preventDefault();
      setPaused(!paused);
    });
    document.getElementById('about').insertAdjacentHTML('beforeend', '<div class="gfx"><span>Graphics</span><div class="gseg" id="gfxSeg" role="group" aria-label="Graphics quality"><button type="button" data-g="high">High</button><button type="button" data-g="balanced">Balanced</button></div></div><p class="gnote">Balanced halves the bloom and lensing resolution, draws fewer stars and a simpler black-hole disk. Saved on this device.</p>');
    document.querySelectorAll('[data-g]').forEach((b) => { b.onclick = () => setGfx(b.dataset.g); });
    onGfx(applyGfx);
    const key = document.getElementById('key');
    const pill = document.createElement('button');
    pill.className = 'kpill';
    pill.type = 'button';
    pill.innerHTML = 'Key <span aria-hidden="true">▴</span>';
    pill.setAttribute('aria-expanded', 'false');
    pill.onclick = () => {
      keyPin = !keyPin;
      document.body.classList.toggle('kopen', keyPin);
      pill.setAttribute('aria-expanded', String(keyPin));
      rt.dirty();
    };
    key.appendChild(pill);
    applyGfx();
    api.gfx = () => ({ gfx: getGfx(), ...api.lastStats, paused, mclk: Math.round(mclk) });
  }

  function mkStep() {
    const d = document.createElement('div');
    d.className = 'stepno';
    const o = new CSS2DObject(d);
    o.center.set(0.5, 1);
    api._scene.add(o);
    const m = { o, d };
    stepMk.push(m);
    return m;
  }

  return api;
}

export function stepsOf(G, id) {
  const m = new Map();
  G.edges.forEach((e) => {
    if (e.source !== id || e.mode !== 'step' || !Number.isInteger(e.order)) return;
    if (!m.has(e.order)) m.set(e.order, []);
    if (!m.get(e.order).includes(e.target)) m.get(e.order).push(e.target);
  });
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
}
