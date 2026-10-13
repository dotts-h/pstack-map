/** @typedef {'yes'|'no'} Answer */
/** @typedef {Readonly<{kind:'file'|'skill'|'principle'|'rule', name:string, line:number}>} Input */
/** @typedef {Readonly<{n:number, caption:string, line:number}>} Step */
/** @typedef {Readonly<{on:Answer, steps:readonly number[]}>} Skips */
/** @typedef {Readonly<{at:number, q:string, line:number, text:string, yes:string, no:string, skips:Skips|null, def:Answer}>} Branch */
/** @typedef {Readonly<{file:string, stepSource:string, inputs:readonly Input[], steps:readonly Step[], branches:readonly Branch[]}>} Flow */
/** @typedef {Readonly<{input:number, step:number}>} Pace */
/** @typedef {ReadonlyMap<string, Answer>} Picks */
/** @typedef {Readonly<{branch:Branch, index:number, answer:Answer|null}>} Asking */
/** @typedef {Readonly<{index:number, answer:Answer, by:'user'|'pick'|'default', skipped:readonly number[]}>} Decision */
/** @typedef {Readonly<{head:string, effect:string}>} Note */
/** @typedef {Readonly<{kind:'in', i:number}> | Readonly<{kind:'step', k:number}> | Readonly<{kind:'ask', index:number}> | Readonly<{kind:'decided', decision:Decision}> | Readonly<{kind:'done'}>} FlowEvent */

const ASK_WAIT = 1.5;
const ASK_SHOW = 0.55;
const NOTE_SHOW = 2.6;
const INPUT_KINDS = new Set(['file', 'skill', 'principle', 'rule']);
const ANSWERS = new Set(['yes', 'no']);

/** @type {Flow} */
export const NO_FLOW = Object.freeze({
  file: '',
  stepSource: 'no flow data',
  inputs: Object.freeze([]),
  steps: Object.freeze([Object.freeze({ n: 1, caption: 'No ordered steps in the flow data', line: 0 })]),
  branches: Object.freeze([]),
});

const isInt = (v, min) => Number.isInteger(v) && v >= min;
const isText = (v) => typeof v === 'string' && v.length > 0;
const optText = (v) => (v == null ? '' : typeof v === 'string' ? v : null);

function readSteps(raw) {
  if (!Array.isArray(raw) || !raw.length) return NO_FLOW.steps;
  if (!raw.every((s) => s && isInt(s.n, 1) && typeof s.caption === 'string' && isInt(s.line, 0))) return NO_FLOW.steps;
  return Object.freeze(raw.map((s) => Object.freeze({ n: s.n, caption: s.caption, line: s.line })));
}

function readInputs(raw) {
  if (!Array.isArray(raw)) return Object.freeze([]);
  return Object.freeze(raw.filter((x) => x && INPUT_KINDS.has(x.kind) && typeof x.name === 'string' && isInt(x.line, 0)).map((x) => Object.freeze({ kind: x.kind, name: x.name, line: x.line })));
}

function readBranch(w, n) {
  if (!w || !isInt(w.ask, 0) || w.ask >= n || !isText(w.q) || !isText(w.text) || !isInt(w.line, 1)) return null;
  const yes = optText(w.yes), no = optText(w.no);
  if (yes === null || no === null) return null;
  const at = w.ask, raw = w.skip ?? [];
  if (!Array.isArray(raw)) return null;
  let skips = null;
  if (raw.length) {
    if (!ANSWERS.has(w.skipOn) || !raw.every((k) => Number.isInteger(k) && k >= at && k < n)) return null;
    skips = Object.freeze({ on: w.skipOn, steps: Object.freeze([...new Set(raw)].sort((a, b) => a - b)) });
  }
  return Object.freeze({ at, q: w.q, line: w.line, text: w.text, yes, no, skips, def: skips?.on === 'no' ? 'yes' : 'no' });
}

/**
 * @param {unknown} raw
 * @param {(id: string) => boolean} isStation
 * @returns {ReadonlyMap<string, Flow>}
 */
export function readFlows(raw, isStation) {
  const flows = new Map();
  const bySkill = raw && typeof raw === 'object' && raw.skills && typeof raw.skills === 'object' ? raw.skills : {};
  for (const [id, f] of Object.entries(bySkill)) {
    if (!isStation(id) || !f || typeof f !== 'object') continue;
    const steps = readSteps(f.steps);
    const wire = f.branches ?? [];
    let branches = Object.freeze([]);
    if (Array.isArray(wire) && wire.length && steps !== NO_FLOW.steps) {
      const parsed = wire.map((w) => readBranch(w, steps.length));
      if (parsed.every(Boolean)) branches = Object.freeze(parsed);
    }
    flows.set(id, Object.freeze({ file: String(f.file || ''), stepSource: String(f.stepSource || 'no flow data'), inputs: readInputs(f.inputs), steps, branches }));
  }
  return flows;
}

/**
 * @param {string | null} param
 * @returns {Picks}
 */
export function readPicks(param) {
  const picks = new Map();
  for (const part of String(param ?? '').split(',')) {
    const m = /^(?:(\d+):)?(yes|no)$/.exec(part.trim());
    if (m) picks.set(m[1] === undefined ? '*' : String(Number(m[1])), m[2]);
  }
  return picks;
}

export class FlowRun {
  #flow;
  #picks;
  #ops = [];
  #pc = -1;
  #ot = 0;
  #ask = null;
  #note = null;
  #noteT = 0;
  #skip = new Set();
  #seen = [];
  #decisions = [];
  #inI = -1;
  #stepI = -1;
  #done = false;

  /**
   * @param {Flow} flow
   * @param {Pace} pace
   * @param {{asks: boolean, picks: Picks}} opts
   */
  constructor(flow, pace, { asks, picks }) {
    this.#flow = flow;
    this.#picks = picks;
    flow.inputs.forEach((_, i) => this.#ops.push({ kind: 'in', i, dur: pace.input }));
    flow.steps.forEach((_, k) => {
      if (asks) flow.branches.forEach((b, index) => { if (b.at === k) this.#ops.push({ kind: 'ask', index, dur: 0 }); });
      this.#ops.push({ kind: 'step', k, dur: pace.step });
    });
  }

  #dead(op) {
    return op.kind === 'step' ? this.#skip.has(op.k) : op.kind === 'ask' && this.#skip.has(this.#flow.branches[op.index].at);
  }

  #enter(from, ev) {
    for (let pc = from; pc < this.#ops.length; pc++) {
      const op = this.#ops[pc];
      if (this.#dead(op)) continue;
      this.#pc = pc;
      this.#ot = 0;
      if (op.kind === 'in') { this.#inI = op.i; ev.push(Object.freeze({ kind: 'in', i: op.i })); }
      else if (op.kind === 'step') { this.#stepI = op.k; this.#seen.push(op.k); ev.push(Object.freeze({ kind: 'step', k: op.k })); }
      else { this.#ask = { index: op.index, branch: this.#flow.branches[op.index], answer: null, by: null, t: 0, shown: 0 }; ev.push(Object.freeze({ kind: 'ask', index: op.index })); }
      return;
    }
    this.#pc = this.#ops.length;
    this.#done = true;
    ev.push(Object.freeze({ kind: 'done' }));
  }

  #decide(ev) {
    const a = this.#ask, b = a.branch;
    const skipped = b.skips && a.answer === b.skips.on ? b.skips.steps : [];
    skipped.forEach((k) => this.#skip.add(k));
    const decision = Object.freeze({ index: a.index, answer: a.answer, by: a.by, skipped: Object.freeze([...skipped]) });
    this.#decisions.push(decision);
    this.#note = Object.freeze({
      head: `${a.answer === 'yes' ? 'Yes' : 'No'}: ${b.q}`,
      effect: b.skips ? (skipped.length ? `skips ${skipped.map((k) => `step ${k + 1}`).join(', ')}` : 'every step stays') : b[a.answer],
    });
    this.#noteT = NOTE_SHOW;
    this.#ask = null;
    ev.push(Object.freeze({ kind: 'decided', decision }));
  }

  /**
   * @param {number} dt
   * @returns {readonly FlowEvent[]}
   */
  tick(dt) {
    const ev = [];
    if (this.#done) return ev;
    if (this.#note && (this.#noteT -= dt) <= 0) this.#note = null;
    if (this.#pc < 0) this.#enter(0, ev);
    const a = this.#ask;
    if (a) {
      a.t += dt;
      if (a.answer === null && a.t >= ASK_WAIT) {
        const pick = this.#picks.get(String(a.index)) ?? this.#picks.get('*');
        a.answer = pick ?? a.branch.def;
        a.by = pick ? 'pick' : 'default';
      }
      if (a.answer !== null && (a.shown += dt) >= ASK_SHOW) {
        this.#decide(ev);
        this.#enter(this.#pc + 1, ev);
      }
      return ev;
    }
    this.#ot += dt;
    while (!this.#done && !this.#ask && this.#ot >= this.#ops[this.#pc].dur) {
      const left = this.#ot - this.#ops[this.#pc].dur;
      this.#enter(this.#pc + 1, ev);
      if (!this.#ask) this.#ot = left;
    }
    return ev;
  }

  /**
   * @param {Answer} answer
   * @returns {boolean}
   */
  choose(answer) {
    const a = this.#ask;
    if (!a || a.answer !== null || !ANSWERS.has(answer)) return false;
    a.answer = answer;
    a.by = 'user';
    return true;
  }

  /** @returns {number} */
  get inI() { return this.#inI; }

  /** @returns {number} */
  get stepI() { return this.#stepI; }

  /** @returns {Asking | null} */
  get asking() {
    const a = this.#ask;
    return a ? Object.freeze({ branch: a.branch, index: a.index, answer: a.answer }) : null;
  }

  /** @returns {Note | null} */
  get note() { return this.#note; }

  /** @returns {boolean} */
  get done() { return this.#done; }

  /** @returns {number} */
  get progress() {
    if (this.#done) return 1;
    let doneDur = 0, total = 0;
    this.#ops.forEach((op, pc) => {
      if (this.#dead(op)) return;
      total += op.dur;
      if (pc < this.#pc) doneDur += op.dur;
    });
    if (this.#pc >= 0) doneDur += this.#ask ? 0 : this.#ot;
    return total > 0 ? Math.min(0.999, doneDur / total) : 0;
  }

  /**
   * @param {number} k
   * @returns {boolean}
   */
  skipped(k) { return this.#skip.has(k); }

  /** @returns {{n: number, executed: readonly number[], skipped: readonly number[], decisions: readonly Decision[]}} */
  summary() {
    return { n: this.#flow.steps.length, executed: [...this.#seen], skipped: [...this.#skip].sort((a, b) => a - b), decisions: [...this.#decisions] };
  }
}
