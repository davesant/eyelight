// Styles. SHADOW_CSS lives inside the component's shadow root, so it can't
// leak into the host page. HIGHLIGHT_CSS is the only thing added to the
// document: ::highlight() rules must be in the document to paint page text.
// It is inserted first in <head> so a host's own ::highlight rules win.

export const HIGHLIGHT_CSS = `
::highlight(eyelight){background-color:var(--eyelight-highlight-bg,#ffe36e);color:var(--eyelight-highlight-fg,#111)}
::highlight(eyelight-current){background-color:var(--eyelight-current-bg,#ff9632);color:var(--eyelight-current-fg,#000)}
@media (forced-colors:active){
::highlight(eyelight){background-color:Mark;color:MarkText}
::highlight(eyelight-current){background-color:Highlight;color:HighlightText}}
`;

const LIGHT = `--eyelight-bg:#fff;--eyelight-fg:#1a1a1a;--eyelight-muted:#575757;--eyelight-border:#8a8a8a;--eyelight-subtle:#e3e3e3;
--eyelight-accent:#0b57d0;--eyelight-accent-fg:#fff;--eyelight-active:#e8effc;--eyelight-mark:#ffe36e;--eyelight-mark-fg:#111;
--eyelight-shadow:0 4px 24px rgba(0,0,0,.18);color-scheme:light;`;
const DARK = `--eyelight-bg:#1f2023;--eyelight-fg:#ececec;--eyelight-muted:#b0b0b0;--eyelight-border:#8c9096;--eyelight-subtle:#3a3c40;
--eyelight-accent:#8ab4f8;--eyelight-accent-fg:#0b1a33;--eyelight-active:#2b3a55;--eyelight-mark:#6b5b00;--eyelight-mark-fg:#fff;
--eyelight-shadow:0 4px 24px rgba(0,0,0,.6);color-scheme:dark;`;

export const SHADOW_CSS = `
:host{${LIGHT}--eyelight-radius:12px;--eyelight-font:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
--eyelight-width:40rem;--eyelight-gap:16px;--eyelight-z:2147483000;--eyelight-kb:0px;
all:initial;position:fixed;inset:auto 0 0 0;z-index:var(--eyelight-z);pointer-events:none;
font:1rem/1.4 var(--eyelight-font);color:var(--eyelight-fg)}
:host([data-theme=dark]){${DARK}}
@media (prefers-color-scheme:dark){:host([data-theme=auto]){${DARK}}}
*{box-sizing:border-box}
[hidden]{display:none!important}
.hint,.panel{pointer-events:auto;position:absolute;bottom:calc(var(--eyelight-gap) + var(--eyelight-kb));left:50%;transform:translateX(-50%)}
:host([data-position=left]) .hint{left:var(--eyelight-gap);transform:none}
:host([data-position=right]) .hint{left:auto;right:var(--eyelight-gap);transform:none}
.hint{display:flex;align-items:center;gap:.35em;min-height:2.25rem;min-width:2.75rem;padding:.35rem .9rem;
border:1px solid var(--eyelight-border);border-radius:999px;background:var(--eyelight-bg);color:var(--eyelight-muted);
font:inherit;font-size:.9375rem;cursor:text;box-shadow:var(--eyelight-shadow);opacity:.92;transition:opacity .2s}
.hint:hover{opacity:1;color:var(--eyelight-fg)}
.hint.obscuring{opacity:0;pointer-events:none}
.caret{display:inline-block;width:2px;height:1.15em;background:var(--eyelight-fg);animation:el-blink 1s step-end 5}
@keyframes el-blink{50%{opacity:0}}
.icon{width:1.25rem;height:1.25rem;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
.touch .hint{width:3.5rem;height:3.5rem;padding:0;justify-content:center;left:auto;right:var(--eyelight-gap);transform:none;color:var(--eyelight-fg);cursor:pointer;opacity:1}
.touch .hint .icon{width:1.5rem;height:1.5rem}
.panel{width:min(var(--eyelight-width),calc(100% - 2 * var(--eyelight-gap)));background:var(--eyelight-bg);color:var(--eyelight-fg);
border:1px solid var(--eyelight-border);border-radius:var(--eyelight-radius);box-shadow:var(--eyelight-shadow);overflow:hidden}
.list{list-style:none;margin:0;padding:.25rem;max-height:min(45vh,24rem);overflow:auto;border-bottom:1px solid var(--eyelight-subtle)}
.opt{display:block;padding:.5rem .75rem;border-radius:8px;cursor:pointer;color:inherit;text-decoration:none}
.opt[aria-selected=true]{background:var(--eyelight-active);outline:2px solid var(--eyelight-accent);outline-offset:-2px}
.opt:hover{background:var(--eyelight-active)}
.t{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.s{display:block;font-size:.8125rem;color:var(--eyelight-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
mark{background:var(--eyelight-mark);color:var(--eyelight-mark-fg);border-radius:2px}
.empty{padding:.5rem .75rem;color:var(--eyelight-muted);font-size:.875rem}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem;padding:.375rem .375rem .375rem .75rem}
.acts{display:flex;align-items:center;gap:.25rem;margin-left:auto;flex-wrap:wrap;justify-content:flex-end}
.prompt{color:var(--eyelight-muted);white-space:nowrap}
input{flex:1 1 9rem;min-width:0;border:0;background:transparent;color:inherit;font:inherit;font-size:1rem;padding:.4rem .25rem;outline:none}
.row:focus-within{box-shadow:inset 0 -2px 0 var(--eyelight-accent)}
.count{font-size:.875rem;color:var(--eyelight-muted);white-space:nowrap;padding:0 .25rem;font-variant-numeric:tabular-nums}
button{font:inherit;color:inherit}
.btn{display:inline-flex;align-items:center;justify-content:center;min-width:2rem;min-height:2rem;padding:0 .375rem;
border:1px solid transparent;border-radius:8px;background:transparent;cursor:pointer;font-size:.875rem}
.btn:hover{background:var(--eyelight-active)}
.btn[aria-pressed=true]{background:var(--eyelight-active);border-color:var(--eyelight-accent)}
.btn:disabled{opacity:.45;cursor:default}
button:focus-visible,.hint:focus-visible{outline:3px solid var(--eyelight-accent);outline-offset:2px}
.foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.25rem .75rem;padding:.25rem .75rem .375rem;
border-top:1px solid var(--eyelight-subtle);font-size:.8125rem;color:var(--eyelight-muted)}
.foot .btn{font-size:.8125rem;min-height:1.75rem;color:var(--eyelight-muted);text-decoration:underline}
.touch .btn{min-width:44px;min-height:44px}
.touch .foot .btn{min-height:44px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
@media (prefers-reduced-motion:reduce){.caret{animation:none}.hint{transition:none}}
@media print{.hint,.panel{display:none}}
`;
