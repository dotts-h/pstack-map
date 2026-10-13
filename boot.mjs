import { THEME_IDS } from './theme-meta.mjs';

const themeName = (new URLSearchParams(location.search).get('theme') || '').toLowerCase();
const THEME = themeName === 'sphere' || !THEME_IDS.includes(themeName) ? 'galaxy' : themeName;
try {
  if (THEME === 'kitchen') await import('./kitchen.mjs');
  else await import('./map.js');
} catch {
  document.getElementById('boot')?.remove();
  const err = document.getElementById('err');
  if (err) {
    const reason = document.getElementById('errReason');
    if (reason) reason.textContent = 'The map failed to start.';
    err.hidden = false;
  }
}
