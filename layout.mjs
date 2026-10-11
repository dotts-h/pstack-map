// Home layout for the pstack map. Pure data: the page and scripts/check-layout.mjs share it
// so the shell check runs on the same positions the scene draws.
// DESIGN.md v3 §5. The rhombus fold matches the prototype: when y < 0, x and z fold
// onto the lower half and y is left negative (it is not recomputed).

import { kindOf, plainName } from './copy.mjs';

export const SHELLS = {
  sphere: [62, 108, 150, 192],
  rhombus: [96, 148, 196, 244],
};

const LAYERS = [
  { kinds: ['playbook'] },
  { kinds: ['skill', 'agent', 'automation', 'other'] },
  { kinds: ['principle'] },
  { kinds: ['reference', 'script'] },
];

const GOLD = Math.PI * (3 - Math.sqrt(5));
const YS = 1.15;

function v(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

function add(a, b) {
  return v(a.x + b.x, a.y + b.y, a.z + b.z);
}

function scale(a, s) {
  return v(a.x * s, a.y * s, a.z * s);
}

function len(a) {
  return Math.hypot(a.x, a.y, a.z);
}

function normalize(a) {
  const l = len(a);
  return l ? scale(a, 1 / l) : v();
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function fib(n, phase) {
  const slots = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const s = Math.sqrt(Math.max(0, 1 - y * y));
    const t = i * GOLD + phase;
    slots.push(normalize(v(Math.cos(t) * s, y * 0.92, Math.sin(t) * s)));
  }
  return slots;
}

// Unit octahedron. y stays negative on the folded corners, matching the prototype.
function octa(n, phase) {
  const slots = [];
  for (let i = 0; i < n; i++) {
    let x = (2 * (i + 0.5)) / n - 1;
    let z = 2 * ((i * 0.6180339887 + phase) % 1) - 1;
    const y = 1 - Math.abs(x) - Math.abs(z);
    if (y < 0) {
      const x2 = (1 - Math.abs(z)) * Math.sign(x);
      const z2 = (1 - Math.abs(x)) * Math.sign(z);
      x = x2;
      z = z2;
    }
    slots.push(v(x, y, z));
  }
  return slots;
}

const OCTA_VERTICES = [
  v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0), v(0, -1, 0), v(0, 0, 1), v(0, 0, -1),
];
const OCTA_EDGES = [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [4, 3], [3, 5], [5, 2]];

function lerp(a, b, t) {
  return v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
}

function octaEdges(n) {
  const k = Math.ceil(n / 12);
  const slots = [];
  for (let j = 0; j < k; j++) {
    for (const [p, q] of OCTA_EDGES) slots.push(lerp(OCTA_VERTICES[p], OCTA_VERTICES[q], (j + 0.5) / k));
  }
  return slots;
}

function toShell(slot, radius, shape) {
  const p = scale(slot, radius);
  if (shape === 'rhombus') p.y *= YS;
  return p;
}

function deg(node) {
  return node.degree?.total ?? 0;
}

function clean(s) {
  return s && s !== 'None' ? s : null;
}

export function homePositions(graph, shape = 'sphere') {
  const mode = shape === 'rhombus' ? 'rhombus' : 'sphere';
  const radii = SHELLS[mode];
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const router = nodes.find((n) => n.kind === 'router');
  if (!router) throw new Error('no router node');

  const names = new Map(nodes.map((n) => [n.id, plainName(n)]));
  const home = new Map();
  const dirOf = new Map();
  home.set(router.id, v());

  const layers = LAYERS.map((layer, i) => ({ ...layer, r: radii[i] }));
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    const list = nodes.filter((n) => layer.kinds.includes(kindOf(n.kind)));
    const slots = mode === 'sphere'
      ? fib(list.length, li * 1.1 + 0.35)
      : li === layers.length - 1
        ? octaEdges(list.length)
        : octa(list.length, li * 0.31 + 0.17);
    const free = slots.map(() => true);

    function target(node) {
      let sum = v();
      for (const edge of edges) {
        const other = edge.source === node.id ? edge.target : edge.target === node.id ? edge.source : null;
        if (other && dirOf.has(other)) sum = add(sum, dirOf.get(other));
      }
      const owner = clean(node.owner);
      if (owner && dirOf.has(owner)) sum = add(sum, scale(dirOf.get(owner), 3));
      return len(sum) > 1e-6 ? normalize(sum) : null;
    }

    const order = list.slice().sort((a, b) => (
      (target(b) ? 1 : 0) - (target(a) ? 1 : 0)
      || deg(b) - deg(a)
      || names.get(a.id).localeCompare(names.get(b.id))
    ));

    let next = 0;
    for (const node of order) {
      const aim = target(node);
      let best = -1;
      if (aim) {
        let bestDot = -9;
        slots.forEach((slot, i) => {
          if (!free[i]) return;
          const d = dot(normalize(slot), aim);
          if (d > bestDot) {
            bestDot = d;
            best = i;
          }
        });
      } else {
        while (next < free.length && !free[next]) next++;
        best = next;
      }
      if (best < 0 || best >= slots.length) throw new Error(`no free slot for ${node.id}`);
      free[best] = false;
      dirOf.set(node.id, normalize(slots[best]));
      home.set(node.id, toShell(slots[best], layer.r, mode));
    }
  }

  for (const node of nodes) {
    if (!home.has(node.id)) home.set(node.id, v(0, 40, 0));
  }
  return home;
}

function finitePos(p) {
  return !!p && [p.x, p.y, p.z].every((n) => Number.isFinite(n));
}

function radiusOf(p) {
  return Math.hypot(p.x, p.y, p.z);
}

const SPHERE_RADIUS = {
  playbook: SHELLS.sphere[0],
  skill: SHELLS.sphere[1],
  agent: SHELLS.sphere[1],
  automation: SHELLS.sphere[1],
  other: SHELLS.sphere[1],
  principle: SHELLS.sphere[2],
  reference: SHELLS.sphere[3],
  script: SHELLS.sphere[3],
};

export function checkLayout(graph) {
  const errors = [];
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const ids = nodes.map((n) => n.id);
  if (new Set(ids).size !== ids.length) errors.push('duplicate node id');

  let sphere = null;
  let rhombus = null;
  try {
    sphere = homePositions(graph, 'sphere');
    rhombus = homePositions(graph, 'rhombus');
  } catch (e) {
    errors.push(e.message);
    return { ok: false, errors, positions: sphere, summary: e.message };
  }

  for (const [label, positions] of [['sphere', sphere], ['rhombus', rhombus]]) {
    if (positions.size !== nodes.length) errors.push(`${label}: positions ${positions.size} != nodes ${nodes.length}`);
    for (const node of nodes) {
      const p = positions.get(node.id);
      if (!p) errors.push(`${label}: missing position for ${node.id}`);
      else if (!finitePos(p)) errors.push(`${label}: non-finite position for ${node.id}`);
    }
  }

  const routers = nodes.filter((n) => n.kind === 'router');
  if (routers.length !== 1) errors.push(`expected 1 router, found ${routers.length}`);
  else {
    for (const positions of [sphere, rhombus]) {
      const p = positions.get(routers[0].id);
      if (radiusOf(p) > 1e-6) errors.push('router is not at the centre');
    }
  }

  for (const node of nodes) {
    const expected = SPHERE_RADIUS[kindOf(node.kind)];
    if (expected == null) continue;
    const r = radiusOf(sphere.get(node.id));
    if (Math.abs(r - expected) > 1e-4) {
      errors.push(`${node.id} (${node.kind}) sphere r=${r.toFixed(3)}, expected ${expected}`);
    }
  }

  const playbooks = nodes.filter((n) => n.kind === 'playbook');
  if (playbooks.length) {
    const widened = playbooks.some((n) => Math.abs(radiusOf(rhombus.get(n.id)) - SHELLS.sphere[0]) > 1);
    if (!widened) errors.push('rhombus playbooks are still on the sphere shell');
  }

  const idSet = new Set(ids);
  for (const [i, edge] of edges.entries()) {
    if (!idSet.has(edge.source)) errors.push(`edges[${i}] source ${edge.source} is not a node`);
    if (!idSet.has(edge.target)) errors.push(`edges[${i}] target ${edge.target} is not a node`);
  }

  const summary = `${nodes.length} nodes, ${edges.length} edges, router centred, sphere shells ${SHELLS.sphere.join('/')}`;
  return { ok: errors.length === 0, errors, positions: sphere, summary };
}
