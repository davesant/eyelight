// Script-tag entry point. Reads config from the <script> tag's data-*
// attributes and window.minimarkerConfig, then initialises (NF1).
//
//   <script src="minimarker.min.js" defer data-prompt="search"></script>

import { init, VERSION } from './minimarker.js';

const script = document.currentScript;

function fromDataset(ds) {
  const cfg = {};
  const num = (v) => (v === undefined ? undefined : Number(v));
  const bool = (v) => (v === undefined ? undefined : v !== 'false');
  const strOrFalse = (v) => (v === undefined ? undefined : v === 'false' ? false : v);
  const map = {
    prompt: ds.prompt,
    include: ds.include,
    exclude: ds.exclude,
    noCapture: ds.noCapture,
    index: strOrFalse(ds.index),
    sitemap: strOrFalse(ds.sitemap),
    theme: ds.theme,
    position: ds.position,
    startMode: ds.startMode,
    caret: ds.caret,
    highlight: ds.highlight,
    minChars: num(ds.minChars),
    maxSuggestions: num(ds.maxSuggestions),
    ignoreKeys: ds.ignoreKeys,
    capture: bool(ds.capture),
    hint: bool(ds.hint),
    mobileButton: ds.mobileButton,
  };
  for (const [k, v] of Object.entries(map)) if (v !== undefined) cfg[k] = v;
  return cfg;
}

function start() {
  try {
    const ds = (script && script.dataset) || {};
    if (ds.manual !== undefined) return; // host will call Minimarker.init() itself
    const cfg = { ...(window.minimarkerConfig || {}), ...fromDataset(ds) };
    init(cfg);
  } catch (e) {
    try { console.warn('[minimarker]', e); } catch { /* ignore */ }
  }
}

try {
  // Placeholder so `Minimarker.init()` works in manual mode; replaced by the live API on init.
  if (!window.Minimarker) window.Minimarker = { init, version: VERSION };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
} catch { /* never break the host page */ }
