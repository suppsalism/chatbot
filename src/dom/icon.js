const SVG_NS = 'http://www.w3.org/2000/svg';

/** Builds a single-path SVG icon via createElementNS — no innerHTML. */
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
