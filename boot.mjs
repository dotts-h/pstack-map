import { THEME_IDS } from './theme-meta.mjs';

const themeName = (new URLSearchParams(location.search).get('theme') || '').toLowerCase();
const THEME = themeName === 'sphere' || !THEME_IDS.includes(themeName) ? 'galaxy' : themeName;
if (THEME === 'kitchen') await import('./kitchen.mjs');
else await import('./map.js');
