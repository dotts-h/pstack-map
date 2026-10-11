// Galaxy theme. Layout, shaders, and motion follow design/concepts/galaxy.
// Zones are hand-picked. Textures are the CC BY 4.0 files credited in NOTICE.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/CSS2DRenderer.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

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
  ZONES.forEach((z) => z.ids.forEach((s) => zoneOfStar.set('playbook:' + s, z)));
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
    let r = 9;
    let j = 0;
    let cap = Math.floor((2 * Math.PI * r) / 7);
    let used = 0;
    kids.forEach((n) => {
      if (used >= cap) {
        j += 1;
        r = 9 + 4.2 * j;
        cap = Math.floor((2 * Math.PI * r) / 7);
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
      r: 3.2 + i * 1.1,
      ph: i * GOLD * 2.4,
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0, 0.2)),
      moon: true,
    });
  });

  const homes = new Map();
  homes.set(router.id, new THREE.Vector3());
  const ARM_B = 0.95;
  const ARM_R0 = 115;
  const armAt = (k, r) => {
    const t = (k * 2 * Math.PI) / 5 + 0.31 + ARM_B * Math.log(r / ARM_R0);
    return new THREE.Vector3(Math.cos(t) * r, 0, Math.sin(t) * r);
  };
  ZONES.forEach((z, k) => {
    const stars = z.ids.map((s) => 'playbook:' + s).filter((s) => byId.has(s)).sort((a, b) => deg(b) - deg(a));
    let r = ARM_R0;
    stars.forEach((s, j) => {
      if (j > 0) r += sysR.get(stars[j - 1]) * 0.75 + sysR.get(s) * 0.75 + 9;
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
    const r = 66 + ((i * 37) % 5) * 6;
    homes.set(n.id, new THREE.Vector3(Math.cos(a) * r, (grnd() - 0.5) * 10, Math.sin(a) * r));
  });
  core.forEach((n, i) => {
    ORB.set(n.id, {
      c: 'core',
      r: 30 + (i % 3) * 7,
      ph: i * GOLD,
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0, -0.1)),
    });
  });
  ORB.forEach((o) => {
    const T = o.moon ? 180 : THREE.MathUtils.clamp(360 * (o.r / 20) ** 1.5, 240, 1200);
    o.w = reduced ? 0 : (2 * Math.PI) / (T * 1000);
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
  let ringMat = null;
  let bhRing = null;
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
    homeVX: -130,
    showSel: true,
    stars: false,
    GEO,
    radiusOf,
    edgeSeg: 36,
    edgeSegHl: 48,
    idleMs: 700,
    motion: { REGROUP: 2000, TRAVEL: 1900, EXIT: 1800, STAGGER: 26, STAGGER_MAX: 520, DISPERSE: 1700 },
    zones: ZONES,
    bindRuntime(runtime) { rt = runtime; },
    fitDist(w, h, mobile, vf) {
      const ppu = Math.min(
        (h - (mobile ? 150 : 190)) / 2 / (RMAX * Math.sin(homeCam.el) * 1.08 + 10),
        (w - (mobile ? 24 : 96 + 300)) / 2 / (RMAX * 0.96),
      );
      return h / (2 * Math.tan(vf / 2) * Math.max(ppu, 0.001));
    },
    fog(d, focused, FS) {
      if (focused && FS) return { near: d + FS.Rb * 0.6, far: FS.shell * 1.35 };
      return { near: d, far: d + RMAX * 3.2 };
    },
    camLimits(Rb, dist) {
      return { min: Math.max(Rb * 1.1, 30), max: Math.min(dist * 2.2, 1200) };
    },
    paintBases(N) {
      N.forEach((o) => {
        if (o.k === 'playbook') {
          const z = zoneOfStar.get(o.id);
          if (z) o.base = new THREE.Color(z.col);
        }
      });
    },
    material(k) {
      if (k === 'playbook') {
        const m = new THREE.MeshBasicMaterial({ color: 0xffffff });
        m.onBeforeCompile = (sh) => {
          sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 gN;varying vec3 gV;')
            .replace('#include <project_vertex>', '#include <project_vertex>\n gN=normalize(normalMatrix*mat3(instanceMatrix)*normal);gV=normalize(-mvPosition.xyz);');
          sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec3 gN;varying vec3 gV;')
            .replace('#include <opaque_fragment>', 'float mu=clamp(dot(normalize(gN),normalize(gV)),0.,1.);outgoingLight=mix(diffuseColor.rgb*vec3(1.,.78,.58)*.62,mix(diffuseColor.rgb,vec3(1.),.6),pow(mu,.55));\n#include <opaque_fragment>');
        };
        return m;
      }
      const map = PTEX[k] ? tex(PTEX[k]) : null;
      const m = new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: 0.92, metalness: 0 });
      m.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace(
          '#include <opaque_fragment>',
          'float rimF=pow(1.0-saturate(abs(dot(normalize(normal),normalize(vViewPosition)))),3.0);outgoingLight+=diffuseColor.rgb*rimF*0.45+vec3(.55,.68,.9)*rimF*0.12;\n#include <opaque_fragment>',
        );
      };
      return m;
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
      if (o.k === 'playbook' || deg(o.id) >= 14) return 1;
      if (o.k === 'script' || o.k === 'reference') return 3;
      return 2;
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
      [[3200, 2600, 3600, 1.2, 0.5], [2200, 1500, 2200, 1.5, 0.6], [900, 800, 1200, 2.1, 0.75]].forEach(([n, r0, r1, sz, op], li) => {
        const p = new Float32Array(n * 3);
        const c = new Float32Array(n * 3);
        const pal = ['#FFFFFF', '#CAD8FF', '#FFE9C4', '#FFD2A6', '#B9CBFF'].map((h) => new THREE.Color(h));
        for (let i = 0; i < n; i++) {
          const u = grnd() * 2 - 1;
          const th = grnd() * Math.PI * 2;
          const r = r0 + grnd() * (r1 - r0);
          const s = Math.sqrt(1 - u * u);
          p.set([r * s * Math.cos(th), r * u, r * s * Math.sin(th)], i * 3);
          const col = pal[Math.floor(grnd() * 5)].clone().multiplyScalar(0.25 + grnd() ** 2.2 * 0.75);
          c.set([col.r, col.g, col.b], i * 3);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(p, 3));
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
        const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: sz, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: op, fog: false, depthWrite: false }));
        sky.add(pts);
        const periods = [5400, 3600, 2400];
        starLayers.push({ pts, w: ((2 * Math.PI) / (periods[li] * 1000)) * (li % 2 ? -1 : 1) });
      });
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
            const r = Math.abs(gauss()) * 34;
            const v = new THREE.Vector3(gauss(), gauss() * 0.45, gauss()).normalize().multiplyScalar(r);
            x = v.x; y = v.y; z = v.z;
            col = warm.clone().multiplyScalar(0.5 + grnd() * 0.5);
          } else {
            const k = Math.floor(grnd() * 5);
            const inter = grnd() < 0.1;
            const r = 55 + grnd() ** 0.8 * (RMAX - 30);
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
        const m = new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
        scene.add(new THREE.Points(g, m));
        galaxyFx.push({ m, op: 0.55 });
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
        scene.add(new THREE.Points(g, m));
        galaxyFx.push({ m, op });
      };
      {
        const L = [];
        for (let i = 0; i < 220; i++) {
          const k = i % 5;
          const r = 70 + grnd() * (RMAX - 60);
          const th = (k * 2 * Math.PI) / 5 + 0.31 + ARM_B * Math.log(r / ARM_R0) + gauss() * 0.12;
          L.push([new THREE.Vector3(Math.cos(th) * r, gauss() * 2, Math.sin(th) * r), new THREE.Color(ZONES[k].col).lerp(new THREE.Color('#FFD9B0'), 0.5)]);
        }
        hazePts(L, NEB, 70, 0.11);
      }
      {
        const L = [];
        for (let i = 0; i < 46; i++) {
          const a = grnd() * Math.PI * 2;
          const r = 58 + grnd() * 36;
          L.push([new THREE.Vector3(Math.cos(a) * r, gauss() * 4, Math.sin(a) * r), new THREE.Color(i % 3 ? '#5FB8C9' : '#9A7FD6')]);
        }
        hazePts(L, NEB2, 62, 0.2);
      }
      const mkHaloG = (col, size, op) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: HALO, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
        s.scale.setScalar(size);
        scene.add(s);
        galaxyFx.push({ m: s.material, op });
        return s;
      };
      mkHaloG('#FFD9A8', 260, 0.3);
      mkHaloG('#FFF1DC', 90, 0.5);
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
      diskMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { time: { value: 0 }, dim: { value: 0 } },
        vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `uniform float time;uniform float dim;varying vec3 vP;
          float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
          void main(){float r=length(vP.xy);float rr=(r-1.45)/2.9;if(rr<0.||rr>1.)discard;float a=atan(vP.y,vP.x)-time*.09/(r*r*.3);
            vec2 q=vec2(cos(a),sin(a));float t=n(q*3.*r)*.6+n(q*8.*r+7.)*.4;float I=pow(1.-rr,2.4)*smoothstep(0.,.06,rr);
            vec3 c=mix(vec3(.95,.48,.2),vec3(1.,.93,.82),pow(1.-rr,4.));gl_FragColor=vec4(c*I*(.45+.75*t)*(1.-dim*.85),1.);}`,
      });
      ringMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { dim: { value: 0 } },
        vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: 'uniform float dim;varying vec3 vP;void main(){float r=length(vP.xy);float g=exp(-pow((r-1.07)/.05,2.))+.35*exp(-pow((r-1.15)/.22,2.));gl_FragColor=vec4(vec3(1.,.86,.66)*g*(1.-dim*.85),1.);}',
      });
      const starMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      const disk = new THREE.Mesh(new THREE.RingGeometry(1.45, 4.35, 160, 6), diskMat);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.6, 160, 2), ringMat);
      disk.rotation.set(-Math.PI / 2 + 0.22, 0, 0);
      starMesh.add(disk);
      starMesh.add(ring);
      ring.renderOrder = 2;
      bhRing = ring;
      scene.add(starMesh);
      api.routerMesh = starMesh;
      api.routerDim = (d) => {
        diskMat.uniforms.dim.value = d;
        ringMat.uniforms.dim.value = d;
      };
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
      const decor = [{ o: starNode, s: mkHalo('#FFC48A', 1, 0.28), f: 9, op: 0.28 }];
      N.filter((o) => o.k === 'playbook').forEach((o) => {
        const c = '#' + o.base.getHexString();
        decor.push({ o, s: mkHalo(c, 1, 0.75), f: 3.1, op: 0.75 }, { o, s: mkHalo(c, 1, 0.14), f: 8, op: 0.14 });
      });
      N.filter((o) => (o.k === 'skill' || o.k === 'agent') && deg(o.id) >= 16).forEach((o, j) => {
        const m = new THREE.Mesh(new THREE.RingGeometry(1.45, 2.2, 96), new THREE.MeshBasicMaterial({ color: css('--k-' + o.k), transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
        m.rotation.set(Math.PI / 2 - 0.35, 0, 0.2 * (j % 2 ? 1 : -1));
        api._scene.add(m);
        hubs.push({ o, m });
      });
      return decor;
    },
    beforeCam() {
      if (!rt) return;
      const now = performance.now();
      const dt = Math.min(100, now - gLast);
      gLast = now;
      if (!reduced) {
        starLayers.forEach((l) => { l.pts.rotation.y += l.w * dt; });
        if (sky0) sky0.rotation.y += starLayers[0].w * dt * 0.5;
        if (!rt.focus && !rt.drag && !rt.camTw) rt.cam.az += dt * ((2 * Math.PI) / 720000);
      }
      if (!reduced && !rt.focus && rt.NB) {
        const t = now - gT0;
        let moved = false;
        ORB.forEach((o, id) => {
          const nd = rt.NB.get(id);
          if (!nd || (nd.dur && now < nd.t0 + nd.dur)) return;
          const p = orbitPos(id, t);
          homes.set(id, p);
          nd.from.copy(p);
          nd.to.copy(p);
          moved = true;
        });
        if (moved) rt.dirty();
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
      if (diskMat) diskMat.uniforms.time.value = reduced ? 0 : performance.now() / 1000;
      if (bhRing && rt?.camera) bhRing.quaternion.copy(rt.camera.quaternion);
      hubs.forEach((p) => {
        p.m.position.copy(p.o.pos);
        p.m.scale.setScalar(p.o.sc);
        p.m.material.opacity = 0.32 * (1 - p.o.dim);
        p.m.visible = p.o.dim < 0.98;
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
      const r1 = Math.max(15, (grp.planet.length * 8) / T2);
      const r2 = Math.max(r1 + 10, (grp.rule.length * 8.5) / T2);
      const r3 = Math.max(r2 + 9, (grp.moon.length * 7) / T2);
      const r4 = Math.max(r3 + 12, (grp.star.length * 10) / T2);
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
      const upY = rOut * 0.55 + 18;
      const upW = Math.max(Math.min(rOut, ((up.length - 1) * 16) / 2), ((up.length - 1) * 13) / 2);
      up.forEach((x, i) => {
        const t = up.length === 1 ? 0 : -upW + (2 * upW * i) / (up.length - 1);
        const st = up.length > 5 && i % 2 ? 1 : 0;
        member.set(x.id, { p: C.clone().addScaledVector(Rh, t).addScaledVector(Df, -rOut * 0.35 - st * 10).addScaledVector(Y, upY + st * 13) });
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
    dockCard({ pop, screenOf, cardId, NB, FS, THREE: T }) {
      const o = NB.get(cardId);
      if (!o) return;
      const s = screenOf(o);
      const inset = 16;
      const top0 = document.querySelector('header').offsetHeight + 16 + 40 + 8;
      pop.style.maxHeight = Math.min(580, innerHeight - inset - top0) + 'px';
      const w = pop.offsetWidth;
      const h = pop.offsetHeight;
      const hw = FS?.hwPx || 60;
      let x = s.x - hw - 28 - w;
      if (x < inset) x = Math.min(s.x + hw + 28, innerWidth - inset - w);
      x = T.MathUtils.clamp(x, inset, innerWidth - inset - w);
      const y = T.MathUtils.clamp(s.y - h * 0.42, top0, innerHeight - inset - h);
      pop.className = pop.className.replace(/\b(below|above|side)\b/g, '').trim() + ' side';
      pop.style.left = Math.round(x) + 'px';
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
