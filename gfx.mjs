// Cinematic is the default. Fast is the lighter toggle.
// pstackMap.picture is the saved choice. Older keys are not reused, so a
// previous automatic Fast write does not override this default.

const PICTURE_KEY = 'pstackMap.picture';
const params = new URLSearchParams(location.search);

const LADDER = [
  { still: 0.75, move: 0.5, stepsStill: 128, stepsMove: 80, bloom: true, dprIdle: 2, dprMove: 1.25 },
  { still: 0.6, move: 0.45, stepsStill: 96, stepsMove: 64, bloom: true, dprIdle: 1.5, dprMove: 1 },
  { still: 0.5, move: 0.4, stepsStill: 64, stepsMove: 48, bloom: false, dprIdle: 1.25, dprMove: 1 },
];

function initialLook() {
  const q = params.get('gfx');
  if (q === 'fast' || q === 'balanced') return 'fast';
  if (q === 'cinematic' || q === 'high') return 'cinematic';
  try {
    const saved = localStorage.getItem(PICTURE_KEY);
    if (saved === 'fast' || saved === 'cinematic') return saved;
  } catch { /* private mode */ }
  return 'cinematic';
}

let LOOK = initialLook();
let moving = false;
let level = 0;
let hinted = false;
const listeners = [];
const floorFns = [];

export function getGfx() { return LOOK; }
export function onGfx(fn) { listeners.push(fn); }
export function onFloor(fn) { floorFns.push(fn); }
export function setGfx(g) {
  if (g !== 'cinematic' && g !== 'fast') return;
  if (g === LOOK) return;
  LOOK = g;
  try { localStorage.setItem(PICTURE_KEY, g); } catch { /* private mode */ }
  listeners.forEach((fn) => fn(LOOK));
}
export function setViewMoving(v) {
  const next = !!v;
  if (next === moving) return false;
  moving = next;
  return LOOK === 'cinematic';
}
export function targetPixelRatio() {
  if (LOOK !== 'cinematic') return Math.min(devicePixelRatio || 1, 1);
  const step = LADDER[level];
  const cap = moving ? step.dprMove : step.dprIdle;
  return Math.min(devicePixelRatio || 1, cap);
}
export function quality() {
  const cinematic = LOOK === 'cinematic';
  const step = LADDER[level];
  return {
    cinematic,
    bloom: cinematic && step.bloom,
    dpr: targetPixelRatio(),
    bhScale: cinematic ? (moving ? step.move : step.still) : 0,
    bhSteps: cinematic ? (moving ? step.stepsMove : step.stepsStill) : 0,
    adapt: level,
    floor: level >= LADDER.length - 1,
  };
}

let frameAcc = 0;
let frameN = 0;
let frameSpan = 0;
let frameLast = 0;
let frameAvg = 0;
let frameLastMs = 0;
let watched = 0;
export function noteFrame(ms) {
  frameLastMs = ms;
  const now = performance.now();
  if (!watched) watched = now;
  if (frameLast) frameSpan += Math.min(80, now - frameLast);
  frameLast = now;
  frameAcc += ms;
  frameN += 1;
  if (LOOK === 'cinematic' && now - watched > 8000 && frameSpan >= 4000 && frameN >= 12) {
    frameAvg = frameAcc / frameN;
    frameAcc = 0;
    frameN = 0;
    frameSpan = 0;
    if (frameAvg > 85 && level < LADDER.length - 1) {
      level += 1;
      listeners.forEach((fn) => fn(LOOK));
    } else if (frameAvg > 85 && level >= LADDER.length - 1 && !hinted) {
      hinted = true;
      floorFns.forEach((fn) => fn());
    }
  }
  return frameStats();
}
export function frameStats() {
  return {
    last: frameLastMs,
    avg: frameAvg || (frameN ? frameAcc / frameN : frameLastMs),
    dpr: targetPixelRatio(),
    gfx: LOOK,
    adapt: level,
  };
}
