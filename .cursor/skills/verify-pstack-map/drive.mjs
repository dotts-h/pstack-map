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
  await page.click('#card .flink');
  await page.waitForFunction(() => document.querySelector('#modal')?.style.display === 'block');
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

  const sessionView = () => {
    const hint = document.getElementById('hint');
    return {
      fast: document.body.classList.contains('fast'),
      running: document.getAnimations().length,
      hint: hint ? { animationName: getComputedStyle(hint).animationName, transitionDuration: getComputedStyle(hint).transitionDuration } : null,
      playButton: Boolean(document.getElementById('pvPlay')),
      lowerThird: document.getElementById('lt')?.style.display === 'block',
      kicker: document.querySelector('#ticket .k')?.textContent || '',
    };
  };
  const orderUpShown = () => (document.querySelector('#lt .ttl')?.textContent || '').includes('Order up');

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

  result.fast = await orderUp(`${base}/?theme=kitchen&hint=0&fast=1&session=playbook:feature`);
  await shot('session-kitchen.png');
  motionOff(result.fast, 'fast session');
  if (!result.fast.done.kicker.includes('ready')) fail('ticket did not reach Order up · ready');

  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.click('#ltExit')]);
  await page.waitForFunction(() => window.__ready === true);
  const exitQuery = new URLSearchParams(await page.evaluate(() => location.search));
  result.exit = { search: exitQuery.toString() };
  if (exitQuery.get('theme') !== 'kitchen' || exitQuery.has('session')) fail(`Exit went to ?${exitQuery}`);

  result.skillFlow = await orderUp(`${base}/?theme=kitchen&hint=0&fast=1&session=skill:architect`);
  await shot('skill-flow-kitchen.png');
  if (result.skillFlow.problems.length) fail(`skill flow: ${result.skillFlow.problems.join('; ')}`);
  if (!result.skillFlow.done.kicker.includes('order up')) fail('skill flow ticket did not reach order up');

  notes.length = 0;
  await page.goto(`${base}/?theme=kitchen&hint=0&fast=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true);
  await page.evaluate(() => { window.__sameDocument = true; });
  const ticketId = 'playbook:feature';
  await page.click(`#rail .tk[data-id="${ticketId}"]`);
  await page.waitForFunction(orderUpShown, { timeout: 30000 });
  const clicked = await page.evaluate(() => ({ sameDocument: window.__sameDocument === true, search: location.search }));
  result.ticketClick = { ticketId, ...clicked, problems: [...notes] };
  if (result.ticketClick.problems.length) fail(`ticket click: ${result.ticketClick.problems.join('; ')}`);
  if (!clicked.sameDocument) fail('a ticket click from the overview reloaded the page');

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  result.reduced = await orderUp(`${base}/?theme=kitchen&hint=0&session=playbook:feature`);
  motionOff(result.reduced, 'reduced motion');
  if (!result.reduced.done.kicker.includes('ready')) fail('reduced motion ticket did not reach Order up · ready');
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
