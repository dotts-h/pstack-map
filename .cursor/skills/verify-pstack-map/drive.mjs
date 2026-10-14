#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from '/tmp/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { oneLiner, plainName } from '../../../copy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const graph = JSON.parse(fs.readFileSync(path.join(root, 'data/graph.json'), 'utf8'));
const architect = graph.nodes.find((n) => n.id === 'architect');
const outDir = '/tmp/verify-pstack-map';
const base = process.env.PSTACK_MAP_URL || 'http://127.0.0.1:8765';
const themes = ['galaxy', 'circuit', 'earth', 'brain', 'kitchen'];
const cardThemes = ['galaxy', 'circuit', 'earth', 'brain'];

fs.mkdirSync(outDir, { recursive: true });

const result = {
  ok: false,
  skillId: 'architect',
  base,
  themes: [],
  kitchen: {},
  fast: {},
  failures: [],
  screenshots: [],
};

function fail(message) {
  result.failures.push(message);
}

function bodySentences(text) {
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const plain = body.replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1');
  return plain
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('-') && !/^\d+\./.test(line))
    .join(' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length > 40);
}

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: 'new',
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.setDefaultTimeout(30000);
const notes = [];
page.on('pageerror', (err) => notes.push(String(err.message || err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') notes.push(msg.text());
});
page.on('response', (res) => {
  if (res.status() >= 400) notes.push(`${res.status()} ${res.url()}`);
});
const fileRequests = [];
page.on('request', (req) => {
  if (req.url().includes('data/files.json')) fileRequests.push(req.url());
});

async function shot(name) {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file });
  result.screenshots.push(file);
}

async function openTheme(theme, extra = '') {
  notes.length = 0;
  const url = `${base}/?hint=0&theme=${theme}${extra}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true);
  return { url, problems: [...notes] };
}

try {
  if (!architect || typeof architect.text !== 'string' || !architect.text) {
    throw new Error('architect node has no text in data/graph.json');
  }
  const expectedTitle = plainName(architect);
  const expectedLine = oneLiner(architect, graph);
  const sentence = bodySentences(architect.text).find((item) => item !== expectedLine && !architect.description.includes(item));
  if (!sentence) throw new Error('no body sentence distinct from the architect description');

  for (const theme of themes) {
    const loaded = await openTheme(theme);
    await shot(`overview-${theme}.png`);
    const row = { theme, url: loaded.url, problems: loaded.problems };
    if (loaded.problems.length) fail(`${theme} overview: ${loaded.problems.join('; ')}`);
    if (theme === 'kitchen') {
      const hintOn = await page.evaluate(() => {
        const hint = document.getElementById('hint');
        if (!hint) return false;
        return getComputedStyle(hint).opacity !== '0' && hint.textContent.trim().length > 0;
      });
      row.hintHidden = !hintOn;
      if (hintOn) fail('kitchen hint is visible with hint=0');
    }
    result.themes.push(row);
  }

  for (const theme of cardThemes) {
    const loaded = await openTheme(theme, '&focus=architect');
    await page.waitForFunction(
      (title) => document.getElementById('popTitle')?.textContent === title,
      {},
      expectedTitle,
    );
    const card = await page.evaluate(() => ({
      title: document.getElementById('popTitle')?.textContent || '',
      what: document.querySelector('#pop .what')?.textContent || '',
    }));
    await shot(`skill-${theme}.png`);
    const row = result.themes.find((item) => item.theme === theme);
    row.card = card;
    row.cardProblems = loaded.problems;
    if (loaded.problems.length) fail(`${theme} card: ${loaded.problems.join('; ')}`);
    if (card.title !== expectedTitle) fail(`${theme} card title ${JSON.stringify(card.title)} is not ${JSON.stringify(expectedTitle)}`);
    if (card.what.trim() !== expectedLine) fail(`${theme} card sentence is not the oneLiner`);
  }

  const kitchen = await openTheme('kitchen', '&open=architect');
  await page.waitForSelector('#card .flink');
  const cardTitle = await page.$eval('#card h3', (el) => el.textContent);
  if (fileRequests.length) fail('data/files.json was requested before the file was opened');
  await page.click('#card .flink');
  await page.waitForFunction(
    (text) => (document.querySelector('#modal .mb')?.innerText || '').includes(text),
    {},
    sentence,
  );
  const modalText = await page.evaluate(() => document.querySelector('#modal .mb')?.innerText || '');
  await shot('skill-kitchen.png');
  result.kitchen = {
    url: kitchen.url,
    cardTitle,
    problems: kitchen.problems,
    sentence,
    sentenceFound: modalText.includes(sentence),
  };
  if (kitchen.problems.length) fail(`kitchen station: ${kitchen.problems.join('; ')}`);
  if (!modalText.includes(sentence)) fail('kitchen modal does not contain a body sentence from architect text');
  if (!fileRequests.length) fail('opening the architect file did not request data/files.json');

  async function fileQuery(label, filePath, needle) {
    const before = fileRequests.length;
    notes.length = 0;
    const url = `${base}/?theme=kitchen&hint=0&file=${encodeURIComponent(filePath)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ready === true);
    await page.waitForFunction(
      (text) => (document.querySelector('#modal .mb')?.innerText || '').includes(text),
      {},
      needle,
    );
    const body = await page.evaluate(() => document.querySelector('#modal .mb')?.innerText || '');
    const row = { url, found: body.includes(needle), requested: fileRequests.length > before, problems: [...notes] };
    if (row.problems.length) fail(`${label}: ${row.problems.join('; ')}`);
    if (!row.found) fail(`${label}: the modal body did not include ${JSON.stringify(needle)}`);
    if (!row.requested) fail(`${label}: did not request data/files.json`);
    return row;
  }

  result.principleFile = await fileQuery(
    'principle-laziness-protocol',
    'pstack/skills/principle-laziness-protocol/SKILL.md',
    'Do not repeat the same choice in several places.',
  );
  result.routerFile = await fileQuery(
    'poteto-mode',
    'pstack/skills/poteto-mode/SKILL.md',
    'Cite only principles whose leaf SKILL.md you read this session.',
  );

  const sessionView = () => {
    const hint = document.getElementById('hint');
    return {
      fast: document.body.classList.contains('fast'),
      running: document.getAnimations().length,
      hint: hint ? { animationName: getComputedStyle(hint).animationName, transitionDuration: getComputedStyle(hint).transitionDuration } : null,
      playButton: Boolean(document.getElementById('pvPlay')),
      lowerThird: document.getElementById('lt')?.style.display === 'block',
      kicker: document.querySelector('#ticket .k')?.textContent || '',
      bubbles: document.querySelectorAll('.qb').length,
      waiter: window.__srv()[1],
    };
  };
  const orderUpShown = () => (document.querySelector('#lt .ttl')?.textContent || '').includes('Order up');

  async function stepUntil(label, test, arg) {
    for (let i = 0; i < 400; i++) {
      if (await page.evaluate(test, arg)) return;
      await page.evaluate(() => window.__step(0.25));
    }
    throw new Error(`${label} not reached after 400 steps of 0.25 s`);
  }

  async function orderUp(url) {
    notes.length = 0;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ready === true);
    const atReady = await page.evaluate(sessionView);
    await page.waitForFunction(orderUpShown, { timeout: 30000 });
    const done = await page.evaluate(sessionView);
    return { url, atReady, done, problems: [...notes] };
  }

  function motionOff(row, label) {
    if (row.problems.length) fail(`${label}: ${row.problems.join('; ')}`);
    if (!row.atReady.fast) fail(`${label}: body is missing class fast`);
    if (row.atReady.running) fail(`${label}: ${row.atReady.running} CSS animations are running`);
    if (row.atReady.hint?.animationName !== 'none') fail(`${label}: #hint animation-name is ${row.atReady.hint?.animationName}`);
    if (row.atReady.hint?.transitionDuration !== '0s') fail(`${label}: #hint transition-duration is ${row.atReady.hint?.transitionDuration}`);
    if (row.atReady.playButton) fail(`${label}: the session still shows a Play button`);
    if (!row.atReady.lowerThird) fail(`${label}: ?session= did not start the session`);
  }

  function noAskNoWaiter(view, label) {
    if (view.bubbles) fail(`${label}: ${view.bubbles} question bubbles at Order up`);
    if (view.waiter !== null) fail(`${label}: the waiter is at serve phase ${view.waiter} at Order up`);
  }

  result.fast = await orderUp(`${base}/?theme=kitchen&hint=0&fast=1&session=playbook:feature`);
  await shot('session-kitchen.png');
  motionOff(result.fast, 'fast session');
  noAskNoWaiter(result.fast.done, 'fast session');
  if (!result.fast.done.kicker.includes('ready')) fail('ticket did not reach Order up · ready');

  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.click('#ltExit')]);
  await page.waitForFunction(() => window.__ready === true);
  const exitQuery = new URLSearchParams(await page.evaluate(() => location.search));
  result.exit = { search: exitQuery.toString() };
  if (exitQuery.get('theme') !== 'kitchen' || exitQuery.has('session')) fail(`Exit went to ?${exitQuery}`);

  result.skillFlow = await orderUp(`${base}/?theme=kitchen&hint=0&fast=1&session=skill:architect`);
  await shot('skill-flow-kitchen.png');
  if (result.skillFlow.problems.length) fail(`skill flow: ${result.skillFlow.problems.join('; ')}`);
  noAskNoWaiter(result.skillFlow.done, 'fast skill flow');
  if (!result.skillFlow.done.kicker.includes('order up')) fail('skill flow ticket did not reach order up');

  notes.length = 0;
  await page.goto(`${base}/?theme=kitchen&hint=0&fast=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true);
  await page.evaluate(() => { window.__sameDocument = true; });
  const ticketId = 'playbook:feature';
  await page.click(`#rail .tk[data-id="${ticketId}"]`);
  await page.waitForFunction(orderUpShown, { timeout: 30000 });
  const clicked = await page.evaluate(() => ({ sameDocument: window.__sameDocument === true, search: location.search }));
  result.ticketClick = { ticketId, ...clicked, done: await page.evaluate(sessionView), problems: [...notes] };
  if (result.ticketClick.problems.length) fail(`ticket click: ${result.ticketClick.problems.join('; ')}`);
  if (!clicked.sameDocument) fail('a ticket click from the overview reloaded the page');
  noAskNoWaiter(result.ticketClick.done, 'ticket click');

  notes.length = 0;
  const branchUrl = `${base}/?theme=kitchen&hint=0&freeze=1&session=skill:how&pick=1:no`;
  await page.goto(branchUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true);
  const question = 'Is the task complex?';
  await stepUntil(`branch: the question "${question}"`, (q) => document.querySelector('.qb .qq')?.textContent === q, question);
  const asked = await page.evaluate(() => ({
    source: document.querySelector('.qb .qs')?.textContent || '',
    skippedBefore: document.querySelectorAll('#ticket li.skip').length,
  }));
  await shot('branch-kitchen.png');
  await stepUntil('branch: the waiter carrying the plate', () => window.__srv()[1] === 'carry');
  await shot('waiter-kitchen.png');
  await stepUntil('branch: served', () => window.__srv()[0] === 'served');
  result.branch = {
    url: branchUrl,
    question,
    ...asked,
    skipped: await page.evaluate(() => [...document.querySelectorAll('#ticket li.skip')].map((li) => li.textContent.replace(li.querySelector('.o')?.textContent || '', '').trim())),
    kicker: await page.evaluate(() => document.querySelector('#ticket .k')?.textContent || ''),
    problems: [...notes],
  };
  if (result.branch.problems.length) fail(`branch: ${result.branch.problems.join('; ')}`);
  if (!/^SKILL\.md:\d+$/.test(asked.source)) fail(`branch: the bubble source is ${JSON.stringify(asked.source)}`);
  if (asked.skippedBefore) fail(`branch: ${asked.skippedBefore} steps were skipped before the answer`);
  const expectSkipped = ['Explore (complex only)', 'Synthesize (complex only)'];
  if (JSON.stringify(result.branch.skipped) !== JSON.stringify(expectSkipped)) fail(`branch: skipped ${JSON.stringify(result.branch.skipped)} after No, expected ${JSON.stringify(expectSkipped)}`);
  if (!result.branch.kicker.includes('served')) fail(`branch: the ticket kicker is ${JSON.stringify(result.branch.kicker)}, not served`);

  notes.length = 0;
  const emptyUrl = `${base}/?theme=kitchen&hint=0&freeze=1&session=playbook:opening-a-pr`;
  await page.goto(emptyUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true);
  const t0 = await page.evaluate(() => window.__T());
  for (let i = 0; i < 8; i++) await page.evaluate(() => window.__step(0.25));
  result.emptyTicket = { url: emptyUrl, t0, ...(await page.evaluate(() => ({ t: window.__T(), srv: window.__srv() }))), problems: [...notes] };
  if (result.emptyTicket.problems.length) fail(`empty ticket: ${result.emptyTicket.problems.join('; ')}`);
  if (!(result.emptyTicket.t > t0)) fail('empty ticket: the clock did not advance under __step');
  if (result.emptyTicket.srv[0] !== 'served' || result.emptyTicket.srv[1] !== null) fail(`empty ticket: ended at ${JSON.stringify(result.emptyTicket.srv)}, expected served with no waiter`);
  if (await page.evaluate(() => document.querySelector('.orderup'))) fail('empty ticket: the pass still says Order up');

  notes.length = 0;
  await page.goto(`${base}/?theme=kitchen&hint=0&freeze=1&session=skill:how`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true);
  await stepUntil('fast during carry', () => window.__srv()[1] === 'carry');
  await page.click('#pace [data-pace=fast]');
  for (let i = 0; i < 8; i++) await page.evaluate(() => window.__step(0.25));
  result.fastDuringCarry = { ...(await page.evaluate(() => ({ srv: window.__srv(), fast: document.body.classList.contains('fast'), t: window.__T() }))), problems: [...notes] };
  if (result.fastDuringCarry.problems.length) fail(`fast during carry: ${result.fastDuringCarry.problems.join('; ')}`);
  if (!result.fastDuringCarry.fast) fail('fast during carry: body is missing class fast');
  if (result.fastDuringCarry.srv[0] !== 'served' || result.fastDuringCarry.srv[1] !== null) fail(`fast during carry: ended at ${JSON.stringify(result.fastDuringCarry.srv)}`);

  notes.length = 0;
  await page.goto(`${base}/?theme=kitchen&hint=0&session=playbook:feature`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true);
  await page.evaluate(() => { window.__paceDoc = true; });
  const paceQuery = () => page.evaluate(() => ({
    sameDocument: window.__paceDoc === true,
    fast: new URLSearchParams(location.search).get('fast'),
    bodyFast: document.body.classList.contains('fast'),
  }));
  await page.click('#pace [data-pace=fast]');
  const pacedFast = await paceQuery();
  await page.click('#pace [data-pace=cozy]');
  const pacedCozy = await paceQuery();
  await page.click('#pace [data-pace=fast]');
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.click('#ltExit')]);
  await page.waitForFunction(() => window.__ready === true);
  const paceExit = await page.evaluate(() => ({
    search: location.search,
    bodyFast: document.body.classList.contains('fast'),
  }));
  const paceExitQuery = new URLSearchParams(paceExit.search);
  result.pace = { fast: pacedFast, cozy: pacedCozy, exit: paceExit.search, exitFast: paceExit.bodyFast, problems: [...notes] };
  if (result.pace.problems.length) fail(`pace: ${result.pace.problems.join('; ')}`);
  if (!pacedFast.sameDocument || pacedFast.fast !== '1' || !pacedFast.bodyFast) fail(`Fast did not set fast=1 and class fast in the same document (${JSON.stringify(pacedFast)})`);
  if (!pacedCozy.sameDocument || pacedCozy.fast !== null || pacedCozy.bodyFast) fail(`Cozy did not remove fast and class fast in the same document (${JSON.stringify(pacedCozy)})`);
  if (paceExitQuery.get('theme') !== 'kitchen' || paceExitQuery.get('fast') !== '1' || paceExitQuery.has('session') || !paceExit.bodyFast) fail(`pace Exit went to ?${paceExitQuery} bodyFast=${paceExit.bodyFast}`);

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  result.reduced = await orderUp(`${base}/?theme=kitchen&hint=0&session=playbook:feature`);
  motionOff(result.reduced, 'reduced motion');
  noAskNoWaiter(result.reduced.done, 'reduced motion');
  if (!result.reduced.done.kicker.includes('ready')) fail('reduced motion ticket did not reach Order up · ready');
  const reducedQuery = new URLSearchParams(await page.evaluate(() => location.search));
  if (reducedQuery.has('fast')) fail(`reduced motion wrote fast=${reducedQuery.get('fast')}`);
  await page.click('#pace [data-pace=cozy]');
  const reducedCozy = await page.evaluate(() => ({
    fast: new URLSearchParams(location.search).get('fast'),
    bodyFast: document.body.classList.contains('fast'),
  }));
  result.reducedCozy = reducedCozy;
  if (reducedCozy.fast !== null || !reducedCozy.bodyFast) fail(`Cozy under reduced motion changed pace (${JSON.stringify(reducedCozy)})`);
} catch (err) {
  fail(err.message || String(err));
} finally {
  result.ok = result.failures.length === 0;
  fs.writeFileSync(path.join(outDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  await browser.close();
}

if (!result.ok) {
  console.error(result.failures.join('\n'));
  process.exit(1);
}
console.log(`ok ${path.join(outDir, 'result.json')}`);
