const warnedMessages = new Set();

/** console.warn, prefixed and de-duplicated so a repeating condition does not spam the console. */
export function warn(message) {
  if (warnedMessages.has(message)) return;
  warnedMessages.add(message);
  console.warn(`[ss-chat] ${message}`);
}

export function isAttachedElement(value) {
  return (
    typeof Element !== 'undefined' &&
    value instanceof Element &&
    value.isConnected
  );
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Builds a single-path SVG icon via createElementNS — no innerHTML (guide §3.5). */
export function createIcon(doc, { path, size = 20 }) {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('height', String(size));
  svg.setAttribute('width', String(size));
  svg.setAttribute('fill', 'currentColor');

  const pathEl = doc.createElementNS(SVG_NS, 'path');
  pathEl.setAttribute('d', path);
  svg.appendChild(pathEl);

  return svg;
}

export function generateUuid() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  } else {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const random = (Math.random() * 16) | 0;
      const value = char === 'x' ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }
}

// Generic string -> typed value coercion, used to read config out of
// dataset (data-*) attributes, which are always plain strings.
export function parseTypedValue(rawValue, type) {
  switch (type) {
    case 'json':
      try {
        return JSON.parse(rawValue);
      } catch {
        return undefined;
      }
    case 'boolean':
      return rawValue === 'true';
    default:
      return rawValue;
  }
}

function hexToRgb(hex) {
  let r = 0,
    g = 0,
    b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  return { r, g, b };
}

function calculateBrightness({ r, g, b }) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Generic contrast check, used to pick readable text color for a given
// background color (hex or rgb() string).
export function getTextColorForBackground(backgroundColor) {
  const rgb = backgroundColor.startsWith('#')
    ? hexToRgb(backgroundColor)
    : backgroundColor.match(/\d+/g).map(Number);
  const brightness = calculateBrightness(rgb);

  return brightness > 128 ? '#000' : '#fff';
}

/** A trivial onSendMessage so demos, docs, and tests are not blocked by the requirement (spec §6.2). */
export function echoReply(message) {
  return `You said: "${message.text}"`;
}
