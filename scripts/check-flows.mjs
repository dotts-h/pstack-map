import fs from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { readFlows, readPicks, FlowRun } from '../kitchen-flow.mjs';

const file = process.argv[2] || new URL('../data/skill-flows.json', import.meta.url);
const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const PACE = { input: 0.5, step: 2 };
const DT = 1 / 30;
const failures = [];
const expect = (ok, what) => { if (!ok) failures.push(what); };
const same = (got, want, what) => expect(isDeepStrictEqual(got, want), `${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

function play(flow, opts, onTick = () => {}) {
  const run = new FlowRun(flow, PACE, opts);
  const budget = flow.inputs.length * PACE.input + flow.steps.length * PACE.step + flow.branches.length * 3 + 1;
  let t = 0, last = 0, steady = true;
  while (!run.done && t < budget) {
    const ev = run.tick(DT);
    t += DT;
    if (run.progress < last || (!run.done && run.progress >= 1)) steady = false;
    last = run.progress;
    onTick(run, ev);
  }
  return { run, t, steady, s: run.summary() };
}

const flows = readFlows(raw, () => true);
let runs = 0, branchCount = 0;
for (const [id, flow] of flows) {
  const wire = raw.skills[id].branches ?? [];
  branchCount += flow.branches.length;
  expect(flow.branches.length === wire.length, `${id}: parsed ${flow.branches.length} of ${wire.length} branches`);
  for (const w of wire) {
    const skipOn = w.skipOn === 'yes' || w.skipOn === 'no' ? w.skipOn : null;
    const matched = skipOn !== null && w.default === skipOn;
    expect((w.kind === 'opt-in') === matched, `${id}: (kind === 'opt-in') does not match (default === skipOn) for ${w.kind} at ${w.ask}`);
    if (w.kind === 'opt-in') same(w.skip, [w.ask], `${id}: opt-in skip is not its own step at ${w.ask}`);
  }
  const n = flow.steps.length;
  const picks = ['', 'yes', 'no', ...flow.branches.flatMap((_, i) => [`${i}:yes`, `${i}:no`])];
  for (const pick of [...picks, null]) {
    const label = pick === null ? `${id} asks off` : `${id} pick=${JSON.stringify(pick)}`;
    const { run, steady, s } = play(flow, { asks: pick !== null, picks: readPicks(pick) });
    runs++;
    expect(run.done, `${label}: not done within the time budget`);
    expect(steady, `${label}: progress went backwards or reached 1 before done`);
    expect(s.executed.every((k, i) => !i || k > s.executed[i - 1]), `${label}: executed out of order ${s.executed}`);
    same([...s.executed, ...s.skipped].sort((a, b) => a - b), [...Array(n).keys()], `${label}: executed and skipped do not partition the steps`);
    if (pick === null) {
      same(s.decisions, [], `${label}: decisions`);
      same(s.skipped, [], `${label}: asks off skips nothing`);
    }
    if (pick === '') {
      const optIn = wire.filter((w) => w.kind === 'opt-in').flatMap((w) => (Array.isArray(w.skip) ? w.skip : []));
      const skipped = [...new Set(optIn)].sort((a, b) => a - b);
      same(s.skipped, skipped, `${label}: the default skipped steps`);
      same(s.executed, [...Array(n).keys()].filter((k) => !skipped.includes(k)), `${label}: the default executed steps`);
      expect(s.decisions.every((d) => d.by === 'default'), `${label}: a decision was not the default`);
    }
    const forced = pick && /^(\d+):(yes|no)$/.exec(pick);
    const d = forced && s.decisions.find((x) => x.index === Number(forced[1]));
    if (d) same([d.answer, d.by], [forced[2], 'pick'], `${label}: forced answer`);
  }
}

const pinHow = !process.argv.includes('--generic');
const how = pinHow && flows.get('how');
if (how) {
  same([how.steps.length, how.branches.map((b) => [b.at, b.q, b.def, b.skips])], [4, [[0, 'Is the scope ambiguous?', 'no', null], [1, 'Is the task complex?', 'yes', { on: 'no', steps: [1, 2] }]]], 'how branches');
  const quiet = play(how, { asks: false, picks: readPicks(null) });
  same([quiet.s.executed, Math.round(quiet.t * 10) / 10], [[0, 1, 2, 3], 9.5], 'how asks off: executed and seconds');

  const dflt = play(how, { asks: true, picks: readPicks('') });
  same(dflt.s.executed, [0, 1, 2, 3], 'how default: executed');
  same(dflt.s.decisions.map((x) => [x.index, x.answer, x.by]), [[0, 'no', 'default'], [1, 'yes', 'default']], 'how default: decisions');
  expect(Math.abs(dflt.t - 13.6) < 0.2, `how default: took ${dflt.t.toFixed(2)} s, want 9.5 s of work plus 2 x (1.5 + 0.55) s of questions`);

  let note = null;
  const forced = play(how, { asks: true, picks: readPicks('1:no') }, (run, ev) => { if (ev.some((e) => e.kind === 'decided' && e.decision.index === 1)) note = run.note; });
  same([forced.s.executed, forced.s.skipped], [[0, 3], [1, 2]], 'how pick=1:no: executed and skipped');
  same(note, { head: 'No: Is the task complex?', effect: 'skips step 2, step 3' }, 'how pick=1:no: note');
  same(play(how, { asks: true, picks: readPicks('no') }).s.skipped, [1, 2], 'how pick=no: skipped');

  const answers = [];
  const clicked = play(how, { asks: true, picks: readPicks('') }, (run) => {
    if (run.asking?.index === 1 && !answers.length) answers.push(run.choose('no'), run.choose('yes'), run.asking.answer);
  });
  same(answers, [true, false, 'no'], 'how click: first answer wins');
  same([clicked.s.skipped, clicked.s.decisions[1]?.by], [[1, 2], 'user'], 'how click: decision');
}

const architect = pinHow && flows.get('architect');
if (architect) {
  same(architect.branches.map((b) => [b.at, b.def, b.skips]), [
    [0, 'no', { on: 'yes', steps: [0] }],
    [2, 'no', { on: 'no', steps: [2] }],
    [2, 'no', null],
    [4, 'no', null],
  ], 'architect branches');
  let note = null;
  const dflt = play(architect, { asks: true, picks: readPicks('') }, (run, ev) => {
    if (ev.some((e) => e.kind === 'decided' && e.decision.index === 1)) note = run.note;
  });
  same([dflt.s.executed, dflt.s.skipped], [[0, 1, 3, 4], [2]], 'architect default: executed and skipped');
  same(dflt.s.decisions.map((x) => [x.index, x.answer, x.by]), [[0, 'no', 'default'], [1, 'no', 'default'], [2, 'no', 'default'], [3, 'no', 'default']], 'architect default: decisions');
  const opt = architect.branches[1];
  same(note, { head: `No: ${opt.q}`, effect: `${opt.no}; skips ${opt.skips.steps.map((k) => `step ${k + 1}`).join(', ')}` }, 'architect default: opt-in note');
}

const doc = (branches) => ({ skills: { x: { steps: [{ n: 1, caption: 'a', line: 1 }, { n: 2, caption: 'b', line: 2 }], inputs: [], branches } } });
const good = { ask: 0, q: 'Q?', line: 3, text: 'If q, then b.', skip: [1], skipOn: 'no', default: 'yes' };
const bare = { ...good };
delete bare.default;
same(readFlows(doc([good]), () => true).get('x').branches.map((b) => [b.at, b.def, b.skips]), [[0, 'yes', { on: 'no', steps: [1] }]], 'one good branch');
same(readFlows(doc([bare]), () => true).get('x').branches, [], 'a branch without default drops the skill branches');
same(readFlows(doc([{ ...good, default: 'later' }]), () => true).get('x').branches, [], 'an illegal default drops the skill branches');
same(readFlows(doc([good, { ...good, ask: 5 }]), () => true).get('x').branches, [], 'a bad branch drops every branch of the skill');
same(readFlows(doc([{ ...good, ask: 1, skip: [0] }]), () => true).get('x').branches, [], 'a skip before its question is rejected');
const sameStep = readFlows(doc([
  { ask: 0, kind: 'opt-in', q: 'Opt?', line: 3, text: 'Opt in.', yes: 'pause', no: 'go on', skip: [0], skipOn: 'no', default: 'no' },
  { ask: 0, kind: 'if', q: 'If?', line: 4, text: 'If q, then b.', yes: 'yes path', no: 'no path', skip: [], default: 'no' },
]), () => true).get('x');
const sameRun = play(sameStep, { asks: true, picks: readPicks('') });
same(sameRun.s.decisions.map((d) => [d.index, d.answer, d.by]), [[0, 'no', 'default'], [1, 'no', 'default']], 'a later ask on a skipped step still decides');
same(sameRun.s.skipped, [0], 'opt-in default skips its own step');
const laterDead = readFlows(doc([
  { ask: 0, kind: 'skip', q: 'Skip later?', line: 3, text: 'Skip the next step.', skip: [1], skipOn: 'yes', default: 'yes' },
  { ask: 1, kind: 'if', q: 'Later?', line: 4, text: 'If later.', yes: 'yes path', no: 'no path', skip: [], default: 'no' },
]), () => true).get('x');
const deadRun = play(laterDead, { asks: true, picks: readPicks('') });
same(deadRun.s.decisions.map((d) => [d.index, d.answer, d.by]), [[0, 'yes', 'default']], 'an earlier skip kills a later ask');
same(deadRun.s.skipped, [1], 'the later step is skipped');
same([...readPicks('0:yes,1:no,junk')], [['0', 'yes'], ['1', 'no']], 'readPicks indexed');
same([...readPicks('no')], [['*', 'no']], 'readPicks all');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`ok ${flows.size} skills, ${branchCount} branches, ${runs} runs`);
