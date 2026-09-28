// Text folding shared by in-page search and suggestions.
// Folding = lower-case + strip accents, so "Café" matches "cafe".

const MARKS = /\p{M}/gu;
const WS = /\s/;
const cache = new Map();

/** Fold one character (code point). May return '' or more than one char. */
export function foldChar(ch) {
  const c = ch.charCodeAt(0);
  if (c < 128) return c >= 65 && c <= 90 ? String.fromCharCode(c + 32) : ch;
  let f = cache.get(ch);
  if (f === undefined) {
    f = ch.normalize('NFD').replace(MARKS, '').toLowerCase();
    if (cache.size < 5000) cache.set(ch, f);
  }
  return f;
}

export const isSpace = (ch) => WS.test(ch);

/** Fold a query string: fold each char, collapse whitespace runs, trim. */
export function foldQuery(s) {
  let out = '';
  let pendingSpace = false;
  for (const ch of s) {
    if (isSpace(ch)) { pendingSpace = true; continue; }
    if (pendingSpace && out) out += ' ';
    pendingSpace = false;
    out += foldChar(ch);
  }
  return out;
}

/** Split folded text into words (letters and digits). */
export function words(s) {
  return foldQuery(s == null ? '' : String(s)).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}
