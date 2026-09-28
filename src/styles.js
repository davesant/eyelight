// Styles. SHADOW_CSS lives inside the component's shadow root, so it can't
// leak into the host page. HIGHLIGHT_CSS is the only thing added to the
// document: ::highlight() rules must be in the document to paint page text.
// It is inserted first in <head> so a host's own ::highlight rules win.

export const HIGHLIGHT_CSS = `
::highlight(minisearch){background-color:var(--minisearch-highlight-bg,#ffe36e);color:var(--minisearch-highlight-fg,#111)}
::highlight(minisearch-current){background-color:var(--minisearch-current-bg,#ff9632);color:var(--minisearch-current-fg,#000)}
@media (forced-colors:active){
::highlight(minisearch){background-color:Mark;color:MarkText}
::highlight(minisearch-current){background-color:Highlight;color:HighlightText}}
`;

const LIGHT = `--ms-bg:#fff;--ms-fg:#1a1a1a;--ms-muted:#575757;--ms-border:#8a8a8a;--ms-subtle:#e3e3e3;
--ms-accent:#0b57d0;--ms-accent-fg:#fff;--ms-active:#e8effc;--ms-mark:#ffe36e;--ms-mark-fg:#111;
--ms-shadow:0 4px 24px rgba(0,0,0,.18);color-scheme:light;`;
const DARK = `--ms-bg:#1f2023;--ms-fg:#ececec;--ms-muted:#b0b0b0;--ms-border:#8c9096;--ms-subtle:#3a3c40;
--ms-accent:#8ab4f8;--ms-accent-fg:#0b1a33;--ms-active:#2b3a55;--ms-mark:#6b5b00;--ms-mark-fg:#fff;
--ms-shadow:0 4px 24px rgba(0,0,0,.6);color-scheme:dark;`;

export const SHADOW_CSS = `
:host{${LIGHT}--ms-radius:12px;--ms-font:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
--ms-width:40rem;--ms-gap:16px;--ms-z:2147483000;--ms-kb:0px;
all:initial;position:fixed;inset:auto 0 0 0;z-index:var(--ms-z);pointer-events:none;
font:1rem/1.4 var(--ms-font);color:var(--ms-fg)}
:host([data-theme=dark]){${DARK}}
@media (prefers-color-scheme:dark){:host([data-theme=auto]){${DARK}}}
*{box-sizing:border-box}
[hidden]{display:none!important}
.hint,.panel{pointer-events:auto;position:absolute;bottom:calc(var(--ms-gap) + var(--ms-kb));left:50%;transform:translateX(-50%)}
:host([data-position=left]) .hint{left:var(--ms-gap);transform:none}
:host([data-position=right]) .hint{left:auto;right:var(--ms-gap);transform:none}
.hint{display:flex;align-items:center;gap:.35em;min-height:2.25rem;min-width:2.75rem;padding:.35rem .9rem;
border:1px solid var(--ms-border);border-radius:999px;background:var(--ms-bg);color:var(--ms-muted);
font:inherit;font-size:.9375rem;cursor:text;box-shadow:var(--ms-shadow);opacity:.92;transition:opacity .2s}
.hint:hover{opacity:1;color:var(--ms-fg)}
.hint.obscuring{opacity:0;pointer-events:none}
.caret{display:inline-block;width:2px;height:1.15em;background:var(--ms-fg);animation:ms-blink 1s step-end 5}
@keyframes ms-blink{50%{opacity:0}}
.icon{width:1.25rem;height:1.25rem;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
.touch .hint{width:3.5rem;height:3.5rem;padding:0;justify-content:center;left:auto;right:var(--ms-gap);transform:none;color:var(--ms-fg);cursor:pointer;opacity:1}
.touch .hint .icon{width:1.5rem;height:1.5rem}
.panel{width:min(var(--ms-width),calc(100% - 2 * var(--ms-gap)));background:var(--ms-bg);color:var(--ms-fg);
border:1px solid var(--ms-border);border-radius:var(--ms-radius);box-shadow:var(--ms-shadow);overflow:hidden}
.list{list-style:none;margin:0;padding:.25rem;max-height:min(45vh,24rem);overflow:auto;border-bottom:1px solid var(--ms-subtle)}
.opt{display:block;padding:.5rem .75rem;border-radius:8px;cursor:pointer;color:inherit;text-decoration:none}
.opt[aria-selected=true]{background:var(--ms-active);outline:2px solid var(--ms-accent);outline-offset:-2px}
.opt:hover{background:var(--ms-active)}
.t{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.s{display:block;font-size:.8125rem;color:var(--ms-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
mark{background:var(--ms-mark);color:var(--ms-mark-fg);border-radius:2px}
.empty{padding:.5rem .75rem;color:var(--ms-muted);font-size:.875rem}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem;padding:.375rem .375rem .375rem .75rem}
.acts{display:flex;align-items:center;gap:.25rem;margin-left:auto;flex-wrap:wrap;justify-content:flex-end}
.prompt{color:var(--ms-muted);white-space:nowrap}
input{flex:1 1 9rem;min-width:0;border:0;background:transparent;color:inherit;font:inherit;font-size:1rem;padding:.4rem .25rem;outline:none}
.row:focus-within{box-shadow:inset 0 -2px 0 var(--ms-accent)}
.count{font-size:.875rem;color:var(--ms-muted);white-space:nowrap;padding:0 .25rem;font-variant-numeric:tabular-nums}
button{font:inherit;color:inherit}
.btn{display:inline-flex;align-items:center;justify-content:center;min-width:2rem;min-height:2rem;padding:0 .375rem;
border:1px solid transparent;border-radius:8px;background:transparent;cursor:pointer;font-size:.875rem}
.btn:hover{background:var(--ms-active)}
.btn[aria-pressed=true]{background:var(--ms-active);border-color:var(--ms-accent)}
.btn:disabled{opacity:.45;cursor:default}
button:focus-visible,.hint:focus-visible{outline:3px solid var(--ms-accent);outline-offset:2px}
.foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.25rem .75rem;padding:.25rem .75rem .375rem;
border-top:1px solid var(--ms-subtle);font-size:.8125rem;color:var(--ms-muted)}
.foot .btn{font-size:.8125rem;min-height:1.75rem;color:var(--ms-muted);text-decoration:underline}
.touch .btn{min-width:44px;min-height:44px}
.touch .foot .btn{min-height:44px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
@media (prefers-reduced-motion:reduce){.caret{animation:none}.hint{transition:none}}
@media print{.hint,.panel{display:none}}
`;
