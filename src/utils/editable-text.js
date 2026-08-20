const BLOCK_TAGS = new Set(['DIV', 'P']);

function walk(node, lines) {
  if (node.nodeType === Node.TEXT_NODE) {
    lines.push(node.nodeValue);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  if (node.nodeName === 'BR') {
    lines.push('\n');
    return;
  }

  // A block boundary (what a browser wraps pasted multi-line content in) is a
  // line break too, but only *between* content — not before the first line.
  if (BLOCK_TAGS.has(node.nodeName) && lines.length > 0) lines.push('\n');

  for (const child of node.childNodes) walk(child, lines);
}

/**
 * Serializes a contenteditable element's content to plain text, turning <br>
 * and block-level line boundaries — what a browser inserts for Shift+Enter or
 * a multi-line paste — into literal "\n" characters.
 *
 * element.textContent can't do this: it walks text nodes only and is blind to
 * every element boundary, so a contenteditable's line breaks silently vanish
 * on read. element.innerText does track them, but jsdom (this project's test
 * environment) doesn't implement it at all, since it has no layout engine —
 * this stays pure DOM traversal so it behaves identically in a real browser
 * and under jsdom.
 *
 * @param {Element} element
 * @returns {string}
 */
export function readEditableText(element) {
  const lines = [];
  for (const child of element.childNodes) walk(child, lines);

  // An "empty" contenteditable often isn't literally empty — browsers
  // routinely leave a lone <br> (or <div><br></div>) placeholder behind once
  // every character has been deleted.
  if (lines.length === 1 && lines[0] === '\n') return '';

  return lines.join('');
}
