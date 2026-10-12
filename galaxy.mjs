// Galaxy theme. Layout, shaders, and motion follow design/concepts/galaxy.
// Zones are hand-picked. Textures are the CC BY 4.0 files credited in NOTICE.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/CSS2DRenderer.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { bbLin, bbHex, ZONE_T, createBakedDisk, createBloom } from './galaxy-fx.mjs';
import { getGfx, setGfx, onGfx } from './gfx.mjs';
import { stepsOf } from './copy.mjs';

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
  let surfaceY = () => 0;
  const centreOf = (c) => (c === 'core' ? new THREE.Vector3() : homes.get(c));
  const orbitPos = (id, t) => {
    const o = ORB.get(id);
    const c = centreOf(o.c);
    const v = new THREE.Vector3(Math.cos(o.ph + o.w * t) * o.r, 0, Math.sin(o.ph + o.w * t) * o.r).applyQuaternion(o.q);
    const x = c.x + v.x;
    const z = c.z + v.z;
    return new THREE.Vector3(x, surfaceY(x, z), z);
  };
  const seatHomes = () => {
    homes.forEach((p, id) => {
      if (ORB.has(id)) return;
      p.y = surfaceY(p.x, p.z);
    });
    [...ORB.keys()].filter((id) => !ORB.get(id).moon).forEach((id) => homes.set(id, orbitPos(id, 0)));
    [...ORB.keys()].filter((id) => ORB.get(id).moon).forEach((id) => homes.set(id, orbitPos(id, 0)));
    ZONES.forEach((z) => { z.label.y = surfaceY(z.label.x, z.label.z); });
  };
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
  const Y0 = -34;
  const sheetWells = [{ x: 0, z: 0, A: 95, s: 30 * SP_IN }];
  G.nodes.filter((n) => isStar(n.id)).forEach((n) => {
    const p = homes.get(n.id);
    sheetWells.push({ x: p.x, z: p.z, A: 6 + 24 * MASS(n.id), s: 7 + (sysR.get(n.id) || 6) * 0.55 });
  });
  surfaceY = (x, z) => {
    let d = 0;
    for (let i = 0; i < sheetWells.length; i++) {
      const w = sheetWells[i];
      const dx = x - w.x;
      const dz = z - w.z;
      d += w.A / (1 + (dx * dx + dz * dz) / (w.s * w.s));
    }
    return Y0 - d;
  };
  seatHomes();
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
    playbook: () => new THREE.SphereGeometry(1, 20, 14),
    skill: () => new THREE.SphereGeometry(1, 18, 12),
    agent: () => new THREE.SphereGeometry(1, 18, 12),
    automation: () => new THREE.SphereGeometry(1, 16, 10),
    principle: () => new THREE.SphereGeometry(1, 18, 12),
    reference: () => new THREE.SphereGeometry(1, 14, 10),
    script: () => new THREE.SphereGeometry(1, 14, 10),
    other: () => new THREE.SphereGeometry(1, 14, 10),
  };

  const homeCam = { az: 0.42, el: 0.95 };
  const sceneC = homes.get(router.id).clone();
  let rt = null;
  let gLast = performance.now();
  let zView = null;
  let focusRings = null;
  let frMat = null;
  let diskMat = null;
  let bhMesh = null;
  let bulge = null;
  let bulge2 = null;
  let GRID = null;
  let lensScale = 1;
  const spikes = [];
  let decorList = [];
  let orbitT = 0;
  let mclk = 0;
  let paused = new URLSearchParams(location.search).get('paused') === '1';
  let keyClose = false;
  let keyPin = false;
  const galaxyFx = [];
  let haloInner = null;
  let haloOuter = null;
  let haloTex = null;
  const haloM = new THREE.Matrix4();
  const haloS = new THREE.Vector3();
  const zoneLbls = [];
  const hubs = [];
  const stepMk = [];
  let sky0 = null;
  let texLoader = null;

  const tex = (file, srgb = true) => {
    const url = new URL('./assets/' + file, import.meta.url).href;
    const t = texLoader.load(url, () => rt?.dirty?.());
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 1;
    return t;
  };

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
    edgeSeg: 20,
    edgeSegHl: 28,
    idleMs: 700,
    motion: { REGROUP: 2000, TRAVEL: 1900, EXIT: 1800, STAGGER: 26, STAGGER_MAX: 520, DISPERSE: 1700 },
    zones: ZONES,
    bindRuntime(runtime) { rt = runtime; installRuntime(); },
    ambientMotion() { return !reduced && !paused; },
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
      if (k === 'playbook') return new THREE.MeshBasicMaterial({ color: 0xffffff });
      return new THREE.MeshLambertMaterial({ map: tex(PTEX[k] || PTEX.other), color: 0xffffff });
    },
    labelDy(o) {
      if (o.k === 'router') return 26;
      return o.sc * 1.45 + 1.2;
    },
    hideHomeEdge: sameSystem,
    dashEdge: (x) => x.e.mode === 'conditional',
    curve(a, b, t, out, mode, side, FS) {
      const len = a.distanceTo(b);
      const m = MID.copy(a).add(b).multiplyScalar(0.5);
      if (mode === 'focus') {
        m.addScaledVector(YV, len * 0.22 + 2);
        if (FS?.Rv) m.addScaledVector(FS.Rv, side * len * 0.12);
        const mt = 1 - t;
        return out.set(
          a.x * mt * mt + 2 * m.x * mt * t + b.x * t * t,
          a.y * mt * mt + 2 * m.y * mt * t + b.y * t * t,
          a.z * mt * mt + 2 * m.z * mt * t + b.z * t * t,
        );
      }
      m.applyAxisAngle(YV, 0.32 * Math.min(1, len / 260));
      const pull = gravPull(a, b, m, len);
      m.x += pull.x;
      m.z += pull.z;
      const mt = 1 - t;
      out.set(
        a.x * mt * mt + 2 * m.x * mt * t + b.x * t * t,
        0,
        a.z * mt * mt + 2 * m.z * mt * t + b.z * t * t,
      );
      const arch = Math.sin(Math.PI * t) * Math.min(5, len * 0.03);
      out.y = surfaceY(out.x, out.z) + arch + 0.45;
      return out;
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
      haloTex = HALO;
      texLoader = new THREE.TextureLoader();
      const sky = new THREE.Group();
      scene.add(sky);
      const milky = new THREE.Mesh(
        new THREE.SphereGeometry(4200, 32, 16),
        new THREE.MeshBasicMaterial({ map: tex('milkyway-eso0932a-2048.webp'), side: THREE.BackSide, transparent: true, opacity: 0.32, depthWrite: false, fog: false }),
      );
      milky.rotation.set(0.9, 0, 0.35);
      milky.renderOrder = -10;
      sky.add(milky);
      sky0 = milky;
      const Nstar = 3200;
      const pos = new Float32Array(Nstar * 3);
      const col = new Float32Array(Nstar * 3);
      const skyN = 1700;
      for (let i = 0; i < Nstar; i++) {
        let x;
        let y;
        let z;
        let tint;
        if (i < skyN) {
          const u = grnd() * 2 - 1;
          const th = grnd() * Math.PI * 2;
          const r = 1800 + grnd() * 2200;
          const s = Math.sqrt(1 - u * u);
          x = r * s * Math.cos(th);
          y = r * u;
          z = r * s * Math.sin(th);
          tint = bbLin(2800 + grnd() ** 2 * 14000).multiplyScalar(0.35 + grnd() ** 2 * 1.3);
        } else {
          const k = i % 5;
          const inter = grnd() < 0.12;
          const r = 40 * SP_IN + grnd() ** 0.75 * (RMAX - 20 * SP_IN);
          const th = (k * 2 * Math.PI) / 5 + 0.31 + ARM_B * Math.log(Math.max(r, ARM_R0)) + gauss() * (inter ? 0.45 : 0.09);
          x = Math.cos(th) * r;
          z = Math.sin(th) * r;
          y = surfaceY(x, z) + gauss() * 1.4;
          tint = new THREE.Color(ZONES[k].col).lerp(new THREE.Color('#FFE2C0'), 0.5).multiplyScalar((inter ? 0.35 : 0.55) + grnd() * 0.7);
        }
        pos.set([x, y, z], i * 3);
        col.set([tint.r, tint.g, tint.b], i * 3);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const sm = new THREE.PointsMaterial({
        map: HALO, size: 1.8, sizeAttenuation: false, vertexColors: true,
        transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      });
      scene.add(new THREE.Points(sg, sm));
      galaxyFx.push({ m: sm, op: 0.9 });
      const glowSprite = (color, size, op, x, y, z) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: HALO, color, transparent: true, opacity: op,
          blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
        }));
        s.scale.setScalar(size);
        s.position.set(x, y, z);
        s.renderOrder = -6;
        scene.add(s);
        galaxyFx.push({ m: s.material, op });
        return s;
      };
      const cy = surfaceY(0, 0);
      bulge = glowSprite('#FFD9A8', 220, 0.26, 0, cy, 0);
      bulge2 = glowSprite('#FFF1DC', 84, 0.4, 0, cy, 0);
      ZONES.forEach((z) => {
        const x = z.label.x * 0.62;
        const zz = z.label.z * 0.62;
        glowSprite(z.col, 190, 0.16, x, surfaceY(x, zz), zz);
      });
      const guides = [];
      {
        const a = [];
        const c = [];
        const S = 64;
        const seen = new Set();
        ORB.forEach((o) => {
          if (o.moon || o.c === 'core' || seen.has(o.c + '|' + o.r)) return;
          seen.add(o.c + '|' + o.r);
          const z = zoneOfStar.get(o.c);
          const cc = new THREE.Color(z ? z.col : '#8899AA').multiplyScalar(0.75);
          const C0 = centreOf(o.c);
          for (let i = 0; i < S; i++) {
            const p0 = new THREE.Vector3(Math.cos((i / S) * Math.PI * 2) * o.r, 0, Math.sin((i / S) * Math.PI * 2) * o.r).applyQuaternion(o.q);
            const p1 = new THREE.Vector3(Math.cos(((i + 1) / S) * Math.PI * 2) * o.r, 0, Math.sin(((i + 1) / S) * Math.PI * 2) * o.r).applyQuaternion(o.q);
            const x0 = C0.x + p0.x;
            const z0 = C0.z + p0.z;
            const x1 = C0.x + p1.x;
            const z1 = C0.z + p1.z;
            a.push(x0, surfaceY(x0, z0) + 0.35, z0, x1, surfaceY(x1, z1) + 0.35, z1);
            c.push(cc.r, cc.g, cc.b, cc.r, cc.g, cc.b);
          }
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
        const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
        l.userData.op = 0.5;
        scene.add(l);
        guides.push(l);
      }
      {
        const RG = RMAX * 1.08;
        const NL = 22;
        const SUB = 48;
        const a = [];
        const c = [];
        const base = new THREE.Color('#9BB6E4');
        const push = (x0, z0, x1, z1) => {
          const y0 = surfaceY(x0, z0);
          const y1 = surfaceY(x1, z1);
          a.push(x0, y0, z0, x1, y1, z1);
          [[x0, y0, z0], [x1, y1, z1]].forEach(([x, y, z]) => {
            const r = Math.hypot(x, z) / RG;
            const fade = 1 - THREE.MathUtils.smoothstep(r, 0.5, 1);
            const glow = 1 + Math.min(1, (Y0 - y) / 40) * 1.3;
            const tint = base.clone().multiplyScalar(0.7 * fade * glow);
            c.push(tint.r, tint.g, tint.b);
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
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
        GRID = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
          vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false,
          blending: THREE.AdditiveBlending, fog: false,
        }));
        GRID.userData.op = 0.9;
        GRID.userData.grid = true;
        GRID.renderOrder = -8;
        scene.add(GRID);
        guides.push(GRID);
      }
      ZONES.forEach((z) => {
        const d = document.createElement('div');
        d.className = 'zlbl';
        d.innerHTML = `<i style="background:${z.col}"></i>${z.name}`;
        const o = new CSS2DObject(d);
        o.position.set(z.label.x, z.label.y + 14, z.label.z);
        scene.add(o);
        zoneLbls.push({ o, d, z });
      });
      const baked = createBakedDisk();
      diskMat = baked.mat;
      bhMesh = baked.mesh;
      scene.add(bhMesh);
      api.routerMesh = bhMesh;
      api.routerDim = (d) => { diskMat.uniforms.dim.value = d; };
      const lens = new THREE.Sprite(new THREE.SpriteMaterial({
        map: HALO, color: 0xFFE0B0, transparent: true, opacity: 0.48,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
      }));
      lens.scale.setScalar(80);
      lens.renderOrder = 2;
      scene.add(lens);
      api._lens = lens;
      galaxyFx.push({ m: lens.material, op: 0.48 });
      frMat = mkLineMat({ color: '#AFC0E0', linewidth: 1, opacity: 0 });
      api._scene = scene;
      api._mkLineMat = mkLineMat;
      const sunLight = new THREE.PointLight(0xFFD7A8, 1.35, 0, 0);
      const fill = new THREE.DirectionalLight(0xFFF0DC, 0.85);
      fill.position.set(-0.4, 1, 0.3);
      scene.add(new THREE.AmbientLight(0x9AA6C4, 0.95));
      scene.add(sunLight);
      scene.add(fill);
      api.guides = guides;
      return { sunLight, fill, guides };
    },
    decor(starNode, N, mkHalo) {
      const decor = [];
      const stars = N.filter((o) => o.k === 'playbook');
      const haloMat = () => new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: { map: { value: haloTex } },
        vertexShader: 'attribute float aOp;varying vec2 vUv;varying vec3 vC;varying float vOp;void main(){vUv=uv;vC=instanceColor;vOp=aOp;gl_Position=projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.);}',
        fragmentShader: 'uniform sampler2D map;varying vec2 vUv;varying vec3 vC;varying float vOp;void main(){vec4 t=texture2D(map,vUv);gl_FragColor=vec4(t.rgb*vC*vOp,t.a*vOp);}',
      });
      const makeBatch = (f, op, mul) => {
        const geo = new THREE.PlaneGeometry(1, 1);
        const aOp = new THREE.InstancedBufferAttribute(new Float32Array(stars.length), 1);
        aOp.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('aOp', aOp);
        const im = new THREE.InstancedMesh(geo, haloMat(), stars.length);
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.frustumCulled = false;
        im.count = stars.length;
        stars.forEach((o, i) => {
          const col = o.base.clone().multiplyScalar(mul);
          im.setColorAt(i, col);
        });
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        api._scene.add(im);
        return { im, f, op, nodes: stars };
      };
      haloInner = makeBatch(3.0, 0.6, 1.8);
      haloOuter = makeBatch(8.5, 0.16, 0.5);
      {
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
      N.filter((o) => (o.k === 'skill' || o.k === 'agent') && deg(o.id) >= 16).forEach((o) => {
        const m = new THREE.Mesh(
          new THREE.RingGeometry(1.5, 2.05, 40),
          new THREE.MeshBasicMaterial({ color: css('--k-' + o.k), transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }),
        );
        m.rotation.x = Math.PI / 2;
        api._scene.add(m);
        hubs.push({ o, m });
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
        if (diskMat) diskMat.uniforms.uTime.value = mclk * 0.00032;
        if (sky0) sky0.rotation.y += ((2 * Math.PI) / 5400) * (dt / 1000) * 0.5;
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
        GRID.material.opacity = (GRID.userData.op ?? 0.9) * THREE.MathUtils.clamp((1.05 - Math.sin(rt.cam.el)) * 1.6, 0.28, 1);
      }
      const star = rt?.NB?.get(router.id);
      if (api._lens && star) {
        api._lens.position.copy(star.pos);
        api._lens.scale.setScalar(Math.max(36, star.sc * 13));
        api._lens.material.opacity = 0.48 * (0.35 + 0.65 * idleAlpha) * (1 - star.dim);
      }
      if (rt?.NB) {
        hubs.forEach((p) => {
          p.m.position.copy(p.o.pos);
          p.m.scale.setScalar(p.o.sc);
          p.m.material.opacity = 0.42 * (1 - p.o.dim);
          p.m.visible = p.o.dim < 0.98;
        });
      }
      [haloInner, haloOuter].forEach((batch) => {
        if (!batch || !rt?.camera) return;
        const attr = batch.im.geometry.getAttribute('aOp');
        const q = rt.camera.quaternion;
        batch.nodes.forEach((o, i) => {
          const hid = !rt.focus && rt.hiddenKinds?.has(o.k);
          const ad = THREE.MathUtils.smoothstep(rt.camera.position.distanceTo(o.pos) / Math.max(o.sc, 0.01), 8, 70);
          const op = hid ? 0 : batch.op * (1 - o.dim) * (0.3 + 0.7 * ad);
          attr.setX(i, op);
          haloM.compose(o.pos, q, haloS.setScalar(hid ? 0 : o.sc * batch.f));
          batch.im.setMatrixAt(i, haloM);
        });
        attr.needsUpdate = true;
        batch.im.instanceMatrix.needsUpdate = true;
      });
      decorList.forEach((d) => {
        if (!rt?.camera) return;
        const ad = THREE.MathUtils.smoothstep(rt.camera.position.distanceTo(d.o.pos) / Math.max(d.o.sc, 0.01), 8, 70);
        if (d.spike) {
          const r = rt.screenOf ? rt.screenOf(d.o).rad : 0;
          d.s.material.opacity *= 1 - THREE.MathUtils.smoothstep(r, 5, 14);
          d.s.visible = d.s.material.opacity > 0.01;
        } else d.s.material.opacity *= 0.3 + 0.7 * ad;
      });
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

  function applyGfx() {
    document.querySelectorAll('[data-g]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.g === getGfx())));
    rt.dirty();
  }
  function installRuntime() {
    rt.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    rt.renderer.toneMappingExposure = 1.05;
    rt.renderer.info.autoReset = false;
    let bloom = null;
    api.renderFrame = (renderer, scene, camera) => {
      const high = getGfx() === 'high';
      let calls;
      let tris;
      let bloomSize = null;
      if (high) {
        if (!bloom) bloom = createBloom(renderer);
        const stats = bloom.render(scene, camera);
        calls = stats.calls;
        tris = stats.tris;
        bloomSize = bloom.size();
      } else {
        renderer.render(scene, camera);
        calls = renderer.info.render.calls;
        tris = renderer.info.render.triangles;
        renderer.info.reset();
      }
      api.lastStats = { calls, tris, gfx: getGfx(), disk: 'baked', bloom: high, bloomSize };
    };
    const reset = document.getElementById('reset');
    const dock = document.createElement('div');
    dock.className = 'gseg';
    dock.id = 'gfxDock';
    dock.setAttribute('role', 'group');
    dock.setAttribute('aria-label', 'Graphics quality');
    dock.innerHTML = '<button type="button" data-g="fast">Fast</button><button type="button" data-g="high">High</button>';
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
    document.getElementById('about').insertAdjacentHTML('beforeend', '<div class="gfx"><span>Graphics</span><div class="gseg" id="gfxSeg" role="group" aria-label="Graphics quality"><button type="button" data-g="fast">Fast</button><button type="button" data-g="high">High</button></div></div><p class="gnote">Fast is the default: a painted black hole, glow sprites, and no full-screen bloom. High adds a soft bloom. Saved on this device.</p>');
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
    api.gfx = () => ({ ...(api.lastStats || {}), gfx: getGfx(), disk: 'baked', paused, mclk: Math.round(mclk) });
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

