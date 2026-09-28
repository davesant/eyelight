// Styles. SHADOW_CSS lives inside the component's shadow root, so it can't
// leak into the host page. HIGHLIGHT_CSS is the only thing added to the
// document: ::highlight() rules must be in the document to paint page text.
// It is inserted first in <head> so a host's own ::highlight rules win.

const FORCED = `@media (forced-colors:active){
::highlight(minimarker){background-color:Mark;color:MarkText}
::highlight(minimarker-current){background-color:Highlight;color:HighlightText}}`;

// Flat highlight (highlight: 'solid').
export const HIGHLIGHT_CSS = `
::highlight(minimarker){background-color:var(--minimarker-highlight-bg,#ffe36e);color:var(--minimarker-highlight-fg,#111)}
::highlight(minimarker-current){background-color:var(--minimarker-current-bg,#ff9632);color:var(--minimarker-current-fg,#000)}
${FORCED}
`;
// Marker pen (highlight: 'marker'): matches are painted by the component's own
// overlay, so the document only needs the forced-colours fallback.
export const MARKER_HIGHLIGHT_CSS = FORCED;

const LIGHT = `--minimarker-bg:#fff;--minimarker-fg:#1a1a1a;--minimarker-muted:#575757;--minimarker-border:#8a8a8a;--minimarker-subtle:#e3e3e3;
--minimarker-accent:#0b57d0;--minimarker-accent-fg:#fff;--minimarker-active:#e8effc;--minimarker-mark:#ffe36e;--minimarker-mark-fg:#111;
--minimarker-shadow:0 4px 24px rgba(0,0,0,.18);color-scheme:light;`;
// Marker colours depend on the page behind them, not the component theme:
// multiply on light pages (text stays dark), screen on dark pages (text stays light).
const MARK_LIGHT = '--minimarker-marker:#ff6db7;--minimarker-marker-current:#ffa42e;--minimarker-marker-blend:multiply;';
const MARK_DARK = '--minimarker-marker:#8c0f50;--minimarker-marker-current:#6e3a00;--minimarker-marker-blend:screen;';
const DARK = `--minimarker-bg:#1f2023;--minimarker-fg:#ececec;--minimarker-muted:#b0b0b0;--minimarker-border:#8c9096;--minimarker-subtle:#3a3c40;
--minimarker-accent:#8ab4f8;--minimarker-accent-fg:#0b1a33;--minimarker-active:#2b3a55;--minimarker-mark:#6b5b00;--minimarker-mark-fg:#fff;
--minimarker-shadow:0 4px 24px rgba(0,0,0,.6);color-scheme:dark;`;

export const SHADOW_CSS = `
:host{${LIGHT}${MARK_LIGHT}--minimarker-radius:12px;--minimarker-font:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
--minimarker-width:40rem;--minimarker-gap:16px;--minimarker-z:2147483000;--minimarker-kb:0px;
all:initial;display:contents;font:1rem/1.4 var(--minimarker-font);color:var(--minimarker-fg)}
:host([data-theme=dark]){${DARK}}
@media (prefers-color-scheme:dark){:host([data-theme=auto]){${DARK}}}
:host([data-page=dark]){${MARK_DARK}}
*{box-sizing:border-box}
[hidden]{display:none!important}
.wrap{position:fixed;inset:auto 0 0 0;z-index:var(--minimarker-z);pointer-events:none}
.marks{position:absolute;top:0;left:0;width:1px;height:1px;overflow:visible;pointer-events:none;z-index:calc(var(--minimarker-z) - 1);
mix-blend-mode:var(--minimarker-marker-blend)}
.marks rect{fill:var(--minimarker-marker)}
.marks rect.cur{fill:var(--minimarker-marker-current)}
.hint,.panel{pointer-events:auto;position:absolute;bottom:calc(var(--minimarker-gap) + var(--minimarker-kb));left:50%;transform:translateX(-50%)}
:host([data-position=left]) :is(.hint,.panel){left:var(--minimarker-gap);transform:none}
:host([data-position=right]) :is(.hint,.panel){left:auto;right:var(--minimarker-gap);transform:none}
.hint{display:flex;align-items:center;gap:.35em;min-height:2.25rem;min-width:2.75rem;padding:.35rem .9rem;
border:1px solid var(--minimarker-border);border-radius:999px;background:var(--minimarker-bg);color:var(--minimarker-muted);
font:inherit;font-size:.9375rem;cursor:text;box-shadow:var(--minimarker-shadow);opacity:.92;transition:opacity .2s}
.hint:hover{opacity:1;color:var(--minimarker-fg)}
.hint.obscuring{opacity:0;pointer-events:none}
.caret{display:inline-block;width:2px;height:1.15em;background:var(--minimarker-fg);animation:el-blink 1s step-end 5}
:host([data-caret=block]) .caret{width:.6em}
.field{position:relative;display:flex;flex:1 1 9rem;min-width:0}
.bcaret{position:absolute;top:50%;left:0;height:1.4em;min-width:.6em;margin-top:-.7em;line-height:1.4;white-space:pre;
background:var(--minimarker-fg);color:var(--minimarker-bg);pointer-events:none;animation:el-blink 1s step-end 5}
.meas{position:absolute;visibility:hidden;white-space:pre;font:inherit;font-size:1rem;pointer-events:none}
:host([data-caret=block]) input{caret-color:transparent}
@keyframes el-blink{50%{opacity:0}}
.icon{width:1.25rem;height:1.25rem;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
.touch .hint{width:3.5rem;height:3.5rem;padding:0;justify-content:center;left:auto;right:var(--minimarker-gap);transform:none;color:var(--minimarker-fg);cursor:pointer;opacity:1}
:host([data-position=left]) .touch .hint{left:var(--minimarker-gap);right:auto}
.touch .hint .icon{width:1.5rem;height:1.5rem}
.panel{width:min(var(--minimarker-width),calc(100% - 2 * var(--minimarker-gap)));background:var(--minimarker-bg);color:var(--minimarker-fg);
border:1px solid var(--minimarker-border);border-radius:var(--minimarker-radius);box-shadow:var(--minimarker-shadow);overflow:hidden}
.list{list-style:none;margin:0;padding:.25rem;max-height:min(45vh,24rem);overflow:auto;border-bottom:1px solid var(--minimarker-subtle)}
.opt{display:block;padding:.5rem .75rem;border-radius:8px;cursor:pointer;color:inherit;text-decoration:none}
.opt[aria-selected=true]{background:var(--minimarker-active);outline:2px solid var(--minimarker-accent);outline-offset:-2px}
.opt:hover{background:var(--minimarker-active)}
.t{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.s{display:block;font-size:.8125rem;color:var(--minimarker-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
mark{background:var(--minimarker-mark);color:var(--minimarker-mark-fg);border-radius:2px}
.empty{padding:.5rem .75rem;color:var(--minimarker-muted);font-size:.875rem}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem;padding:.375rem .375rem .375rem .75rem}
.acts{display:flex;align-items:center;gap:.25rem;margin-left:auto;flex-wrap:wrap;justify-content:flex-end}
.prompt{color:var(--minimarker-muted);white-space:nowrap}
input{flex:1 1 auto;width:100%;min-width:0;border:0;background:transparent;color:inherit;font:inherit;font-size:1rem;padding:.4rem .25rem;outline:none}
.row:focus-within{box-shadow:inset 0 -2px 0 var(--minimarker-accent)}
.count{font-size:.875rem;color:var(--minimarker-muted);white-space:nowrap;padding:0 .25rem;font-variant-numeric:tabular-nums}
button{font:inherit;color:inherit}
.btn{display:inline-flex;align-items:center;justify-content:center;min-width:2rem;min-height:2rem;padding:0 .375rem;
border:1px solid transparent;border-radius:8px;background:transparent;cursor:pointer;font-size:.875rem}
.btn:hover{background:var(--minimarker-active)}
.btn[aria-pressed=true]{background:var(--minimarker-active);border-color:var(--minimarker-accent)}
.btn:disabled{opacity:.45;cursor:default}
button:focus-visible,.hint:focus-visible{outline:3px solid var(--minimarker-accent);outline-offset:2px}
.foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.25rem .75rem;padding:.25rem .75rem .375rem;
border-top:1px solid var(--minimarker-subtle);font-size:.8125rem;color:var(--minimarker-muted)}
.foot .btn{font-size:.8125rem;min-height:1.75rem;color:var(--minimarker-muted);text-decoration:underline}
.touch .btn{min-width:44px;min-height:44px}
.touch .foot .btn{min-height:44px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
@media (prefers-reduced-motion:reduce){.caret,.bcaret{animation:none}.hint{transition:none}}
@media print{.hint,.panel,.marks{display:none}}
@media (forced-colors:active){.marks,.bcaret{display:none}:host([data-caret=block]) input{caret-color:auto}}
`;
