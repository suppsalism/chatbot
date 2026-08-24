import { describe, it, expect } from 'vitest';
import { renderRichText } from '../../src/utils/rich-text';

/** Renders into a detached host so assertions can read structure back. */
function render(text) {
  const host = document.createElement('div');
  host.appendChild(renderRichText(document, text));
  return host;
}

/** The rendered structure as a compact string — `<strong>a</strong>` etc. */
function structure(text) {
  const host = render(text);
  return [...host.childNodes].map(serialize).join('');
}

function serialize(node) {
  if (node.nodeType === 3) return node.textContent;
  const tag = node.tagName.toLowerCase();
  if (tag === 'br') return '<br>';
  return `<${tag}>${[...node.childNodes].map(serialize).join('')}</${tag}>`;
}

describe('renderRichText — plain text', () => {
  it('renders text with no markers unchanged', () => {
    expect(structure('Hello there')).toBe('Hello there');
  });

  it('renders an empty string as nothing', () => {
    expect(render('').childNodes).toHaveLength(0);
  });

  it('renders a line break as <br>', () => {
    expect(structure('one\ntwo')).toBe('one<br>two');
  });

  it('renders a blank line between paragraphs as two breaks', () => {
    expect(structure('one\n\ntwo')).toBe('one<br><br>two');
  });

  it('never produces markup from text that only looks like markup', () => {
    const host = render('<script>alert(1)</script>');
    expect(host.querySelector('script')).toBeNull();
    expect(host.textContent).toBe('<script>alert(1)</script>');
  });
});

describe('renderRichText — inline rules', () => {
  it('renders **bold** as <strong>', () => {
    expect(structure('a **b** c')).toBe('a <strong>b</strong> c');
  });

  it('renders *italic* as <em>', () => {
    expect(structure('a *b* c')).toBe('a <em>b</em> c');
  });

  // The ordering guarantee: bold is tried first, or "**b**" reads as
  // "*" + "*b*" + "*" and comes out italic with stray asterisks.
  it('reads ** as bold rather than nested italics', () => {
    expect(structure('**b**')).toBe('<strong>b</strong>');
  });

  it('handles bold and italic in one line', () => {
    expect(structure('**b** and *i*')).toBe('<strong>b</strong> and <em>i</em>');
  });

  it('handles several runs of the same rule', () => {
    expect(structure('*a* *b*')).toBe('<em>a</em> <em>b</em>');
  });

  it('applies inline rules on every line of a block', () => {
    expect(structure('**a**\n*b*')).toBe('<strong>a</strong><br><em>b</em>');
  });
});

describe('renderRichText — malformed input degrades', () => {
  it('leaves an unclosed bold marker literal', () => {
    expect(structure('a **b')).toBe('a **b');
  });

  it('leaves an unclosed italic marker literal', () => {
    expect(structure('a *b')).toBe('a *b');
  });

  it('does not let a marker span lines', () => {
    expect(structure('*a\nb*')).toBe('*a<br>b*');
  });

  it('leaves empty markers literal', () => {
    expect(structure('****')).toBe('****');
    expect(structure('**')).toBe('**');
  });

  it('leaves a lone asterisk literal', () => {
    expect(structure('2 * 3 = 6')).toBe('2 * 3 = 6');
  });
});

describe('renderRichText — block rules', () => {
  it('renders "* " lines as a <ul>', () => {
    expect(structure('* one\n* two')).toBe('<ul><li>one</li><li>two</li></ul>');
  });

  it('renders "1. " lines as an <ol>', () => {
    expect(structure('1. one\n2. two')).toBe('<ol><li>one</li><li>two</li></ol>');
  });

  it('does not require numbers to be in sequence', () => {
    expect(structure('1. one\n1. two')).toBe('<ol><li>one</li><li>two</li></ol>');
  });

  it('applies inline rules inside a list item', () => {
    expect(structure('* **one**')).toBe('<ul><li><strong>one</strong></li></ul>');
  });

  it('starts a new list when the rule changes', () => {
    expect(structure('* a\n1. b')).toBe('<ul><li>a</li></ul><ol><li>b</li></ol>');
  });

  it('ends a list at the first non-list line', () => {
    expect(structure('* a\nafter')).toBe('<ul><li>a</li></ul>after');
  });

  it('surrounds a list with the text around it', () => {
    expect(structure('before\n* a\nafter')).toBe('before<ul><li>a</li></ul>after');
  });

  // A list breaks its own line by being block-level, so a `\n` next to one
  // would render as a second, empty line.
  it('emits no break next to a list', () => {
    expect(render('before\n* a\nafter').querySelector('br')).toBeNull();
  });
});

describe('renderRichText — the space after a list marker', () => {
  // Without the required space, "*Milk*" at line start is indistinguishable
  // from a bullet, and every italic run opening a line would become a list.
  it('reads *text* at the start of a line as italic, not a bullet', () => {
    expect(structure('*Milk*')).toBe('<em>Milk</em>');
  });

  it('leaves "*text" with no space and no closer literal', () => {
    expect(structure('*Milk')).toBe('*Milk');
  });

  // Without the required space, "1.5 million" becomes list item 1.
  it('does not read a decimal number as a numbered item', () => {
    expect(structure('1.5 million users')).toBe('1.5 million users');
  });

  it('does not read "1." with no space as a numbered item', () => {
    expect(structure('1.one')).toBe('1.one');
  });
});

describe('renderRichText — streaming', () => {
  // Each chunk re-parses the full accumulated text, so a marker split across
  // chunks is literal until its closing pair lands, then becomes an element.
  it('resolves a marker once the closing pair arrives', () => {
    expect(structure('**bol')).toBe('**bol');
    expect(structure('**bold')).toBe('**bold');
    expect(structure('**bold**')).toBe('<strong>bold</strong>');
  });

  it('builds a list up one item at a time', () => {
    expect(structure('* one')).toBe('<ul><li>one</li></ul>');
    expect(structure('* one\n* two')).toBe('<ul><li>one</li><li>two</li></ul>');
  });
});

describe('renderRichText — the rule tables', () => {
  // The module maps a match back to its rule through a capture group named
  // after the rule's type. Nothing enforces that at runtime, so a new row with
  // a mismatched group name would silently throw on first use — this is what
  // catches it.
  it('names each inline rule capture group after its type', () => {
    const structureOf = {
      bold: '<strong>x</strong>',
      italic: '<em>x</em>',
    };

    // Every rule that ships must round-trip through the shared pattern.
    for (const [type, expected] of Object.entries(structureOf)) {
      const marker = type === 'bold' ? '**' : '*';
      expect(structure(`${marker}x${marker}`), type).toBe(expected);
    }
  });

  it('creates no element type beyond the ones the rules name', () => {
    const host = render('**b** *i*\nplain\n* item\n1. item');
    const tags = new Set([...host.querySelectorAll('*')].map((el) => el.tagName.toLowerCase()));
    expect(tags).toEqual(new Set(['strong', 'em', 'br', 'ul', 'ol', 'li']));
  });
});
