// Plain names and one-liners for the pstack map. Deterministic, from graph.json only.
// Rules: DESIGN.md v3 §10.2. Shared by the page and the shell layout (sort key).

export const KINDS = ['router', 'playbook', 'skill', 'agent', 'automation', 'principle', 'reference', 'script'];

export const FRIENDLY = {
  router: ['Start here', 'Start here'],
  playbook: ['Workflow', 'Workflows'],
  skill: ['Tool', 'Tools'],
  agent: ['Assistant', 'Assistants'],
  automation: ['Routine', 'Routines'],
  principle: ['Rule', 'Rules'],
  reference: ['Doc', 'Docs'],
  script: ['Helper', 'Helpers'],
  other: ['Item', 'Other'],
};

export const EWORD = {
  loads: 'Starts',
  applies: 'Follows',
  runs: 'Runs',
  imports: 'Builds on',
  references: 'Mentions',
  other: 'Linked',
};

export const ETYPES = ['loads', 'applies', 'runs', 'imports', 'references'];

const ACR = { pr: 'PR', ci: 'CI', ui: 'UI', api: 'API', ts: 'TS', tsv: 'TSV', ios: 'iOS', tdd: 'TDD', readme: 'README' };
const TRIG = /^(Apply|Use|Used|Invoke|Invoked|Skip|Trigger)s?\b/i;

export function kindOf(kind) {
  return KINDS.includes(kind) ? kind : 'other';
}

export function etype(type) {
  return ETYPES.includes(type) ? type : 'other';
}

function clean(s) {
  return s && s !== 'None' ? s : null;
}

function stems(s) {
  return new Set((String(s).match(/[A-Za-z]{4,}/g) || []).map((x) => x.slice(0, 4).toLowerCase()));
}

function sentenceCase(s) {
  return s === s.toUpperCase() && /[A-Z]{3}/.test(s) ? s[0] + s.slice(1).toLowerCase() : s;
}

function humanize(s) {
  const raw = String(s ?? '').replace(/\/$/, '').replace(/\.(md|ts|mjs|js|sh|tsv|json|ya?ml)$/i, '').replace(/\./g, ' ');
  const words = raw.split(/[-_\s]+/).filter(Boolean).map((x) => ACR[x.toLowerCase()] || x);
  if (!words.length) return '';
  const out = words.join(' ');
  return out[0].toUpperCase() + out.slice(1);
}

export function plainName(node) {
  let title = clean(node.title);
  if (title && node.kind === 'reference') {
    const titleStems = stems(title);
    const nameStems = stems(node.name);
    if (![...titleStems].some((stem) => nameStems.has(stem))) title = null;
  }
  const text = sentenceCase(title || humanize(node.name));
  if (!text) return node.name || node.id || '';
  return text[0].toUpperCase() + text.slice(1);
}

function stripMd(s) {
  return s
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*?([^*]+)\*\*?/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[>-]\s*/, '')
    .replace(/\s+-\s+/g, '; ')
    .replace(/\s+/g, ' ')
    .trim();
}

function capWords(s, max) {
  if (s.length <= max) return s;
  let cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  if (space > 0) cut = cut.slice(0, space);
  return cut.replace(/[,;:—-]+$/, '') + '…';
}

export function oneLiner(node, graph) {
  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const description = clean(node.description);
  if (description) {
    const stripped = stripMd(description);
    const sentences = stripped.split(/(?<=[.!?])\s+(?=[A-Z"“(])/).filter(Boolean);
    const picked = sentences.find((sentence) => !TRIG.test(sentence)) || sentences[0];
    if (picked) return capWords(picked[0].toUpperCase() + picked.slice(1), 120);
  }
  const ownerId = clean(node.owner);
  const incoming = edges
    .filter((edge) => edge.target === node.id)
    .map((edge) => byId.get(edge.source))
    .filter(Boolean);
  const source = (ownerId && byId.get(ownerId))
    || incoming.sort((a, b) => (b.degree?.total ?? 0) - (a.degree?.total ?? 0))[0];
  if (!source) return 'No description in the source yet.';
  return `${FRIENDLY[kindOf(node.kind)][0]} used by ${plainName(source)}.`;
}

export function stepsOf(graph, id) {
  const m = new Map();
  graph.edges.forEach((e) => {
    if (e.source !== id || e.mode !== 'step' || !Number.isInteger(e.order)) return;
    if (!m.has(e.order)) m.set(e.order, []);
    if (!m.get(e.order).includes(e.target)) m.get(e.order).push(e.target);
  });
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
}
