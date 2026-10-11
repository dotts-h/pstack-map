// Home layout for the pstack map. Pure data: the page and scripts/check-layout.mjs share it
// so the ring check runs on the same positions the scene draws.
// Radii and ordering follow DESIGN.md v2.1 §5.

const KINDS = ['router', 'playbook', 'skill', 'principle', 'agent', 'automation', 'script', 'reference'];
const KMUL = { router: 1, playbook: 1, skill: 1, principle: 1, agent: 1, automation: 1, script: 0.75, reference: 0.62, other: 0.8 };
const GROUP_ORDER = ['core', 'architecture', 'verification', 'delegation', 'meta'];

export const RINGS = {
  playbook: { r: 62, y: 0 },
  middle: { r: 108, y: -22 },
  principle: { r: 152, y: 14 },
};

export function kindOf(kind) {
  return KINDS.includes(kind) ? kind : 'other';
}

function clean(s) {
  return s && s !== 'None' ? s : null;
}

function deg(node) {
  return node.degree?.total ?? 0;
}

function v(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

function radiusOf(node, maxDeg) {
  if (node.kind === 'router') return 10;
  const frac = maxDeg ? deg(node) / maxDeg : 0;
  return KMUL[kindOf(node.kind)] * (1.3 + 4.4 * Math.sqrt(frac));
}

export function homePositions(graph) {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const router = nodes.find((n) => n.kind === 'router');
  if (!router) throw new Error('no router node');

  const maxDeg = Math.max(0, ...nodes.filter((n) => n.kind !== 'router').map(deg));
  const home = new Map();
  home.set(router.id, v());

  function ring(list, radius, y, offset = 0) {
    if (!list.length) return;
    list.forEach((n, i) => {
      const a = offset + (i / list.length) * Math.PI * 2;
      home.set(n.id, v(Math.cos(a) * radius, y, Math.sin(a) * radius));
    });
  }

  function angOf(id) {
    const p = home.get(id);
    return Math.atan2(p.z, p.x);
  }

  function meanAngle(id) {
    let sx = 0;
    let sy = 0;
    for (const e of edges) {
      const other = e.source === id ? e.target : e.target === id ? e.source : null;
      if (other && other !== router.id && home.has(other)) {
        const a = angOf(other);
        sx += Math.cos(a);
        sy += Math.sin(a);
      }
    }
    return sx || sy ? Math.atan2(sy, sx) : 0;
  }

  ring(nodes.filter((n) => n.kind === 'playbook'), RINGS.playbook.r, RINGS.playbook.y);

  const mids = nodes.filter((n) => ['skill', 'agent', 'automation', 'other'].includes(kindOf(n.kind)));
  mids.sort((a, b) => meanAngle(a.id) - meanAngle(b.id));
  ring(mids, RINGS.middle.r, RINGS.middle.y);

  const principles = nodes.filter((n) => n.kind === 'principle');
  principles.sort((a, b) => (GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)) || (meanAngle(a.id) - meanAngle(b.id)));
  ring(principles, RINGS.principle.r, RINGS.principle.y, 0.07);

  const moons = new Map();
  for (const n of nodes) {
    if (n.kind !== 'script' && n.kind !== 'reference') continue;
    const owner = clean(n.owner) || router.id;
    if (!moons.has(owner)) moons.set(owner, []);
    moons.get(owner).push(n.id);
  }

  for (const [owner, list] of moons) {
    const op = home.get(owner) || v();
    if (owner === router.id) {
      list.forEach((id, i) => {
        const a = (i / list.length) * Math.PI * 2 + 0.4;
        home.set(id, v(Math.cos(a) * 19, -13, Math.sin(a) * 19));
      });
      continue;
    }
    const len = Math.hypot(op.x, op.z) || 1;
    const out = { x: op.x / len, z: op.z / len };
    const tan = { x: -out.z, z: out.x };
    const ownerNode = byId.get(owner);
    const orr = ownerNode ? radiusOf(ownerNode, maxDeg) : 2;
    list.forEach((id, i) => {
      const row = Math.floor(i / 4);
      const col = i % 4;
      const m = Math.min(4, list.length - row * 4);
      const radial = orr + 6 + row * 4.5;
      const tangential = (col - (m - 1) / 2) * 4.2;
      home.set(id, v(op.x + out.x * radial + tan.x * tangential, op.y - 5, op.z + out.z * radial + tan.z * tangential));
    });
  }

  for (const n of nodes) if (!home.has(n.id)) home.set(n.id, v(0, 40, 0));
  return home;
}

function onRing(positions, nodes, kind, radius, y, errors) {
  for (const n of nodes) {
    if (n.kind !== kind) continue;
    const p = positions.get(n.id);
    if (!p) {
      errors.push(`${n.id} has no position`);
      continue;
    }
    const r = Math.hypot(p.x, p.z);
    if (Math.abs(r - radius) > 0.05 || Math.abs(p.y - y) > 0.05) {
      errors.push(`${n.id} (${kind}) at r=${r.toFixed(2)} y=${p.y.toFixed(2)}, expected r=${radius} y=${y}`);
    }
  }
}

// Acceptance check 3: router at the centre, playbooks on the inner ring, principles on the outer ring.
export function checkLayout(graph) {
  const errors = [];
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const ids = nodes.map((n) => n.id);
  if (new Set(ids).size !== ids.length) errors.push('duplicate node id');

  let positions = null;
  try {
    positions = homePositions(graph);
  } catch (e) {
    errors.push(e.message);
    return { ok: false, errors, positions, summary: e.message };
  }

  if (positions.size !== nodes.length) errors.push(`positions ${positions.size} != nodes ${nodes.length}`);
  for (const n of nodes) if (!positions.has(n.id)) errors.push(`missing position for ${n.id}`);

  const routers = nodes.filter((n) => n.kind === 'router');
  if (routers.length !== 1) errors.push(`expected 1 router, found ${routers.length}`);
  else {
    const p = positions.get(routers[0].id);
    if (Math.hypot(p.x, p.y, p.z) > 1e-6) errors.push('router is not at the centre');
  }

  onRing(positions, nodes, 'playbook', RINGS.playbook.r, RINGS.playbook.y, errors);
  onRing(positions, nodes, 'principle', RINGS.principle.r, RINGS.principle.y, errors);

  const idSet = new Set(ids);
  for (const [i, e] of edges.entries()) {
    if (!idSet.has(e.source)) errors.push(`edges[${i}] source ${e.source} is not a node`);
    if (!idSet.has(e.target)) errors.push(`edges[${i}] target ${e.target} is not a node`);
  }

  const playbooks = nodes.filter((n) => n.kind === 'playbook').length;
  const principles = nodes.filter((n) => n.kind === 'principle').length;
  const summary = `${nodes.length} nodes, ${edges.length} edges, router centred, ${playbooks} playbooks on r=${RINGS.playbook.r}, ${principles} principles on r=${RINGS.principle.r}`;
  return { ok: errors.length === 0, errors, positions, summary };
}
