// Graphics choice for the galaxy. Fast is the default for everyone.
// The old key pstackMap.gfx (high | balanced) is not the heavy path anymore.

const LOOK_KEY = 'pstackMap.look';
const LEGACY_KEY = 'pstackMap.gfx';
const params = new URLSearchParams(location.search);

function readLegacy() {
  try {
    const old = localStorage.getItem(LEGACY_KEY);
    if (old === 'high' || old === 'balanced') return 'fast';
  } catch { /* private mode */ }
  return null;
}

function initialLook() {
  const q = params.get('gfx');
  if (q === 'high') return 'high';
  if (q === 'fast' || q === 'balanced') return 'fast';
  try {
    const saved = localStorage.getItem(LOOK_KEY);
    if (saved === 'high' || saved === 'fast') return saved;
  } catch { /* private mode */ }
  const legacy = readLegacy();
  if (legacy) {
    try { localStorage.setItem(LOOK_KEY, legacy); } catch { /* private mode */ }
    return legacy;
  }
  return 'fast';
}

let LOOK = initialLook();
const listeners = [];

export function getGfx() { return LOOK; }
export function onGfx(fn) { listeners.push(fn); }
export function setGfx(g) {
  if (g !== 'high' && g !== 'fast') return;
  if (g === LOOK) return;
  LOOK = g;
  try { localStorage.setItem(LOOK_KEY, g); } catch { /* private mode */ }
  listeners.forEach((fn) => fn(LOOK));
}
export function targetPixelRatio() {
  const cap = LOOK === 'high' ? 1.25 : 1;
  return Math.min(devicePixelRatio || 1, cap);
}
export function quality() {
  return { high: LOOK === 'high', bloom: LOOK === 'high', dpr: targetPixelRatio() };
}

let frameAcc = 0;
let frameN = 0;
let frameSpan = 0;
let frameLast = 0;
let frameAvg = 0;
let frameLastMs = 0;
export function noteFrame(ms) {
  frameLastMs = ms;
  const now = performance.now();
  if (frameLast) frameSpan += Math.min(80, now - frameLast);
  frameLast = now;
  frameAcc += ms;
  frameN += 1;
  if (frameSpan >= 2000 && frameN >= 8) {
    frameAvg = frameAcc / frameN;
    frameAcc = 0;
    frameN = 0;
    frameSpan = 0;
  }
  return frameStats();
}
export function frameStats() {
  return {
    last: frameLastMs,
    avg: frameAvg || (frameN ? frameAcc / frameN : frameLastMs),
    dpr: targetPixelRatio(),
    gfx: LOOK,
  };
}
