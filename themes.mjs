// Theme worlds for the pstack map. Sphere stays the v3 shells (layout.mjs).
// Kitchen, circuit, earth, and brain follow design/concepts mockups.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

export const THEME_IDS = ['sphere', 'kitchen', 'circuit', 'earth', 'brain'];

const clean = (s) => (s && s !== 'None' ? s : null);
const lathe = (pts, seg, rot = 0) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg, rot);
const GOLD = Math.PI * (3 - Math.sqrt(5));

const KEYS = {
  kitchen: {
    title: '<span class="t">The brigade</span> <span>top → floor</span>',
    edgeLabel: 'Who uses what',
    rows: [
      ['router', ['router'], 'Chef de cuisine', 'Start here', 'The head chef at the pass. Every order starts here.'],
      ['playbook', ['playbook'], 'Sous chefs', 'Workflows', 'Each runs one dish or service, start to finish.'],
      ['skill', ['skill', 'agent'], 'Chefs de partie', 'Tools · Assistants', 'Each runs one station: sauce, fish, pastry…'],
      ['automation', ['automation'], 'Commis', 'Routines', 'Junior hands who do set prep jobs when called.'],
      ['principle', ['principle'], 'Techniques', 'Rules', 'How this kitchen cooks: mise en place, taste as you go.'],
      ['reference', ['reference', 'script'], 'Pantry', 'Docs · Helpers', 'The ingredients every dish is made from.'],
    ],
  },
  circuit: {
    title: '<span>The board</span> <span>what each part does</span>',
    edgeLabel: 'Connection types',
    rows: [
      ['router', ['router'], 'CPU', 'Start here', 'Every signal starts here.'],
      ['playbook', ['playbook'], 'Chips', 'Workflows', 'Each runs a whole job by driving the parts around it.'],
      ['skill', ['skill', 'agent'], 'Components', 'Tools · Assistants', 'Each does one thing when a chip calls it.'],
      ['automation', ['automation'], 'Capacitors', 'Routines', 'Store a charge and fire on cue.'],
      ['principle', ['principle'], 'Resistors', 'Rules', 'Keep every signal within limits.'],
      ['reference', ['reference', 'script'], 'Pads & vias', 'Docs · Helpers', 'Contact points where notes and scripts plug in.'],
    ],
  },
  earth: {
    title: '<span>The map</span> <span>size = importance</span>',
    edgeLabel: 'Connection types',
    rows: [
      ['router', ['router'], 'Capital', 'Start here', 'Where every journey starts.'],
      ['playbook', ['playbook'], 'Cities', 'Workflows', 'Big places that run a whole journey.'],
      ['skill', ['skill', 'agent'], 'Towns', 'Tools · Assistants', 'Each does one job well; cities rely on them.'],
      ['automation', ['automation'], 'Outposts', 'Routines', 'Small posts that run on a trigger.'],
      ['principle', ['principle'], 'Villages', 'Rules', 'Local customs every journey follows.'],
      ['reference', ['reference', 'script'], 'Hamlets', 'Docs · Helpers', 'Tiny places that keep notes and scripts.'],
    ],
  },
  brain: {
    title: '<span>The lobes</span> <span>what each part does</span>',
    edgeLabel: 'Connection types',
    rows: [
      ['router', ['router'], 'Thalamus', 'Start here', 'The relay at the centre; every signal passes through.'],
      ['playbook', ['playbook'], 'Frontal lobe', 'Workflows', 'Plans: runs a whole task from start to finish.'],
      ['skill', ['skill', 'agent'], 'Motor strip', 'Tools · Assistants', 'Acts: does one job when a plan calls it.'],
      ['automation', ['automation'], 'Cerebellum', 'Routines', 'Habits: runs automatically on cue.'],
      ['principle', ['principle'], 'Parietal lobe', 'Rules', 'Checks: the rules every action is held to.'],
      ['reference', ['reference', 'script'], 'Temporal lobe', 'Docs · Helpers', 'Remembers: notes, references and scripts.'],
    ],
  },
};

const ROLE = {
  kitchen: { router: 'Chef de cuisine', playbook: 'Sous chef', skill: 'Chef de partie', agent: 'Chef de partie', automation: 'Commis', principle: 'Technique', reference: 'Pantry', script: 'Pantry', other: 'Kitchen' },
  circuit: { router: 'CPU', playbook: 'Chip', skill: 'Component', agent: 'Component', automation: 'Capacitor', principle: 'Resistor', reference: 'Test pad', script: 'Via', other: 'Part' },
  earth: { router: 'Capital', playbook: 'City', skill: 'Town', agent: 'Town', automation: 'Outpost', principle: 'Village', reference: 'Hamlet', script: 'Hamlet', other: 'Place' },
  brain: { router: 'Thalamus', playbook: 'Frontal lobe', skill: 'Motor strip', agent: 'Motor strip', automation: 'Cerebellum', principle: 'Parietal lobe', reference: 'Temporal lobe', script: 'Temporal lobe', other: 'Brain' },
};

const RANK_BARS = { router: 3, playbook: 2, skill: 1, agent: 1, automation: 0, principle: -1, reference: -1, script: -1, other: -1 };

export function rankBadge(kind) {
  const b = RANK_BARS[kind] ?? -1;
  if (b > 0) return `<span class="rank" aria-hidden="true">${'<i></i>'.repeat(b)}</span>`;
  if (b === 0) return '<span class="rank ring" aria-hidden="true"><i></i></span>';
  return '';
}

function glyphWrap(s, body) {
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" style="flex:none" aria-hidden="true">${body}</svg>`;
}

function kitchenGlyph(k, s, c) {
  const p = {
    router: `<path d="M3 19h18v2H3zM5 18a7 7 0 0 1 14 0zM11 7h2v3h-2z" fill="${c}"/>`,
    playbook: `<path d="M2 19h20v2H2zM4 18a8 8 0 0 1 16 0zM11 6.5h2v3h-2z" fill="${c}"/>`,
    skill: `<path d="M4 8h16v2h-1v10H5V10H4z" fill="${c}"/>`,
    agent: `<path d="M2 12h14v6H3zM16 13.5h6v2h-6z" fill="${c}"/>`,
    automation: `<path d="M6 3h12v2l-4.5 7L18 19v2H6v-2l4.5-7L6 5z" fill="${c}"/>`,
    principle: `<path d="M12 2 20.7 7v10L12 22 3.3 17V7z" fill="${c}"/>`,
    reference: `<path d="M8 3h8v3l1.5 2V21h-11V8L8 6z" fill="${c}"/>`,
    script: `<rect x="6" y="5" width="12" height="16" rx="1.5" fill="none" stroke="${c}" stroke-width="2.2"/>`,
    other: `<circle cx="12" cy="12" r="5" fill="${c}"/>`,
  }[k];
  return glyphWrap(s, p);
}

function circuitGlyph(k, s, c) {
  const p = {
    router: `<rect x="6" y="6" width="12" height="12" rx="1.5" fill="${c}"/><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" stroke="${c}" stroke-width="1.4"/>`,
    playbook: `<rect x="4" y="8" width="16" height="8" rx="1" fill="${c}"/><path d="M7 5v3M10.3 5v3M13.6 5v3M17 5v3M7 16v3M10.3 16v3M13.6 16v3M17 16v3" stroke="${c}" stroke-width="1.4"/>`,
    skill: `<rect x="6" y="9" width="12" height="6" rx="1" fill="${c}"/><rect x="4" y="8.5" width="3" height="7" fill="${c}" opacity=".6"/><rect x="17" y="8.5" width="3" height="7" fill="${c}" opacity=".6"/>`,
    agent: `<rect x="5" y="8.5" width="14" height="7" rx="3.5" fill="${c}"/>`,
    automation: `<circle cx="12" cy="12" r="7" fill="${c}"/><path d="M8.5 9.5h7" stroke="var(--surface)" stroke-width="1.6"/>`,
    principle: `<path d="M2 12h4l1.5-4 3 8 3-8 3 8 1.5-4h4" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`,
    reference: `<circle cx="12" cy="12" r="6" fill="${c}"/>`,
    script: `<circle cx="12" cy="12" r="5" fill="none" stroke="${c}" stroke-width="2.4"/>`,
    other: `<rect x="8" y="8" width="8" height="8" fill="${c}"/>`,
  }[k];
  return glyphWrap(s, p);
}

function earthGlyph(k, s, c) {
  const p = {
    router: `<path d="M12 2.5l2.6 6 6.4.5-4.9 4.2 1.5 6.3L12 16.2 6.4 19.5l1.5-6.3L3 9l6.4-.5z" fill="${c}"/>`,
    playbook: `<circle cx="12" cy="12" r="7.5" fill="${c}"/>`,
    skill: `<path d="M12 4l7 8-7 8-7-8z" fill="${c}"/>`,
    agent: `<path d="M12 4l7 8-7 8-7-8z" fill="${c}"/>`,
    automation: `<path d="M12 5l7 13H5z" fill="${c}"/>`,
    principle: `<rect x="6.5" y="6.5" width="11" height="11" rx="1" fill="${c}"/>`,
    reference: `<circle cx="12" cy="12" r="4.5" fill="${c}"/>`,
    script: `<path d="M12 6.5l4.8 2.75v5.5L12 17.5l-4.8-2.75v-5.5z" fill="none" stroke="${c}" stroke-width="2"/>`,
    other: `<circle cx="12" cy="12" r="4" fill="${c}"/>`,
  }[k];
  return glyphWrap(s, p);
}

function brainGlyph(k, s, c) {
  const dend = `<path d="M12 12L4.5 6M12 12l8-4.5M12 12l-6 7.5M12 12l7 6.5" stroke="${c}" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`;
  const body = k === 'router'
    ? `<circle cx="12" cy="12" r="8" fill="none" stroke="${c}" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="${c}"/>`
    : k === 'script'
      ? `${dend}<circle cx="12" cy="12" r="4" fill="var(--surface)" stroke="${c}" stroke-width="1.8"/>`
      : `${dend}<circle cx="12" cy="12" r="${k === 'reference' ? 4 : 5}" fill="${c}"/>`;
  return glyphWrap(s, body);
}

const META = {
  sphere: {
    em: null, placeholder: 'Search workflows, tools, rules…',
    hintBold: 'Click any planet to explore', hintSmall: '· drag to turn, scroll to zoom',
    role: null, key: null, glyph: null, wideKey: false, showShape: true,
  },
  kitchen: {
    em: 'kitchen', placeholder: 'Search dishes, stations, techniques…',
    hintBold: 'Click any dish or station to explore', hintSmall: '· drag to walk around, scroll to step closer',
    role: ROLE.kitchen, key: KEYS.kitchen, glyph: kitchenGlyph, wideKey: true, showShape: false,
    eword: { loads: 'Hands the order to', applies: 'Uses the technique', runs: 'Runs', imports: 'Builds on', references: 'Uses / mentions', other: 'Linked' },
  },
  circuit: {
    em: 'circuit', placeholder: 'Search chips, parts, rules…',
    hintBold: 'Click any chip to explore', hintSmall: '· drag to tilt the board, scroll to zoom',
    role: ROLE.circuit, key: KEYS.circuit, glyph: circuitGlyph, wideKey: true, showShape: false,
  },
  earth: {
    em: 'earth', placeholder: 'Search cities, towns, villages…',
    hintBold: 'Click any city to explore', hintSmall: '· drag to spin the globe, scroll to zoom',
    role: ROLE.earth, key: KEYS.earth, glyph: earthGlyph, wideKey: true, showShape: false,
  },
  brain: {
    em: 'brain', placeholder: 'Search plans, actions, rules…',
    hintBold: 'Click any neuron to explore', hintSmall: '· drag to turn the brain, scroll to zoom',
    role: ROLE.brain, key: KEYS.brain, glyph: brainGlyph, wideKey: true, showShape: false,
  },
};

export function themeMeta(id) {
  return META[id] || META.sphere;
}

function merge(parts) {
  const pos = [];
  const nor = [];
  const col = [];
  parts.forEach(([g, c]) => {
    const geo = g.index ? g.toNonIndexed() : g;
    const p = geo.attributes.position.array;
    const n = geo.attributes.normal.array;
    for (let i = 0; i < p.length; i += 3) {
      pos.push(p[i], p[i + 1], p[i + 2]);
      nor.push(n[i], n[i + 1], n[i + 2]);
      col.push(c[0], c[1], c[2]);
    }
  });
  const o = new THREE.BufferGeometry();
  o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  o.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  o.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return o;
}

// Circuit columns on a plane that faces the camera: left/right along camera right, rows along camera up.
function tidyAt(C, h, side, lane, Rc, Rv, Uv, j) {
  return C.clone()
    .addScaledVector(Rv, side * (lane + Rc * (0.55 + 0.4 * (j % 2))))
    .addScaledVector(Uv, -h * Rc * 1.35);
}

export function createTheme(id, ctx) {
  const { G, byId, kindOf, nm, deg, SHAPE, homePositions } = ctx;
  if (id === 'sphere') {
    const homes = homePositions(G, SHAPE);
    return {
      id,
      homes,
      RMAX: SHAPE === 'rhombus' ? 244 : 192,
      YS: SHAPE === 'rhombus' ? 1.15 : 1,
      sceneC: new THREE.Vector3(),
      homeCam: SHAPE === 'rhombus' ? { az: 0.42, el: 0.16 } : { az: 0.42, el: 0.34 },
      gkeep: 0,
      pulse: { speed: 1.4, per: 3, size: 0.65, color: '#FFF4DA' },
      homeVX: 0,
      showSel: true,
      slotPos: (C, h, side, lane, rho, r, psi, Rc, Rv, Uv, Dv, j) => tidyAt(C, h, side, lane, Rc, Rv, Uv, j),
    };
  }
  if (id === 'kitchen') return kitchenTheme(ctx);
  if (id === 'circuit') return circuitTheme(ctx);
  if (id === 'earth') return earthTheme(ctx);
  if (id === 'brain') return brainTheme(ctx);
  return createTheme('sphere', ctx);
}

function kitchenTheme({ G, byId, kindOf, nm, deg }) {
  const maxDeg = Math.max(1, ...G.nodes.filter((n) => n.kind !== 'router').map((n) => deg(n.id)));
  const KMUL = { router: 1, playbook: 1, skill: 1, principle: 0.8, agent: 1, automation: 0.9, script: 0.7, reference: 0.7, other: 0.8 };
  const radiusOf = (n) => (n.kind === 'router' ? 14 : KMUL[kindOf(n.kind)] * (2.4 + 5 * Math.sqrt(deg(n.id) / maxDeg)));
  const GEO = {
    playbook: () => lathe([[0, -0.6], [1.15, -0.6], [1.15, -0.52], [0.92, -0.5], [0.9, -0.2], [0.78, 0.15], [0.55, 0.38], [0.25, 0.5], [0.12, 0.52], [0.1, 0.62], [0.16, 0.7], [0, 0.72]], 40),
    skill: () => lathe([[0, -0.6], [0.85, -0.6], [0.9, -0.55], [0.9, 0.42], [1.0, 0.47], [1.0, 0.53], [0.92, 0.55], [0, 0.55]], 32),
    agent: () => lathe([[0, -0.36], [1, -0.36], [1.06, -0.3], [1.06, 0.26], [1.14, 0.3], [1.12, 0.34], [0, 0.34]], 32),
    automation: () => lathe([[0, -0.8], [0.6, -0.8], [0.6, -0.7], [0.44, -0.6], [0.12, 0], [0.44, 0.6], [0.6, 0.7], [0.6, 0.8], [0, 0.8]], 24),
    principle: () => new THREE.CylinderGeometry(1, 1, 0.2, 6),
    reference: () => lathe([[0, -0.7], [0.55, -0.7], [0.6, -0.62], [0.6, 0.35], [0.45, 0.45], [0.42, 0.55], [0.48, 0.58], [0.48, 0.7], [0, 0.7]], 24),
    script: () => new THREE.CylinderGeometry(0.55, 0.55, 1, 16),
    other: () => new THREE.IcosahedronGeometry(0.9, 1),
  };
  const LAYERS = [
    { kinds: ['playbook'], r: 80, y: 84 },
    { kinds: ['skill', 'agent', 'other'], r: 136, y: 42 },
    { kinds: ['automation'], r: 96, y: 8 },
    { kinds: ['principle'], r: 178, y: -12 },
    { kinds: ['reference', 'script'], r: 222, y: -28 },
  ];
  const CHEF_Y = 124;
  const FLOOR_Y = -36;
  const homes = new Map();
  const dirOf = new Map();
  const router = G.nodes.find((n) => n.kind === 'router');
  homes.set(router.id, new THREE.Vector3(0, CHEF_Y, 0));
  const targetOf = (n) => {
    const v = new THREE.Vector3();
    G.edges.forEach((e) => {
      const o = e.source === n.id ? e.target : e.target === n.id ? e.source : null;
      if (o && dirOf.has(o)) v.add(dirOf.get(o));
    });
    const owner = clean(n.owner);
    if (owner && dirOf.has(owner)) v.addScaledVector(dirOf.get(owner), 3);
    v.y = 0;
    return v.lengthSq() > 1e-6 ? v.normalize() : null;
  };
  LAYERS.forEach((L, li) => {
    const list = G.nodes.filter((n) => L.kinds.includes(kindOf(n.kind)));
    const slots = list.map((_, i) => {
      const a = (i / list.length) * Math.PI * 2 + li * 0.37;
      return new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    });
    const free = slots.map(() => true);
    const order = list.slice().sort((a, b) => (targetOf(b) ? 1 : 0) - (targetOf(a) ? 1 : 0) || deg(b.id) - deg(a.id) || nm(a.id).localeCompare(nm(b.id)));
    let next = 0;
    order.forEach((n) => {
      const t = targetOf(n);
      let best = -1;
      if (t) {
        let bd = -9;
        slots.forEach((s, i) => {
          if (free[i]) {
            const d = s.dot(t);
            if (d > bd) { bd = d; best = i; }
          }
        });
      } else {
        while (!free[next]) next += 1;
        best = next;
      }
      free[best] = false;
      dirOf.set(n.id, slots[best]);
      homes.set(n.id, slots[best].clone().multiplyScalar(L.r).setY(L.y));
    });
  });
  G.nodes.forEach((n) => { if (!homes.has(n.id)) homes.set(n.id, new THREE.Vector3(0, 40, 0)); });
  const RMAX = 222;
  const sceneC = new THREE.Vector3(0, 4, 0);
  const bellMat = new THREE.MeshStandardMaterial({ color: '#E2BB72', metalness: 0.75, roughness: 0.24, emissive: '#4A3212', emissiveIntensity: 1 });
  const api = {
    id: 'kitchen',
    homes,
    GEO,
    radiusOf,
    RMAX,
    sceneC,
    homeCam: { az: 0.5, el: 0.3 },
    gkeep: 0,
    pulse: null,
    homeVX: -150,
    showSel: false,
    stars: false,
    bellMat,
    plate: null,
    pools: [],
    rotation: (n, k, i) => (k === 'principle'
      ? new THREE.Euler(Math.PI / 2, (i * 2.399) % 6.28, 0, 'YXZ')
      : new THREE.Euler(0, (i * 2.399) % 6.28, 0)),
    material(k) {
      const m = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        flatShading: k === 'principle',
        metalness: k === 'playbook' ? 0.7 : k === 'reference' ? 0.15 : 0.55,
        roughness: k === 'reference' ? 0.25 : 0.32,
        emissive: 0x1A120A,
      });
      m.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace(
          '#include <opaque_fragment>',
          'float rimF=pow(1.0-saturate(abs(dot(normalize(normal),normalize(vViewPosition)))),2.2);outgoingLight+=diffuseColor.rgb*rimF*0.45+vec3(rimF*0.05);\n#include <opaque_fragment>',
        );
      };
      return m;
    },
    edgeBase(t, EALPHA) {
      const mul = t === 'references' ? 0.55 : t === 'applies' ? 0.7 : 1;
      const base = t === 'references' ? 0.06 : EALPHA[t];
      return base * mul;
    },
    fitDist(W, H, mobile, vf) {
      const ph = ((W - (mobile ? 24 : 96) - (mobile ? 0 : 300)) / 2) / (RMAX * 1.02);
      const pv = ((H - (mobile ? 140 : 110)) / 2) / ((CHEF_Y - FLOOR_Y) / 2 + RMAX * Math.sin(0.3));
      return H / (2 * Math.tan(vf / 2) * Math.min(ph, pv)) + RMAX * 0.12;
    },
    fog(d, focused, FS) {
      if (focused && FS) return { near: d + FS.Rb * 0.6, far: FS.shell * 1.35 };
      return { near: d, far: d + RMAX * 3 };
    },
    front(o, camDir) {
      const rel = o.pos.clone().setY(0);
      const flat = camDir.clone().setY(0);
      if (flat.lengthSq() < 1e-6) return true;
      flat.normalize();
      return rel.lengthSq() < 1 || rel.dot(flat) > -0.25 * rel.length();
    },
    labelTier(o, hovered) {
      if (o.k === 'router' || o === hovered) return 0;
      if (o.k === 'playbook' || o.k === 'automation' || deg(o.id) >= 14) return 1;
      if (o.k === 'script' || o.k === 'reference') return 3;
      return 2;
    },
    curve(a, b, t, out, mode) {
      const len = a.distanceTo(b);
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      const my = mode === 'focus' ? Math.max(a.y, b.y) + len * 0.22 : (a.y + b.y) / 2 + len * 0.12;
      const mt = 1 - t;
      return out.set(a.x * mt * mt + 2 * mx * mt * t + b.x * t * t, a.y * mt * mt + 2 * my * mt * t + b.y * t * t, a.z * mt * mt + 2 * mz * mt * t + b.z * t * t);
    },
    scenery(scene, { HALO, mkLineMat, css }) {
      scene.add(new THREE.AmbientLight(0x6E5A48, 1.0));
      scene.add(new THREE.HemisphereLight(0xFFE2C0, 0x1A120C, 0.55));
      const sunLight = new THREE.PointLight(0xFFD29A, 2.2, 0, 0);
      scene.add(sunLight);
      const fill = new THREE.DirectionalLight(0xB8C2D0, 0.7);
      scene.add(fill);
      const guides = [];
      {
        const a = [];
        const col = [];
        const gc = new THREE.Color(css('--guide'));
        const go = new THREE.Color(css('--guide-outer'));
        LAYERS.forEach((L, li) => {
          const c = li === LAYERS.length - 1 || li === 0 ? go : gc;
          const S = 192;
          for (let i = 0; i < S; i++) {
            const t0 = (i / S) * Math.PI * 2;
            const t1 = ((i + 1) / S) * Math.PI * 2;
            a.push(Math.cos(t0) * L.r, L.y - 4, Math.sin(t0) * L.r, Math.cos(t1) * L.r, L.y - 4, Math.sin(t1) * L.r);
            col.push(c.r, c.g, c.b, c.r, c.g, c.b);
          }
        });
        const g = new LineSegmentsGeometry();
        g.setPositions(a);
        g.setColors(col);
        const l = new LineSegments2(g, mkLineMat({ vertexColors: true, linewidth: 1, opacity: 1 }));
        scene.add(l);
        guides.push(l);
      }
      const floor = new THREE.Mesh(new THREE.CircleGeometry(900, 96), new THREE.MeshStandardMaterial({ color: '#17110D', roughness: 0.88, metalness: 0 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = FLOOR_Y;
      scene.add(floor);
      const pools = [];
      const mkPool = (x, z, size, op, col = '#FFB46A') => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: HALO, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, FLOOR_Y + 0.2, z);
        m.scale.setScalar(size);
        scene.add(m);
        pools.push({ m, op });
      };
      mkPool(0, 0, 330, 0.26);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        mkPool(Math.cos(a) * 222, Math.sin(a) * 222, 110, 0.11);
      }
      const plate = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.86, 0.07, 96), new THREE.MeshStandardMaterial({ color: '#B9BEC4', roughness: 0.55, metalness: 0, emissive: '#24262A', transparent: true, opacity: 0 }));
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 128), new THREE.MeshStandardMaterial({ color: '#C9A15F', metalness: 0.8, roughness: 0.3, transparent: true, opacity: 0 }));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.036;
      plate.add(disc, rim);
      scene.add(plate);
      api.plate = plate;
      api.pools = pools;
      api.guides = guides;
      const mesh = new THREE.Mesh(lathe([[0, -0.5], [1.25, -0.5], [1.25, -0.4], [0.95, -0.38], [0.9, -0.1], [0.75, 0.25], [0.45, 0.45], [0.12, 0.52], [0.1, 0.62], [0.2, 0.68], [0.2, 0.74], [0, 0.76]], 64), bellMat);
      scene.add(mesh);
      api.routerMesh = mesh;
      api.routerDim = (d, DIM) => {
        bellMat.emissiveIntensity = 1 - d;
        bellMat.color.set('#E2BB72').lerp(DIM, d * 0.8);
      };
      return { sunLight, fill, guides };
    },
    decor(starNode, N, mkHalo) {
      const decor = [
        { o: starNode, s: mkHalo('#FFD08A', 1, 0.35), f: 3.2, op: 0.35 },
        { o: starNode, s: mkHalo('#F2B85A', 1, 0.12), f: 9, op: 0.12 },
      ];
      N.filter((o) => o.k !== 'router' && deg(o.id) >= 15).forEach((o) => decor.push({ o, s: mkHalo('#FFC88A', 1, 0.1), f: 4, op: 0.1 }));
      return decor;
    },
    tick(idleAlpha) {
      if (!api.plate) return;
      api.plate.children.forEach((c) => { c.material.opacity = 1 - idleAlpha; });
      api.pools.forEach((p) => { p.m.material.opacity = p.op * (0.35 + 0.65 * idleAlpha); });
    },
  };
  return api;
}

function circuitTheme({ G, kindOf, deg }) {
  const maxDeg = Math.max(1, ...G.nodes.filter((n) => n.kind !== 'router').map((n) => deg(n.id)));
  const KMUL = { router: 1, playbook: 1.45, skill: 1.15, agent: 1.15, automation: 1.05, principle: 1.05, script: 0.9, reference: 0.9, other: 0.9 };
  const HALF = { playbook: 0.25, skill: 0.3, agent: 0.45, automation: 0.8, principle: 0.38, reference: 0.06, script: 0.22, other: 0.25 };
  const radiusOf = (n) => (n.kind === 'router' ? 12 : KMUL[kindOf(n.kind)] * (2 + 4 * Math.sqrt(deg(n.id) / maxDeg)));
  const BX = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const rz = (g) => g.rotateZ(Math.PI / 2);
  const GEO = {
    playbook: () => merge([[BX(2.2, 0.5, 1.3), [0.26, 0.28, 0.32]], ...[...Array(12)].map((_, i) => [BX(0.14, 0.12, 0.34, -0.9 + (i % 6) * 0.36, -0.12, (i < 6 ? 1 : -1) * 0.8), [1, 1, 1]]), [new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16).translate(-0.85, 0.26, 0.4), [0.6, 0.6, 0.6]]]),
    skill: () => merge([[BX(1.3, 0.55, 0.8), [0.9, 0.9, 0.9]], [BX(0.26, 0.6, 0.84, -0.78), [0.62, 0.62, 0.66]], [BX(0.26, 0.6, 0.84, 0.78), [0.62, 0.62, 0.66]]]),
    agent: () => merge([[rz(new THREE.CapsuleGeometry(0.45, 1.1, 8, 20)), [1, 1, 1]], [BX(1.9, 0.06, 0.7, 0, -0.42), [0.5, 0.5, 0.5]]]),
    automation: () => merge([[new THREE.CylinderGeometry(0.7, 0.7, 1.6, 32), [0.82, 0.82, 0.82]], [new THREE.CylinderGeometry(0.72, 0.72, 0.08, 32).translate(0, 0.8, 0), [1, 1, 1]], [BX(0.18, 0.02, 1.0, 0, 0.85), [0.45, 0.45, 0.45]]]),
    principle: () => merge([
      [rz(new THREE.CapsuleGeometry(0.36, 1.0, 8, 20)), [1, 1, 1]],
      ...[-0.36, -0.14, 0.1].map((x) => [rz(new THREE.CylinderGeometry(0.385, 0.385, 0.1, 24)).translate(x, 0, 0), [0.3, 0.3, 0.3]]),
      [rz(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8)).translate(-0.98, 0, 0), [0.85, 0.85, 0.85]],
      [rz(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8)).translate(0.98, 0, 0), [0.85, 0.85, 0.85]],
    ]),
    reference: () => merge([[new THREE.CylinderGeometry(1, 1, 0.12, 32), [1, 1, 1]]]),
    script: () => merge([[new THREE.TorusGeometry(0.75, 0.22, 12, 32).rotateX(Math.PI / 2), [1, 1, 1]]]),
    other: () => merge([[BX(1, 0.5, 1), [1, 1, 1]]]),
  };
  const LAYERS = [{ kinds: ['playbook'], s: 72 }, { kinds: ['skill', 'agent', 'other'], s: 122 }, { kinds: ['principle'], s: 168 }, { kinds: ['reference', 'script'], s: 214 }];
  const RMAX = 214;
  const homes = new Map();
  const dirOf = new Map();
  const router = G.nodes.find((n) => n.kind === 'router');
  homes.set(router.id, new THREE.Vector3(0, 12 * 0.3, 0));
  const sqSlots = (n, s, ph) => {
    const a = [];
    const L = 8 * s;
    for (let i = 0; i < n; i++) {
      let d = (((i + 0.5) / n + ph) % 1) * L;
      let x;
      let z;
      if (d < 2 * s) { x = -s + d; z = -s; }
      else if (d < 4 * s) { x = s; z = -s + (d - 2 * s); }
      else if (d < 6 * s) { x = s - (d - 4 * s); z = s; }
      else { x = -s; z = s - (d - 6 * s); }
      if (Math.abs(Math.abs(x) - s) < 1e-6 && Math.abs(Math.abs(z) - s) < 1e-6) x *= 0.94;
      a.push(new THREE.Vector3(Math.round(x / 2) * 2, 0, Math.round(z / 2) * 2));
    }
    return a;
  };
  LAYERS.forEach((L, li) => {
    const list = G.nodes.filter((n) => L.kinds.includes(kindOf(n.kind)));
    const slots = sqSlots(list.length, L.s, 0.07 * li);
    const free = slots.map(() => true);
    const target = (n) => {
      const v = new THREE.Vector3();
      G.edges.forEach((e) => {
        const o = e.source === n.id ? e.target : e.target === n.id ? e.source : null;
        if (o && dirOf.has(o)) v.add(dirOf.get(o));
      });
      return v.lengthSq() > 1e-6 ? v.normalize() : null;
    };
    const order = list.slice().sort((a, b) => (target(b) ? 1 : 0) - (target(a) ? 1 : 0) || deg(b.id) - deg(a.id));
    let next = 0;
    order.forEach((n) => {
      const t = target(n);
      let best = -1;
      if (t) {
        let bd = -9;
        slots.forEach((s, i) => {
          if (free[i]) {
            const d = s.clone().normalize().dot(t);
            if (d > bd) { bd = d; best = i; }
          }
        });
      } else {
        while (!free[next]) next += 1;
        best = next;
      }
      free[best] = false;
      const p = slots[best].clone();
      p.y = radiusOf(n) * HALF[kindOf(n.kind)];
      homes.set(n.id, p);
      dirOf.set(n.id, slots[best].clone().normalize());
    });
  });
  G.nodes.filter((n) => kindOf(n.kind) === 'automation').forEach((n, i) => {
    const sx = i % 2 ? 1 : -1;
    const sz = i < 2 ? -1 : 1;
    homes.set(n.id, new THREE.Vector3(sx * 34, radiusOf(n) * 0.8, sz * 34));
    dirOf.set(n.id, new THREE.Vector3(sx, 0, sz).normalize());
  });
  G.nodes.forEach((n) => { if (!homes.has(n.id)) homes.set(n.id, new THREE.Vector3(0, 2, 0)); });
  const cpuMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.45, roughness: 0.38 });
  const api = {
    id: 'circuit',
    homes,
    GEO,
    radiusOf,
    RMAX,
    sceneC: new THREE.Vector3(),
    homeCam: { az: 0.28, el: 0.82 },
    gkeep: 0.6,
    pulse: { speed: 1.6, per: 2, size: 0.75, color: '#FFE7B0' },
    homeVX: -130,
    showSel: true,
    stars: false,
    rotation: (n, k, i) => {
      const h = homes.get(n.id);
      return new THREE.Euler(0, Math.abs(h.x) > Math.abs(h.z) ? Math.PI / 2 : 0, 0);
    },
    material(k) {
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        metalness: (k === 'reference' || k === 'script') ? 0.75 : 0.3,
        roughness: k === 'reference' ? 0.3 : 0.45,
      });
    },
    slotPos: (C, h, side, lane, rho, r, psi, Rc, Rv, Uv, Dv, j) => {
      const Rh = new THREE.Vector3(Rv.x, 0, Rv.z);
      if (Rh.lengthSq() < 1e-8) Rh.set(1, 0, 0);
      Rh.normalize();
      const Df = new THREE.Vector3(Dv.x, 0, Dv.z);
      if (Df.lengthSq() < 1e-8) Df.set(0, 0, 1);
      Df.normalize();
      return new THREE.Vector3(C.x, 0, C.z).addScaledVector(Rh, side * (lane + Rc * (0.55 + 0.4 * (j % 2)))).addScaledVector(Df, -h * Rc * 1.35).setY(2.4);
    },
    disperse: (o) => ({ p: homes.get(o.id).clone().setY(-8), sc: o.r * 0.5 }),
    front: () => true,
    fitDist(W, H, mobile, vf) {
      const e = (RMAX + 26) * (Math.cos(0.28) + Math.sin(0.28));
      const ppu = Math.min((((mobile ? H - 150 : H - 120) / 2) / (e * Math.sin(0.82) + 8)), ((W - (mobile ? 24 : 96 + 260)) / 2) / e);
      return H / (2 * Math.tan(vf / 2) * ppu * 1.12) + RMAX * 0.2;
    },
    fog(d) {
      return { near: d, far: d + RMAX * 4 };
    },
    curve(a, b, t, out, mode) {
      const y = 0.35 + (mode === 'focus' ? 0.1 : 0);
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const xf = Math.abs(a.x) + Math.abs(a.z) < 1 ? Math.abs(dx) >= Math.abs(dz) : Math.abs(a.x) >= Math.abs(a.z);
      const c = Math.min(Math.abs(dx), Math.abs(dz), 12) * 0.8;
      const sx = Math.sign(dx) || 1;
      const sz = Math.sign(dz) || 1;
      const P = xf
        ? [[a.x, a.z], [b.x - sx * c, a.z], [b.x, a.z + sz * c], [b.x, b.z]]
        : [[a.x, a.z], [a.x, b.z - sz * c], [a.x + sx * c, b.z], [b.x, b.z]];
      const L = [0];
      for (let i = 1; i < 4; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
      const dist = t * L[3];
      let i = 1;
      while (i < 3 && dist > L[i]) i += 1;
      const u = L[i] - L[i - 1] > 1e-6 ? (dist - L[i - 1]) / (L[i] - L[i - 1]) : 0;
      return out.set(P[i - 1][0] + (P[i][0] - P[i - 1][0]) * u, y, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * u);
    },
    scenery(scene, { mkLineMat, css }) {
      scene.add(new THREE.AmbientLight(0xA0B0A8, 1.0));
      const sunLight = new THREE.PointLight(0xFFE2B0, 0.25, 0, 0);
      scene.add(sunLight);
      const keyLight = new THREE.DirectionalLight(0xFFF4E0, 1.3);
      keyLight.position.set(-200, 400, 150);
      scene.add(keyLight);
      const fill = new THREE.DirectionalLight(0xC8D8D0, 0.4);
      scene.add(fill);
      const c = document.createElement('canvas');
      c.width = c.height = 2048;
      const x = c.getContext('2d');
      x.fillStyle = '#0F241C';
      x.fillRect(0, 0, 2048, 2048);
      x.fillStyle = '#16302A';
      for (let i = 16; i < 2048; i += 24) for (let j = 16; j < 2048; j += 24) x.fillRect(i, j, 2, 2);
      x.strokeStyle = '#2A4A3E';
      x.lineWidth = 6;
      x.strokeRect(24, 24, 2000, 2000);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      const top = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.08 });
      const side = new THREE.MeshStandardMaterial({ color: '#0A1612', roughness: 0.7 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(520, 6, 520), [side, side, top, side, side, side]);
      board.position.y = -3;
      scene.add(board);
      const hole = new THREE.MeshStandardMaterial({ color: '#B9A06A', metalness: 0.7, roughness: 0.35 });
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 2.2, 12, 40).rotateX(Math.PI / 2), hole);
        ring.position.set(sx * 240, 0.4, sz * 240);
        scene.add(ring);
      });
      const guides = [];
      const a = [];
      const rect = (s) => {
        const P = [[-s, -s], [s, -s], [s, s], [-s, s]];
        for (let i = 0; i < 4; i++) {
          const p = P[i];
          const q = P[(i + 1) % 4];
          a.push(p[0], 0.15, p[1], q[0], 0.15, q[1]);
        }
      };
      rect(22);
      LAYERS.forEach((L) => rect(L.s + 16));
      const g = new LineSegmentsGeometry();
      g.setPositions(a);
      const l = new LineSegments2(g, mkLineMat({ color: css('--guide-outer'), linewidth: 1, opacity: 0.16 }));
      l.userData.op = 0.16;
      scene.add(l);
      guides.push(l);
      const mesh = new THREE.Mesh(merge([
        [BX(3, 0.55, 3), [0.13, 0.14, 0.15]],
        [BX(2.1, 0.16, 2.1, 0, 0.34, 0), [0.86, 0.74, 0.48]],
        ...[...Array(40)].map((_, i) => {
          const s = Math.floor(i / 10);
          const k = i % 10;
          const o = -1.26 + k * 0.28;
          if (s === 0) return [BX(0.12, 0.1, 0.34, o, -0.12, 1.62), [0.82, 0.82, 0.84]];
          if (s === 1) return [BX(0.12, 0.1, 0.34, o, -0.12, -1.62), [0.82, 0.82, 0.84]];
          if (s === 2) return [BX(0.34, 0.1, 0.12, 1.62, -0.12, o), [0.82, 0.82, 0.84]];
          return [BX(0.34, 0.1, 0.12, -1.62, -0.12, o), [0.82, 0.82, 0.84]];
        }),
      ]), cpuMat);
      scene.add(mesh);
      api.routerMesh = mesh;
      api.routerDim = (d, DIM) => { cpuMat.color.set(0xffffff).lerp(DIM, d * 0.85); };
      api.guides = guides;
      return { sunLight, fill, guides };
    },
    decor(starNode, N, mkHalo) {
      return [{ o: starNode, s: mkHalo('#E2C27A', 1, 0.12), f: 4, op: 0.12 }];
    },
  };
  return api;
}

function earthTheme({ G, byId, kindOf, nm, deg }) {
  const RG = 150;
  const maxDeg = Math.max(1, ...G.nodes.filter((n) => n.kind !== 'router').map((n) => deg(n.id)));
  const KMUL = { router: 1, playbook: 1.15, skill: 0.85, agent: 0.85, automation: 0.8, principle: 0.62, script: 0.5, reference: 0.5, other: 0.6 };
  const radiusOf = (n) => (n.kind === 'router' ? 6.5 : KMUL[kindOf(n.kind)] * (1.5 + 3.8 * Math.sqrt(deg(n.id) / maxDeg)));
  const GEO = {
    playbook: () => new THREE.SphereGeometry(1, 32, 20),
    skill: () => new THREE.OctahedronGeometry(1, 0),
    agent: () => new THREE.OctahedronGeometry(1, 0),
    automation: () => new THREE.TetrahedronGeometry(1.1, 0),
    principle: () => new THREE.BoxGeometry(1.3, 1.3, 1.3),
    reference: () => new THREE.IcosahedronGeometry(1, 0),
    script: () => new THREE.DodecahedronGeometry(1, 0),
    other: () => new THREE.IcosahedronGeometry(1, 0),
  };
  const HOMEDIR = new THREE.Vector3(Math.sin(0.42) * Math.cos(0.42), Math.sin(0.42), Math.cos(0.42) * Math.cos(0.42)).normalize();
  const homes = new Map();
  const dirOf = new Map();
  const region = new Map();
  const router = G.nodes.find((n) => n.kind === 'router');
  const cities = G.nodes.filter((n) => kindOf(n.kind) === 'playbook').sort((a, b) => deg(b.id) - deg(a.id) || nm(a.id).localeCompare(nm(b.id)));
  const fibp = [];
  {
    const n = cities.length + 1;
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n;
      const s = Math.sqrt(1 - y * y);
      const th = i * GOLD;
      fibp.push(new THREE.Vector3(Math.cos(th) * s, y, Math.sin(th) * s));
    }
  }
  const i0 = 2;
  const q0 = new THREE.Quaternion().setFromUnitVectors(fibp[i0], HOMEDIR);
  fibp.forEach((p) => p.applyQuaternion(q0));
  const capDir = fibp.splice(i0, 1)[0];
  fibp.sort((a, b) => b.dot(capDir) - a.dot(capDir));
  const centre = new Map([[router.id, capDir]]);
  cities.forEach((c, i) => centre.set(c.id, fibp[i]));
  const adj = new Map(G.nodes.map((n) => [n.id, []]));
  G.edges.forEach((e) => {
    adj.get(e.source)?.push(e.target);
    adj.get(e.target)?.push(e.source);
  });
  G.nodes.forEach((n) => {
    if (centre.has(n.id)) { region.set(n.id, n.id); return; }
    const sc = new Map();
    (adj.get(n.id) || []).forEach((o) => {
      const other = byId.get(o);
      if (other && kindOf(other.kind) === 'playbook') sc.set(o, (sc.get(o) || 0) + 1);
    });
    const owner = clean(n.owner);
    if (owner && centre.has(owner)) sc.set(owner, (sc.get(owner) || 0) + 3);
    let best = null;
    let bv = 0;
    for (const [k, v] of sc) if (v > bv || (v === bv && best && deg(k) > deg(best))) { best = k; bv = v; }
    if (best) region.set(n.id, best);
  });
  for (let pass = 0; pass < 3; pass++) {
    G.nodes.forEach((n) => {
      if (region.has(n.id)) return;
      const sc = new Map();
      (adj.get(n.id) || []).forEach((o) => {
        const r = region.get(o);
        if (r && r !== router.id) sc.set(r, (sc.get(r) || 0) + 1);
      });
      let best = null;
      let bv = 0;
      for (const [k, v] of sc) if (v > bv) { best = k; bv = v; }
      if (best) region.set(n.id, best);
    });
  }
  G.nodes.forEach((n) => { if (!region.has(n.id)) region.set(n.id, router.id); });
  const TIER = { skill: 0, agent: 0, other: 0, automation: 1, principle: 2, reference: 3, script: 3 };
  const onGlobe = (d, lift) => d.clone().normalize().multiplyScalar(RG + lift);
  homes.set(router.id, onGlobe(capDir, 4));
  dirOf.set(router.id, capDir);
  [router, ...cities].forEach((c) => {
    const cd = centre.get(c.id);
    if (c !== router) {
      homes.set(c.id, onGlobe(cd, 2.5));
      dirOf.set(c.id, cd);
    }
    const t1 = new THREE.Vector3(0, 1, 0).cross(cd);
    if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
    t1.normalize();
    const t2 = cd.clone().cross(t1);
    const mem = G.nodes.filter((n) => region.get(n.id) === c.id && n.id !== c.id).sort((a, b) => (TIER[kindOf(a.kind)] ?? 0) - (TIER[kindOf(b.kind)] ?? 0) || deg(b.id) - deg(a.id));
    mem.forEach((n, i) => {
      const ang = 0.07 + 0.052 * Math.sqrt(i + 1) + (c === router ? 0.05 : 0);
      const ph = i * GOLD + c.id.length;
      const d = cd.clone().addScaledVector(t1, Math.cos(ph) * Math.tan(ang)).addScaledVector(t2, Math.sin(ph) * Math.tan(ang)).normalize();
      homes.set(n.id, onGlobe(d, 1.5));
      dirOf.set(n.id, d);
    });
  });
  G.nodes.forEach((n) => { if (!homes.has(n.id)) homes.set(n.id, onGlobe(new THREE.Vector3(0, 1, 0), 2)); });
  const capMat = new THREE.MeshStandardMaterial({ color: '#F2C46B', emissive: '#B07A1E', emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.2 });
  const api = {
    id: 'earth',
    homes,
    GEO,
    radiusOf,
    RMAX: RG,
    sceneC: new THREE.Vector3(),
    homeCam: { az: 0.42, el: 0.42 },
    gkeep: 0.75,
    pulse: { speed: 1, per: 2, size: 0.8, color: '#FFE9C2' },
    homeVX: -130,
    showSel: true,
    stars: true,
    slotPos: (C, h, side, lane, rho, r, psi, Rc, Rv, Uv) => C.clone().addScaledVector(Uv, h * Rc).addScaledVector(Rv, side * (lane + rho * r * Math.cos(psi) * 0.75)).normalize().multiplyScalar(RG + 3),
    disperse: (o) => ({ p: homes.get(o.id).clone().normalize().multiplyScalar(RG - 6), sc: o.r * 0.6 }),
    focusBasis(C, cam) {
      const n = C.clone().normalize();
      const fel = Math.asin(THREE.MathUtils.clamp(n.y, -0.92, 0.92));
      let faz = Math.atan2(n.x, n.z);
      while (faz - cam.az > Math.PI) faz -= 2 * Math.PI;
      while (faz - cam.az < -Math.PI) faz += 2 * Math.PI;
      const Dv = new THREE.Vector3(Math.cos(fel) * Math.sin(faz), Math.sin(fel), Math.cos(fel) * Math.cos(faz));
      const Rv = new THREE.Vector3(0, 1, 0).cross(Dv).normalize();
      const Uv = Dv.clone().cross(Rv);
      return { Rv, Uv, Dv, az: faz, el: fel };
    },
    front(o, camDir) {
      return o.pos.dot(camDir) > 0.42 * o.pos.length();
    },
    fitDist(W, H, mobile, vf) {
      const ppu = Math.min(((mobile ? H - 150 : H - 130) / 2) / (RG * 1.12), ((W - (mobile ? 24 : 96 + 260)) / 2) / (RG * 1.12));
      return H / (2 * Math.tan(vf / 2) * ppu) + RG * 0.25;
    },
    fog(d) {
      return { near: d, far: d + RG * 2.2 };
    },
    curve(a, b, t, out, mode) {
      const ra = a.length();
      const rb = b.length();
      const ua = a.clone().normalize();
      const ub = b.clone().normalize();
      const th = Math.acos(THREE.MathUtils.clamp(ua.dot(ub), -1, 1));
      let d;
      if (th < 1e-4) d = ua;
      else {
        const s = Math.sin(th);
        d = ua.multiplyScalar(Math.sin((1 - t) * th) / s).addScaledVector(ub, Math.sin(t * th) / s);
      }
      const lift = (mode === 'focus' ? 0.3 * th : 0.09 * Math.min(th, 1)) * RG * Math.sin(Math.PI * t);
      return out.copy(d).multiplyScalar(ra + (rb - ra) * t + lift);
    },
    material() {
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, metalness: 0.05, roughness: 0.45, emissive: 0xffffff, emissiveIntensity: 0.18 });
      m.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance*=diffuseColor.rgb;');
      };
      return m;
    },
    scenery(scene, { HALO, mkLineMat, css }) {
      scene.add(new THREE.AmbientLight(0x7C8AA2, 0.85));
      const sunLight = new THREE.PointLight(0xFFD9A0, 0.5, 0, 0);
      scene.add(sunLight);
      const keyLight = new THREE.DirectionalLight(0xFFF1DC, 1.1);
      keyLight.position.set(-320, 260, 240);
      scene.add(keyLight);
      const fill = new THREE.DirectionalLight(0xB8C8E6, 0.35);
      scene.add(fill);
      const ocean = new THREE.Mesh(new THREE.SphereGeometry(RG, 128, 96), new THREE.MeshStandardMaterial({ color: '#07101A', roughness: 0.92, metalness: 0, emissive: '#03060B' }));
      scene.add(ocean);
      const land = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: '#24423B', roughness: 1, transparent: true, opacity: 0.62, depthWrite: false, alphaMap: HALO, polygonOffset: true, polygonOffsetFactor: -2 }), G.nodes.length);
      land.frustumCulled = false;
      const z = new THREE.Vector3(0, 0, 1);
      G.nodes.forEach((nd, i) => {
        const d = homes.get(nd.id).clone().normalize();
        const k = kindOf(nd.kind);
        const s = k === 'router' ? 40 : k === 'playbook' ? 34 : 22;
        land.setMatrixAt(i, new THREE.Matrix4().compose(d.clone().multiplyScalar(RG + 0.25), new THREE.Quaternion().setFromUnitVectors(z, d), new THREE.Vector3(s, s, 1)));
      });
      land.renderOrder = 1;
      scene.add(land);
      const guides = [];
      const a = [];
      const S = 144;
      const P = (lat, lon) => new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)).multiplyScalar(RG + 0.4);
      for (let la = -60; la <= 60; la += 30) {
        for (let i = 0; i < S; i++) {
          const p = P((la * Math.PI) / 180, (i / S) * 2 * Math.PI);
          const q = P((la * Math.PI) / 180, ((i + 1) / S) * 2 * Math.PI);
          a.push(p.x, p.y, p.z, q.x, q.y, q.z);
        }
      }
      for (let lo = 0; lo < 360; lo += 30) {
        for (let i = 0; i < S / 2; i++) {
          const p = P(-Math.PI / 2 + (i / (S / 2)) * Math.PI, (lo * Math.PI) / 180);
          const q = P(-Math.PI / 2 + ((i + 1) / (S / 2)) * Math.PI, (lo * Math.PI) / 180);
          a.push(p.x, p.y, p.z, q.x, q.y, q.z);
        }
      }
      const g = new LineSegmentsGeometry();
      g.setPositions(a);
      const l = new LineSegments2(g, mkLineMat({ color: css('--guide-outer'), linewidth: 1, opacity: 0.55 }));
      l.userData.op = 0.55;
      scene.add(l);
      guides.push(l);
      const atmo = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        uniforms: { c: { value: new THREE.Color('#4F86C6') } },
        vertexShader: 'varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
        fragmentShader: 'uniform vec3 c;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-abs(dot(vN,vV)),3.);gl_FragColor=vec4(c*f*.9,f);}',
      });
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(RG * 1.07, 96, 64), atmo));
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), capMat);
      scene.add(mesh);
      api.routerMesh = mesh;
      api.routerDim = (d, DIM) => {
        capMat.emissiveIntensity = 0.9 * (1 - d);
        capMat.color.set('#F2C46B').lerp(DIM, d * 0.8);
      };
      api.guides = guides;
      return { sunLight, fill, guides };
    },
    decor(starNode, N, mkHalo) {
      const decor = [
        { o: starNode, s: mkHalo('#F6CF85', 1, 0.55), f: 3.2, op: 0.55 },
        { o: starNode, s: mkHalo('#F2B85A', 1, 0.14), f: 8, op: 0.14 },
      ];
      N.filter((o) => o.k === 'playbook').forEach((o) => decor.push({ o, s: mkHalo('#F6DDB0', 1, 0.22), f: 3.4, op: 0.22 }));
      return decor;
    },
  };
  // Cities are smooth; towns and smaller places stay faceted.
  const baseMat = api.material;
  api.material = (k) => {
    const m = baseMat();
    m.flatShading = k !== 'playbook';
    return m;
  };
  return api;
}

function brainTheme({ G, kindOf, deg, css }) {
  const BA = 175;
  const BB = 118;
  const BC = 138;
  const maxDeg = Math.max(1, ...G.nodes.filter((n) => n.kind !== 'router').map((n) => deg(n.id)));
  const KMUL = { router: 1, playbook: 1, skill: 0.9, agent: 0.9, automation: 1, principle: 0.8, script: 0.6, reference: 0.6, other: 0.6 };
  const radiusOf = (n) => (n.kind === 'router' ? 8 : KMUL[kindOf(n.kind)] * (1.5 + 3.6 * Math.sqrt(deg(n.id) / maxDeg)));
  const GEO = {
    playbook: () => new THREE.IcosahedronGeometry(1, 3),
    skill: () => new THREE.IcosahedronGeometry(1, 3),
    agent: () => new THREE.IcosahedronGeometry(1, 3),
    automation: () => new THREE.IcosahedronGeometry(1, 3),
    principle: () => new THREE.IcosahedronGeometry(1, 3),
    reference: () => new THREE.IcosahedronGeometry(1, 2),
    script: () => new THREE.IcosahedronGeometry(1, 2),
    other: () => new THREE.IcosahedronGeometry(1, 2),
  };
  const zoneOf = (u) => (u.y <= -0.12 && u.x > -0.55 ? 'temporal' : u.x > 0.28 ? 'frontal' : u.x > -0.12 ? 'motor' : u.x < -0.62 ? 'occipital' : 'parietal');
  const ZK = { frontal: ['playbook'], motor: ['skill', 'agent', 'other'], parietal: ['principle'], temporal: ['reference', 'script'] };
  const CB = new THREE.Vector3(-118, -72, 0);
  const CBS = new THREE.Vector3(58, 40, 100);
  const sceneC = new THREE.Vector3(0, -18, 0);
  const homes = new Map();
  const dirOf = new Map();
  const router = G.nodes.find((n) => n.kind === 'router');
  homes.set(router.id, new THREE.Vector3(0, -14, 0));
  dirOf.set(router.id, new THREE.Vector3(0, -1, 0));
  const cortex = (d, k) => new THREE.Vector3(d.x * BA * k, d.y * BB * k * (d.y < 0 ? 0.8 : 1), d.z * BC * k + Math.sign(d.z) * 3);
  const cand = [];
  {
    const n = 6000;
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n;
      const s = Math.sqrt(1 - y * y);
      const th = i * GOLD;
      cand.push(new THREE.Vector3(Math.cos(th) * s, y, Math.sin(th) * s));
    }
  }
  Object.entries(ZK).forEach(([z, kinds]) => {
    const list = G.nodes.filter((n) => kinds.includes(kindOf(n.kind)));
    if (!list.length) return;
    let pool = cand.filter((d) => zoneOf(d) === z && d.y > -0.8 && Math.abs(d.z) > 0.08);
    if (pool.length < list.length) pool = cand.filter((d) => zoneOf(d) === z);
    if (!pool.length) pool = cand;
    const st = pool.length / list.length;
    const slots = list.map((_, i) => cortex(pool[Math.min(pool.length - 1, Math.floor(i * st + st / 2))], 0.84));
    const free = slots.map(() => true);
    const target = (n) => {
      const v = new THREE.Vector3();
      G.edges.forEach((e) => {
        const o = e.source === n.id ? e.target : e.target === n.id ? e.source : null;
        if (o && dirOf.has(o) && o !== router.id) v.add(dirOf.get(o));
      });
      return v.lengthSq() > 1e-6 ? v.normalize() : null;
    };
    const order = list.slice().sort((a, b) => (target(b) ? 1 : 0) - (target(a) ? 1 : 0) || deg(b.id) - deg(a.id));
    let next = 0;
    order.forEach((n) => {
      const t = target(n);
      let best = -1;
      if (t) {
        let bd = -9;
        slots.forEach((s, i) => {
          if (free[i]) {
            const d = s.clone().normalize().dot(t);
            if (d > bd) { bd = d; best = i; }
          }
        });
      } else {
        while (!free[next]) next += 1;
        best = next;
      }
      free[best] = false;
      homes.set(n.id, slots[best].clone());
      dirOf.set(n.id, slots[best].clone().normalize());
    });
  });
  G.nodes.filter((n) => kindOf(n.kind) === 'automation').forEach((n, i, a) => {
    const th = ((i + 0.5) / a.length) * Math.PI * 1.2 - Math.PI * 0.6;
    const p = new THREE.Vector3(-Math.cos(th) * 0.35, 0.25 * Math.sin(i * 2.1), Math.sin(th)).normalize();
    const q = CB.clone().add(new THREE.Vector3(p.x * CBS.x * 0.8, p.y * CBS.y * 0.8, p.z * CBS.z * 0.8));
    homes.set(n.id, q);
    dirOf.set(n.id, q.clone().normalize());
  });
  G.nodes.forEach((n) => { if (!homes.has(n.id)) homes.set(n.id, new THREE.Vector3(0, 40, 0)); });
  const capMat = new THREE.MeshStandardMaterial({ color: '#F2C46B', emissive: '#C08A2A', emissiveIntensity: 0.9, roughness: 0.35 });
  const brainMats = [];
  const api = {
    id: 'brain',
    homes,
    GEO,
    radiusOf,
    RMAX: BA,
    sceneC,
    homeCam: { az: 0.36, el: 0.16 },
    gkeep: 0.1,
    pulse: { speed: 1.4, per: 3, size: 0.65, color: '#FFF4DA' },
    homeVX: -130,
    showSel: true,
    stars: false,
    front(o, camDir) {
      const rel = o.pos.clone().sub(sceneC);
      return rel.dot(camDir) > -0.15 * rel.length();
    },
    fitDist(W, H, mobile, vf) {
      const ppu = Math.min(((mobile ? H - 150 : H - 120) / 2) / 150, ((W - (mobile ? 24 : 96 + 260)) / 2) / (BA * 1.12));
      return H / (2 * Math.tan(vf / 2) * ppu) + BC * 0.45;
    },
    fog(d) {
      return { near: d - 60, far: d + BC * 2.6 };
    },
    curve(a, b, t, out, mode, side, FS) {
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
      const m = a.clone().add(b).multiplyScalar(0.5).sub(sceneC).multiplyScalar(0.45).add(sceneC);
      const mt = 1 - t;
      return out.set(a.x * mt * mt + 2 * m.x * mt * t + b.x * t * t, a.y * mt * mt + 2 * m.y * mt * t + b.y * t * t, a.z * mt * mt + 2 * m.z * mt * t + b.z * t * t);
    },
    material() {
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.42 });
      m.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance*=diffuseColor.rgb;');
      };
      return m;
    },
    scenery(scene, { css: cssFn }) {
      scene.add(new THREE.AmbientLight(0x8C96B8, 1.0));
      const sunLight = new THREE.PointLight(0xFFE2B0, 1.2, 0, 0);
      scene.add(sunLight);
      const fill = new THREE.DirectionalLight(0xC8D2EE, 0.9);
      scene.add(fill);
      const colorOf = cssFn || css;
      const ZC = { frontal: colorOf('--k-playbook'), motor: colorOf('--k-skill'), parietal: colorOf('--k-principle'), temporal: colorOf('--k-reference'), occipital: '#5A6378' };
      const base = new THREE.Color('#7D8FC0');
      const mat = () => {
        const m = new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          vertexColors: true,
          uniforms: { op: { value: 1 } },
          vertexShader: 'varying vec3 vN;varying vec3 vV;varying vec3 vC;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);vC=color;gl_Position=projectionMatrix*mv;}',
          fragmentShader: 'uniform float op;varying vec3 vN;varying vec3 vV;varying vec3 vC;void main(){float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.4);gl_FragColor=vec4(vC*(.07+.62*f)*op,1.);}',
        });
        brainMats.push(m);
        return m;
      };
      const hemi = (side) => {
        const g = new THREE.SphereGeometry(1, 160, 112);
        const p = g.attributes.position;
        const col = [];
        const v = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i);
          const f = 1 + 0.03 * Math.sin(17 * v.x + 4 * Math.sin(9 * v.y)) * Math.sin(15 * v.y + 3 * Math.sin(11 * v.z)) + 0.014 * Math.sin(29 * v.z + 5 * v.x);
          let z = v.z * BC * 0.5 * f;
          if (z * side < 0) z *= 0.35;
          const x = v.x * BA * f;
          const y = v.y * BB * f * (v.y < 0 ? 0.8 : 1);
          p.setXYZ(i, x, y, z + side * BC * 0.5);
          const u = new THREE.Vector3(x / BA, y / BB, (z + side * BC * 0.5) / BC);
          const c = new THREE.Color(ZC[zoneOf(u)] || '#5A6378').lerp(base, 0.45);
          col.push(c.r, c.g, c.b);
        }
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, mat());
        mesh.frustumCulled = false;
        mesh.renderOrder = -1;
        scene.add(mesh);
      };
      hemi(1);
      hemi(-1);
      {
        const g = new THREE.SphereGeometry(1, 96, 64);
        const p = g.attributes.position;
        const col = [];
        const v = new THREE.Vector3();
        const c = new THREE.Color(colorOf('--k-automation')).lerp(base, 0.4).multiplyScalar(0.6);
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i);
          const f = 1 + 0.03 * Math.sin(46 * v.y + 2 * Math.sin(5 * v.z));
          p.setXYZ(i, CB.x + v.x * CBS.x * f, CB.y + v.y * CBS.y * f, CB.z + v.z * CBS.z * f);
          col.push(c.r, c.g, c.b);
        }
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, mat());
        mesh.frustumCulled = false;
        scene.add(mesh);
      }
      {
        const g = new THREE.CylinderGeometry(14, 20, 84, 48, 1, true);
        const col = [];
        const c = new THREE.Color('#5A6378');
        for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b);
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        const mesh = new THREE.Mesh(g, mat());
        mesh.position.set(-58, -112, 0);
        mesh.rotation.z = -0.42;
        mesh.frustumCulled = false;
        scene.add(mesh);
      }
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), capMat);
      scene.add(mesh);
      api.routerMesh = mesh;
      api.routerDim = (d, DIM) => {
        capMat.emissiveIntensity = 0.9 * (1 - d);
        capMat.color.set('#F2C46B').lerp(DIM, d * 0.8);
      };
      api.guides = [];
      api.brainMats = brainMats;
      return { sunLight, fill, guides: [] };
    },
    decor(starNode, N, mkHalo, color) {
      const decor = [
        { o: starNode, s: mkHalo('#F6CF85', 1, 0.6), f: 3.4, op: 0.6 },
        { o: starNode, s: mkHalo('#F2B85A', 1, 0.16), f: 9, op: 0.16 },
      ];
      N.filter((o) => o.k !== 'router').forEach((o) => {
        const hot = deg(o.id) >= 12;
        decor.push({ o, s: mkHalo(color(o.k), 1, hot ? 0.32 : 0.18), f: 3.6, op: hot ? 0.32 : 0.18 });
      });
      return decor;
    },
    tick(idleAlpha) {
      const a = api.gkeep + (1 - api.gkeep) * idleAlpha;
      (api.brainMats || []).forEach((m) => { m.uniforms.op.value = a; });
    },
  };
  return api;
}
