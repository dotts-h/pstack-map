#!/usr/bin/env node
// Every connection must meet its body: the curve endpoint sits on the sphere
// in the direction of the other end, in the overview, mid-orbit, and focus.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

globalThis.location = { search: '', href: 'http://localhost/', hostname: 'localhost' };
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.innerWidth = 1600;
globalThis.innerHeight = 900;
globalThis.document = {
  createElement: () => ({ getContext: () => null, style: {}, width: 0, height: 0 }),
  querySelector: () => null,
  getElementById: () => null,
  addEventListener() {},
  body: { classList: { contains: () => false, add() {}, remove() {}, toggle() {} } },
};
globalThis.window = globalThis;

await register(new URL('./resolve-three.mjs', import.meta.url), pathToFileURL('./'));

const fs = await import('node:fs');
const { galaxyTheme } = await import('../galaxy.mjs');
const { kindOf, KINDS, plainName } = await import('../copy.mjs');
const THREE = await import('three');

const file = process.argv[2] ?? 'data/graph.json';
const G = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = new Map(G.nodes.map((n) => [n.id, n]));
const nm = (id) => plainName(byId.get(id)) || id;
const deg = (id) => byId.get(id)?.degree?.total ?? 0;
const theme = galaxyTheme({ G, byId, kindOf, deg, css: () => '#888', reduced: false, nm });

const errors = [];
const tmp = new THREE.Vector3();
function rim(center, radius, toward, out) {
  out.copy(toward).sub(center);
  if (out.lengthSq() < 1e-10) out.set(1, 0, 0);
  else out.normalize();
  return out.multiplyScalar(radius).add(center);
}
function checkEnds(label, pos, radiusOfId, mode, FS) {
  let n = 0;
  for (const e of G.edges) {
    const a = pos.get(e.source);
    const b = pos.get(e.target);
    if (!a || !b) {
      errors.push(`${label}: missing position ${e.source} -> ${e.target}`);
      continue;
    }
    const ra = radiusOfId(e.source);
    const rb = radiusOfId(e.target);
    const A = rim(a, ra, b, new THREE.Vector3());
    const B = rim(b, rb, a, new THREE.Vector3());
    const side = mode === 'focus' ? (e.source === FS?.focus ? 1 : -1) : 0;
    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    theme.curve(A, B, 0, p0, mode, side, FS);
    theme.curve(A, B, 1, p1, mode, side, FS);
    const d0 = p0.distanceTo(a);
    const d1 = p1.distanceTo(b);
    const tol = (r) => Math.max(0.05, r * 0.02);
    if (p0.distanceTo(A) > tol(ra) || Math.abs(d0 - ra) > tol(ra)) {
      errors.push(`${label}: ${e.source} end off by ${p0.distanceTo(A).toFixed(3)} (radius ${ra.toFixed(2)}, dist ${d0.toFixed(2)}) -> ${e.target}`);
    }
    if (p1.distanceTo(B) > tol(rb) || Math.abs(d1 - rb) > tol(rb)) {
      errors.push(`${label}: ${e.target} end off by ${p1.distanceTo(B).toFixed(3)} (radius ${rb.toFixed(2)}, dist ${d1.toFixed(2)}) <- ${e.source}`);
    }
    n += 1;
    if (errors.length > 12) return n;
  }
  return n;
}

const homeR = (id) => theme.radiusOf(byId.get(id));
const pose0 = theme.poseAt(0);
const nHome = checkEnds('overview', pose0, homeR, 'home', null);
const midT = 25000;
const poseM = theme.poseAt(midT);
let moved = 0;
pose0.forEach((p, id) => {
  if (p.distanceTo(poseM.get(id)) > 1) moved += 1;
});
if (!moved) errors.push('mid-orbit: no body moved; the orbit sample is vacuous');
const nOrbit = checkEnds('mid-orbit', poseM, homeR, 'home', null);

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
function checkFocus(id) {
  const C = pose0.get(id).clone();
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 8000);
  const az = 0.42;
  const el = 0.95;
  const dist = 400;
  camera.position.set(
    C.x + dist * Math.cos(el) * Math.sin(az),
    C.y + dist * Math.sin(el),
    C.z + dist * Math.cos(el) * Math.cos(az),
  );
  camera.lookAt(C);
  camera.updateMatrixWorld(true);
  const laid = theme.focusLayout({
    id, C, cam: { az, el }, camera,
    neighbours: neighbours(id),
    mobile: false, W: 1600, H: 900, vf: THREE.MathUtils.degToRad(40),
    byId, kindOf, deg, KINDS,
  });
  const pos = new Map(pose0);
  const rad = new Map();
  laid.member.forEach((m, nid) => {
    pos.set(nid, m.p.clone());
    const n = byId.get(nid);
    const o = { id: nid, k: kindOf(n.kind), r: theme.radiusOf(n) };
    rad.set(nid, theme.focusScale(o, laid.ppu, id));
  });
  const FS = { Rv: laid.Rv, C, focus: id };
  let n = 0;
  for (const e of G.edges) {
    if (!laid.member.has(e.source) || !laid.member.has(e.target)) continue;
    const a = pos.get(e.source);
    const b = pos.get(e.target);
    const ra = rad.get(e.source);
    const rb = rad.get(e.target);
    const A = rim(a, ra, b, new THREE.Vector3());
    const B = rim(b, rb, a, new THREE.Vector3());
    const side = e.source === id ? 1 : -1;
    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    theme.curve(A, B, 0, p0, 'focus', side, FS);
    theme.curve(A, B, 1, p1, 'focus', side, FS);
    const tol = (r) => Math.max(0.05, r * 0.02);
    if (p0.distanceTo(A) > tol(ra) || Math.abs(p0.distanceTo(a) - ra) > tol(ra)) {
      errors.push(`focus ${id}: ${e.source} end off (gap ${p0.distanceTo(A).toFixed(3)}, radius ${ra.toFixed(2)})`);
    }
    if (p1.distanceTo(B) > tol(rb) || Math.abs(p1.distanceTo(b) - rb) > tol(rb)) {
      errors.push(`focus ${id}: ${e.target} end off (gap ${p1.distanceTo(B).toFixed(3)}, radius ${rb.toFixed(2)})`);
    }
    n += 1;
    if (errors.length > 24) return n;
  }
  if (!n) errors.push(`focus ${id}: no member edges`);
  return n;
}

const leaf = G.nodes.find((n) => n.kind !== 'router' && (n.degree?.total || 0) <= 1);
const focusCounts = {
  how: checkFocus('how'),
  core: checkFocus('poteto-mode'),
  leaf: checkFocus(leaf.id),
};

if (errors.length) {
  console.error(`${file}: curve endpoints failed\n- ${errors.slice(0, 24).join('\n- ')}`);
  process.exit(1);
}
console.log(`${file}: curve endpoints ok (overview ${nHome}, orbit ${nOrbit}, moved ${moved}, focus how ${focusCounts.how}, core ${focusCounts.core}, leaf ${focusCounts.leaf} ${leaf.id})`);
void tmp;
