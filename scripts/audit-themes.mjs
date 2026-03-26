#!/usr/bin/env node
/**
 * Theme Contrast & Vibrancy Audit
 * Parses CSS custom properties from theme files, computes WCAG contrast ratios,
 * and outputs a comprehensive report.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Color utilities ──────────────────────────────────────────────────────────

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function rgbaToRgb(str, bgHex = '#ffffff') {
  // Parse rgba(r, g, b, a) — composite onto bg
  const m = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  const r = parseFloat(m[1]), g = parseFloat(m[2]), b = parseFloat(m[3]);
  const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
  if (a >= 1) return { r, g, b };
  const bg = hexToRgb(bgHex);
  return {
    r: Math.round(r * a + bg.r * (1 - a)),
    g: Math.round(g * a + bg.g * (1 - a)),
    b: Math.round(b * a + bg.b * (1 - a)),
  };
}

function parseColor(val, bgHex = '#ffffff') {
  if (!val) return null;
  val = val.trim();
  if (val.startsWith('#')) return hexToRgb(val);
  if (val.startsWith('rgb')) return rgbaToRgb(val, bgHex);
  return null;
}

function relativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(c1, c2) {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function saturation({ r, g, b }) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === 0) return 0;
  const l = (max + min) / 2;
  if (max === min) return 0;
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

// ── CSS Parser ───────────────────────────────────────────────────────────────

function extractThemeTokens(css) {
  const themes = {};

  // Extract :root tokens
  const rootMatch = css.match(/:root\s*\{([^}]+)\}/);
  if (rootMatch) {
    themes['warm-earth'] = parseBlock(rootMatch[1]);
  }

  // Extract html.dark tokens
  const darkMatch = css.match(/html\.dark\s*\{([^}]+)\}/);
  if (darkMatch) {
    themes['warm-earth-dark'] = parseBlock(darkMatch[1]);
  }

  return themes;
}

function extractPaletteTokens(css) {
  const themes = {};

  // Light themes: html[data-theme="xxx"]
  const lightRe = /html\[data-theme="([^"]+)"\]\s*\{([^}]+)\}/g;
  let m;
  while ((m = lightRe.exec(css)) !== null) {
    themes[m[1]] = parseBlock(m[2]);
  }

  // Dark themes: html.dark[data-dark-theme="xxx"]
  const darkRe = /html\.dark\[data-dark-theme="([^"]+)"\]\s*\{([^}]+)\}/g;
  while ((m = darkRe.exec(css)) !== null) {
    themes[m[1]] = parseBlock(m[2]);
  }

  return themes;
}

function parseBlock(block) {
  const tokens = {};
  const re = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    tokens[m[1]] = m[2].trim();
  }
  return tokens;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const stylesCss = readFileSync(resolve(ROOT, 'frontend/src/styles.css'), 'utf8');
const palettesCss = readFileSync(resolve(ROOT, 'frontend/src/theme-palettes.css'), 'utf8');

const baseTokens = extractThemeTokens(stylesCss);
const paletteTokens = extractPaletteTokens(palettesCss);

// Merge: palette overrides base
const allThemes = {};

// Warm Earth (light) = :root defaults
allThemes['warm-earth'] = { ...baseTokens['warm-earth'], _isDark: false };

// Warm Earth Dark = html.dark defaults
allThemes['warm-earth-dark'] = { ...(baseTokens['warm-earth'] || {}), ...(baseTokens['warm-earth-dark'] || {}), _isDark: true };

// Light themes from palettes
const lightThemes = ['white-heaven', 'sea-foam', 'storm-cloud', 'morning-sky', 'misty-forest', 'modern-dental', 'cosmic', 'mindful', 'purple-scale', 'pastel-rose', 'french-blues', 'sunset-website'];
for (const name of lightThemes) {
  if (paletteTokens[name]) {
    allThemes[name] = { ...baseTokens['warm-earth'], ...paletteTokens[name], _isDark: false };
  }
}

// Dark themes from palettes
const darkThemes = ['purple-night', 'cherry-blossom', 'sunset-dusk', 'purple-haze', 'ocean-deep', 'luna', 'coffee', 'moon', 'wine', 'gold-crimson', 'pink-gray', 'yellow-dark', 'forest-night', 'bloodstone', 'red-noir'];
for (const name of darkThemes) {
  if (paletteTokens[name]) {
    allThemes[name] = { ...(baseTokens['warm-earth'] || {}), ...(baseTokens['warm-earth-dark'] || {}), ...paletteTokens[name], _isDark: true };
  }
}

// ── Audit ────────────────────────────────────────────────────────────────────

const pairings = [
  { fg: 'primary', bg: 'background', min: 3, label: 'primary / bg (UI)' },
  { fg: 'primary', bg: 'card', min: 3, label: 'primary / card (UI)' },
  { fg: 'primary-foreground', bg: 'primary', min: 4.5, label: 'btn text / primary' },
  { fg: 'foreground', bg: 'background', min: 4.5, label: 'text / bg' },
  { fg: 'foreground', bg: 'card', min: 4.5, label: 'text / card' },
  { fg: 'muted-foreground', bg: 'background', min: 4.5, label: 'muted / bg' },
  { fg: 'muted-foreground', bg: 'card', min: 4.5, label: 'muted / card' },
  { fg: 'sidebar-text-primary', bg: 'sidebar-bg', min: 4.5, label: 'sidebar txt / bg' },
  { fg: 'sidebar-text-muted', bg: 'sidebar-bg', min: 3, label: 'sidebar muted / bg' },
  { fg: 'destructive', bg: 'background', min: 3, label: 'destructive / bg' },
  { fg: 'success', bg: 'background', min: 3, label: 'success / bg' },
];

// Priority hex colors (hardcoded in task-colors.ts)
const priorityColors = {
  'urgent-light': '#C62828',
  'high-light': '#9A6A08',
  'medium-light': '#2D5BE3',
  'low-light': '#0C8A6B',
  'urgent-dark': '#F4707F',
  'high-dark': '#F5C060',
  'medium-dark': '#5B82F0',
  'low-dark': '#3DC9A5',
};

console.log('# Theme Audit Report\n');
console.log(`Generated: ${new Date().toISOString()}\n`);

// ── Contrast table ───────────────────────────────────────────────────────────

console.log('## WCAG Contrast Results\n');

const results = [];
let totalFails = 0;

for (const [themeName, tokens] of Object.entries(allThemes)) {
  const isDark = tokens._isDark;
  const themeResults = { name: themeName, isDark, fails: [], passes: 0, total: 0 };

  for (const p of pairings) {
    const fgVal = tokens[p.fg];
    const bgVal = tokens[p.bg];
    if (!fgVal || !bgVal) continue;

    const bgColor = parseColor(bgVal);
    if (!bgColor) continue;

    // For rgba fg values, composite onto bg
    const bgHex = bgVal.startsWith('#') ? bgVal : '#' + [bgColor.r, bgColor.g, bgColor.b].map(c => c.toString(16).padStart(2, '0')).join('');
    const fgColor = parseColor(fgVal, bgHex);
    if (!fgColor) continue;

    const ratio = contrastRatio(fgColor, bgColor);
    themeResults.total++;

    if (ratio < p.min) {
      themeResults.fails.push({ ...p, ratio: ratio.toFixed(2), fgHex: fgVal, bgHex: bgVal });
      totalFails++;
    } else {
      themeResults.passes++;
    }
  }

  results.push(themeResults);
}

// Summary table
console.log('| Theme | Type | Pass | Fail | Issues |');
console.log('|-------|------|------|------|--------|');
for (const r of results) {
  const failCount = r.fails.length;
  const status = failCount === 0 ? 'ALL PASS' : r.fails.map(f => `${f.label} (${f.ratio}:1 < ${f.min}:1)`).join('; ');
  const icon = failCount === 0 ? 'PASS' : `**${failCount} FAIL**`;
  console.log(`| ${r.name} | ${r.isDark ? 'dark' : 'light'} | ${r.passes} | ${icon} | ${failCount === 0 ? '-' : status} |`);
}

console.log(`\n**Total failures: ${totalFails}**\n`);

// ── Detailed failures ────────────────────────────────────────────────────────

const failingThemes = results.filter(r => r.fails.length > 0);
if (failingThemes.length > 0) {
  console.log('## Detailed Failures\n');
  for (const r of failingThemes) {
    console.log(`### ${r.name} (${r.isDark ? 'dark' : 'light'})\n`);
    console.log('| Pairing | FG | BG | Ratio | Required | Gap |');
    console.log('|---------|----|----|-------|----------|-----|');
    for (const f of r.fails) {
      const gap = (f.min - parseFloat(f.ratio)).toFixed(2);
      console.log(`| ${f.label} | \`${f.fgHex}\` | \`${f.bgHex}\` | ${f.ratio}:1 | ${f.min}:1 | -${gap} |`);
    }
    console.log('');
  }
}

// ── Priority color cross-check ───────────────────────────────────────────────

console.log('## Priority Color Contrast (hardcoded colors vs theme backgrounds)\n');
console.log('| Theme | Card BG | urgent | high | medium | low |');
console.log('|-------|---------|--------|------|--------|-----|');

for (const [themeName, tokens] of Object.entries(allThemes)) {
  const isDark = tokens._isDark;
  const cardVal = tokens['card'];
  const cardColor = parseColor(cardVal);
  if (!cardColor) continue;

  const suffix = isDark ? 'dark' : 'light';
  const cols = ['urgent', 'high', 'medium', 'low'].map(level => {
    const pColor = parseColor(priorityColors[`${level}-${suffix}`]);
    if (!pColor) return '?';
    const ratio = contrastRatio(pColor, cardColor);
    return ratio < 3 ? `**${ratio.toFixed(1)}** FAIL` : `${ratio.toFixed(1)}`;
  });

  console.log(`| ${themeName} | \`${cardVal}\` | ${cols.join(' | ')} |`);
}

// ── Vibrancy scores ──────────────────────────────────────────────────────────

console.log('\n## Vibrancy Scores\n');
console.log('| Theme | Type | Primary | Primary Sat | BG Sat | Score | Notes |');
console.log('|-------|------|---------|-------------|--------|-------|-------|');

for (const [themeName, tokens] of Object.entries(allThemes)) {
  const primaryColor = parseColor(tokens['primary']);
  const bgColor = parseColor(tokens['background']);
  if (!primaryColor || !bgColor) continue;

  const pSat = saturation(primaryColor);
  const bSat = saturation(bgColor);

  // Vibrancy heuristic
  let score = 3;
  let notes = '';

  if (pSat < 0.08) {
    score = 1;
    notes = 'Achromatic primary';
  } else if (pSat < 0.2) {
    score = 2;
    notes = 'Desaturated primary';
  } else if (pSat >= 0.5) {
    score = 5;
    notes = 'Highly vibrant';
  } else if (pSat >= 0.35) {
    score = 4;
    notes = 'Good saturation';
  } else {
    score = 3;
    notes = 'Moderate';
  }

  // Check if primary is too dark to see on dark bg
  if (tokens._isDark) {
    const ratio = contrastRatio(primaryColor, bgColor);
    if (ratio < 2) {
      score = Math.min(score, 1);
      notes += ' | PRIMARY INVISIBLE (ratio ' + ratio.toFixed(1) + ')';
    }
  }

  console.log(`| ${themeName} | ${tokens._isDark ? 'dark' : 'light'} | \`${tokens['primary']}\` | ${(pSat * 100).toFixed(0)}% | ${(bSat * 100).toFixed(0)}% | **${score}/5** | ${notes} |`);
}

// ── Fix recommendations ──────────────────────────────────────────────────────

console.log('\n## Fix Recommendations\n');

for (const r of failingThemes) {
  console.log(`### ${r.name}\n`);
  for (const f of r.fails) {
    const bgColor = parseColor(f.bgHex);
    if (!bgColor) continue;

    // Simple suggestion: note what needs to change
    const bgLum = relativeLuminance(bgColor);
    const needsDarker = bgLum > 0.5;

    console.log(`- **${f.label}**: \`${f.fgHex}\` on \`${f.bgHex}\` = ${f.ratio}:1 (need ${f.min}:1). ${needsDarker ? 'Darken' : 'Lighten'} the foreground color.`);
  }
  console.log('');
}
