/** One injection path, used by both shell.js and iframe.js (guide Step 5). */
export function createStyleTag(doc, css, { nonce } = {}) {
  const style = doc.createElement('style');
  if (nonce) style.setAttribute('nonce', nonce);
  style.textContent = css; // not HTML parsing — the one exception to "no innerHTML" (guide §3.5)
  return style;
}
