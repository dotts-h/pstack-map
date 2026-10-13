// usage: node scripts/check-flows.mjs [data/skill-flows.json]
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
    if (pick === null) same(s.decisions, [], `${label}: decisions`);
    if (pick === '') {
      same(s.skipped, [], `${label}: the default skipped steps`);
      expect(s.decisions.every((d) => d.by === 'default'), `${label}: a decision was not the default`);
    }
    const forced = pick && /^(\d+):(yes|no)$/.exec(pick);
    const d = forced && s.decisions.find((x) => x.index === Number(forced[1]));
    if (d) same([d.answer, d.by], [forced[2], 'pick'], `${label}: forced answer`);
  }
}

const how = flows.get('how');
same(how && [how.steps.length, how.branches.map((b) => [b.at, b.q, b.def, b.skips])], [4, [[0, 'Is the scope ambiguous?', 'no', null], [1, 'Is the task complex?', 'yes', { on: 'no', steps: [1, 2] }]]], 'how branches');
if (how) {
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

const doc = (branches) => ({ skills: { x: { steps: [{ n: 1, caption: 'a', line: 1 }, { n: 2, caption: 'b', line: 2 }], inputs: [], branches } } });
const good = { ask: 0, q: 'Q?', line: 3, text: 'If q, then b.', skip: [1], skipOn: 'no' };
same(readFlows(doc([good]), () => true).get('x').branches.map((b) => [b.at, b.def, b.skips]), [[0, 'yes', { on: 'no', steps: [1] }]], 'one good branch');
same(readFlows(doc([good, { ...good, ask: 5 }]), () => true).get('x').branches, [], 'a bad branch drops every branch of the skill');
same(readFlows(doc([{ ...good, ask: 1, skip: [0] }]), () => true).get('x').branches, [], 'a skip before its question is rejected');
same([...readPicks('0:yes,1:no,junk')], [['0', 'yes'], ['1', 'no']], 'readPicks indexed');
same([...readPicks('no')], [['*', 'no']], 'readPicks all');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`ok ${flows.size} skills, ${branchCount} branches, ${runs} runs`);
