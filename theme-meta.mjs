// Names, key rows, and glyphs for every theme. No scene code, so the galaxy
// page can paint without loading kitchen, circuit, earth, or brain.
function galaxyGlyph(k, s, c) {
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


export const THEME_IDS = ['galaxy', 'kitchen', 'circuit', 'earth', 'brain'];

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

const GALAXY_KEY = {
  title: '<span>Bodies</span> <span>size = importance</span>',
  edgeLabel: 'Connection types',
  rows: [
    ['router', ['router'], 'Core', 'Start here', ''],
    ['playbook', ['playbook'], 'Stars', 'Workflows', ''],
    ['skill', ['skill', 'agent'], 'Planets', 'Tools · Assistants', ''],
    ['automation', ['automation'], 'Small worlds', 'Routines', ''],
    ['principle', ['principle'], 'Rule worlds', 'Rules', ''],
    ['reference', ['reference', 'script'], 'Moons', 'Docs · Helpers', ''],
  ],
};

const META = {
  galaxy: {
    em: 'galaxy', placeholder: 'Search stars, planets, rules…',
    hintBold: 'Click any star to explore', hintSmall: '· drag to turn, scroll to zoom',
    role: { router: 'Core', playbook: 'Star', skill: 'Planet', agent: 'Planet', automation: 'Small world', principle: 'Rule world', reference: 'Moon', script: 'Moon', other: 'Body' },
    key: GALAXY_KEY, glyph: galaxyGlyph, wideKey: true, showShape: false,
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
  return META[id] || META.galaxy;
}

