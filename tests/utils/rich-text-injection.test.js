import { describe, it, expect } from 'vitest';
import { renderRichText } from '../../src/utils/rich-text';

/**
 * Injection surface of the rich-text parser.
 *
 * Agent replies routinely come from a model or a backend, and the widget's
 * iframe is same-origin with no `sandbox` attribute — it isolates CSS, not
 * privilege. A renderer that produced markup here would be a host-page
 * execution channel, so these tests exist to keep it structurally impossible
 * rather than merely absent.
 *
 * The invariants: no HTML is ever parsed, no tag name comes from input, and no
 * attribute is ever set from input.
 */

function render(text) {
  const host = document.createElement('div');
  host.appendChild(renderRichText(document, text));
  return host;
}

const PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg/onload=alert(1)>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<a href="javascript:alert(1)">click</a>',
  '<body onload=alert(1)>',
  '<style>*{background:url(javascript:alert(1))}</style>',
  '"><script>alert(1)</script>',
  "'><img src=x onerror=alert(1)>",
  '<strong onclick="alert(1)">x</strong>',
  '<!--<script>alert(1)</script>-->',
  '<object data="javascript:alert(1)"></object>',
  'javascript:alert(1)',
  '&lt;script&gt;alert(1)&lt;/script&gt;',
  '&#60;script&#62;alert(1)&#60;/script&#62;',
];

describe('rich text — raw payloads', () => {
  it.each(PAYLOADS)('renders %j as literal text', (payload) => {
    const host = render(payload);

    expect(host.textContent).toBe(payload);
    expect(host.querySelector('script, img, svg, iframe, a, object, style')).toBeNull();
  });
});

describe('rich text — payloads smuggled inside a marker', () => {
  // The dangerous shape: a payload that reaches the parser through a rule's
  // capture group, so it is handled by build() rather than skipped as plain
  // text. Whatever comes out must still be text, not structure.
  const wrapped = [
    ['bold', '**<img src=x onerror=alert(1)>**', 'strong'],
    ['italic', '*<img src=x onerror=alert(1)>*', 'em'],
  ];

  it.each(wrapped)('escapes a payload inside %s', (_label, input, tag) => {
    const host = render(input);
    const element = host.querySelector(tag);

    expect(element).not.toBeNull();
    expect(element.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(element.querySelector('*')).toBeNull();
  });

  it('escapes a payload inside a list item', () => {
    const host = render('* <script>alert(1)</script>');
    const li = host.querySelector('li');

    expect(li.textContent).toBe('<script>alert(1)</script>');
    expect(li.querySelector('*')).toBeNull();
  });

  it('escapes a payload spread across list items', () => {
    const host = render('* <img\n* src=x\n* onerror=alert(1)>');

    expect(host.querySelectorAll('li')).toHaveLength(3);
    expect(host.querySelector('img')).toBeNull();
  });
});

describe('rich text — structural invariants', () => {
  const EVERY_RULE = '**b** *i*\nplain\n* <img src=x>\n1. <a href="javascript:alert(1)">x</a>';

  // The strongest guarantee available: nothing the parser builds carries an
  // attribute at all, so there is no slot for a payload to land in. A future
  // rule that sets one — a link's href, an image's src — breaks this test,
  // which is the point.
  it('sets no attribute on any element it creates', () => {
    const host = render(EVERY_RULE);

    for (const element of host.querySelectorAll('*')) {
      expect(element.attributes, element.tagName).toHaveLength(0);
    }
  });

  it('creates only the tags named in the rule tables', () => {
    const host = render(EVERY_RULE);
    const tags = [...host.querySelectorAll('*')].map((el) => el.tagName.toLowerCase());

    for (const tag of tags) {
      expect(['strong', 'em', 'br', 'ul', 'ol', 'li']).toContain(tag);
    }
  });

  it('attaches no event handler property', () => {
    const host = render('**x**\n* y');

    for (const element of host.querySelectorAll('*')) {
      expect(element.onclick).toBeNull();
      expect(element.onerror).toBeNull();
      expect(element.onload).toBeNull();
    }
  });
});

describe('rich text — pathological input', () => {
  // The inline patterns use a plain negated character class with no nested
  // quantifier, so they cannot backtrack catastrophically. This asserts the
  // property rather than the implementation: a rule added with a nested
  // quantifier would hang here instead of in production.
  it.each([
    ['asterisks', '*'.repeat(20000)],
    ['open markers', '**'.repeat(10000)],
    ['list markers', '* '.repeat(10000)],
    ['digits', '1'.repeat(20000)],
    ['long lines', 'a\n'.repeat(10000)],
  ])('parses %s without hanging', (_label, input) => {
    const started = Date.now();
    render(input);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('does not stack-overflow on deeply repeated markers', () => {
    expect(() => render('**a** '.repeat(5000))).not.toThrow();
  });
});
