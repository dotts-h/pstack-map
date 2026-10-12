// pstack map. Galaxy is the default; kitchen, circuit, earth, and brain are themes.
// The card, chip travel, breadcrumbs, and Back are the same in every theme.
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/CSS2DRenderer.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { homePositions } from './layout.mjs';
import { FRIENDLY, EWORD, KINDS, ETYPES, kindOf, etype, plainName, oneLiner, stepsOf } from './copy.mjs';
import { THEME_IDS, themeMeta, rankBadge } from './theme-meta.mjs';
import { galaxyTheme, CREDITS_HTML } from './galaxy.mjs';
import { getGfx, targetPixelRatio, onGfx, noteFrame, frameStats, setViewMoving } from './gfx.mjs';

const qs = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || qs.has('reduced');
const SHAPE = 'sphere';
const themeName = (qs.get('theme') || '').toLowerCase();
const THEME = themeName === 'sphere' || !THEME_IDS.includes(themeName) ? 'galaxy' : themeName;
const META = themeMeta(THEME);
const mobile = () => innerWidth < 760;
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function showError(reason) {
  document.getElementById('boot')?.remove();
  const err = document.getElementById('err');
  document.getElementById('errReason').textContent = reason;
  err.hidden = false;
}
document.getElementById('retry').onclick = () => location.reload();

let G;
try {
  const res = await fetch(new URL('data/graph.json', import.meta.url));
  if (!res.ok) throw new Error('status');
  G = await res.json();
  if (!Array.isArray(G.nodes) || !Array.isArray(G.edges)) throw new Error('shape');
} catch {
  showError('The map data is unavailable.');
  throw new Error('graph unavailable');
}

const U = G.upstream;
const byId = new Map(G.nodes.map((n) => [n.id, n]));
const color = (k) => css('--k-' + kindOf(k));
const ecolor = (t, hl) => (t === 'references' && hl ? css('--e-references-hl') : css('--e-' + etype(t)));
const EALPHA = { loads: 0.5, applies: 0.14, runs: 0.22, imports: 0.22, references: 0.06, other: 0.07 };
const NAME = new Map(G.nodes.map((n) => [n.id, plainName(n)]));
const nm = (id) => NAME.get(id) || id;
const trunc = (s, m = 24) => (s.length > m ? s.slice(0, m - 1).trimEnd() + '…' : s);
const deg = (id) => byId.get(id)?.degree?.total ?? 0;

let theme;
let homes;
try {
  if (THEME === 'galaxy') {
    theme = galaxyTheme({ G, byId, kindOf, nm, deg, css, reduced });
  } else {
    const { createTheme } = await import('./themes.mjs');
    theme = createTheme(THEME, { G, byId, kindOf, nm, deg, SHAPE, homePositions, css, reduced });
  }
  homes = theme.homes;
} catch (e) {
  showError(e.message || 'The map data is unavailable.');
  throw e;
}

const lathe = (pts, seg, rot = 0) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg, rot);
const SPHERE_GEO = {
  playbook: () => lathe([[0, -1.35], [1, 0], [0, 1.35]], 4, Math.PI / 4),
  skill: () => lathe([[0, -0.95], [0.55, -0.42], [1, 0.02], [0.84, 0.24], [0.62, 0.42], [0, 0.42]], 16),
  principle: () => lathe([[0, -0.8], [1, 0], [0, 0.8]], 6),
  agent: () => lathe([[0, -0.7], [0.95, -0.12], [0.95, 0.16], [0.6, 0.5], [0, 0.5]], 4, Math.PI / 4),
  automation: () => lathe([[0, -1], [1, 0], [0, 1]], 3),
  script: () => new THREE.TetrahedronGeometry(1.1, 0),
  reference: () => lathe([[0, -0.9], [0.55, 0], [0, 0.9]], 4),
  other: () => new THREE.IcosahedronGeometry(0.9, 0),
};
const GEO = theme.GEO || SPHERE_GEO;
const KMUL = { router: 1, playbook: 1, skill: 1, principle: 1, agent: 1, automation: 1, script: 0.75, reference: 0.62, other: 0.8 };
const maxDeg = Math.max(1, ...G.nodes.filter((n) => n.kind !== 'router').map((n) => deg(n.id)));
const radiusOf = theme.radiusOf || ((n) => (n.kind === 'router' ? 13 : KMUL[kindOf(n.kind)] * (2 + 6.2 * Math.sqrt(deg(n.id) / maxDeg))));
const vec = (p) => new THREE.Vector3(p.x, p.y, p.z);

const host = document.getElementById('scene');
const W = () => host.clientWidth;
const H = () => host.clientHeight;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: theme.id !== 'galaxy' || getGfx() === 'cinematic',
    powerPreference: 'high-performance',
    stencil: false,
  });
  if (!renderer.getContext()) throw new Error('no context');
} catch {
  showError('This browser has no 3D support.');
  throw new Error('no webgl');
}
renderer.setPixelRatio(targetPixelRatio());
renderer.setSize(W(), H());
renderer.setClearColor(css('--bg'), 1);
host.appendChild(renderer.domElement);
const labelR = new CSS2DRenderer();
labelR.setSize(W(), H());
document.getElementById('labels').appendChild(labelR.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(css('--bg'), 300, 650);
const camera = new THREE.PerspectiveCamera(40, W() / Math.max(1, H()), 1, 6000);
let sunLight = null;
let fill = null;
if (theme.id === 'sphere') {
  scene.add(new THREE.AmbientLight(0x9AA8C8, 1.1));
  sunLight = new THREE.PointLight(0xFFE2B0, 2.4, 0, 0);
  scene.add(sunLight);
  fill = new THREE.DirectionalLight(0xC8D4EA, 1.1);
  scene.add(fill);
}

function haloTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,.55)');
  g.addColorStop(0.45, 'rgba(255,255,255,.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
const HALO = haloTex();
if (theme.stars !== false) {
  const Nstar = 1800;
  const p = new Float32Array(Nstar * 3);
  const c = new Float32Array(Nstar * 3);
  const pal = [new THREE.Color('#FFFFFF'), new THREE.Color('#C8D4FF'), new THREE.Color('#FFE6C2')];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < Nstar; i++) {
    const u = rnd() * 2 - 1;
    const t = rnd() * Math.PI * 2;
    const r = 1400 + rnd() * 1400;
    const s = Math.sqrt(1 - u * u);
    p.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3);
    const col = pal[Math.floor(rnd() * 3)].clone().multiplyScalar(0.35 + rnd() * 0.65);
    c.set([col.r, col.g, col.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.8, fog: false, depthWrite: false })));
}
const lineMats = [];
const mkLineMat = (o) => {
  const m = new LineMaterial({ worldUnits: false, transparent: true, depthWrite: false, ...o });
  m.resolution.set(W(), H());
  lineMats.push(m);
  return m;
};

const RMAX = theme.RMAX;
const YS = theme.YS || 1;
let guides = [];
if (theme.id === 'sphere' && SHAPE === 'rhombus') {
  const f = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#7FA6E0', transparent: true, opacity: 0.035, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  f.scale.set(RMAX, RMAX * YS, RMAX);
  scene.add(f);
  guides.push(f);
}
if (theme.id === 'sphere') {
  const a = [];
  const col = [];
  const gc = new THREE.Color(css('--guide'));
  const push = (p, q, k) => {
    a.push(p.x, p.y, p.z, q.x, q.y, q.z);
    const c = k > 1 ? new THREE.Color(css('--guide-outer')) : gc.clone().multiplyScalar(k);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
  };
  const radii = SHAPE === 'rhombus' ? [96, 148, 196, 244] : [62, 108, 150, 192];
  radii.forEach((r, li) => {
    const k = 0.55 + (0.45 * li) / (radii.length - 1);
    const outer = li === radii.length - 1;
    if (SHAPE === 'rhombus') {
      const V = [[r, 0, 0], [-r, 0, 0], [0, r * YS, 0], [0, -r * YS, 0], [0, 0, r], [0, 0, -r]].map((xyz) => new THREE.Vector3(...xyz));
      const E = [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [4, 3], [3, 5], [5, 2]];
      E.forEach(([i, j]) => push(V[i], V[j], outer ? 2 : k));
    } else {
      const S = 192;
      for (let i = 0; i < S; i++) {
        const t0 = (i / S) * Math.PI * 2;
        const t1 = ((i + 1) / S) * Math.PI * 2;
        push(new THREE.Vector3(Math.cos(t0) * r, 0, Math.sin(t0) * r), new THREE.Vector3(Math.cos(t1) * r, 0, Math.sin(t1) * r), k);
      }
    }
  });
  const g = new LineSegmentsGeometry();
  g.setPositions(a);
  g.setColors(col);
  const l = new LineSegments2(g, mkLineMat({ vertexColors: true, linewidth: 1, opacity: 1 }));
  scene.add(l);
  guides.push(l);
  if (SHAPE === 'sphere') {
    const b = [];
    const S = 256;
    const r = RMAX + 3;
    for (let i = 0; i < S; i++) {
      const t0 = (i / S) * Math.PI * 2;
      const t1 = ((i + 1) / S) * Math.PI * 2;
      b.push(Math.cos(t0) * r, Math.sin(t0) * r, 0, Math.cos(t1) * r, Math.sin(t1) * r, 0);
    }
    const g2 = new LineSegmentsGeometry();
    g2.setPositions(b);
    const limb = new LineSegments2(g2, mkLineMat({ color: css('--guide'), linewidth: 1.25, opacity: 1 }));
    limb.userData.limb = true;
    scene.add(limb);
    guides.push(limb);
  }
} else {
  const lit = theme.scenery(scene, { HALO, mkLineMat, css });
  sunLight = lit.sunLight;
  fill = lit.fill;
  guides = lit.guides || [];
}

function gemMaterial(k) {
  if (theme.material) return theme.material(k);
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, metalness: 0.1, roughness: 0.42, emissive: 0x141a26 });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      'float rimF=pow(1.0-saturate(abs(dot(normalize(normal),normalize(vViewPosition)))),2.2);outgoingLight+=diffuseColor.rgb*rimF*0.55+vec3(rimF*0.06);\n#include <opaque_fragment>',
    );
  };
  return m;
}
const N = [];
const byKind = {};
G.nodes.forEach((n) => {
  const k = kindOf(n.kind);
  if (k !== 'router') (byKind[k] = byKind[k] || []).push(n);
});
const inst = {};
function mkNode(n, k, im, i) {
  const r = radiusOf(n);
  const home = vec(homes.get(n.id) || { x: 0, y: 40, z: 0 });
  return {
    n, id: n.id, k, i, im, r, base: new THREE.Color(color(k)),
    pos: home.clone(), from: home.clone(), to: home.clone(),
    sc: r, scFrom: r, scTo: r, dim: 0, dimFrom: 0, dimTo: 0, t0: 0, dur: 0, dimT0: 0, dimDur: 0, prog: 1,
    rot: theme.rotation ? theme.rotation(n, k, i) : new THREE.Euler((k === 'skill' || k === 'principle') ? 0.25 : 0, (i * 2.399) % 6.28, 0),
  };
}
Object.entries(byKind).forEach(([k, list]) => {
  const im = new THREE.InstancedMesh(GEO[k](), gemMaterial(k), list.length);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false;
  scene.add(im);
  inst[k] = im;
  list.forEach((n, i) => N.push(mkNode(n, k, im, i)));
});
const router = G.nodes.find((n) => n.kind === 'router');
let starMat = null;
let starMesh;
if (theme.routerMesh) {
  starMesh = theme.routerMesh;
} else {
  starMat = new THREE.ShaderMaterial({
    uniforms: { core: { value: new THREE.Color('#FFF3D6') }, edge: { value: new THREE.Color('#E9A748') }, dim: { value: 0 } },
    vertexShader: 'varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform vec3 core;uniform vec3 edge;uniform float dim;varying vec3 vN;varying vec3 vV;void main(){float mu=clamp(dot(normalize(vN),normalize(vV)),0.,1.);vec3 c=mix(edge,core,pow(mu,.55));gl_FragColor=vec4(mix(c,vec3(.15,.17,.22),dim*.8),1.);}',
  });
  starMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), starMat);
  scene.add(starMesh);
}
const starNode = mkNode(router, 'router', null, 0);
starNode.mesh = starMesh;
N.push(starNode);
theme.paintBases?.(N);
const NB = new Map(N.map((o) => [o.id, o]));
const mkHalo = (col, size, op) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: HALO, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  scene.add(s);
  return s;
};
const pring = [];
const decor = theme.decor
  ? theme.decor(starNode, N, mkHalo, color)
  : [
    { o: starNode, s: mkHalo('#F6CF85', 1, 0.85), f: 3.4, op: 0.85 },
    { o: starNode, s: mkHalo('#F2B85A', 1, 0.2), f: 11, op: 0.2 },
  ];
if (!theme.decor) {
  N.filter((o) => o.k !== 'router' && deg(o.id) >= 15).forEach((o) => decor.push({ o, s: mkHalo(color(o.k), 1, 0.16), f: 4.2, op: 0.16 }));
  N.filter((o) => o.k !== 'router' && deg(o.id) >= 20).forEach((o, j) => {
  const m = new THREE.Mesh(new THREE.RingGeometry(1.55, 2.05, 128), new THREE.MeshBasicMaterial({ color: color(o.k), transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.set(Math.PI / 2 - 0.42, 0, 0.18 * (j % 2 ? 1 : -1));
  scene.add(m);
  pring.push({ o, m });
  });
}
const selRing = new THREE.Mesh(new THREE.RingGeometry(1.32, 1.42, 128), new THREE.MeshBasicMaterial({ color: 0xE6EAF2, transparent: true, opacity: 0, depthWrite: false }));
scene.add(selRing);

function mkLabel(cls, text, anchor = 'c') {
  const a = document.createElement('div');
  a.className = 'anc ' + anchor;
  const sp = document.createElement('span');
  const l = document.createElement('span');
  l.className = cls;
  l.textContent = text;
  sp.appendChild(l);
  a.appendChild(sp);
  const lo = new CSS2DObject(a);
  lo.center.set(0, 0);
  scene.add(lo);
  return { lo, a, l };
}
N.forEach((o) => {
  const L = mkLabel('lbl', trunc(nm(o.id)));
  Object.assign(o, { lo: L.lo, anc: L.a, el: L.l, lmode: 'home' });
});

const SEG = theme.edgeSeg || 16;
const SEG_HL = theme.edgeSegHl || 32;
const E = G.edges.filter((e) => NB.has(e.source) && NB.has(e.target)).map((e) => ({ e, t: etype(e.type) }));
const idle = {};
[...ETYPES, 'other'].forEach((t) => {
  const list = E.filter((x) => x.t === t);
  if (!list.length) return;
  const g = new LineSegmentsGeometry();
  g.setPositions(new Float32Array(list.length * SEG * 6));
  const baseOp = theme.edgeBase ? theme.edgeBase(t, EALPHA) : EALPHA[t];
  const m = mkLineMat({ color: ecolor(t), linewidth: 1.25, opacity: baseOp, dashed: t === 'imports', dashSize: 1.6, gapSize: 1.2 });
  const l = new LineSegments2(g, m);
  l.frustumCulled = false;
  scene.add(l);
  idle[t] = { l, g, list, base: baseOp };
});
const hl = { l: null, g: null, list: [] };
let edgeGen = 0;
let edgeStamp = '';
function setHighlight(list) {
  edgeGen += 1;
  if (hl.l) {
    scene.remove(hl.l);
    hl.g.dispose();
    const idx = lineMats.indexOf(hl.l.material);
    if (idx >= 0) lineMats.splice(idx, 1);
    hl.l.material.dispose();
  }
  hl.list = list;
  if (!list.length) {
    hl.l = null;
    hl.g = null;
    return;
  }
  const g = new LineSegmentsGeometry();
  g.setPositions(new Float32Array(list.length * SEG_HL * 6));
  const col = new Float32Array(list.length * SEG_HL * 6);
  list.forEach((x, i) => {
    const c = new THREE.Color(ecolor(x.t, true));
    for (let s = 0; s < SEG_HL; s++) col.set([c.r, c.g, c.b, c.r, c.g, c.b], (i * SEG_HL + s) * 6);
  });
  g.setColors(col);
  const m = mkLineMat({ vertexColors: true, linewidth: 2, opacity: 1 });
  const l = new LineSegments2(g, m);
  l.frustumCulled = false;
  l.renderOrder = 2;
  scene.add(l);
  Object.assign(hl, { l, g });
}
const arrows = new THREE.InstancedMesh(new THREE.ConeGeometry(0.55, 1.8, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }), 160);
arrows.count = 0;
arrows.frustumCulled = false;
scene.add(arrows);
const PULSE_N = 320;
const pulses = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), PULSE_N);
pulses.count = 0;
pulses.frustumCulled = false;
pulses.renderOrder = 3;
scene.add(pulses);
let PLAY = null;
const STEPCUR = new Set();
const STEP_MS = 2200;
const IC_PLAY = '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M3 2l7 4-7 4z"/></svg>';
const IC_PAUSE = '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M3 2h2v8H3zM7 2h2v8H7z"/></svg>';
const IC_BACK = '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M2 2h1.6v8H2zM10 2v8L4 6z"/></svg>';
function pulseGate(x, t, i) {
  if (PLAY && PLAY.k >= 0 && FOCUS === PLAY.id) {
    const cur = PLAY.S[PLAY.k][0];
    return x.e.mode === 'step' && x.e.order === cur && x.e.source === PLAY.id ? 1.7 : 0.22;
  }
  if (x.e.mode === 'conditional') {
    const s = Math.sin(t * 0.55 + i * 1.7);
    return s > 0 ? s ** 1.5 : 0;
  }
  return 1;
}
function pausePlay() {
  if (!PLAY) return;
  PLAY.playing = false;
  clearTimeout(PLAY.t);
}
function drawPulses(now) {
  const spec = theme.pulse;
  if (!spec || !hl.l || reduced || !FOCUS) {
    pulses.count = 0;
    return;
  }
  const t = now / 1000;
  let pi = 0;
  pulses.material.color.set(spec.color);
  hl.list.forEach((x, i) => {
    trimmed(x);
    const side = x.e.source === FOCUS ? 1 : -1;
    const len = A.distanceTo(B);
    for (let k = 0; k < spec.per && pi < PULSE_N; k++) {
      const u = ((t * spec.speed * 40) / Math.max(len, 20) + i * 0.377 + k / spec.per) % 1;
      curve(A, B, u, P0, 'focus', side);
      const gate = theme.id === 'galaxy' ? pulseGate(x, t, i) : 1;
      if (gate <= 0.02) continue;
      const sz = spec.size * (0.55 + 0.45 * Math.sin(u * Math.PI)) * Math.min(gate, 1.7);
      M4.compose(P0, Q.identity(), S.setScalar(sz));
      pulses.setMatrixAt(pi, M4);
      pi += 1;
    }
  });
  pulses.count = pi;
  pulses.material.opacity = 1 - idleAlpha;
  pulses.instanceMatrix.needsUpdate = true;
}
function paintLabel(o, text) {
  if (theme.id === 'kitchen') {
    const html = rankBadge(o.k) + esc(text);
    if (o._h !== html) {
      o.el.innerHTML = html;
      o._h = html;
    }
    return;
  }
  if (o._h !== text) {
    o.el.textContent = text;
    o._h = text;
  }
}

const vf = THREE.MathUtils.degToRad(40);
const HOMECAM = theme.homeCam;
const vertExtent = theme.id === 'sphere' && SHAPE === 'rhombus' ? RMAX * YS : RMAX;
const fitDist = () => (theme.fitDist
  ? theme.fitDist(W(), H(), mobile(), vf)
  : (() => {
    const usable = H() - (mobile() ? 140 : 96);
    const ppu = (usable / 2) / (vertExtent * 1.04);
    return H() / (2 * Math.tan(vf / 2) * ppu) + RMAX * 0.18;
  })());
const homeViewX = () => (mobile() ? 0 : (theme.homeVX || 0));
const cam = { target: theme.sceneC.clone(), dist: fitDist(), az: HOMECAM.az, el: HOMECAM.el, min: 60, max: theme.homeMax || 1400 };
let viewX = homeViewX();
let viewY = 0;
let centreReady = false;
const DAMP = 0.08;
let spinAz = 0;
let spinEl = 0;
function stopSpin() {
  spinAz = 0;
  spinEl = 0;
}
function easeCentre() {
  if (!theme.centreTarget) return;
  const want = theme.centreTarget();
  if (!centreReady || reduced) {
    viewX = want.x;
    viewY = want.y;
    centreReady = true;
    return;
  }
  const now = performance.now();
  const dt = Math.min(100, now - (easeCentre.t || now));
  easeCentre.t = now;
  const k = 1 - Math.exp(-dt / 220);
  const dx = want.x - viewX;
  const dy = want.y - viewY;
  viewX += dx * k;
  viewY += dy * k;
  if (Math.abs(dx) > 0.25 || Math.abs(dy) > 0.25) dirty = true;
}
function applyCam() {
  easeCentre();
  const { target: t, dist: d, az, el } = cam;
  camera.position.set(t.x + d * Math.cos(el) * Math.sin(az), t.y + d * Math.sin(el), t.z + d * Math.cos(el) * Math.cos(az));
  camera.lookAt(t);
  camera.setViewOffset(W(), H(), viewX, viewY, W(), H());
  if (theme.fog && (theme.id === 'kitchen' || theme.id === 'galaxy' || !(FOCUS && FS))) {
    const f = theme.fog(d, !!(FOCUS && FS), FS);
    scene.fog.near = f.near;
    scene.fog.far = f.far;
  } else if (FOCUS && FS) {
    scene.fog.near = d + FS.Rb * 0.6;
    scene.fog.far = FS.shell * 1.35;
  } else {
    scene.fog.near = d - RMAX * 0.1;
    scene.fog.far = d + RMAX * 2.4;
  }
  fill.position.copy(camera.position);
  camera.updateMatrixWorld();
}
function pan(dx, dy) {
  const k = cam.dist * 0.0012;
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  cam.target.addScaledVector(right, -dx * k);
  cam.target.addScaledVector(up, dy * k);
}
function rotateBy(dx, dy) {
  const h = H() || 1;
  const daz = -dx * ((2 * Math.PI * 0.6) / h);
  const del = dy * ((2 * Math.PI * 0.6) / h);
  if (camTw) {
    camTw.s.az += daz;
    camTw.e.az += daz;
    camTw.s.el = THREE.MathUtils.clamp(camTw.s.el + del, -1.2, 1.35);
    camTw.e.el = THREE.MathUtils.clamp(camTw.e.el + del, -1.2, 1.35);
  } else {
    spinAz += daz;
    spinEl += del;
  }
}

const V = new THREE.Vector3();
function screenOf(o) {
  const r = host.getBoundingClientRect();
  V.copy(o.pos).project(camera);
  const x = r.left + ((V.x + 1) / 2) * W();
  const y = r.top + ((1 - V.y) / 2) * H();
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const V2 = o.pos.clone().addScaledVector(up, o.sc).project(camera);
  return { x, y, rad: (Math.abs(V2.y - V.y) / 2) * H(), z: V.z };
}
const hiddenKinds = new Set();
const hiddenE = new Set();
function pick(x, y) {
  let best = null;
  let bd = 1e9;
  for (const o of N) {
    if (o.lmode === 'hide' || o.dim > 0.5 || hiddenKinds.has(o.k)) continue;
    const s = screenOf(o);
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < Math.max(s.rad + 6, 12) && d - s.z * 4 < bd) {
      bd = d - s.z * 4;
      best = o;
    }
  }
  return best;
}

let hovered = null;
let hoverApplied = undefined;
let pendingHover = null;
function edgeShown(x) {
  const so = NB.get(x.e.source);
  const to = NB.get(x.e.target);
  return !!(so && to && !hiddenKinds.has(so.k) && !hiddenKinds.has(to.k) && !hiddenE.has(x.t));
}
function bodyMoving(now) {
  return !!camTw || N.some((o) => o.dur && now - o.t0 < o.dur);
}
function applyHoverTarget(o) {
  if (!o) {
    for (const n of N) {
      n.dimFrom = n.dim;
      n.dimTo = 0;
      n.dimDur = 0;
    }
    setHighlight([]);
    return;
  }
  const keep = new Set([o.id]);
  for (const e of G.edges) {
    if (hiddenE.has(etype(e.type))) continue;
    if (e.source === o.id && NB.has(e.target) && !hiddenKinds.has(NB.get(e.target).k)) keep.add(e.target);
    if (e.target === o.id && NB.has(e.source) && !hiddenKinds.has(NB.get(e.source).k)) keep.add(e.source);
  }
  for (const n of N) {
    n.dimFrom = n.dim;
    n.dimTo = keep.has(n.id) ? 0 : 1;
    n.dimDur = 0;
  }
  setHighlight(E.filter((x) => (x.e.source === o.id || x.e.target === o.id) && edgeShown(x)));
}

const pointers = new Map();
let drag = null;
function pinchInfo() {
  const pts = [...pointers.values()];
  if (pts.length < 2) return null;
  return {
    dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
    mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
  };
}
host.addEventListener('contextmenu', (e) => e.preventDefault());
host.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
  if (!drag) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, button: e.button, moved: 0 };
  try { host.setPointerCapture(e.pointerId); } catch { /* already released */ }
});
host.addEventListener('pointerup', (e) => {
  const was = drag && drag.id === e.pointerId ? drag : null;
  const pinching = pointers.size >= 2;
  pointers.delete(e.pointerId);
  if (was && !pinching && pointers.size === 0 && was.moved <= 4 && was.button === 0) {
    stopSpin();
    const hit = pick(e.clientX, e.clientY);
    if (hit) go(hit.id, { push: true, focusTitle: true });
    else if (FOCUS) exitFocus();
  }
  if (drag && drag.id === e.pointerId) drag = null;
  if (pointers.size === 0) pendingHover = { x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' };
});
host.addEventListener('pointerleave', () => {
  if (pointers.size) return;
  pendingHover = null;
  if (hovered) {
    hovered = null;
    host.style.cursor = '';
    hoverApplied = undefined;
  }
});
host.addEventListener('pointercancel', (e) => {
  pointers.delete(e.pointerId);
  if (drag && drag.id === e.pointerId) drag = null;
});
host.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) {
    pendingHover = { x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' };
    return;
  }
  const prev = pointers.get(e.pointerId);
  const dx = e.clientX - prev.x;
  const dy = e.clientY - prev.y;
  const before = pinchInfo();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: prev.button });
  if (drag && drag.id === e.pointerId) drag.moved += Math.hypot(dx, dy);
  if (pointers.size >= 2 && before) {
    const after = pinchInfo();
    if (after && before.dist > 0) {
      cam.dist = THREE.MathUtils.clamp(cam.dist * (before.dist / after.dist), cam.min, cam.max);
      if (!FOCUS) pan(after.mid.x - before.mid.x, after.mid.y - before.mid.y);
    }
  } else if (prev.button === 2 || prev.button === 1) {
    if (!FOCUS) pan(dx, dy);
  } else if (prev.button === 0) {
    rotateBy(dx, dy);
  }
  dirty = true;
});
let wheeled = false;
host.addEventListener('wheel', (e) => {
  e.preventDefault();
  let dy = e.deltaY;
  if (e.deltaMode === 1) dy *= 16;
  else if (e.deltaMode === 2) dy *= 400;
  cam.dist = THREE.MathUtils.clamp(cam.dist * Math.exp(dy * 0.001), cam.min, cam.max);
  wheeled = true;
  dirty = true;
}, { passive: false });

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;
let FOCUS = null;
let FS = null;
let camTw = null;
let dirty = true;
let savedCam = null;
let idleAlpha = 1;
let idleTw = null;
let moreLbls = [];
function tweenNode(o, pos, sc, dim, delay, dur) {
  o.from.copy(o.pos);
  o.to.copy(pos);
  o.scFrom = o.sc;
  o.scTo = sc;
  o.dimFrom = o.dim;
  o.dimTo = dim;
  const t = performance.now() + (reduced ? 0 : delay);
  o.t0 = t;
  o.dur = reduced ? 0 : dur;
  o.dimT0 = t;
  o.dimDur = reduced ? 0 : dur;
  if (o.dur) window.__settled = false;
}
function camTo(t, dist, az, el, dur) {
  camTw = {
    s: { target: cam.target.clone(), dist: cam.dist, az: cam.az, el: cam.el },
    e: { target: t.clone(), dist, az, el },
    t0: performance.now(),
    dur: reduced ? 0 : dur,
  };
  window.__settled = false;
}

const GOLD = Math.PI * (3 - Math.sqrt(5));
const FL = {
  R0: 46, R_PER: 2, SHELL_IN: 0.82, SHELL_OUT: 1.12, H_SPAN: 0.9, STEP_MAX: 0.2, PSI_MAX: (55 * Math.PI) / 180, X_SCALE: 0.75, ROW_PX: 30, CAP: 36,
  R_MIN: 1.8, R_MAX: 3.2, R_SEL: 6.5, LABEL_PX: 170, DISPERSE_K: 4.5, SHELL_MIN: 520, SHELL_MAX: 1100, CARD_HALF: 176,
  REGROUP: 900, TRAVEL: 900, EXIT: 700, STAGGER: 14, STAGGER_MAX: 260, DISPERSE: 800, CARD_IN: 0.7, CARD_ANCHOR: 0.42, SHEET_ANCHOR: 0.27, SEL_PX: 28, LABEL_PX_M: 104,
  ...(theme.motion || {}),
};
function neighbours(id) {
  const inc = [];
  const out = [];
  for (const e of G.edges) {
    if (e.target === id && e.source !== id) inc.push({ id: e.source, e });
    if (e.source === id && e.target !== id) out.push({ id: e.target, e });
  }
  const outIds = new Set(out.map((x) => x.id));
  return { inc: inc.filter((x) => !outIds.has(x.id)), out };
}
function sortSide(list) {
  const order = [...ETYPES, 'other'];
  return list.sort((a, b) => (
    order.indexOf(etype(a.e.type)) - order.indexOf(etype(b.e.type))
    || KINDS.indexOf(kindOf(byId.get(a.id).kind)) - KINDS.indexOf(kindOf(byId.get(b.id).kind))
    || nm(a.id).localeCompare(nm(b.id))
  ));
}
function sideSlots(list, side, Rc, Rv, Uv, Dv, C, lane) {
  sortSide(list);
  let items = list;
  let more = 0;
  if (list.length > FL.CAP) {
    const groups = new Map();
    list.forEach((x) => {
      const t = etype(x.e.type);
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t).push(x);
    });
    const budget = FL.CAP - 1 - (groups.size - 1);
    items = [];
    for (const [, l] of groups) items.push(...l.slice(0, Math.max(3, Math.floor((budget * l.length) / list.length))));
    more = list.length - items.length;
  }
  const slots = [];
  let last = null;
  items.forEach((x) => {
    const t = etype(x.e.type);
    if (last !== null && t !== last) slots.push({ gap: true });
    slots.push(x);
    last = t;
  });
  if (more) slots.push({ more });
  const n = slots.length;
  const step = n > 1 ? Math.min((2 * FL.H_SPAN) / (n - 1), FL.STEP_MAX) : 0;
  const top = (step * (n - 1)) / 2;
  let j = 0;
  slots.forEach((s, k) => {
    const h = top - k * step;
    s.h = h;
    if (s.gap) return;
    const psi = (((j * GOLD) % (2 * FL.PSI_MAX)) + 2 * FL.PSI_MAX) % (2 * FL.PSI_MAX) - FL.PSI_MAX;
    const r = Rc * (j % 2 ? FL.SHELL_OUT : FL.SHELL_IN);
    const rho = Math.sqrt(Math.max(0, 1 - h * h));
    s.p = theme.slotPos
      ? theme.slotPos(C, h, side, lane, rho, r, psi, Rc, Rv, Uv, Dv, j)
      : C.clone()
        .addScaledVector(Uv, h * Rc)
        .addScaledVector(Rv, side * (lane + rho * r * Math.cos(psi) * FL.X_SCALE))
        .addScaledVector(Dv, rho * r * Math.sin(psi));
    j++;
  });
  return { slots, more };
}
function plateKitchen(id, C) {
  const Rv = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const Dv = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).normalize();
  const Rh = new THREE.Vector3(Rv.x, 0, Rv.z);
  if (Rh.lengthSq() < 1e-8) Rh.set(1, 0, 0);
  Rh.normalize();
  const Df = new THREE.Vector3(Dv.x, 0, Dv.z);
  if (Df.lengthSq() < 1e-8) Df.set(0, 0, 1);
  Df.normalize();
  const Y = new THREE.Vector3(0, 1, 0);
  const m = mobile();
  const { inc, out } = neighbours(id);
  const sortK = (list) => list.sort((a, b) => KINDS.indexOf(kindOf(byId.get(a.id).kind)) - KINDS.indexOf(kindOf(byId.get(b.id).kind)) || deg(b.id) - deg(a.id));
  const catOf = (nid) => {
    const k = kindOf(byId.get(nid).kind);
    return (k === 'reference' || k === 'script') ? 'ing' : k === 'principle' ? 'tech' : 'sta';
  };
  const grp = { ing: [], tech: [], sta: [] };
  sortK(out).forEach((x) => grp[catOf(x.id)].push(x));
  const up = sortK(inc).slice(0, 9);
  Object.keys(grp).forEach((key) => { grp[key] = grp[key].slice(0, 14); });
  const r1 = Math.max(20, (grp.ing.length * 9) / (2 * Math.PI));
  const r2 = Math.max(r1 + 15, (grp.tech.length * 10) / (2 * Math.PI));
  const r3 = Math.max(r2 + 15, (grp.sta.length * 12) / Math.PI);
  const at = (a, r, y) => C.clone().addScaledVector(Rh, Math.sin(a) * r).addScaledVector(Df, Math.cos(a) * r).addScaledVector(Y, y);
  const member = new Map([[id, { p: C.clone(), side: 0 }]]);
  const ringPlace = (list, r, y, a0, span, full) => list.forEach((x, i) => {
    const n = list.length;
    const a = full ? a0 + (i / n) * Math.PI * 2 : (n === 1 ? a0 + span / 2 : a0 + (span * i) / (n - 1));
    member.set(x.id, { p: at(a, r, y), side: 0 });
  });
  ringPlace(grp.ing, r1, -1, Math.PI / 2 + 0.35, 0, true);
  ringPlace(grp.tech, r2, 6, Math.PI / 2 + 0.35 + Math.PI / Math.max(1, grp.tech.length), 0, true);
  ringPlace(grp.sta, r3, 20, Math.PI * 0.55, Math.PI * 0.9, false);
  const upY = r3 * 0.5 + 22;
  const upW = Math.max(Math.min(r3, ((up.length - 1) * 16) / 2), ((up.length - 1) * 13) / 2);
  up.forEach((x, i) => {
    const t = up.length === 1 ? 0 : -upW + (2 * upW * i) / (up.length - 1);
    const st = up.length > 5 && i % 2 ? 1 : 0;
    member.set(x.id, { p: C.clone().addScaledVector(Rh, t).addScaledVector(Df, -r3 * 0.35 - st * 10).addScaledVector(Y, upY + st * 13), side: 0 });
  });
  const hw = Math.max(r3, upW) + 6;
  const el = cam.el;
  const top = Math.max((upY + (up.length > 5 ? 13 : 0)) * Math.cos(el) + r3 * 0.35 * Math.sin(el), r3 * Math.sin(el) + 14 * Math.cos(el)) + 8;
  const bot = Math.max(r2 * Math.sin(el) + 6, r1 * Math.sin(el) + 8);
  const visW = m ? W() - 24 : W() - 32 - 320 - 28;
  const ppu = Math.min((m ? H() * 0.54 : H() - 130) / (top + bot), (visW / 2 - (m ? 84 : 120)) / hw);
  const Rb = Math.hypot(hw, upY) + 4;
  const shell = THREE.MathUtils.clamp(Rb * FL.DISPERSE_K, FL.SHELL_MIN, FL.SHELL_MAX);
  const dist = H() / (2 * Math.tan(vf / 2) * ppu);
  theme._plateR = r1;
  if (theme.plate) {
    theme.plate.position.copy(C).add(new THREE.Vector3(0, -1 - Math.min(6, 32 / Math.max(ppu, 0.001)) * 0.62, 0));
    theme.plate.scale.set(r1 * 0.78, 1, r1 * 0.78);
  }
  return {
    member, inc, out, Rb, shell, dist, ppu, r3, Rh,
    viewX: m ? 0 : Math.round((320 + 28) / 2),
    viewY: m ? Math.round(H() / 2 - H() * 0.28) : Math.round((-(top - bot) / 2) * ppu) + 10,
  };
}
function focus(id, dur) {
  if (!NB.has(id)) return;
  if (!FOCUS) savedCam = { target: cam.target.clone(), dist: cam.dist, az: cam.az, el: cam.el };
  FOCUS = id;
  hoverApplied = undefined;
  const C = NB.get(id).pos.clone();
  let Rv = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  let Uv = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  let Dv = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).normalize();
  let faz = cam.az;
  let fel = cam.el;
  if (theme.focusBasis) {
    const basis = theme.focusBasis(C, cam);
    Rv = basis.Rv;
    Uv = basis.Uv;
    Dv = basis.Dv;
    faz = basis.az;
    fel = basis.el;
  }
  const m = mobile();
  let inc;
  let out;
  let member;
  let L = null;
  let Rt = null;
  let Rb;
  let shell;
  let dist;
  let ppu = 1;
  if (theme.id === 'kitchen') {
    const plated = plateKitchen(id, C);
    inc = plated.inc;
    out = plated.out;
    member = plated.member;
    Rb = plated.Rb;
    shell = plated.shell;
    dist = plated.dist;
    ppu = plated.ppu;
    viewX = plated.viewX;
    viewY = plated.viewY;
    theme._plateOn = kindOf(byId.get(id).kind) === 'playbook';
    FS = { Rc: plated.r3, Rb, shell, dist, Rv: plated.Rh.clone(), C };
  } else {
    theme._plateOn = false;
    if (theme.focusLayout) {
      const laid = theme.focusLayout({
        id, C, cam, camera, neighbours: neighbours(id),
        mobile: m, W: W(), H: H(), vf, byId, kindOf, deg, KINDS,
      });
      inc = laid.inc;
      out = laid.out;
      member = laid.member;
      Rb = laid.Rb;
      shell = laid.shell;
      dist = laid.dist;
      ppu = laid.ppu;
      if (!theme.centreTarget) {
        viewX = laid.viewX;
        viewY = laid.viewY;
      }
      FS = { Rc: laid.rOut || laid.Rb, Rb, shell, dist, Rv: laid.Rv.clone(), C, hwPx: laid.hwPx };
    } else {
    const visW = W() - 32;
    const visH = m ? H() * 0.5 - 24 : H() - 56 - 24;
    FL.CAP = Math.floor((visH * 0.86) / FL.ROW_PX);
    ({ inc, out } = neighbours(id));
    const nMax = Math.min(FL.CAP, Math.max(inc.length, out.length));
    const Rc = FL.R0 + FL.R_PER * nMax;
    const Xr = Rc * FL.SHELL_OUT * FL.X_SCALE + FL.R_MAX;
    const hs = FL.H_SPAN * Rc + FL.R_MAX + 4;
    let lane = 0;
    for (let it = 0; it < 5; it++) {
      ppu = Math.min(
        (m ? H() * FL.SHEET_ANCHOR - 64 : H() * FL.CARD_ANCHOR - 64) / hs,
        (visW / 2 - (m ? FL.LABEL_PX_M : FL.LABEL_PX)) / (lane + Xr),
      );
      lane = m ? 0 : FL.CARD_HALF / ppu;
    }
    L = sideSlots(inc, -1, Rc, Rv, Uv, Dv, C, lane);
    Rt = sideSlots(out, 1, Rc, Rv, Uv, Dv, C, lane);
    member = new Map([[id, { p: C.clone(), side: 0 }]]);
    [[L, -1], [Rt, 1]].forEach(([S, side]) => S.slots.forEach((s) => { if (s.id) member.set(s.id, { p: s.p, side }); }));
    Rb = Rc * FL.SHELL_OUT + lane + FL.R_MAX;
    shell = THREE.MathUtils.clamp(Rb * FL.DISPERSE_K, FL.SHELL_MIN, FL.SHELL_MAX);
    dist = H() / (2 * Math.tan(vf / 2) * ppu);
    FS = { Rc, Rb, shell, dist, Rv: Rv.clone(), C };
    viewX = 0;
    viewY = Math.round(H() / 2 - H() * (m ? FL.SHEET_ANCHOR : FL.CARD_ANCHOR));
    }
  }
  if (theme.camLimits) {
    const lim = theme.camLimits(Rb, dist, shell);
    cam.min = lim.min;
    cam.max = lim.max;
  } else {
    cam.min = Math.max(Rb * (theme.id === 'kitchen' ? 1.1 : 1.15), 40);
    cam.max = Math.min(dist * 2, shell * 0.6);
  }
  const fe = [...inc, ...out].filter((x) => member.has(x.id)).map((x) => E.find((y) => y.e === x.e)).filter(Boolean);
  setHighlight(fe);
  let k = 0;
  for (const o of N) {
    const mm = member.get(o.id);
    if (mm) {
      const sc = theme.focusScale
        ? theme.focusScale(o, ppu, id)
        : theme.id === 'kitchen'
          ? (o.id === id ? Math.min(o.k === 'router' ? 7 : 6, 32 / ppu) : THREE.MathUtils.clamp(o.r * 0.75, 2, 3.4))
          : (o.id === id
            ? Math.min(Math.max(FL.R_SEL, o.k === 'router' ? 7 : 0), FL.SEL_PX / ppu)
            : THREE.MathUtils.clamp(o.r * 0.8, FL.R_MIN, FL.R_MAX));
      tweenNode(o, mm.p, sc, 0, o.id === id ? 0 : Math.min(FL.STAGGER * (++k), FL.STAGGER_MAX), dur);
      o.lmode = o.id === id ? 'sel' : 'mem';
    } else {
      const v = o.pos.clone().sub(C);
      if (v.lengthSq() < 1) v.set(0, 1, 0);
      v.normalize();
      const j = 1 + 0.25 * ((((o.i || 0) * 0.618 + o.k.length * 0.13) % 1));
      if (theme.disperse) {
        const d = theme.disperse(o, C, v, shell * j);
        tweenNode(o, d.p, d.sc, 1, 0, FL.DISPERSE);
      } else tweenNode(o, C.clone().addScaledVector(v, shell * j), o.r * 1.2, 1, 0, FL.DISPERSE);
      o.lmode = 'hide';
    }
  }
  moreLbls.forEach((h) => scene.remove(h.lo));
  moreLbls = [];
  if (L && Rt) {
    [[L, -1], [Rt, 1]].forEach(([S, side]) => {
      const items = S.slots.filter((s) => s.id);
      if (!S.more || !items.length) return;
      const h = mkLabel('more-lbl', `+${S.more} more`, side < 0 ? 'ml' : 'mr');
      h.node = NB.get(items.at(-1).id);
      h.side = side;
      moreLbls.push(h);
    });
  }
  camTo(C, dist, faz, fel, dur);
  idleTw = { from: idleAlpha, to: 0, t0: performance.now(), dur: reduced ? 0 : (theme.idleMs ?? 300) };
  document.body.classList.add('focus');
  document.body.classList.remove('key-open');
  document.getElementById('keyBtn').setAttribute('aria-expanded', 'false');
  dirty = true;
}
function exitFocus() {
  if (!FOCUS) return;
  clearTimeout(go.t);
  stopSpin();
  FOCUS = null;
  trail = [];
  moreLbls.forEach((h) => scene.remove(h.lo));
  moreLbls = [];
  setHighlight([]);
  hideCard();
  renderTrail();
  hoverApplied = undefined;
  N.slice().reverse().forEach((o, i) => {
    tweenNode(o, vec(homes.get(o.id)), o.r, 0, Math.min(i * 2, FL.STAGGER_MAX / 2), FL.EXIT);
    o.lmode = 'home';
  });
  cam.min = 60;
  cam.max = theme.homeMax || 1400;
  if (!theme.centreTarget) {
    viewX = homeViewX();
    viewY = 0;
  }
  theme._plateOn = false;
  theme.clearFocus?.();
  const c = savedCam || { target: theme.sceneC.clone(), dist: fitDist(), az: HOMECAM.az, el: HOMECAM.el };
  camTo(c.target, c.dist, cam.az, c.el, FL.EXIT);
  idleTw = { from: idleAlpha, to: 1, t0: performance.now() + (reduced ? 0 : FL.EXIT * 0.4), dur: reduced ? 0 : 400 };
  document.body.classList.remove('focus');
  dirty = true;
}

let trail = [];
function go(id, { push = true, focusTitle = false } = {}) {
  if (!NB.has(id)) return;
  theme.onReset?.();
  dismissHint();
  stopSpin();
  const first = !FOCUS;
  if (push) {
    const at = trail.indexOf(id);
    if (at >= 0) trail = trail.slice(0, at + 1);
    else trail.push(id);
  }
  hideCard();
  focus(id, first ? FL.REGROUP : FL.TRAVEL);
  renderTrail();
  clearTimeout(go.t);
  const open = () => showCard(id, { focusTitle });
  go.t = setTimeout(open, reduced ? 0 : (first ? FL.REGROUP : FL.TRAVEL) * FL.CARD_IN);
}
function back({ focusTitle = false, restoreBack = false } = {}) {
  if (trail.length > 1) {
    trail.pop();
    go(trail.at(-1), { push: false, focusTitle });
    if (restoreBack) document.getElementById('backBtn')?.focus();
  } else exitFocus();
}
function renderTrail() {
  const el = document.getElementById('trail');
  if (!trail.length) {
    el.innerHTML = '';
    return;
  }
  const vis = trail.length > 5 ? [trail[0], null, ...trail.slice(-3)] : trail;
  el.innerHTML = `<button class="back" id="backBtn" type="button" title="Back (Backspace)"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 3.5 5 8l4.5 4.5"/></svg>${trail.length > 1 ? 'Back' : 'Map'}</button><span class="vsep"></span><ol>`
    + vis.map((id, i) => (id === null
      ? '<li><span style="color:var(--text-3);padding:0 4px">…</span></li>'
      : (i === vis.length - 1
        ? `<li aria-current="page"><span>${esc(nm(id))}</span></li>`
        : `<li><button type="button" data-id="${esc(id)}">${esc(trunc(nm(id), 22))}</button></li>`))).join('')
    + '</ol><span class="vsep"></span><button class="exit" type="button" title="Back to the map (Esc)" aria-label="Back to the map"><svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg></button>';
  el.querySelector('#backBtn').onclick = () => back({ focusTitle: true });
  el.querySelector('.exit').onclick = exitFocus;
  el.querySelectorAll('ol button').forEach((b) => { b.onclick = () => go(b.dataset.id, { push: true, focusTitle: true }); });
}

const pop = document.getElementById('pop');
let cardId = null;
const moreBags = new Map();
let moreN = 0;
function glyph(k, s = 14) {
  const kind = kindOf(k);
  if (META.glyph) return META.glyph(kind, s, color(k));
  const c = color(k);
  const h = s / 2;
  const p = {
    router: `<circle cx="${h}" cy="${h}" r="${h - 1.5}" fill="${c}"/>`,
    playbook: `<polygon points="${h},0.5 ${s - 3},${h} ${h},${s - 0.5} 3,${h}" fill="${c}"/>`,
    skill: `<polygon points="${s * 0.28},${s * 0.22} ${s * 0.72},${s * 0.22} ${s - 1},${s * 0.42} ${h},${s - 1} 1,${s * 0.42}" fill="${c}"/>`,
    principle: `<polygon points="${h},2 ${s - 1},${h} ${h},${s - 2} 1,${h}" fill="${c}"/>`,
    agent: `<polygon points="${s * 0.3},2 ${s * 0.7},2 ${s - 2},${s * 0.3} ${s - 2},${s * 0.7} ${s * 0.7},${s - 2} ${s * 0.3},${s - 2} 2,${s * 0.7} 2,${s * 0.3}" fill="${c}"/>`,
    automation: `<polygon points="${h},1.5 ${s - 1.5},${s - 2} 1.5,${s - 2}" fill="${c}"/>`,
    script: `<polygon points="${h},2.5 ${s - 2.5},${s - 2.5} 2.5,${s - 2.5}" fill="none" stroke="${c}" stroke-width="1.6"/>`,
    reference: `<polygon points="${h},1.5 ${s * 0.68},${h} ${h},${s - 1.5} ${s * 0.32},${h}" fill="${c}"/>`,
    other: `<circle cx="${h}" cy="${h}" r="${h - 3.5}" fill="${c}"/>`,
  }[kindOf(k)];
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="flex:none" aria-hidden="true">${p}</svg>`;
}
const CHIP_MAX = 6;
const CHIP_MAX_BOTH = 4;
function chipButton(id) {
  const node = byId.get(id);
  if (!node) return '';
  return `<button class="chip" type="button" data-id="${esc(id)}" title="${esc(nm(id))}">${glyph(node.kind, 10)}<span>${esc(nm(id))}</span></button>`;
}
function normQuote(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function routerRepeats(when, node) {
  const w = normQuote(when);
  if (w.length < 24 || !node) return false;
  return [node.description, oneLiner(node, G)].map(normQuote).filter((b) => b.length >= 24)
    .some((b) => b === w || b.startsWith(w) || w.startsWith(b));
}
function whenOf(card, other) {
  const e = G.edges.find((edge) => (
    ((edge.source === card && edge.target === other) || (edge.source === other && edge.target === card))
    && edge.mode === 'conditional' && edge.when
  ));
  if (!e) return null;
  const fromRouter = kindOf(byId.get(e.source)?.kind) === 'router' || kindOf(byId.get(e.target)?.kind) === 'router';
  const workflow = kindOf(byId.get(card)?.kind) === 'playbook' ? byId.get(card)
    : kindOf(byId.get(other)?.kind) === 'playbook' ? byId.get(other) : null;
  if (fromRouter && routerRepeats(e.when, workflow)) return null;
  return e.when;
}
const lcWhen = (w) => (/^[A-Z][a-z]/.test(w) ? w[0].toLowerCase() + w.slice(1) : w);
const COND_ICON = '<svg width="16" height="8" viewBox="0 0 16 8" aria-hidden="true"><path d="M1 6Q8 0 15 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2.2 2.2" stroke-linecap="round"/></svg>';
function chipGroup(title, ids, max) {
  if (!ids.length) return '';
  const sorted = ids.slice().sort((a, b) => (
    KINDS.indexOf(kindOf(byId.get(a)?.kind)) - KINDS.indexOf(kindOf(byId.get(b)?.kind))
    || deg(b) - deg(a)
  ));
  if (theme.id === 'galaxy') {
    const cond = sorted.filter((id) => whenOf(cardId, id));
    const plain = sorted.filter((id) => !whenOf(cardId, id));
    const nC = Math.min(cond.length, 3);
    const shown = plain.slice(0, Math.max(nC ? 2 : 0, max - nC));
    const rest = [...plain.slice(shown.length), ...cond.slice(nC)];
    let more = '';
    if (rest.length) {
      const key = String(++moreN);
      moreBags.set(key, rest);
      more = `<button class="chip more" type="button" data-more="${key}">+${rest.length} more</button>`;
    }
    const rows = cond.slice(0, nC).map((id) => {
      const w = whenOf(cardId, id);
      return `<div class="crow"><span class="w" title="${esc(w)}">${COND_ICON}When ${esc(trunc(lcWhen(w), 74))} →</span>${chipButton(id)}</div>`;
    }).join('');
    const chips = (shown.length || rest.length) ? `<div class="chips">${shown.map(chipButton).join('')}${more}</div>` : '';
    return `<div class="grp"><h3>${title}<span>${ids.length}</span></h3>${chips}${rows}</div>`;
  }
  const shown = sorted.slice(0, max);
  const rest = sorted.slice(max);
  let more = '';
  if (rest.length) {
    const key = String(++moreN);
    moreBags.set(key, rest);
    more = `<button class="chip more" type="button" data-more="${key}">+${rest.length} more</button>`;
  }
  return `<div class="grp"><h3>${title}<span>${ids.length}</span></h3><div class="chips">${shown.map(chipButton).join('')}${more}</div></div>`;
}
function whenLine(text, tag = 'span') {
  if (!text) return '';
  const label = /^(when|if|unless|before|after|only|apply)\b/i.test(text) ? '' : '<span class="k">When</span> ';
  return `<${tag} class="when">${label}${esc(text)}</${tag}>`;
}
function updPlay() {
  if (!PLAY) return;
  const b = pop.querySelector('#playBtn');
  const st = pop.querySelector('#pstat');
  if (!b || !st) return;
  const { S, k } = PLAY;
  const label = PLAY.playing ? 'Pause' : k >= S.length - 1 ? 'Replay' : k >= 0 ? 'Resume' : 'Play steps';
  b.innerHTML = `${PLAY.playing ? IC_PAUSE : IC_PLAY}<span>${label}</span>`;
  st.innerHTML = k < 0
    ? `${S.length} steps`
    : `<b>Step ${esc(String(S[k][0]))}</b> · ${esc(S[k][1].map((id) => nm(id)).slice(0, 2).join(', '))}${S[k][1].length > 2 ? ` +${S[k][1].length - 2}` : ''} <span class="pk">${k + 1}/${S.length}</span>`;
  dirty = true;
}
function advance() {
  if (!PLAY || !PLAY.playing) return;
  PLAY.k += 1;
  if (PLAY.k >= PLAY.S.length - 1) PLAY.playing = false;
  else PLAY.t = setTimeout(advance, reduced ? STEP_MS : STEP_MS);
  updPlay();
}
function bindPlay(id) {
  const b = pop.querySelector('#playBtn');
  if (!b) {
    PLAY = null;
    return;
  }
  const S = stepsOf(G, id);
  PLAY = { id, S, k: -1, playing: false, t: null };
  b.onclick = (e) => {
    e.stopPropagation();
    if (!PLAY) return;
    if (PLAY.playing) pausePlay();
    else {
      if (PLAY.k >= PLAY.S.length - 1) PLAY.k = -1;
      PLAY.playing = true;
      advance();
    }
    updPlay();
  };
  const back = pop.querySelector('#stepBack');
  if (back) back.onclick = (e) => {
    e.stopPropagation();
    if (!PLAY) return;
    pausePlay();
    PLAY.k = Math.max(0, PLAY.k - 1);
    updPlay();
  };
  updPlay();
}
function showCard(id, { focusTitle = false } = {}) {
  const n = byId.get(id);
  if (!n || FOCUS !== id) return;
  cardId = id;
  const k = kindOf(n.kind);
  const { inc, out } = neighbours(id);
  const uniq = (list) => [...new Set(list.map((x) => x.id))];
  const outE = G.edges.filter((e) => e.source === id);
  const inE = G.edges.filter((e) => e.target === id);
  const conn = [...outE.map((e) => ({ e, o: e.target, dir: '→' })), ...inE.map((e) => ({ e, o: e.source, dir: '←' }))];
  const tryIt = (k === 'skill' || k === 'router') ? `<div class="try">Try it: <code>/${esc(n.id)}</code></div>` : '';
  const file = String(n.path || '').replace(/^pstack\//, '');
  const lines = Number.isFinite(n.lines) ? String(n.lines) : '—';
  const src = String(U?.sourceUrlTemplate || '').replace('{path}', n.path || '');
  const uses = uniq(out);
  const used = uniq(inc);
  const mx = uses.length && used.length ? CHIP_MAX_BOTH : CHIP_MAX;
  const role = META.role?.[k];
  const badge = theme.id === 'kitchen' ? rankBadge(k) : '';
  const eye = role
    ? `${glyph(n.kind, 12)}${badge}${esc(role)} <span style="color:var(--text-3)">· ${esc(FRIENDLY[k][0])}</span>`
    : `${glyph(n.kind, 12)}${esc(FRIENDLY[k][0])}`;
  const applies = theme.id === 'galaxy' && n.appliesWhen ? `<p class="applies">${esc(n.appliesWhen)}</p>` : '';
  const steps = theme.id === 'galaxy' ? stepsOf(G, n.id) : [];
  const player = steps.length > 1
    ? `<div class="play"><button class="pbtn" id="playBtn" type="button">${IC_PLAY}<span>Play steps</span></button><button class="pico" id="stepBack" type="button" aria-label="Step back" title="Step back">${IC_BACK}</button><span class="pstat" id="pstat" aria-live="polite">${steps.length} steps</span></div>`
    : '';
  pop.innerHTML = `<div class="caret"></div><div class="pop-scroll"><div class="pop-head"><div class="eyebrow">${eye}</div>
    <button class="x" type="button" aria-label="Close (Esc)"><svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg></button>
    <h2 id="popTitle" tabindex="-1">${esc(nm(id))}</h2></div><p class="what">${esc(oneLiner(n, G))}</p>${applies}${player}${tryIt}
    ${chipGroup('Uses', uses, mx)}${chipGroup('Used by', used, mx)}
    <div class="pop-foot"><button class="link" id="detBtn" type="button" aria-expanded="false" aria-controls="det">Details <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 4.5 6 7.5 9 4.5"/></svg></button>
      <span style="font-size:12px;color:var(--text-3)">${inc.length + out.length} connections</span></div>
    <div class="details" id="det"><dl><dt>Type</dt><dd>${esc(n.kind)}</dd><dt>ID</dt><dd>${esc(n.id)}</dd><dt>File</dt><dd title="${esc(n.path || '')}">${esc(file)}</dd><dt>Lines</dt><dd>${esc(lines)}</dd></dl>
      ${whenLine(n.appliesWhen, 'p')}
      <h4>Connections</h4>${conn.slice(0, 8).map(({ e, o, dir }) => {
        const ev = e.evidence?.[0];
        const evHtml = ev ? `<span class="ev">${esc(String(ev.path || '').replace(/^pstack\//, ''))}:${esc(ev.line)}</span>` : '';
        return `<div class="conn"><span class="t">${esc(dir)} ${esc(e.type)}</span><span class="n">${esc(nm(o))}</span>${whenLine(e.when)}${evHtml}</div>`;
      }).join('')}
      ${conn.length > 8 ? `<div class="conn"><span class="t" style="grid-column:1/3">+${conn.length - 8} more connections</span></div>` : ''}
      <a class="btn src" href="${esc(src)}" target="_blank" rel="noopener">View source <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M4.5 2.5h5v5M9.5 2.5 3 9"/></svg></a></div></div>`;
  if (theme.id === 'galaxy') bindPlay(id);
  if (qs.get('details') === '1' && !showCard.openedDetails) {
    showCard.openedDetails = true;
    pop.classList.add('expanded');
    pop.querySelector('#detBtn')?.setAttribute('aria-expanded', 'true');
  }
  placeCard();
  pop.classList.add('show');
  if (pop.classList.contains('expanded')) requestAnimationFrame(revealDetails);
  if (focusTitle) pop.querySelector('#popTitle')?.focus({ preventScroll: true });
}
function revealDetails() {
  const sc = pop.querySelector('.pop-scroll');
  const d = pop.querySelector('#det');
  const head = pop.querySelector('.pop-head');
  const foot = pop.querySelector('.pop-foot');
  if (!sc || !d || !head || !foot) return;
  sc.scrollTo({ top: d.offsetTop - head.offsetHeight - foot.offsetHeight - 16, behavior: reduced ? 'auto' : 'smooth' });
}
function hideCard() {
  pausePlay();
  PLAY = null;
  STEPCUR.clear();
  pop.classList.remove('show', 'expanded');
  cardId = null;
}
function placeCard() {
  if (!cardId || mobile()) return;
  if (theme.dockCard) {
    theme.dockCard({ pop, screenOf, cardId, NB, FS, THREE });
    return;
  }
  const o = NB.get(cardId);
  if (!o) return;
  const s = screenOf(o);
  const gap = 14;
  const inset = 16;
  pop.style.maxHeight = '';
  const top0 = document.querySelector('header').offsetHeight + 16 + 40 + 8;
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  const r = Math.max(s.rad * 1.5, 10);
  const cands = [['below', s.x - w / 2, s.y + r + gap], ['above', s.x - w / 2, s.y - r - gap - h], ['side', s.x + r + gap + 40, s.y - h / 2], ['side', s.x - r - gap - 40 - w, s.y - h / 2]];
  const fits = ([, x, y]) => x >= inset && y >= top0 && x + w <= innerWidth - inset && y + h <= innerHeight - inset;
  const room = innerHeight - inset - (s.y + r + gap);
  if (!cands.slice(0, 2).some(fits) && room >= 240) {
    pop.style.maxHeight = Math.floor(room) + 'px';
    cands[0][2] = s.y + r + gap;
  }
  const hh = pop.offsetHeight;
  cands.forEach((c) => { if (c[0] === 'side') c[2] = s.y - hh / 2; });
  const found = cands.find(([, x, y]) => x >= inset && y >= top0 && x + w <= innerWidth - inset && y + pop.offsetHeight <= innerHeight - inset) || cands[0];
  let [side, x, y] = found;
  x = THREE.MathUtils.clamp(x, inset, innerWidth - inset - w);
  y = THREE.MathUtils.clamp(y, top0, innerHeight - inset - pop.offsetHeight);
  pop.className = pop.className.replace(/\b(below|above|side)\b/g, '').trim() + ' ' + side;
  pop.style.left = Math.round(x) + 'px';
  pop.style.top = Math.round(y) + 'px';
  pop.style.setProperty('--cx', Math.round(THREE.MathUtils.clamp(s.x - x, 20, w - 20)) + 'px');
}
pop.addEventListener('click', (e) => {
  const more = e.target.closest('.chip.more');
  if (more) {
    const ids = moreBags.get(more.dataset.more) || [];
    more.insertAdjacentHTML('beforebegin', ids.map(chipButton).join(''));
    more.remove();
    placeCard();
    return;
  }
  const chip = e.target.closest('.chip[data-id]');
  if (chip) {
    go(chip.dataset.id, { push: true, focusTitle: true });
    return;
  }
  if (e.target.closest('.x')) {
    exitFocus();
    return;
  }
  const det = e.target.closest('#detBtn');
  if (det) {
    const on = !pop.classList.contains('expanded');
    pop.classList.toggle('expanded', on);
    det.setAttribute('aria-expanded', String(on));
    placeCard();
    if (on) revealDetails();
  }
});

const M4 = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const S = new THREE.Vector3();
const Cc = new THREE.Color();
const DIM = new THREE.Color(css('--dim'));
const SMALLK = ['script', 'reference'];
const PRI = { router: 0, playbook: 2, principle: 3, skill: 3, agent: 3, automation: 3, other: 4, script: 5, reference: 5 };
const A = new THREE.Vector3();
const B = new THREE.Vector3();
const P0 = new THREE.Vector3();
const P1 = new THREE.Vector3();
const T = new THREE.Vector3();
function curve(a, b, t, out, mode, side) {
  if (theme.curve) return theme.curve(a, b, t, out, mode, side, FS);
  if (mode === 'focus' && FS) {
    const len = a.distanceTo(b);
    const c1 = a.clone();
    const c2 = b.clone();
    const sv = FS.Rv.clone().multiplyScalar(side);
    if (side > 0) {
      c1.addScaledVector(sv, len * 0.5);
      c2.addScaledVector(b.clone().sub(a).normalize(), -len * 0.25);
    } else {
      c1.addScaledVector(a.clone().sub(b).normalize(), len * 0.25);
      c2.addScaledVector(sv, len * 0.5);
    }
    const mt = 1 - t;
    return out.copy(a).multiplyScalar(mt * mt * mt).addScaledVector(c1, 3 * mt * mt * t).addScaledVector(c2, 3 * mt * t * t).addScaledVector(b, t * t * t);
  }
  const len = a.distanceTo(b);
  const m = T.copy(a).add(b).multiplyScalar(0.5);
  const ml = m.length();
  if (ml > 1e-3) m.multiplyScalar(1 + (len * 0.14) / ml);
  else m.y += len * 0.14;
  const mt = 1 - t;
  return out.set(a.x * mt * mt + 2 * m.x * mt * t + b.x * t * t, a.y * mt * mt + 2 * m.y * mt * t + b.y * t * t, a.z * mt * mt + 2 * m.z * mt * t + b.z * t * t);
}
function trimmed(x) {
  const so = NB.get(x.e.source);
  const to = NB.get(x.e.target);
  const d = new THREE.Vector3().copy(to.pos).sub(so.pos);
  if (d.lengthSq() < 1e-8) d.set(1, 0, 0);
  d.normalize();
  A.copy(so.pos).addScaledVector(d, so.sc * 1.05);
  B.copy(to.pos).addScaledVector(d, -to.sc * 1.05);
  return { so, to };
}
function writeEdges(list, geo, mode) {
  const arr = geo.attributes.instanceStart.data.array;
  const SG = mode === 'focus' ? SEG_HL : SEG;
  list.forEach((x, i) => {
    const { so, to } = trimmed(x);
    const side = mode === 'focus' ? (x.e.source === FOCUS ? 1 : -1) : 0;
    const hide = mode === 'home' && (hiddenKinds.has(so.k) || hiddenKinds.has(to.k) || hiddenE.has(x.t) || theme.hideHomeEdge?.(x));
    const dash = !!theme.dashEdge?.(x);
    for (let s = 0; s < SG; s++) {
      if (hide || (dash && s % 3)) {
        arr.fill(0, (i * SG + s) * 6, (i * SG + s) * 6 + 6);
        continue;
      }
      curve(A, B, s / SG, P0, mode, side);
      curve(A, B, (s + 1) / SG, P1, mode, side);
      arr.set([P0.x, P0.y, P0.z, P1.x, P1.y, P1.z], (i * SG + s) * 6);
    }
  });
  geo.attributes.instanceStart.data.needsUpdate = true;
}
let lastBusy = 0;
let pending = 0;
let booted = false;
function edgeMode() {
  return FOCUS && FS ? 'focus' : 'home';
}
let rafOn = true;
let lastRender = 0;
let lastInput = performance.now();
function wake() {
  lastInput = performance.now();
  if (document.hidden || rafOn) return;
  rafOn = true;
  requestAnimationFrame(frame);
}
const ORBIT_IDLE = 8000;
function frameMode(now) {
  if (document.hidden) return 'stop';
  const live = !!(camTw || idleTw || spinAz || spinEl || drag || pointers.size || pendingHover || pending || (PLAY && PLAY.playing) || bodyMoving(now));
  if (live || now - lastInput < 160) return 'full';
  if (dirty) return 'full';
  if (!reduced && theme.ambientMotion?.() && now - lastInput < ORBIT_IDLE) return 'ambient';
  return 'stop';
}
function frame(now) {
  const mode = frameMode(now);
  if (mode === 'stop') {
    rafOn = false;
    return;
  }
  if (mode === 'ambient' && now - lastRender < 32) {
    requestAnimationFrame(frame);
    return;
  }
  lastRender = now;
  const t0 = performance.now();
  try {
    frameBody(now);
  } catch (err) {
    console.error(err);
  }
  const cost = performance.now() - t0;
  noteFrame(cost);
  paintPerf(cost);
  if (document.hidden || frameMode(performance.now()) === 'stop') {
    rafOn = false;
    return;
  }
  requestAnimationFrame(frame);
}
function frameBody(now) {
  if (pendingHover && !(drag && drag.moved > 4)) {
    const next = pendingHover.touch ? null : pick(pendingHover.x, pendingHover.y);
    if (next !== hovered) {
      hovered = next;
      host.style.cursor = next ? 'pointer' : '';
      hoverApplied = undefined;
    }
    pendingHover = null;
  }
  if (!FOCUS && !bodyMoving(now)) {
    const key = hovered ? hovered.id : '';
    if (hoverApplied !== key) {
      hoverApplied = key;
      applyHoverTarget(hovered);
      dirty = true;
    }
  } else hoverApplied = undefined;

  let anyAnim = false;
  if (camTw) {
    const p = camTw.dur ? Math.min(1, (now - camTw.t0) / camTw.dur) : 1;
    const e = ease(p);
    cam.target.lerpVectors(camTw.s.target, camTw.e.target, e);
    cam.dist = THREE.MathUtils.lerp(camTw.s.dist, camTw.e.dist, e);
    cam.az = THREE.MathUtils.lerp(camTw.s.az, camTw.e.az, e);
    cam.el = THREE.MathUtils.lerp(camTw.s.el, camTw.e.el, e);
    if (p >= 1) camTw = null;
    anyAnim = true;
  } else if (spinAz || spinEl) {
    cam.az += spinAz * DAMP;
    cam.el = THREE.MathUtils.clamp(cam.el + spinEl * DAMP, -1.2, 1.35);
    spinAz *= 1 - DAMP;
    spinEl *= 1 - DAMP;
    if (Math.abs(spinAz) < 1e-4) spinAz = 0;
    if (Math.abs(spinEl) < 1e-4) spinEl = 0;
    anyAnim = true;
    dirty = true;
  }
  if (idleTw) {
    const p = idleTw.dur ? THREE.MathUtils.clamp((now - idleTw.t0) / idleTw.dur, 0, 1) : (now >= idleTw.t0 ? 1 : 0);
    idleAlpha = THREE.MathUtils.lerp(idleTw.from, idleTw.to, p);
    if (p >= 1 && now >= idleTw.t0) idleTw = null;
    anyAnim = true;
  }
  theme.beforeCam?.();
  applyCam();
  const nodesMoving = N.some((o) => (o.dur && now < o.t0 + o.dur) || (o.dimDur && now < o.dimT0 + o.dimDur));
  if (nodesMoving) anyAnim = true;
  const pose = anyAnim || dirty;
  if (pose) for (const o of N) {
    const p = o.dur ? THREE.MathUtils.clamp((now - o.t0) / o.dur, 0, 1) : 1;
    const dp = o.dimDur ? THREE.MathUtils.clamp((now - o.dimT0) / o.dimDur, 0, 1) : 1;
    if (p < 1 || dp < 1) anyAnim = true;
    const e = ease(p);
    o.pos.lerpVectors(o.from, o.to, e);
    o.sc = THREE.MathUtils.lerp(o.scFrom, o.scTo, e);
    o.dim = THREE.MathUtils.lerp(o.dimFrom, o.dimTo, easeOut(dp));
    o.prog = p;
    const hid = !FOCUS && hiddenKinds.has(o.k);
    if (o.mesh) {
      o.mesh.position.copy(o.pos);
      o.mesh.scale.setScalar(hid ? 0 : o.sc);
      if (theme.routerDim) theme.routerDim(o.dim, DIM);
      else if (starMat) starMat.uniforms.dim.value = o.dim;
      continue;
    }
    Q.setFromEuler(o.rot);
    M4.compose(o.pos, Q, S.setScalar(hid ? 0 : o.sc));
    o.im.setMatrixAt(o.i, M4);
    Cc.copy(o.base).lerp(DIM, o.dim * (FOCUS ? 0.9 : 0.85));
    o.im.setColorAt(o.i, Cc);
  }
  if (pose) Object.values(inst).forEach((im) => {
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });
  if (pose) sunLight.position.copy(starNode.pos);
  if (pose) decor.forEach((d) => {
    d.s.position.copy(d.o.pos);
    d.s.scale.setScalar(d.o.sc * d.f);
    d.s.material.opacity = d.op * (1 - d.o.dim);
    d.s.visible = !(hiddenKinds.has(d.o.k) && !FOCUS);
  });
  if (pose) pring.forEach((p) => {
    p.m.position.copy(p.o.pos);
    p.m.scale.setScalar(p.o.sc);
    p.m.material.opacity = 0.32 * (1 - p.o.dim);
    p.m.visible = !(hiddenKinds.has(p.o.k) && !FOCUS);
  });
  guides.forEach((l) => {
    if (l.userData?.limb) l.quaternion.copy(camera.quaternion);
    if (!pose) return;
    const ga = (theme.gkeep || 0) + (1 - (theme.gkeep || 0)) * idleAlpha;
    const base = l.userData?.op ?? (l.isLineSegments2 ? 1 : 0.035);
    if (l.material) l.material.opacity = base * ga;
    l.visible = ga > 0.01;
  });
  theme.tick?.(idleAlpha);
  if (theme.plate) theme.plate.visible = !!(FOCUS && theme._plateOn);
  if (FOCUS && theme.showSel !== false) {
    const f = NB.get(FOCUS);
    selRing.position.copy(f.pos);
    selRing.quaternion.copy(camera.quaternion);
    selRing.scale.setScalar(f.sc);
    selRing.material.opacity = f.prog > 0.8 ? 0.7 : 0;
  } else selRing.material.opacity = 0;
  const mode = edgeMode();
  if (anyAnim || dirty) {
    let stamp = edgeGen + '|' + mode + '|' + (FOCUS || '');
    hiddenKinds.forEach((k) => { stamp += '|' + k; });
    for (let i = 0; i < N.length; i++) {
      const p = N[i].pos;
      stamp += '|' + Math.round(p.x * 4) + ',' + Math.round(p.y * 4) + ',' + Math.round(p.z * 4);
    }
    if (stamp !== edgeStamp) {
      edgeStamp = stamp;
      for (const t of Object.keys(idle)) {
        const I = idle[t];
        writeEdges(I.list, I.g, 'home');
        if (t === 'imports') I.l.computeLineDistances();
      }
      if (hl.l) writeEdges(hl.list, hl.g, mode);
    }
  }
  const hoverMul = hovered && !FOCUS ? 0.15 : 1;
  for (const t of Object.keys(idle)) {
    idle[t].l.material.opacity = idle[t].base * idleAlpha * hoverMul;
    idle[t].l.visible = idleAlpha > 0.01 && !hiddenE.has(t);
  }
  let ai = 0;
  if (hl.l) {
    const hlFade = FOCUS ? 1 - idleAlpha : 1;
    hl.l.material.opacity = hlFade;
    hl.l.material.transparent = hlFade < 0.999;
    hl.l.visible = hlFade > 0.01;
    for (const x of hl.list) {
      if (ai >= 160) break;
      trimmed(x);
      const side = mode === 'focus' ? (x.e.source === FOCUS ? 1 : -1) : 0;
      curve(A, B, 0.94, P0, mode, side);
      const d = T.copy(B).sub(P0);
      if (d.lengthSq() < 1e-8) continue;
      d.normalize();
      M4.compose(B.clone().addScaledVector(d, -0.9), Q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d), S.setScalar(1));
      arrows.setMatrixAt(ai, M4);
      arrows.setColorAt(ai, new THREE.Color(ecolor(x.t, true)));
      ai++;
    }
  }
  arrows.count = ai;
  arrows.material.opacity = hl.l ? (FOCUS ? 1 - idleAlpha : 1) : 0;
  if (pose) {
    arrows.instanceMatrix.needsUpdate = true;
    if (arrows.instanceColor) arrows.instanceColor.needsUpdate = true;
  }
  if (pose || FOCUS) drawPulses(now);
  const rev = labelSignature();
  if (pose || rev !== labelRev) {
    labelRev = rev;
    const camDir = T.copy(camera.position).sub(cam.target).normalize();
    const fd = fitDist();
    const cx = FOCUS ? (LP.copy(NB.get(FOCUS).pos).project(camera), LP.x) : 0;
    RV.setFromMatrixColumn(camera.matrixWorld, 0);
    for (const o of N) {
      if (FOCUS) {
        if (o.lmode === 'hide' || o.lmode === 'sel') {
          o.lo.visible = false;
          continue;
        }
        LP.copy(o.pos).project(camera);
        const left = LP.x < cx;
        setAnchor(o, left ? 'l' : 'r');
        const cls = 'lbl' + (SMALLK.includes(o.k) ? ' small' : '') + ((o === hovered || STEPCUR.has(o.id)) ? ' hover' : '');
        if (o.el.className !== cls) o.el.className = cls;
        paintLabel(o, trunc(nm(o.id), mobile() ? 16 : 30));
        o.lo.position.copy(o.pos).addScaledVector(RV, (left ? -1 : 1) * (o.sc * 1.2 + 0.8));
        o.anc.style.opacity = (o.prog > 0.6 || reduced) ? 1 : 0;
        o.lo.visible = !labelOff(o.lo.position);
      } else {
        setAnchor(o, 'c');
        o.anc.style.opacity = 1;
        const cls = 'lbl ' + (o.k === 'router' ? 'router' : SMALLK.includes(o.k) ? 'small' : '') + (o === hovered ? ' hover' : '');
        if (o.el.className !== cls) o.el.className = cls;
        paintLabel(o, trunc(nm(o.id)));
        const front = theme.front ? theme.front(o, camDir) : o.pos.dot(camDir) > -0.15 * o.pos.length();
        const tier = theme.labelTier ? theme.labelTier(o, hovered) : (o.k === 'router' || o === hovered ? 0 : o.k === 'playbook' || deg(o.id) >= 14 ? 1 : SMALLK.includes(o.k) ? 3 : 2);
        const zoomOk = tier <= 1 || (tier === 2 && cam.dist < fd * 0.62) || (tier === 3 && cam.dist < fd * 0.42);
        const zoneOk = theme.inZone ? theme.inZone(o) : true;
        o.lo.position.copy(o.pos);
        o.lo.position.y += theme.labelDy ? theme.labelDy(o) : -o.sc * 1.35;
        o.lo.visible = !hiddenKinds.has(o.k) && zoneOk && (o.k === 'router' || o === hovered || (front && zoomOk)) && !labelOff(o.pos);
      }
    }
    theme.syncSteps?.({ focus: FOCUS, play: PLAY, nodes: NB, camera, idleAlpha, hot: STEPCUR });
    moreLbls.forEach((h) => {
      if (!h.node) return;
      h.lo.position.copy(h.node.pos).addScaledVector(RV, h.side * (h.node.sc * 1.2 + 0.8));
      h.lo.visible = !labelOff(h.lo.position);
    });
    labelR.render(scene, camera);
    declutter();
  }
  const coasting = Math.abs(spinAz) > 0.008 || Math.abs(spinEl) > 0.008;
  if (setViewMoving(!!(drag || camTw || coasting || pointers.size || wheeled))) applyView();
  wheeled = false;
  if (theme.renderFrame) theme.renderFrame(renderer, scene, camera);
  else renderer.render(scene, camera);
  if (cardId && (anyAnim || dirty)) placeCard();
  dirty = false;
  if (anyAnim || pending > 0) lastBusy = now;
  window.__settled = now - lastBusy > 500;
  if (!booted) {
    booted = true;
    document.getElementById('boot')?.remove();
    window.__ready = true;
  }
  if (qs.has('debug')) document.getElementById('debug').textContent = `${renderer.info.render.calls} calls · ${renderer.info.render.triangles} tris`;
}
const LP = new THREE.Vector3();
const RV = new THREE.Vector3();
let labelRev = '';
function labelOff(pos) {
  LP.copy(pos).project(camera);
  return LP.z < -1 || LP.z > 1 || Math.abs(LP.x) > 1.12 || Math.abs(LP.y) > 1.12;
}
function labelSignature() {
  const e = camera.matrixWorld.elements;
  return [
    FOCUS || '', hovered ? hovered.id : '', cardId || '',
    PLAY ? String(PLAY.k) + (PLAY.playing ? 'p' : '') : '',
    hiddenKinds.size, hiddenE.size,
    cam.dist.toFixed(1), idleAlpha.toFixed(2),
    e[12].toFixed(1), e[13].toFixed(1), e[14].toFixed(1),
    e[2].toFixed(3), e[6].toFixed(3), e[10].toFixed(3),
    Math.round(viewX), Math.round(viewY),
  ].join('|');
}
const perfBuf = new THREE.Vector2();
let perfEl = null;
let perfPaint = 0;
if (qs.has('perf')) {
  perfEl = document.createElement('div');
  perfEl.id = 'perf';
  perfEl.setAttribute('aria-hidden', 'true');
  perfEl.style.cssText = 'position:fixed;top:68px;left:16px;z-index:40;font:12px/17px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#ECEEF4;background:rgba(3,4,10,.84);padding:8px 10px;border-radius:8px;pointer-events:none;white-space:pre;border:1px solid rgba(255,255,255,.14)';
  document.body.appendChild(perfEl);
}
function paintPerf(cost) {
  const s = frameStats();
  window.__perf = { ...s, cost, gfx: theme.gfx?.() || null };
  if (!perfEl || performance.now() - perfPaint < 250) return;
  perfPaint = performance.now();
  const g = window.__perf.gfx || {};
  renderer.getDrawingBufferSize(perfBuf);
  perfEl.textContent = [
    `frame ${cost.toFixed(1)} ms   avg ${s.avg.toFixed(1)} ms`,
    `calls ${g.calls ?? '—'}   tris ${g.tris ?? '—'}`,
    `dpr ${renderer.getPixelRatio().toFixed(2)}   buf ${perfBuf.x}×${perfBuf.y}`,
    `bloom ${g.bloom ? (g.bloomSize ? g.bloomSize.join('×') : 'on') : 'off'}`,
    `disk ${g.disk || '—'}   gfx ${g.gfx || s.gfx || '—'}`,
    g.bhSize ? `bh ${g.bhSize.join('×')}  steps ${g.bhSteps ?? '—'}  ${g.bhCached ? 'cached' : 'marched'}  adapt ${g.adapt ?? 0}` : '',
  ].join('\n');
}
function setAnchor(o, a) {
  if (o.anchorMode !== a) {
    o.anc.className = 'anc ' + a + ' fade';
    o.anchorMode = a;
  }
}
function declutter() {
  const items = [];
  for (const o of N) {
    o.el.style.visibility = '';
    if (!o.lo.visible) continue;
    const p = o === hovered ? -2 : FOCUS ? 1 : PRI[o.k] - (deg(o.id) >= 14 ? 0.5 : 0);
    items.push({ o, p, d: camera.position.distanceTo(o.pos) });
  }
  items.sort((a, b) => a.p - b.p || a.d - b.d);
  const placed = [];
  if (cardId && pop.classList.contains('show')) placed.push(pop.getBoundingClientRect());
  if (!FOCUS) {
    const st = screenOf(starNode);
    const rr = st.rad * 1.15;
    placed.push({ left: st.x - rr, right: st.x + rr, top: st.y - rr, bottom: st.y + rr * 0.6 });
  }
  for (const it of items) {
    const r = it.o.el.getBoundingClientRect();
    if (!r.width) continue;
    const hit = placed.some((q) => r.left < q.right + 4 && r.right > q.left - 4 && r.top < q.bottom + 2 && r.bottom > q.top - 2);
    if (hit && it.p > -2) it.o.el.style.visibility = 'hidden';
    else placed.push(r);
  }
}
function applyView() {
  renderer.setPixelRatio(targetPixelRatio());
  renderer.setSize(W(), H());
  labelR.setSize(W(), H());
  camera.aspect = W() / Math.max(1, H());
  camera.updateProjectionMatrix();
  lineMats.forEach((m) => m.resolution.set(W(), H()));
  labelRev = '';
  dirty = true;
  wake();
}
addEventListener('resize', () => {
  applyView();
  placeCard();
});
onGfx(applyView);
addEventListener('pointerdown', wake, { capture: true });
addEventListener('pointermove', wake, { capture: true });
addEventListener('wheel', wake, { capture: true, passive: true });
addEventListener('keydown', wake);
document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

const counts = {};
G.nodes.forEach((n) => {
  const k = kindOf(n.kind);
  counts[k] = (counts[k] || 0) + 1;
});
const ecounts = {};
G.edges.forEach((e) => {
  const t = etype(e.type);
  ecounts[t] = (ecounts[t] || 0) + 1;
});
const edgeGlyph = (t) => {
  const c = ecolor(t, true);
  const dash = t === 'imports' ? 'stroke-dasharray="3 2.5"' : '';
  return `<svg width="16" height="14" style="flex:none" aria-hidden="true"><line x1="1" y1="7" x2="15" y2="7" stroke="${c}" stroke-width="2" ${dash}/></svg>`;
};
const key = document.getElementById('key');
const edgeWords = META.eword || EWORD;
if (META.key) {
  key.innerHTML = `<h3>${META.key.title}</h3>`
    + META.key.rows.map(([g, ks, rank, plain, line]) => `<button class="krow tall" type="button" aria-pressed="true" data-k="${ks.join(',')}" ${g === 'router' ? 'disabled' : ''}>${glyph(g, 16)}<span class="name">${theme.id === 'kitchen' ? rankBadge(g) : ''}${esc(rank)} <span style="color:var(--text-3);font-weight:400">· ${esc(plain)}</span><span class="ksub">${esc(line)}</span></span><span class="count">${ks.reduce((a, k) => a + (counts[k] || 0), 0)}</span></button>`).join('')
    + `<div class="kdiv"></div><button class="kmore" type="button" aria-expanded="false" aria-controls="kedges">${esc(META.key.edgeLabel)} <span>▾</span></button><div class="kedges" id="kedges">`
    + [...ETYPES, 'other'].filter((t) => ecounts[t]).map((t) => `<button class="krow" type="button" aria-pressed="true" data-e="${t}">${edgeGlyph(t)}<span class="name">${esc(edgeWords[t])}</span><span class="count">${ecounts[t]}</span></button>`).join('')
    + '</div>';
} else {
  key.innerHTML = '<h3>Map key <span>centre → outside</span></h3>'
    + KINDS.filter((k) => counts[k]).map((k) => `<button class="krow" type="button" aria-pressed="true" data-k="${k}" ${k === 'router' ? 'disabled' : ''}>${glyph(k)}<span class="name">${FRIENDLY[k][1]}</span><span class="count">${counts[k]}</span></button>`).join('')
    + '<div class="kdiv"></div><button class="kmore" type="button" aria-expanded="false" aria-controls="kedges">Connection types <span>▾</span></button><div class="kedges" id="kedges">'
    + [...ETYPES, 'other'].filter((t) => ecounts[t]).map((t) => `<button class="krow" type="button" aria-pressed="true" data-e="${t}">${edgeGlyph(t)}<span class="name">${EWORD[t]}</span><span class="count">${ecounts[t]}</span></button>`).join('')
    + '</div>';
}
key.querySelectorAll('.krow[data-k]').forEach((b) => {
  b.onclick = () => {
    if (b.disabled) return;
    const ks = b.dataset.k.split(',');
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    ks.forEach((k) => { if (on) hiddenKinds.delete(k); else hiddenKinds.add(k); });
    hoverApplied = undefined;
    dirty = true;
  };
});
key.querySelectorAll('.krow[data-e]').forEach((b) => {
  b.onclick = () => {
    const t = b.dataset.e;
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    if (on) hiddenE.delete(t);
    else hiddenE.add(t);
    hoverApplied = undefined;
    dirty = true;
  };
});
key.querySelector('.kmore').onclick = (e) => {
  const o = document.getElementById('kedges').classList.toggle('open');
  e.currentTarget.setAttribute('aria-expanded', String(o));
};
if (theme.keyExtras) {
  const extra = theme.keyExtras(E);
  if (extra.head) key.insertAdjacentHTML('afterbegin', extra.head);
  const more = key.querySelector('.kmore');
  if (extra.beforeMore && more) more.insertAdjacentHTML('beforebegin', extra.beforeMore);
  key.querySelectorAll('[data-z]').forEach((b) => {
    b.onclick = () => theme.flyZone(b.dataset.z);
  });
}
const dt = new Date(U.commitDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
document.getElementById('about').innerHTML = `<p>A map of how the pstack skills library fits together: workflows, the tools and rules they use, and the docs behind them.</p>
  <dl><dt>Version</dt><dd>pstack ${esc(U.version)}</dd><dt>Data from</dt><dd>${esc(dt)}</dd><dt>Commit</dt><dd><a href="${esc(U.url + '/commit/' + U.commit)}" style="font-family:var(--font-mono)">${esc(U.commitShort)}</a></dd>
  <dt>Source</dt><dd><a href="${esc(U.url + '/tree/' + U.commit + '/' + U.pluginPath)}">cursor/plugins</a></dd><dt>License</dt><dd><a href="${esc(U.licenseUrl)}">MIT</a> · © Lauren Tan</dd></dl>${THEME === 'galaxy' ? CREDITS_HTML : ''}`;
const ab = document.getElementById('aboutBtn');
ab.onclick = () => {
  const o = document.getElementById('about').classList.toggle('open');
  ab.setAttribute('aria-expanded', String(o));
};
document.getElementById('srcLink').href = `${U.url}/tree/${U.commit}/${U.pluginPath}`;
document.getElementById('licLink').href = U.licenseUrl;
const seg = document.getElementById('seg');
if (seg) seg.hidden = true;
const brandWord = document.getElementById('brandWord');
if (META.em && brandWord) brandWord.innerHTML = `pstack <em>${esc(META.em)}</em>`;
document.title = META.em ? `pstack ${META.em}` : 'pstack map';
const themePick = document.getElementById('themePick');
if (themePick) {
  themePick.value = THEME;
  themePick.onchange = () => {
    const params = new URLSearchParams(location.search);
    params.delete('shape');
    params.set('theme', themePick.value);
    location.search = params.toString();
  };
}
const hintBold = document.querySelector('#hint b');
const hintSmall = document.querySelector('#hint small');
if (hintBold) hintBold.textContent = META.hintBold;
if (hintSmall) hintSmall.textContent = META.hintSmall;
document.getElementById('reset').onclick = () => {
  stopSpin();
  theme.onReset?.();
  viewX = homeViewX();
  viewY = 0;
  if (FOCUS) exitFocus();
  else camTo(theme.sceneC.clone(), fitDist(), HOMECAM.az, HOMECAM.el, theme.motion?.EXIT || 700);
};
document.getElementById('keyBtn').onclick = () => {
  const on = document.body.classList.toggle('key-open');
  document.getElementById('keyBtn').setAttribute('aria-expanded', String(on));
};
document.getElementById('searchBtn').onclick = () => {
  const header = document.getElementById('top');
  const on = header.classList.toggle('search-open');
  document.getElementById('searchBtn').setAttribute('aria-expanded', String(on));
  if (on) document.getElementById('q').focus();
};

const qEl = document.getElementById('q');
qEl.placeholder = META.placeholder;
const resEl = document.getElementById('results');
let res = [];
let ri = 0;
function search(q) {
  q = q.trim().toLowerCase();
  if (!q) {
    resEl.classList.remove('open');
    qEl.setAttribute('aria-expanded', 'false');
    res = [];
    return;
  }
  res = G.nodes.map((n) => {
    const a = nm(n.id).toLowerCase();
    return { n, s: a.startsWith(q) ? 0 : a.includes(' ' + q) ? 1 : a.includes(q) ? 2 : n.id.toLowerCase().includes(q) ? 3 : 9 };
  }).filter((x) => x.s < 9).sort((a, b) => a.s - b.s || deg(b.n.id) - deg(a.n.id)).slice(0, 6);
  ri = 0;
  resEl.innerHTML = res.length
    ? res.map((x, i) => {
      const t = nm(x.n.id);
      const j = t.toLowerCase().indexOf(q);
      const h = j >= 0 ? esc(t.slice(0, j)) + '<mark>' + esc(t.slice(j, j + q.length)) + '</mark>' + esc(t.slice(j + q.length)) : esc(t);
      return `<li role="option" id="r${i}" aria-selected="${i === 0}" data-id="${esc(x.n.id)}">${glyph(x.n.kind, 12)}<span>${h}</span><span class="k">${esc(FRIENDLY[kindOf(x.n.kind)][0])}</span></li>`;
    }).join('')
    : `<li class="empty">No matches for “${esc(q)}”. Try a workflow like <b>Bug fix</b> or a tool like <b>How</b>.</li>`;
  resEl.classList.add('open');
  qEl.setAttribute('aria-expanded', 'true');
  qEl.setAttribute('aria-activedescendant', res.length ? 'r0' : '');
  resEl.querySelectorAll('li[data-id]').forEach((li) => {
    li.onmousedown = (e) => {
      e.preventDefault();
      pickResult(li.dataset.id);
    };
  });
}
function pickResult(id) {
  trail = [];
  resEl.classList.remove('open');
  qEl.blur();
  document.getElementById('top').classList.remove('search-open');
  document.getElementById('searchBtn').setAttribute('aria-expanded', 'false');
  go(id, { push: true, focusTitle: true });
}
qEl.addEventListener('input', (e) => search(e.target.value));
qEl.addEventListener('blur', () => setTimeout(() => resEl.classList.remove('open'), 120));
qEl.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    resEl.classList.remove('open');
    document.getElementById('top').classList.remove('search-open');
    document.getElementById('searchBtn').setAttribute('aria-expanded', 'false');
    qEl.blur();
    return;
  }
  if (!res.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    ri = (ri + (e.key === 'ArrowDown' ? 1 : -1) + res.length) % res.length;
    resEl.querySelectorAll('li[data-id]').forEach((li, i) => li.setAttribute('aria-selected', String(i === ri)));
    qEl.setAttribute('aria-activedescendant', 'r' + ri);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    pickResult(res[ri].n.id);
  }
});
addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName);
  if (e.key === 'Escape') {
    if (pop.classList.contains('expanded')) {
      pop.classList.remove('expanded');
      pop.querySelector('#detBtn')?.setAttribute('aria-expanded', 'false');
      placeCard();
    } else if (document.getElementById('about').classList.contains('open')) ab.click();
    else if (document.body.classList.contains('key-open')) {
      document.body.classList.remove('key-open');
      document.getElementById('keyBtn').setAttribute('aria-expanded', 'false');
    } else if (document.getElementById('top').classList.contains('search-open')) {
      document.getElementById('top').classList.remove('search-open');
      document.getElementById('searchBtn').setAttribute('aria-expanded', 'false');
    } else exitFocus();
  } else if (!typing && e.key === '/') {
    e.preventDefault();
    if (mobile()) {
      document.getElementById('top').classList.add('search-open');
      document.getElementById('searchBtn').setAttribute('aria-expanded', 'true');
    }
    qEl.focus();
  } else if (!typing && FOCUS && (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft'))) {
    e.preventDefault();
    back({ restoreBack: true });
  } else if (cardId && document.activeElement?.classList.contains('chip') && /Arrow(Left|Right|Up|Down)/.test(e.key)) {
    const cs = [...pop.querySelectorAll('.chip')];
    const i = cs.indexOf(document.activeElement);
    const j = THREE.MathUtils.clamp(i + (/Right|Down/.test(e.key) ? 1 : -1), 0, cs.length - 1);
    cs[j]?.focus();
    e.preventDefault();
  }
});

const HINT_KEY = 'pstackMap.hintDismissed';
const hintEl = document.getElementById('hint');
function dismissHint() {
  hintEl.classList.remove('show');
  try { localStorage.setItem(HINT_KEY, '1'); } catch { /* private mode: once per session */ }
}
document.getElementById('hintOk').onclick = dismissHint;
const wantHint = qs.get('hint') === '1' || (qs.get('hint') !== '0' && (() => {
  try { return localStorage.getItem(HINT_KEY) !== '1'; } catch { return true; }
})());

const hashId = decodeURIComponent((location.hash.match(/^#node=(.+)$/) || [])[1] || '');
theme.bindRuntime?.({
  get focus() { return FOCUS; },
  get camTw() { return camTw; },
  get drag() { return drag; },
  cam,
  camera,
  NB,
  dirty() { dirty = true; wake(); },
  hiddenKinds,
  exit: exitFocus,
  camTo,
  mobile,
  W,
  H,
  vf,
  viewX(v) { viewX = v; },
  screenOf,
  renderer,
  fitDist,
  get idle() { return idleAlpha; },
});
applyCam();
requestAnimationFrame(frame);
if (wantHint && !qs.has('focus') && !qs.has('trail') && !hashId) {
  pending++;
  setTimeout(() => {
    hintEl.classList.add('show');
    setTimeout(() => pending--, 300);
  }, reduced ? 0 : 600);
}
const delay = +(qs.get('delay') || 300);
const hop = (theme.motion?.REGROUP || 900) + 400;
const seq = qs.get('trail') ? qs.get('trail').split(',') : qs.get('focus') ? [qs.get('focus')] : hashId ? [hashId] : [];
const sq = seq.filter((id) => NB.has(id));
pending += sq.length + (qs.get('orbit') ? 1 : 0);
sq.forEach((id, i) => setTimeout(() => {
  go(id, { push: true, focusTitle: false });
  pending--;
}, delay + i * hop));
if (qs.get('zone') && theme.flyZone) {
  pending++;
  setTimeout(() => {
    theme.flyZone(qs.get('zone'));
    pending--;
  }, delay);
}
if (qs.get('orbit')) {
  setTimeout(() => {
    const d = THREE.MathUtils.degToRad(+qs.get('orbit'));
    if (camTw) camTw.e.az += d;
    else cam.az += d;
    pending--;
  }, delay + Math.max(0, sq.length - 1) * hop + 50);
}
if (qs.get('q')) {
  qEl.focus();
  qEl.value = qs.get('q');
  search(qs.get('q'));
}
window.__go = go;
window.__back = back;
window.__exit = exitFocus;
window.__pstack = {
  theme: THEME,
  shape: SHAPE,
  get focus() { return FOCUS; },
  get trail() { return trail.slice(); },
  get card() { return cardId; },
  get settled() { return !!window.__settled; },
  get cam() {
    return {
      az: cam.az, el: cam.el, dist: cam.dist,
      x: cam.target.x, y: cam.target.y, z: cam.target.z,
      viewX, viewY,
      saved: savedCam && { dist: savedCam.dist, x: savedCam.target.x, y: savedCam.target.y, z: savedCam.target.z },
      tween: camTw && { dist: camTw.e.dist, x: camTw.e.target.x, p: camTw.dur ? (performance.now() - camTw.t0) / camTw.dur : 1 },
    };
  },
  name: nm,
  get calls() { return theme.lastStats?.calls ?? renderer.info.render.calls; },
  get tris() { return theme.lastStats?.tris ?? renderer.info.render.triangles; },
  get gfx() { return theme.gfx ? theme.gfx() : null; },
  get bend() {
    const core = NB.get(G.nodes.find((n) => n.kind === 'router').id);
    const star = N.find((o) => o.k === 'playbook');
    const planet = N.find((o) => o.k === 'skill');
    const y = (o) => o && +o.pos.y.toFixed(1);
    return { core: y(core), star: star && { id: star.id, y: y(star) }, planet: planet && { id: planet.id, y: y(planet) } };
  },
  get play() { return PLAY && { id: PLAY.id, k: PLAY.k, playing: PLAY.playing, n: PLAY.S.length, order: PLAY.k >= 0 ? PLAY.S[PLAY.k][0] : null }; },
};
