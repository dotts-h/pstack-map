import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/CSS2DRenderer.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { checkLayout, kindOf } from './layout.mjs';

const KINDS = ['router', 'playbook', 'skill', 'principle', 'agent', 'automation', 'script', 'reference'];
const KIND_LABEL = {
  router: 'Router', playbook: 'Playbook', principle: 'Principle', skill: 'Skill',
  script: 'Script', reference: 'Reference', agent: 'Agent', automation: 'Automation', other: 'Other',
};
const ETYPES = ['loads', 'applies', 'runs', 'imports', 'references'];
const EALPHA = { loads: 0.45, applies: 0.16, runs: 0.5, imports: 0.5, references: 0.07, other: 0.07 };
const MID_KINDS = ['principle', 'skill', 'agent', 'automation', 'other'];
const SMALL_KINDS = ['script', 'reference'];
const LABEL_PRI = { router: 0, playbook: 2, principle: 3, skill: 3, agent: 3, automation: 3, other: 4, script: 5, reference: 5 };
const PW = 380;
const RAIL = 248 + 16;
const FL = {
  R0: 34, R_PER: 1.5, SHELL_IN: 0.82, SHELL_OUT: 1.12, H_SPAN: 0.9, STEP_MAX: 0.2,
  PSI_MAX: 55 * Math.PI / 180, X_SCALE: 0.75, ROW_PX: 22, CAP: 36,
  R_MIN: 1.8, R_MAX: 3.2, R_SEL: 6.5, LABEL_PX: 170, DISPERSE_K: 4.5, SHELL_MIN: 520, SHELL_MAX: 1100,
  REGROUP: 900, EXIT: 700, STAGGER: 14, STAGGER_MAX: 260, DISPERSE: 800,
};
const GOLD = Math.PI * (3 - Math.sqrt(5));
const SEG = 16;
const SEG_HL = 32;

const qs = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || qs.has('reduced');
const narrow = () => matchMedia('(max-width: 759px)').matches;

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const etype = (t) => (ETYPES.includes(t) ? t : 'other');
const ecolor = (t, hl) => (t === 'references' && hl ? css('--e-references-hl') : css('--e-' + etype(t)));
const color = (k) => css('--k-' + kindOf(k));
const clean = (s) => (s && s !== 'None' ? s : null);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const trunc = (s, m = 24) => (s.length > m ? s.slice(0, m - 1).trimEnd() + '…' : s);

function display(n) {
  const k = kindOf(n.kind);
  if (k === 'router' || k === 'skill') return '/' + n.id;
  if (k === 'playbook' || k === 'principle') return clean(n.title) || n.id;
  return clean(n.name) || n.id;
}

function showBootError(title, detail) {
  const boot = document.getElementById('boot');
  if (!boot || boot.dataset.done) return;
  boot.innerHTML = '<div class="card"><h2></h2><p></p><button class="btn" type="button">Reload</button></div>';
  boot.querySelector('h2').textContent = title;
  boot.querySelector('p').textContent = detail || '';
  boot.querySelector('button').onclick = () => location.reload();
}

function finishBoot() {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.dataset.done = '1';
  boot.remove();
}

try {
  await main();
} catch (err) {
  showBootError(err && err.webgl ? 'This map needs WebGL.' : "Couldn't load data/graph.json.", err && err.message ? err.message : String(err));
}

async function main() {
  const res = await fetch(new URL('data/graph.json', import.meta.url));
  if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
  const G = await res.json();
  if (!Array.isArray(G.nodes) || !Array.isArray(G.edges)) throw new Error('graph.json has no nodes array');
  if (G.nodes.length === 0) {
    showBootError('No nodes in this data file.', '');
    return;
  }

  const layout = checkLayout(G);
  if (!layout.positions) throw new Error(layout.errors.join('\n') || 'layout failed');
  const byId = new Map(G.nodes.map((n) => [n.id, n]));
  const home = new Map([...layout.positions].map(([id, p]) => [id, new THREE.Vector3(p.x, p.y, p.z)]));
  const deg = (id) => byId.get(id).degree?.total ?? 0;
  const U = G.upstream ?? {};

  const kindOn = new Set([...KINDS, 'other']);
  const typeOn = new Set([...ETYPES, 'other']);
  const kindVisible = (k) => kindOn.has(kindOf(k));
  const typeVisible = (t) => typeOn.has(etype(t));

  const host = document.getElementById('scene');
  const W = () => host.clientWidth;
  const H = () => host.clientHeight;

  let renderer;
  try {
    const probe = document.createElement('canvas');
    if (!probe.getContext('webgl2') && !probe.getContext('webgl')) {
      const err = new Error('Try a current Chrome or Firefox.');
      err.webgl = true;
      throw err;
    }
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (err) {
    if (!err.webgl) err.webgl = true;
    throw err;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.setClearColor(css('--bg'), 1);
  renderer.domElement.style.touchAction = 'none';
  host.appendChild(renderer.domElement);

  const labelR = new CSS2DRenderer();
  labelR.setSize(W(), H());
  labelR.domElement.style.position = 'absolute';
  labelR.domElement.style.inset = '0';
  document.getElementById('labels').appendChild(labelR.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(css('--bg'), 300, 650);
  const camera = new THREE.PerspectiveCamera(40, W() / H(), 1, 6000);
  scene.add(new THREE.AmbientLight(0x9aa8c8, 1.1));
  const sunLight = new THREE.PointLight(0xffe2b0, 2.4, 0, 0);
  scene.add(sunLight);
  const fill = new THREE.DirectionalLight(0xc8d4ea, 1.1);
  scene.add(fill);

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

  {
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
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({
      size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.8, fog: false, depthWrite: false,
    })));
  }

  const lineMats = [];
  function mkLineMat(o) {
    const m = new LineMaterial({ worldUnits: false, transparent: true, depthWrite: false, ...o });
    m.resolution.set(W(), H());
    lineMats.push(m);
    return m;
  }
  function dropMat(m) {
    const i = lineMats.indexOf(m);
    if (i >= 0) lineMats.splice(i, 1);
    m.dispose();
  }

  const RINGS = [{ r: 62, y: 0 }, { r: 108, y: -22 }, { r: 152, y: 14 }];
  const orbitObjs = RINGS.map(({ r, y }) => {
    const a = [];
    for (let i = 0; i < 256; i++) {
      const t0 = (i / 256) * Math.PI * 2;
      const t1 = ((i + 1) / 256) * Math.PI * 2;
      a.push(Math.cos(t0) * r, y, Math.sin(t0) * r, Math.cos(t1) * r, y, Math.sin(t1) * r);
    }
    const g = new LineSegmentsGeometry();
    g.setPositions(a);
    const l = new LineSegments2(g, mkLineMat({ color: css('--orbit'), linewidth: 1, opacity: 1 }));
    scene.add(l);
    return l;
  });

  const lathe = (pts, seg, rot = 0) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg, rot);
  const GEO = {
    playbook: () => lathe([[0, -1.35], [1, 0], [0, 1.35]], 4, Math.PI / 4),
    skill: () => lathe([[0, -0.95], [0.55, -0.42], [1, 0.02], [0.84, 0.24], [0.62, 0.42], [0, 0.42]], 16),
    principle: () => lathe([[0, -0.8], [1, 0], [0, 0.8]], 6),
    agent: () => lathe([[0, -0.7], [0.95, -0.12], [0.95, 0.16], [0.6, 0.5], [0, 0.5]], 4, Math.PI / 4),
    automation: () => lathe([[0, -1], [1, 0], [0, 1]], 3),
    script: () => new THREE.TetrahedronGeometry(1.1, 0),
    reference: () => lathe([[0, -0.9], [0.55, 0], [0, 0.9]], 4),
    other: () => new THREE.IcosahedronGeometry(0.9, 0),
  };
  const KMUL = { router: 1, playbook: 1, skill: 1, principle: 1, agent: 1, automation: 1, script: 0.75, reference: 0.62, other: 0.8 };
  const maxDeg = Math.max(0, ...G.nodes.filter((n) => n.kind !== 'router').map((n) => deg(n.id)));
  const radiusOf = (n) => (n.kind === 'router' ? 10 : KMUL[kindOf(n.kind)] * (1.3 + 4.4 * Math.sqrt(maxDeg ? deg(n.id) / maxDeg : 0)));

  function gemMaterial() {
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
  for (const n of G.nodes) {
    const k = kindOf(n.kind);
    if (k === 'router') continue;
    (byKind[k] ??= []).push(n);
  }
  const inst = {};
  function mkNode(n, k, im, i) {
    const r = radiusOf(n);
    const p = (home.get(n.id) || new THREE.Vector3()).clone();
    return {
      n, id: n.id, k, i, im, r, base: new THREE.Color(color(k)),
      pos: p.clone(), from: p.clone(), to: p.clone(),
      sc: r, scFrom: r, scTo: r, dim: 0, dimFrom: 0, dimTo: 0, t0: 0, dur: 0, prog: 1,
      hidden: false, lmode: 'home', anchorMode: 'c',
      rot: new THREE.Euler((k === 'skill' || k === 'principle') ? 0.25 : 0, (i * 2.399) % (Math.PI * 2), 0),
    };
  }
  for (const [k, list] of Object.entries(byKind)) {
    const im = new THREE.InstancedMesh(GEO[k](), gemMaterial(), list.length);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false;
    im.userData.kind = k;
    scene.add(im);
    inst[k] = im;
    list.forEach((n, i) => N.push(mkNode(n, k, im, i)));
  }

  const router = G.nodes.find((n) => n.kind === 'router');
  const starMat = new THREE.ShaderMaterial({
    uniforms: { core: { value: new THREE.Color('#FFF3D6') }, edge: { value: new THREE.Color('#E9A748') }, dim: { value: 0 } },
    vertexShader: 'varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform vec3 core;uniform vec3 edge;uniform float dim;varying vec3 vN;varying vec3 vV;void main(){float mu=clamp(dot(normalize(vN),normalize(vV)),0.,1.);vec3 c=mix(edge,core,pow(mu,.55));gl_FragColor=vec4(mix(c,vec3(.15,.17,.22),dim*.8),1.);}',
  });
  const starMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), starMat);
  scene.add(starMesh);
  const starNode = mkNode(router, 'router', null, 0);
  starNode.mesh = starMesh;
  N.push(starNode);
  const NB = new Map(N.map((o) => [o.id, o]));

  const mkHalo = (col, size, op) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: HALO, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    s.scale.setScalar(size);
    scene.add(s);
    return s;
  };
  const decor = [
    { o: starNode, s: mkHalo('#F6CF85', 1, 0.9), f: 3.6, op: 0.9 },
    { o: starNode, s: mkHalo('#F2B85A', 1, 0.22), f: 11, op: 0.22 },
  ];
  for (const o of N) {
    if (o.k !== 'router' && deg(o.id) >= 15) decor.push({ o, s: mkHalo(color(o.k), 1, 0.16), f: 4.2, op: 0.16 });
  }
  const pring = [];
  N.filter((o) => o.k !== 'router' && deg(o.id) >= 20).forEach((o, j) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(1.55, 2.05, 128),
      new THREE.MeshBasicMaterial({ color: color(o.k), transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }),
    );
    m.rotation.set(Math.PI / 2 - 0.42, 0, 0.18 * (j % 2 ? 1 : -1));
    scene.add(m);
    pring.push({ o, m });
  });

  const hoverRing = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 1.95, 64),
    new THREE.MeshBasicMaterial({ color: css('--select'), transparent: true, opacity: 0.35, depthTest: false, depthWrite: false, side: THREE.DoubleSide }),
  );
  hoverRing.visible = false;
  hoverRing.renderOrder = 10;
  scene.add(hoverRing);

  function mkLabel(cls, html, anchor = 'c') {
    const a = document.createElement('div');
    a.className = 'anc ' + anchor;
    const sp = document.createElement('span');
    const l = document.createElement('span');
    l.className = cls;
    l.innerHTML = html;
    sp.appendChild(l);
    a.appendChild(sp);
    const lo = new CSS2DObject(a);
    lo.center.set(0, 0);
    scene.add(lo);
    return { lo, a, l };
  }
  for (const o of N) {
    const cls = 'lbl ' + (o.k === 'router' ? 'router' : (o.k === 'script' || o.k === 'reference') ? 'small' : '');
    const L = mkLabel(cls, esc(trunc(display(o.n))));
    o.lo = L.lo;
    o.anc = L.a;
    o.el = L.l;
  }

  const E = G.edges.filter((e) => NB.has(e.source) && NB.has(e.target)).map((e) => ({ e, t: etype(e.type) }));
  const idle = {};
  for (const t of [...ETYPES, 'other']) {
    const list = E.filter((x) => x.t === t);
    if (!list.length) continue;
    const g = new LineSegmentsGeometry();
    g.setPositions(new Float32Array(list.length * SEG * 6));
    const m = mkLineMat({ color: ecolor(t), linewidth: 1.25, opacity: EALPHA[t], dashed: t === 'imports', dashSize: 1.6, gapSize: 1.2 });
    const l = new LineSegments2(g, m);
    l.frustumCulled = false;
    scene.add(l);
    idle[t] = { l, g, list, base: EALPHA[t] };
  }
  const hl = { l: null, g: null, mat: null, list: [] };
  function setHighlight(list) {
    if (hl.l) {
      scene.remove(hl.l);
      hl.g.dispose();
      dropMat(hl.mat);
    }
    hl.list = list;
    if (!list.length) {
      hl.l = null;
      hl.g = null;
      hl.mat = null;
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
    const m = mkLineMat({ vertexColors: true, linewidth: 2, opacity: 0 });
    const l = new LineSegments2(g, m);
    l.frustumCulled = false;
    l.renderOrder = 2;
    scene.add(l);
    hl.l = l;
    hl.g = g;
    hl.mat = m;
  }
  const arrows = new THREE.InstancedMesh(new THREE.ConeGeometry(0.55, 1.8, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }), 160);
  arrows.count = 0;
  arrows.frustumCulled = false;
  scene.add(arrows);

  const cam = { target: new THREE.Vector3(), dist: 345, az: 0.35, el: 0.46, min: 40, max: 900 };
  let viewX = 0;
  let FOCUS = null;
  let FS = null;
  let camTw = null;
  let hdrs = [];
  let dirty = true;
  let savedCam = null;
  let idleAlpha = 1;
  let idleTw = null;
  let hoverId = null;
  let pendingHover = null;

  const overviewViewX = () => (narrow() ? 0 : -RAIL / 2);
  const focusViewX = () => (narrow() ? 0 : PW / 2);

  function applyCam() {
    const { target: t, dist: d, az, el } = cam;
    camera.position.set(
      t.x + d * Math.cos(el) * Math.sin(az),
      t.y + d * Math.sin(el),
      t.z + d * Math.cos(el) * Math.cos(az),
    );
    camera.lookAt(t);
    viewX = FOCUS ? focusViewX() : overviewViewX();
    camera.setViewOffset(W(), H(), viewX, 0, W(), H());
    if (FOCUS && FS) {
      scene.fog.near = d + FS.Rb * 0.6;
      scene.fog.far = FS.shell * 1.35;
    } else {
      scene.fog.near = d * 0.85;
      scene.fog.far = d * 1.9;
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
    try { host.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  host.addEventListener('pointerup', (e) => {
    const was = drag && drag.id === e.pointerId ? drag : null;
    const pinching = pointers.size >= 2;
    pointers.delete(e.pointerId);
    if (was && !pinching && pointers.size === 0 && was.moved < 4 && was.button === 0) {
      const hit = pick(e.clientX, e.clientY);
      if (hit) focus(hit);
      else if (FOCUS) unfocus();
    }
    if (drag && drag.id === e.pointerId) drag = null;
    if (pointers.size === 0) pendingHover = { x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' };
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
      cam.az -= dx * 0.005;
      cam.el = THREE.MathUtils.clamp(cam.el + dy * 0.005, -1.2, 1.35);
    }
    dirty = true;
  });
  host.addEventListener('wheel', (e) => {
    e.preventDefault();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= 400;
    cam.dist = THREE.MathUtils.clamp(cam.dist * Math.exp(dy * 0.001), cam.min, cam.max);
    dirty = true;
  }, { passive: false });

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(x, y) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects([starMesh, ...Object.values(inst)], false);
    for (const hit of hits) {
      if (hit.object === starMesh) return starNode.hidden ? null : starNode.id;
      const list = byKind[hit.object.userData.kind];
      const node = list && list[hit.instanceId];
      if (!node) continue;
      const o = NB.get(node.id);
      if (o && !o.hidden) return o.id;
    }
    return null;
  }

  function nodeHidden(id) {
    const o = NB.get(id);
    return !o || o.hidden;
  }
  function edgeShown(x) {
    return typeVisible(x.t) && !nodeHidden(x.e.source) && !nodeHidden(x.e.target);
  }
  let lastHoverPt = null;
  function applyHidden() {
    for (const o of N) o.hidden = !kindVisible(o.k);
    if (FOCUS) {
      if (nodeHidden(FOCUS)) unfocus();
      else focus(FOCUS);
    } else if (hoverId && nodeHidden(hoverId)) setHover(null);
    else if (hoverId) setHover(hoverId, lastHoverPt, true);
    dirty = true;
  }

  function setHover(id, pt, force = false) {
    const changed = force || id !== hoverId;
    if (pt) lastHoverPt = pt;
    hoverId = id;
    host.style.cursor = id ? 'pointer' : '';
    const tip = document.getElementById('tip');
    if (!id || (pt && pt.touch)) {
      tip.hidden = true;
    } else {
      const n = byId.get(id);
      document.getElementById('tip1').textContent = display(n);
      const connections = deg(id);
      document.getElementById('tip2').textContent = `${KIND_LABEL[kindOf(n.kind)]} · ${connections} connection${connections === 1 ? '' : 's'}`;
      tip.hidden = false;
      if (pt) {
        const w = tip.offsetWidth;
        const h = tip.offsetHeight;
        let left = pt.x + 14;
        let top = pt.y + 14;
        if (left + w > innerWidth - 8) left = pt.x - w - 14;
        if (top + h > innerHeight - 8) top = pt.y - h - 14;
        tip.style.left = Math.max(8, left) + 'px';
        tip.style.top = Math.max(8, top) + 'px';
      }
    }
    if (FOCUS || !changed) return;
    if (!id) {
      for (const o of N) {
        o.dimFrom = o.dim;
        o.dimTo = 0;
        o.dur = 0;
        o.t0 = 0;
      }
      setHighlight([]);
      dirty = true;
      return;
    }
    const keep = new Set([id]);
    for (const e of G.edges) {
      if (!typeVisible(e.type)) continue;
      if (e.source === id && !nodeHidden(e.target)) keep.add(e.target);
      if (e.target === id && !nodeHidden(e.source)) keep.add(e.source);
    }
    for (const o of N) {
      o.dimFrom = o.dim;
      o.dimTo = keep.has(o.id) ? 0 : 1;
      o.dur = 0;
      o.t0 = 0;
    }
    setHighlight(E.filter((x) => (x.e.source === id || x.e.target === id) && edgeShown(x)));
    dirty = true;
  }

  function tweenNode(o, pos, sc, dim, delay, dur) {
    o.from.copy(o.pos);
    o.to.copy(pos);
    o.scFrom = o.sc;
    o.scTo = sc;
    o.dimFrom = o.dim;
    o.dimTo = dim;
    o.t0 = performance.now() + (reduced ? 0 : delay);
    o.dur = reduced ? 0 : dur;
  }
  function camTo(t, dist, az, el, dur) {
    camTw = {
      s: { target: cam.target.clone(), dist: cam.dist, az: cam.az, el: cam.el },
      e: { target: t.clone(), dist, az, el },
      t0: performance.now(),
      dur: reduced ? 0 : dur,
    };
  }

  function dedupeSide(list) {
    const seen = new Set();
    const out = [];
    for (const x of list) {
      if (seen.has(x.id)) continue;
      seen.add(x.id);
      out.push(x);
    }
    return out;
  }
  function neighbours(id) {
    const inc = [];
    const out = [];
    for (const e of G.edges) {
      if (e.target === id && e.source !== id && !nodeHidden(e.source)) inc.push({ id: e.source, e });
      if (e.source === id && e.target !== id && !nodeHidden(e.target)) out.push({ id: e.target, e });
    }
    const outIds = new Set(out.map((x) => x.id));
    return { inc: dedupeSide(inc.filter((x) => !outIds.has(x.id))), out: dedupeSide(out) };
  }
  function sortSide(list) {
    const order = [...ETYPES, 'other'];
    return list.sort((a, b) => (
      order.indexOf(etype(a.e.type)) - order.indexOf(etype(b.e.type))
      || KINDS.indexOf(kindOf(byId.get(a.id).kind)) - KINDS.indexOf(kindOf(byId.get(b.id).kind))
      || display(byId.get(a.id)).localeCompare(display(byId.get(b.id)))
    ));
  }
  function sideSlots(list, side, Rc, Rv, Uv, Dv) {
    sortSide(list);
    let items = list;
    let more = 0;
    if (list.length > FL.CAP) {
      const groups = new Map();
      for (const x of list) {
        const t = etype(x.e.type);
        if (!groups.has(t)) groups.set(t, []);
        groups.get(t).push(x);
      }
      const budget = FL.CAP - 1 - (groups.size - 1);
      items = [];
      for (const [, l] of groups) items.push(...l.slice(0, Math.max(3, Math.floor(budget * l.length / list.length))));
      more = list.length - items.length;
    }
    const slots = [];
    let last = null;
    for (const x of items) {
      const t = etype(x.e.type);
      if (last !== null && t !== last) slots.push({ gap: true });
      if (t !== last) x.hdr = { t, n: list.filter((y) => etype(y.e.type) === t).length };
      slots.push(x);
      last = t;
    }
    if (more) slots.push({ more });
    const n = slots.length;
    const step = n > 1 ? Math.min((2 * FL.H_SPAN) / (n - 1), FL.STEP_MAX) : 0;
    const top = (step * (n - 1)) / 2;
    let j = 0;
    for (let k = 0; k < slots.length; k++) {
      const s = slots[k];
      const h = top - k * step;
      s.h = h;
      if (s.gap) continue;
      const psi = (((j * GOLD) % (2 * FL.PSI_MAX)) + 2 * FL.PSI_MAX) % (2 * FL.PSI_MAX) - FL.PSI_MAX;
      const r = Rc * (j % 2 ? FL.SHELL_OUT : FL.SHELL_IN);
      const rho = Math.sqrt(Math.max(0, 1 - h * h));
      s.p = new THREE.Vector3()
        .addScaledVector(Uv, h * Rc)
        .addScaledVector(Rv, side * rho * r * Math.cos(psi) * FL.X_SCALE)
        .addScaledVector(Dv, rho * r * Math.sin(psi));
      s.j = j;
      j++;
    }
    return { slots, more };
  }

  function hashId() {
    if (!location.hash.startsWith('#node=')) return null;
    try { return decodeURIComponent(location.hash.slice(6)); } catch { return location.hash.slice(6); }
  }
  function setHash(id) {
    const next = id ? '#node=' + encodeURIComponent(id) : location.pathname + location.search;
    if (id) {
      if (location.hash === '#node=' + encodeURIComponent(id)) return;
      history.pushState(null, '', '#node=' + encodeURIComponent(id));
    } else if (location.hash.startsWith('#node=')) {
      history.pushState(null, '', location.pathname + location.search);
    }
    return next;
  }

  function focus(id, opts = {}) {
    if (!NB.has(id)) return;
    if (!FOCUS) savedCam = { target: cam.target.clone(), dist: cam.dist, az: cam.az, el: cam.el };
    FOCUS = id;
    document.body.classList.remove('legend-open');
    const C = new THREE.Vector3();
    const Rv = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const Uv = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const Dv = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).normalize();
    const visW = Math.max(80, narrow() ? W() - 32 : W() - PW - 32);
    const visH = Math.max(80, narrow() ? window.innerHeight * 0.45 - 48 : H() - 120);
    const vf = THREE.MathUtils.degToRad(40);
    FL.CAP = Math.max(4, Math.floor(visH * 0.86 / FL.ROW_PX));
    const { inc, out } = neighbours(id);
    const nMax = Math.min(FL.CAP, Math.max(inc.length, out.length));
    const Rc = FL.R0 + FL.R_PER * nMax;
    const L = sideSlots(inc, -1, Rc, Rv, Uv, Dv);
    const Rt = sideSlots(out, 1, Rc, Rv, Uv, Dv);
    const member = new Map([[id, { p: C.clone(), side: 0 }]]);
    for (const [S, side] of [[L, -1], [Rt, 1]]) {
      for (const s of S.slots) if (s.id) member.set(s.id, { p: s.p, side });
    }
    const Rb = Rc * FL.SHELL_OUT + FL.R_MAX;
    const shell = THREE.MathUtils.clamp(Rb * FL.DISPERSE_K, FL.SHELL_MIN, FL.SHELL_MAX);
    const ppu = Math.max(0.05, Math.min(
      (visH / 2) / (FL.H_SPAN * Rc + FL.R_MAX + 4),
      (visW / 2 - FL.LABEL_PX) / (Rc * FL.SHELL_OUT * FL.X_SCALE + FL.R_MAX),
    ));
    let dist = H() / (2 * Math.tan(vf / 2) * ppu);
    const minD = Math.max(Rb * 1.15, 40);
    const maxD = Math.max(minD + 1, Math.min(dist * 2, shell * 0.6));
    dist = Math.min(Math.max(dist, minD), maxD);
    FS = { Rc, Rb, shell, dist, side: new Map([...member].map(([k, v]) => [k, v.side])), Rv: Rv.clone() };
    cam.min = minD;
    cam.max = maxD;
    const fe = E.filter((x) => edgeShown(x) && ((x.e.source === id && member.has(x.e.target)) || (x.e.target === id && member.has(x.e.source))));
    setHighlight(fe);
    let k = 0;
    for (const o of N) {
      const m = member.get(o.id);
      if (m && !o.hidden) {
        const sc = o.id === id ? Math.max(FL.R_SEL, o.k === 'router' ? 7 : 0) : THREE.MathUtils.clamp(o.r * 0.8, FL.R_MIN, FL.R_MAX);
        tweenNode(o, m.p, sc, 0, o.id === id ? 0 : Math.min(FL.STAGGER * (++k), FL.STAGGER_MAX), FL.REGROUP);
        o.lmode = o.id === id ? 'sel' : 'mem';
      } else {
        const v = o.pos.clone().sub(C);
        if (v.lengthSq() < 1) v.set(0, 1, 0);
        v.normalize();
        const j = 1 + 0.25 * ((((o.i || 0) * 0.618 + o.k.length * 0.13) % 1 + 1) % 1);
        tweenNode(o, C.clone().addScaledVector(v, shell * j), o.r * 1.2, 1, 0, FL.DISPERSE);
        o.lmode = 'hide';
      }
    }
    for (const h of hdrs) scene.remove(h.lo);
    hdrs = [];
    for (const [S, side] of [[L, -1], [Rt, 1]]) {
      const items = S.slots.filter((s) => s.id);
      for (const s of S.slots) {
        if (!s.hdr && !s.more) continue;
        const html = s.more ? `+${s.more} more · see panel` : `${esc(s.hdr.t)} <b>${s.hdr.n}</b>`;
        const h = mkLabel(s.more ? 'more-lbl' : 'ghdr', html, s.more ? (side < 0 ? 'ml' : 'mr') : (side < 0 ? 'hl' : 'hr'));
        h.a.classList.add('fade');
        if (!reduced) h.a.classList.add('ghost');
        h.node = s.more ? NB.get(items[items.length - 1].id) : NB.get(s.id);
        h.more = !!s.more;
        h.side = side;
        hdrs.push(h);
        setTimeout(() => h.a.classList.remove('ghost'), reduced ? 0 : FL.REGROUP * 0.6);
      }
    }
    viewX = focusViewX();
    camTo(C, dist, cam.az, cam.el, FL.REGROUP);
    idleTw = { from: idleAlpha, to: 0, t0: performance.now(), dur: reduced ? 0 : 300 };
    document.body.classList.add('focus', 'panel-open');
    const n = byId.get(id);
    const fb = document.getElementById('focusbar');
    fb.innerHTML = `Focus <b></b> · ${inc.length} in · ${out.length} out <span class="kbd">Esc</span>`;
    fb.querySelector('b').textContent = display(n);
    fb.style.left = ((narrow() ? W() : W() - PW) / 2) + 'px';
    openPanel(n);
    if (!opts.fromHash) setHash(id);
    dirty = true;
  }

  function unfocus(opts = {}) {
    if (!FOCUS) return;
    FOCUS = null;
    for (const h of hdrs) scene.remove(h.lo);
    hdrs = [];
    setHighlight([]);
    N.slice().reverse().forEach((o, i) => {
      tweenNode(o, home.get(o.id) || new THREE.Vector3(), o.r, 0, Math.min(i * 2, FL.STAGGER_MAX / 2), FL.EXIT);
      o.lmode = 'home';
    });
    cam.min = 40;
    cam.max = 900;
    viewX = overviewViewX();
    const c = savedCam || { target: new THREE.Vector3(), dist: 345, az: cam.az, el: 0.46 };
    camTo(c.target, c.dist, cam.az, c.el, FL.EXIT);
    idleTw = { from: idleAlpha, to: 1, t0: performance.now() + (reduced ? 0 : FL.EXIT * 0.4), dur: reduced ? 0 : 400 };
    document.body.classList.remove('focus', 'panel-open');
    document.querySelector('.panel')?.remove();
    document.getElementById('hint').style.display = '';
    if (!opts.fromHash) setHash(null);
    hoverId = null;
    document.getElementById('tip').hidden = true;
    dirty = true;
  }

  function glyph(k, s = 14) {
    const c = color(k);
    const h = s / 2;
    const p = {
      router: `<circle cx="${h}" cy="${h}" r="${h - 1.5}" fill="${c}"/><circle cx="${h}" cy="${h}" r="${h - 0.5}" fill="none" stroke="${c}" stroke-opacity=".35"/>`,
      playbook: `<polygon points="${h},0.5 ${s - 3},${h} ${h},${s - 0.5} 3,${h}" fill="${c}"/>`,
      skill: `<polygon points="${s * 0.28},${s * 0.22} ${s * 0.72},${s * 0.22} ${s - 1},${s * 0.42} ${h},${s - 1} 1,${s * 0.42}" fill="${c}"/>`,
      principle: `<polygon points="${h},2 ${s - 1},${h} ${h},${s - 2} 1,${h}" fill="${c}"/>`,
      agent: `<polygon points="${s * 0.3},2 ${s * 0.7},2 ${s - 2},${s * 0.3} ${s - 2},${s * 0.7} ${s * 0.7},${s - 2} ${s * 0.3},${s - 2} 2,${s * 0.7} 2,${s * 0.3}" fill="${c}"/>`,
      automation: `<polygon points="${h},1.5 ${s - 1.5},${s - 2} 1.5,${s - 2}" fill="${c}"/>`,
      script: `<polygon points="${h},2.5 ${s - 2.5},${s - 2.5} 2.5,${s - 2.5}" fill="none" stroke="${c}" stroke-width="1.6"/>`,
      reference: `<polygon points="${h},1.5 ${s * 0.68},${h} ${h},${s - 1.5} ${s * 0.32},${h}" fill="${c}"/>`,
      other: `<circle cx="${h}" cy="${h}" r="${h - 3.5}" fill="${c}"/>`,
    }[kindOf(k)];
    return `<svg class="glyph" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="flex:none" aria-hidden="true">${p}</svg>`;
  }
  function edgeGlyph(t) {
    const c = ecolor(t, true);
    const dash = t === 'imports' ? 'stroke-dasharray="3 2.5"' : '';
    return `<svg class="glyph" width="20" height="14" style="flex:none" aria-hidden="true"><line x1="1" y1="7" x2="19" y2="7" stroke="${c}" stroke-width="1.5" ${dash}/></svg>`;
  }

  function openPanel(n) {
    document.querySelector('.panel')?.remove();
    const out = G.edges.filter((e) => e.source === n.id);
    const inc = G.edges.filter((e) => e.target === n.id);
    const order = [...ETYPES, 'other'];
    const edgeByRow = [];
    const row = (e, other, extra) => {
      const o = byId.get(other);
      if (!o) return '';
      const idx = edgeByRow.length;
      edgeByRow.push(e);
      const ev = e.evidence?.[0];
      const evHtml = ev ? `<span class="ev">${esc(ev.path.replace(/^pstack\//, ''))}:${ev.line}</span>` : '';
      return `<div class="edge${extra ? ' extra' : ''}" data-id="${esc(other)}" data-edge="${idx}" ${extra ? 'hidden' : ''}>${glyph(o.kind, 12)}<span class="t">${esc(display(o))}</span><span class="type">${esc(e.type)}${e.weight > 1 ? ' ×' + e.weight : ''}</span>${evHtml}</div>`;
    };
    const sec = (title, list, end) => {
      const groups = new Map();
      const sorted = list.slice().sort((a, b) => order.indexOf(etype(a.type)) - order.indexOf(etype(b.type))
        || display(byId.get(a[end]) || { id: a[end], kind: 'other', title: a[end] }).localeCompare(display(byId.get(b[end]) || { id: b[end], kind: 'other', title: b[end] })));
      for (const e of sorted) {
        const t = etype(e.type);
        if (!groups.has(t)) groups.set(t, []);
        groups.get(t).push(e);
      }
      let html = '';
      if (!list.length) html = '<div class="sub">None</div>';
      for (const [t, l] of groups) {
        if (groups.size > 1) html += `<div class="sub">${esc(t)} <span style="font-family:var(--font-mono)">${l.length}</span></div>`;
        l.forEach((e, i) => { html += row(e, e[end], i >= 12); });
        if (l.length > 12) html += `<div class="more" data-more>Show ${l.length - 12} more</div>`;
      }
      return `<div class="sec"><h4>${title}<span class="n">${list.length}</span></h4>${html}</div>`;
    };
    const flags = n.flags && typeof n.flags === 'object' ? Object.entries(n.flags).flatMap(([k, v]) => {
      if (v === false || v == null || v === '') return [];
      if (v === true) return [k];
      if (Array.isArray(v)) return [`${k}=${v.join(',')}`];
      return [`${k}=${v}`];
    }) : [];
    const owner = clean(n.owner);
    const src = U.sourceUrlTemplate ? U.sourceUrlTemplate.replace('{path}', n.path) : '';
    const el = document.createElement('aside');
    el.className = 'panel';
    el.innerHTML = `<div class="panel-head"><span class="chip">${glyph(n.kind, 10)}${esc(KIND_LABEL[kindOf(n.kind)])} · ${esc(n.group || '')}</span><h2></h2><div class="id"></div><button class="close" type="button" aria-label="Close">×</button></div>
      <div class="panel-body"><p class="desc"></p>
      <dl class="kv"><dt>Path</dt><dd></dd><dt>Lines</dt><dd></dd>${owner ? '<dt>Owner</dt><dd class="owner"></dd>' : ''}${flags.length ? '<dt>Flags</dt><dd class="wrap flags"></dd>' : ''}</dl>
      <div class="actions">${src ? `<a class="btn" href="${esc(src)}" target="_blank" rel="noopener">View source <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M4.5 2.5h5v5M9.5 2.5 3 9"/></svg></a>` : ''}${n.kind === 'playbook' ? '<button class="btn" type="button" disabled title="Workflow view is not in this version">Show workflow</button>' : ''}</div>
      ${sec('Outgoing', out, 'target')}${sec('Incoming', inc, 'source')}</div>`;
    el.querySelector('h2').textContent = display(n);
    el.querySelector('.id').textContent = n.id;
    el.querySelector('.desc').textContent = n.description || 'No description in source.';
    if (!n.description) el.querySelector('.desc').style.color = 'var(--text-3)';
    const dds = el.querySelectorAll('.kv dd');
    dds[0].textContent = (n.path || '').replace(/^pstack\//, '');
    dds[1].textContent = n.lines ?? '';
    if (owner) {
      const odd = el.querySelector('.owner');
      if (byId.has(owner)) {
        const a = document.createElement('a');
        a.href = '#node=' + encodeURIComponent(owner);
        a.textContent = owner;
        a.onclick = (e) => { e.preventDefault(); ensureVisible(owner); focus(owner); };
        odd.appendChild(a);
      } else odd.textContent = owner;
    }
    const flagEl = el.querySelector('.flags');
    if (flagEl) flagEl.innerHTML = flags.map((f) => `<span class="tag">${esc(f)}</span>`).join('');
    el.querySelector('.close').onclick = () => unfocus();
    el.querySelectorAll('.edge').forEach((row) => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        if (byId.has(id)) { ensureVisible(id); focus(id); }
      });
      const ev = row.querySelector('.ev');
      if (!ev) return;
      ev.addEventListener('click', (e) => {
        e.stopPropagation();
        const next = row.nextElementSibling;
        if (next && next.classList.contains('quotes')) { next.remove(); return; }
        const edge = edgeByRow[Number(row.dataset.edge)];
        const quotes = document.createElement('div');
        quotes.className = 'quotes';
        quotes.innerHTML = (edge?.evidence || []).map((v) => `<div class="quote"><span>${esc(String(v.path).replace(/^pstack\//, ''))}:${v.line}</span>${esc(v.text || '')}</div>`).join('');
        row.after(quotes);
      });
    });
    el.querySelectorAll('[data-more]').forEach((btn) => {
      btn.onclick = () => {
        let sib = btn.previousElementSibling;
        while (sib && sib.classList.contains('edge')) {
          sib.hidden = false;
          sib = sib.previousElementSibling;
        }
        btn.remove();
      };
    });
    document.body.appendChild(el);
    document.getElementById('hint').style.display = 'none';
  }

  function ensureVisible(id) {
    const n = byId.get(id);
    if (!n) return;
    const k = kindOf(n.kind);
    if (!kindOn.has(k)) {
      kindOn.add(k);
      syncChecks();
      for (const o of N) o.hidden = !kindVisible(o.k);
    }
  }

  const counts = {};
  for (const n of G.nodes) {
    const k = kindOf(n.kind);
    counts[k] = (counts[k] || 0) + 1;
  }
  const ecounts = {};
  for (const e of G.edges) {
    const t = etype(e.type);
    ecounts[t] = (ecounts[t] || 0) + 1;
  }
  const legend = document.getElementById('legend');
  legend.innerHTML = `<h3>Kinds <button type="button" id="showAll">Show all</button></h3>`
    + [...KINDS, 'other'].filter((k) => counts[k]).map((k) => `<label class="row" data-kind="${k}"><input type="checkbox" checked ${k === 'router' ? 'disabled' : ''} data-kind="${k}">${glyph(k)}<span class="name">${KIND_LABEL[k]}</span><span class="count">${counts[k]}</span></label>`).join('')
    + `<div class="divider"></div><h3>Edges</h3>`
    + [...ETYPES, 'other'].filter((t) => ecounts[t]).map((t) => `<label class="row" data-type="${t}"><input type="checkbox" checked data-type="${t}">${edgeGlyph(t)}<span class="name">${t}</span><span class="count">${ecounts[t]}</span></label>`).join('');

  function syncChecks() {
    legend.querySelectorAll('input[data-kind]').forEach((input) => {
      input.checked = kindOn.has(input.dataset.kind);
      input.closest('.row').classList.toggle('off', !input.checked);
    });
    legend.querySelectorAll('input[data-type]').forEach((input) => {
      input.checked = typeOn.has(input.dataset.type);
      input.closest('.row').classList.toggle('off', !input.checked);
    });
  }
  legend.addEventListener('change', (e) => {
    const input = e.target;
    if (input.dataset.kind) {
      if (input.dataset.kind === 'router') { input.checked = true; return; }
      if (input.checked) kindOn.add(input.dataset.kind);
      else kindOn.delete(input.dataset.kind);
    }
    if (input.dataset.type) {
      if (input.checked) typeOn.add(input.dataset.type);
      else typeOn.delete(input.dataset.type);
    }
    input.closest('.row')?.classList.toggle('off', !input.checked);
    applyHidden();
  });
  document.getElementById('showAll').onclick = () => {
    for (const k of [...KINDS, 'other']) kindOn.add(k);
    for (const t of [...ETYPES, 'other']) typeOn.add(t);
    syncChecks();
    applyHidden();
  };
  document.getElementById('kindsBtn').onclick = () => document.body.classList.toggle('legend-open');

  document.getElementById('ver').textContent = U.version ? 'pstack ' + U.version : '';
  document.getElementById('commit').textContent = U.commitShort || (U.commit || '').slice(0, 7);
  document.getElementById('commitLink').href = U.url && U.commit ? `${U.url}/commit/${U.commit}` : '#';
  document.getElementById('date').textContent = U.commitDate
    ? 'data ' + new Date(U.commitDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : '';
  document.getElementById('srcLink').href = U.url && U.commit ? `${U.url}/tree/${U.commit}/${U.pluginPath || 'pstack'}` : 'https://github.com/cursor/plugins/tree/main/pstack';
  document.getElementById('licLink').href = U.licenseUrl || 'https://github.com/cursor/plugins/blob/main/pstack/LICENSE';
  const debug = document.getElementById('debug');
  const drawnNodes = N.length;
  const drawnEdges = E.length;
  debug.textContent = `${G.nodes.length} nodes · ${G.edges.length} edges${layout.ok && drawnNodes === G.nodes.length && drawnEdges === G.edges.length ? '' : ' · layout check failed'}`;
  debug.dataset.nodes = String(drawnNodes);
  debug.dataset.edges = String(drawnEdges);
  debug.dataset.graphNodes = String(G.nodes.length);
  debug.dataset.graphEdges = String(G.edges.length);
  debug.dataset.layout = layout.ok && drawnNodes === G.nodes.length && drawnEdges === G.edges.length ? 'ok' : 'fail';
  if (debug.dataset.layout === 'fail') debug.dataset.layoutErrors = layout.errors.join('; ');

  document.getElementById('reset').onclick = () => {
    if (FOCUS) unfocus();
    camTo(new THREE.Vector3(), 345, 0.35, 0.46, 700);
    dirty = true;
  };
  if (matchMedia('(pointer: coarse)').matches) {
    document.getElementById('hint').textContent = 'Drag to orbit · pinch to zoom · two fingers to pan';
  }

  const q = document.getElementById('q');
  const resultsEl = document.getElementById('results');
  let active = 0;
  let resultIds = [];
  function strip(s) {
    return String(s || '').toLowerCase().replace(/^principle-/, '').replace(/^playbook:/, '').replace(/^script:/, '').replace(/^ref:/, '').replace(/^\//, '');
  }
  function scoreField(query, field) {
    const f = strip(field);
    if (!f || !query) return 0;
    if (f === query) return 100;
    if (f.startsWith(query)) return 80;
    if (f.split(/[\s\-/.:]+/).some((w) => w.startsWith(query))) return 60;
    if (f.includes(query)) return 40;
    let i = 0;
    let gaps = 0;
    let last = -1;
    for (const ch of query) {
      const j = f.indexOf(ch, i);
      if (j < 0) return 0;
      if (last >= 0) gaps += j - last - 1;
      last = j;
      i = j + 1;
    }
    return Math.max(0, 20 - gaps);
  }
  function search(query) {
    const qn = strip(query.trim());
    if (!qn) return [];
    const kindPri = Object.fromEntries([...KINDS, 'other'].map((k, i) => [k, i]));
    const hits = [];
    for (const n of G.nodes) {
      const fields = [display(n), n.id, n.name, n.title];
      const score = Math.max(...fields.map((f) => scoreField(qn, f)));
      if (score <= 0) continue;
      hits.push({ n, score, k: kindOf(n.kind), deg: deg(n.id), label: display(n) });
    }
    hits.sort((a, b) => b.score - a.score || kindPri[a.k] - kindPri[b.k] || b.deg - a.deg || a.label.localeCompare(b.label));
    return hits.slice(0, 8);
  }
  function highlight(label, query) {
    const raw = query.trim().replace(/^\//, '');
    const i = label.toLowerCase().indexOf(raw.toLowerCase());
    if (i < 0 || !raw) return esc(label);
    return esc(label.slice(0, i)) + '<b>' + esc(label.slice(i, i + raw.length)) + '</b>' + esc(label.slice(i + raw.length));
  }
  function renderResults(note) {
    if (note) {
      resultsEl.hidden = false;
      resultsEl.innerHTML = `<div class="res note"></div>`;
      resultsEl.querySelector('.note').textContent = note;
      resultIds = [];
      return;
    }
    const hits = search(q.value);
    resultIds = hits.map((h) => h.n.id);
    if (!q.value.trim()) { resultsEl.hidden = true; resultsEl.innerHTML = ''; return; }
    resultsEl.hidden = false;
    if (!hits.length) {
      resultsEl.innerHTML = `<div class="res note"></div>`;
      resultsEl.querySelector('.note').textContent = `No match for "${q.value.trim()}"`;
      return;
    }
    active = Math.min(active, hits.length - 1);
    resultsEl.innerHTML = hits.map((h, i) => {
      const hidden = !kindVisible(h.n.kind);
      return `<div class="res${i === active ? ' active' : ''}" data-i="${i}">${glyph(h.n.kind, 12)}<span class="hit">${highlight(h.label, q.value)}</span>${hidden ? '<span class="hid">hidden</span>' : ''}<span class="kind">${KIND_LABEL[h.k]}</span></div>`;
    }).join('');
    resultsEl.querySelectorAll('.res[data-i]').forEach((row) => {
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        pickResult(Number(row.dataset.i));
      });
      row.addEventListener('mousemove', () => {
        active = Number(row.dataset.i);
        resultsEl.querySelectorAll('.res').forEach((r) => r.classList.toggle('active', Number(r.dataset.i) === active));
      });
    });
  }
  function pickResult(i) {
    const id = resultIds[i];
    if (!id) return;
    ensureVisible(id);
    resultsEl.hidden = true;
    q.blur();
    focus(id);
  }
  q.addEventListener('input', () => { active = 0; renderResults(); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, Math.max(0, resultIds.length - 1)); renderResults(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); renderResults(); }
    else if (e.key === 'Enter') { e.preventDefault(); pickResult(active); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); q.value = ''; resultsEl.hidden = true; }
  });
  q.addEventListener('focus', () => { if (q.value.trim()) renderResults(); });

  addEventListener('keydown', (e) => {
    const typing = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
    if (e.key === '/' && !typing) { e.preventDefault(); q.focus(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); q.focus(); return; }
    if (e.key === 'Escape' && !typing) unfocus();
  });

  function applyHash() {
    const id = hashId();
    if (!id) {
      if (FOCUS) unfocus({ fromHash: true });
      return;
    }
    if (!NB.has(id)) {
      renderResults(`No node with id "${id}"`);
      return;
    }
    if (FOCUS !== id) focus(id, { fromHash: true });
  }
  addEventListener('hashchange', applyHash);
  addEventListener('popstate', applyHash);

  const M4 = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const S = new THREE.Vector3();
  const C = new THREE.Color();
  const DIM = new THREE.Color(css('--dim'));
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const P0 = new THREE.Vector3();
  const P1 = new THREE.Vector3();
  const T = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  function curve(a, b, t, out, mode, side) {
    if (mode === 'focus') {
      const len = a.distanceTo(b) || 1;
      const c1 = a.clone();
      const c2 = b.clone();
      const sv = FS.Rv.clone().multiplyScalar(side);
      if (side > 0) {
        c1.addScaledVector(sv, len * 0.5);
        c2.addScaledVector(b.clone().sub(a).normalize(), -len * 0.25);
      } else {
        c1.addScaledVector(a.clone().normalize(), -len * 0.25);
        c2.addScaledVector(sv, len * 0.5);
      }
      const mt = 1 - t;
      return out.copy(a).multiplyScalar(mt * mt * mt).addScaledVector(c1, 3 * mt * mt * t).addScaledVector(c2, 3 * mt * t * t).addScaledVector(b, t * t * t);
    }
    const len = a.distanceTo(b);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 + len * 0.14;
    const mz = (a.z + b.z) / 2;
    const mt = 1 - t;
    return out.set(
      a.x * mt * mt + 2 * mx * mt * t + b.x * t * t,
      a.y * mt * mt + 2 * my * mt * t + b.y * t * t,
      a.z * mt * mt + 2 * mz * mt * t + b.z * t * t,
    );
  }
  function trimmed(x) {
    const so = NB.get(x.e.source);
    const to = NB.get(x.e.target);
    const d = T.copy(to.pos).sub(so.pos);
    const len = d.length() || 1;
    d.multiplyScalar(1 / len);
    A.copy(so.pos).addScaledVector(d, so.sc * 1.05);
    B.copy(to.pos).addScaledVector(d, -to.sc * 1.05);
  }
  function writeEdges(list, geo, mode) {
    const arr = geo.attributes.instanceStart.data.array;
    const segs = mode === 'focus' ? SEG_HL : SEG;
    list.forEach((x, i) => {
      const shown = mode === 'focus' ? edgeShown(x) : edgeShown(x);
      if (!shown) {
        for (let s = 0; s < segs; s++) arr.set([0, 0, 0, 0, 0, 0], (i * segs + s) * 6);
        return;
      }
      trimmed(x);
      const side = mode === 'focus' ? (x.e.source === FOCUS ? 1 : -1) : 0;
      for (let s = 0; s < segs; s++) {
        curve(A, B, s / segs, P0, mode, side);
        curve(A, B, (s + 1) / segs, P1, mode, side);
        arr.set([P0.x, P0.y, P0.z, P1.x, P1.y, P1.z], (i * segs + s) * 6);
      }
    });
    geo.attributes.instanceStart.data.needsUpdate = true;
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
      const p = FOCUS ? (o.lmode === 'sel' ? -1 : 1) : (hoverId && (o.id === hoverId) ? -1 : LABEL_PRI[o.k] ?? 4);
      items.push({ o, p, d: camera.position.distanceTo(o.pos) });
    }
    items.sort((a, b) => a.p - b.p || a.d - b.d);
    const placed = [];
    for (const it of items) {
      const r = it.o.el.getBoundingClientRect();
      if (!r.width) continue;
      const hit = placed.some((q) => r.left < q.right + 2 && r.right > q.left - 2 && r.top < q.bottom + 1 && r.bottom > q.top - 1);
      if (hit && it.p > 0) it.o.el.style.visibility = 'hidden';
      else placed.push(r);
    }
  }

  let booted = false;
  let hoverRingKey = -1;
  function frame(now) {
    requestAnimationFrame(frame);
    if (pendingHover && !(drag && drag.moved > 4)) {
      const id = pendingHover.touch ? null : pick(pendingHover.x, pendingHover.y);
      setHover(id, pendingHover);
      pendingHover = null;
    }
    if (camTw) {
      const p = camTw.dur ? Math.min(1, (now - camTw.t0) / camTw.dur) : 1;
      const e = ease(p);
      cam.target.lerpVectors(camTw.s.target, camTw.e.target, e);
      cam.dist = THREE.MathUtils.lerp(camTw.s.dist, camTw.e.dist, e);
      cam.az = THREE.MathUtils.lerp(camTw.s.az, camTw.e.az, e);
      cam.el = THREE.MathUtils.lerp(camTw.s.el, camTw.e.el, e);
      if (p >= 1) camTw = null;
    }
    if (idleTw) {
      const p = idleTw.dur ? THREE.MathUtils.clamp((now - idleTw.t0) / idleTw.dur, 0, 1) : (now >= idleTw.t0 ? 1 : 0);
      idleAlpha = THREE.MathUtils.lerp(idleTw.from, idleTw.to, p);
      if (p >= 1) idleTw = null;
    }
    applyCam();
    let anyAnim = !!camTw || !!idleTw;
    for (const o of N) {
      const p = o.dur ? THREE.MathUtils.clamp((now - o.t0) / o.dur, 0, 1) : 1;
      if (p < 1) anyAnim = true;
      const e = ease(Math.max(0, p));
      o.pos.lerpVectors(o.from, o.to, e);
      o.sc = THREE.MathUtils.lerp(o.scFrom, o.scTo, e);
      o.dim = THREE.MathUtils.lerp(o.dimFrom, o.dimTo, easeOut(Math.max(0, p)));
      o.prog = p;
      const scale = o.hidden ? 0 : o.sc;
      if (o.mesh) {
        o.mesh.position.copy(o.pos);
        o.mesh.scale.setScalar(scale);
        starMat.uniforms.dim.value = o.dim;
        continue;
      }
      Q.setFromEuler(o.rot);
      M4.compose(o.pos, Q, S.setScalar(scale));
      o.im.setMatrixAt(o.i, M4);
      const dimAmt = o.dim * (FOCUS ? 0.9 : 0.85);
      C.copy(o.base).lerp(DIM, dimAmt);
      o.im.setColorAt(o.i, C);
    }
    for (const im of Object.values(inst)) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    sunLight.position.copy(starNode.pos);
    for (const d of decor) {
      const hide = d.o.hidden || (FOCUS && d.o.lmode === 'hide');
      d.s.visible = !hide;
      d.s.position.copy(d.o.pos);
      d.s.scale.setScalar(d.o.sc * d.f);
      d.s.material.opacity = d.op * (1 - d.o.dim);
    }
    for (const p of pring) {
      const hide = p.o.hidden || (FOCUS && p.o.lmode === 'hide');
      p.m.visible = !hide;
      p.m.position.copy(p.o.pos);
      p.m.scale.setScalar(p.o.sc);
      p.m.material.opacity = 0.32 * (1 - p.o.dim);
    }
    for (const l of orbitObjs) l.material.opacity = idleAlpha;
    if (anyAnim || dirty) {
      for (const t of Object.keys(idle)) {
        const I = idle[t];
        writeEdges(I.list, I.g, 'home');
        if (t === 'imports') I.l.computeLineDistances();
      }
      if (hl.l) writeEdges(hl.list, hl.g, FOCUS ? 'focus' : 'home');
    }
    const hoverMul = hoverId && !FOCUS ? 0.15 : 1;
    for (const t of Object.keys(idle)) {
      idle[t].l.material.opacity = idle[t].base * idleAlpha * hoverMul;
      idle[t].l.visible = typeVisible(t) && idleAlpha > 0.01;
    }
    let ai = 0;
    const hlFade = hl.l ? (FOCUS ? 1 - idleAlpha : 1) : 0;
    if (hl.l) {
      hl.l.material.opacity = hlFade;
      hl.l.material.transparent = hlFade < 0.999;
      hl.l.visible = hlFade > 0.01;
      for (const x of hl.list) {
        if (ai >= 160 || !edgeShown(x)) continue;
        trimmed(x);
        const side = x.e.source === FOCUS ? 1 : -1;
        const mode = FOCUS ? 'focus' : 'home';
        curve(A, B, 0.94, P0, mode, side);
        const d = T.copy(B).sub(P0);
        if (d.lengthSq() < 1e-8) d.set(0, 1, 0);
        d.normalize();
        M4.compose(B.clone().addScaledVector(d, -0.9), Q.setFromUnitVectors(UP, d), S.set(1, 1, 1));
        arrows.setMatrixAt(ai, M4);
        arrows.setColorAt(ai, new THREE.Color(ecolor(x.t, true)));
        ai++;
      }
    }
    arrows.count = ai;
    arrows.material.opacity = hlFade;
    arrows.instanceMatrix.needsUpdate = true;
    if (arrows.instanceColor) arrows.instanceColor.needsUpdate = true;

    const ho = hoverId ? NB.get(hoverId) : null;
    if (ho && !ho.hidden) {
      const inner = Math.max(ho.sc, 0.2) * 1.6;
      if (Math.abs(inner - hoverRingKey) > 0.02) {
        hoverRing.geometry.dispose();
        hoverRing.geometry = new THREE.RingGeometry(inner, inner + 0.35, 64);
        hoverRingKey = inner;
      }
      hoverRing.visible = true;
      hoverRing.position.copy(ho.pos);
      hoverRing.quaternion.copy(camera.quaternion);
    } else hoverRing.visible = false;

    const labelMax = narrow() ? 20 : 24;
    let cx = 0;
    if (FOCUS) {
      const v = NB.get(FOCUS).pos.clone().project(camera);
      cx = v.x;
    }
    const hoverKeep = hoverId && !FOCUS ? new Set([hoverId]) : null;
    if (hoverKeep) {
      for (const e of G.edges) {
        if (!typeVisible(e.type)) continue;
        if (e.source === hoverId && !nodeHidden(e.target)) hoverKeep.add(e.target);
        if (e.target === hoverId && !nodeHidden(e.source)) hoverKeep.add(e.source);
      }
    }
    for (const o of N) {
      if (o.hidden) { o.lo.visible = false; continue; }
      if (FOCUS) {
        if (o.lmode === 'hide') { o.lo.visible = false; continue; }
        o.lo.visible = true;
        if (o.lmode === 'sel') {
          setAnchor(o, 'c');
          o.el.className = 'lbl sel';
          o.el.textContent = display(o.n);
          o.lo.position.copy(o.pos);
          o.lo.position.y -= o.sc * 1.25;
        } else {
          const v = o.pos.clone().project(camera);
          const left = v.x < cx;
          setAnchor(o, left ? 'l' : 'r');
          o.el.className = 'lbl' + (SMALL_KINDS.includes(o.k) ? ' small' : '');
          o.el.textContent = trunc(display(o.n), narrow() ? 20 : 30);
          const rv = T.setFromMatrixColumn(camera.matrixWorld, 0);
          o.lo.position.copy(o.pos).addScaledVector(rv, (left ? -1 : 1) * (o.sc * 1.2 + 0.8));
        }
        o.anc.style.opacity = (o.prog > 0.6 || reduced) ? 1 : 0;
      } else {
        setAnchor(o, 'c');
        o.anc.style.opacity = 1;
        o.el.className = 'lbl ' + (o.k === 'router' ? 'router' : SMALL_KINDS.includes(o.k) ? 'small' : '');
        o.el.textContent = trunc(display(o.n), labelMax);
        const lod = o.k === 'router' || o.k === 'playbook'
          || (MID_KINDS.includes(o.k) && cam.dist < 200)
          || (SMALL_KINDS.includes(o.k) && cam.dist < 115);
        const hovered = hoverKeep && hoverKeep.has(o.id);
        o.lo.visible = lod || hovered || o.k === 'router';
        if (hoverKeep && !hoverKeep.has(o.id) && o.k !== 'router') o.lo.visible = false;
        o.lo.position.copy(o.pos);
        o.lo.position.y -= o.sc * 1.35;
      }
    }
    for (const h of hdrs) {
      const o = h.node;
      if (!o) continue;
      const rv = T.setFromMatrixColumn(camera.matrixWorld, 0);
      h.lo.position.copy(o.pos).addScaledVector(rv, h.side * (o.sc * 1.2 + 0.8));
    }
    renderer.render(scene, camera);
    labelR.render(scene, camera);
    declutter();
    dirty = false;
    if (!booted) {
      booted = true;
      finishBoot();
      document.documentElement.dataset.pstackReady = '1';
    }
  }

  addEventListener('resize', () => {
    renderer.setSize(W(), H());
    labelR.setSize(W(), H());
    camera.aspect = W() / Math.max(1, H());
    camera.updateProjectionMatrix();
    for (const m of lineMats) m.resolution.set(W(), H());
    const fb = document.getElementById('focusbar');
    if (FOCUS) fb.style.left = ((narrow() ? W() : W() - PW) / 2) + 'px';
    dirty = true;
  });

  viewX = overviewViewX();
  applyCam();
  requestAnimationFrame(frame);

  function nodeScreen(id) {
    const o = NB.get(id);
    if (!o) return null;
    const v = o.pos.clone().project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + (v.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-v.y * 0.5 + 0.5) * rect.height,
      z: v.z,
    };
  }
  window.__pstack = {
    ready: true,
    nodes: G.nodes.length,
    edges: G.edges.length,
    drawnNodes,
    drawnEdges,
    layoutOk: debug.dataset.layout === 'ok',
    layoutErrors: layout.errors,
    home: Object.fromEntries([...home].map(([id, p]) => [id, { x: p.x, y: p.y, z: p.z }])),
    focus: (id) => focus(id),
    unfocus: () => unfocus(),
    nodeScreen,
    state: () => ({
      hover: hoverId,
      focus: FOCUS,
      panel: document.querySelector('.panel h2')?.textContent ?? null,
      dims: Object.fromEntries(N.map((o) => [o.id, Number(o.dim.toFixed(3))])),
    }),
    positions: () => Object.fromEntries(N.map((o) => [o.id, { x: o.pos.x, y: o.pos.y, z: o.pos.z, k: o.k, hidden: !!o.hidden }])),
  };

  if (hashId()) focus(hashId(), { fromHash: true });
  else if (qs.get('focus') && NB.has(qs.get('focus'))) {
    const delay = Number(qs.get('delay') || 300);
    setTimeout(() => focus(qs.get('focus')), delay);
  }
  if (qs.get('orbit')) {
    const delay = Number(qs.get('delay') || 300);
    setTimeout(() => {
      const d = THREE.MathUtils.degToRad(Number(qs.get('orbit')));
      if (camTw) camTw.e.az += d;
      else cam.az += d;
      dirty = true;
    }, delay + 50);
  }
  if (qs.get('unfocus')) setTimeout(() => unfocus(), Number(qs.get('unfocus')));
}
