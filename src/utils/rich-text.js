/**
 * Turns an agent's reply text into rich DOM content.
 *
 * Everything here is built with createElement/textContent and handed back as a
 * DocumentFragment — no HTML string is ever produced, so there is nothing for
 * a parser to interpret. That is the point: replies come from a backend or a
 * model, and the widget's iframe is same-origin, so a markup-producing renderer
 * would be a host-page injection channel. The only elements this module can
 * ever create are the ones named in the rule tables below.
 *
 * Adding a transformation means adding one row to INLINE_RULES or BLOCK_RULES.
 * Nothing else in this file, and nothing outside it, needs to change.
 *
 * One rule for whoever adds the next row: **a `build` may set textContent, and
 * nothing else.** What makes this module safe is not that it escapes input, but
 * that input only ever reaches a text node — there is no attribute for a
 * payload to land in. The first rule that sets one reopens the hole. A link
 * rule is the obvious candidate, and `href` accepts `javascript:`, so it needs
 * a scheme allowlist before it ships. `rich-text-injection.test.js` asserts
 * that nothing built here carries an attribute at all, and will fail on a rule
 * that breaks this.
 */

/** Builds a leaf element holding nothing but text. */
function textElement(doc, tag, text) {
  const element = doc.createElement(tag);
  element.textContent = text;
  return element;
}

/**
 * Inline rules — matched anywhere inside a line, including inside a list item.
 *
 * Order is precedence: the alternatives are tried left to right, so bold must
 * come before italic or `**text**` is read as `*` + `*text*` + `*`.
 *
 * Each rule's `source` must declare exactly one named capture group, named
 * after the rule's `type` — that is how a match is traced back to the rule
 * that produced it, and `rich-text.test.js` asserts it for every row. A `type`
 * therefore has to be a valid JS identifier.
 *
 * Patterns exclude newlines so a run can never span lines: an unclosed `*`
 * stays literal instead of swallowing the rest of the message.
 */
const INLINE_RULES = [
  {
    type: 'bold',
    source: String.raw`\*\*(?<bold>[^*\n]+)\*\*`,
    build: (doc, text) => textElement(doc, 'strong', text),
  },
  {
    type: 'italic',
    source: String.raw`\*(?<italic>[^*\n]+)\*`,
    build: (doc, text) => textElement(doc, 'em', text),
  },
];

/**
 * Block rules — matched against a whole line, in order. Consecutive lines
 * matched by the same rule become one list; anything else ends it.
 *
 * The trailing space in each pattern is load-bearing, not decoration. `* ` is
 * what separates a bullet from an italic run opening at the start of a line,
 * and `1. ` is what stops "1.5 million" becoming a numbered item.
 */
const BLOCK_RULES = [
  { type: 'bullet', pattern: /^\* (.+)$/, tag: 'ul' },
  { type: 'numbered', pattern: /^\d+\. (.+)$/, tag: 'ol' },
];

/**
 * The separator rule — `\n`. It is the one rule that applies *between* lines
 * rather than within one, which is why it is a single rule rather than a table
 * row: there is only one way to separate two lines.
 *
 * It builds a real `<br>` rather than emitting a `\n` text node and leaving the
 * break to the bubble's `pre-wrap`. Two reasons. The rendered output then says
 * what it means without depending on a stylesheet to finish the job — and a
 * `\n` next to a list would render twice, once as the literal newline and once
 * from the list being block-level.
 */
const LINE_BREAK_RULE = {
  type: 'break',
  build: (doc) => doc.createElement('br'),
};

const INLINE_PATTERN = new RegExp(INLINE_RULES.map((rule) => rule.source).join('|'), 'g');

/** The rule a given inline match came from, identified by which group matched. */
function ruleFor(match) {
  return INLINE_RULES.find((rule) => match.groups[rule.type] !== undefined);
}

/** The block rule a line matches, plus the line's content minus its marker. */
function matchBlock(line) {
  for (const rule of BLOCK_RULES) {
    const match = rule.pattern.exec(line);
    if (match) return { rule, text: match[1] };
  }
  return null;
}

/** Appends one line to `parent`, expanding every inline match into its element. */
function appendInline(doc, parent, line) {
  INLINE_PATTERN.lastIndex = 0;
  let cursor = 0;
  let match;

  while ((match = INLINE_PATTERN.exec(line))) {
    if (match.index > cursor) {
      parent.appendChild(doc.createTextNode(line.slice(cursor, match.index)));
    }

    const rule = ruleFor(match);
    parent.appendChild(rule.build(doc, match.groups[rule.type]));

    cursor = match.index + match[0].length;
  }

  if (cursor < line.length) {
    parent.appendChild(doc.createTextNode(line.slice(cursor)));
  }
}

/**
 * Groups lines into blocks: runs of consecutive plain lines, and runs of
 * consecutive list lines sharing a rule.
 *
 * Grouping first is what keeps the spacing right. A list already breaks the
 * line by being block-level, so a separator next to one would render a second,
 * empty line — which is why breaks exist only *within* a plain-text block,
 * never between blocks.
 */
function toBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const block = matchBlock(lines[index]);

    if (!block) {
      const plain = [];
      while (index < lines.length && !matchBlock(lines[index])) {
        plain.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: 'plain', lines: plain });
      continue;
    }

    const items = [];
    while (index < lines.length) {
      const current = matchBlock(lines[index]);
      if (!current || current.rule.type !== block.rule.type) break;
      items.push(current.text);
      index += 1;
    }
    blocks.push({ type: 'list', tag: block.rule.tag, items });
  }

  return blocks;
}

/**
 * Renders reply text as rich content: `**bold**`, `*italic*`, `* ` bullet
 * lists, `1. ` numbered lists, and `\n` line breaks. Text carrying none of
 * those renders as exactly the words it contains.
 *
 * Malformed input degrades rather than throwing, the same rule config and form
 * specs follow: an unclosed marker is left as the literal characters the
 * author wrote.
 *
 * @param {Document} doc The document to create nodes in — the iframe's, not the host page's.
 * @param {string} text
 * @returns {DocumentFragment}
 */
export function renderRichText(doc, text) {
  const fragment = doc.createDocumentFragment();

  for (const block of toBlocks(text)) {
    if (block.type === 'list') {
      const list = doc.createElement(block.tag);
      for (const item of block.items) {
        const li = doc.createElement('li');
        appendInline(doc, li, item);
        list.appendChild(li);
      }
      fragment.appendChild(list);
      continue;
    }

    block.lines.forEach((line, position) => {
      if (position > 0) fragment.appendChild(LINE_BREAK_RULE.build(doc));
      appendInline(doc, fragment, line);
    });
  }

  return fragment;
}
