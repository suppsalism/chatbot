// jsdom implements no layout, so scrollIntoView is absent. MessageWrapper calls
// it on every DOM mutation; stub it on both the top document and any iframe
// document the widget creates.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

const { appendChild } = Node.prototype;
Node.prototype.appendChild = function patchedAppendChild(node) {
  const result = appendChild.call(this, node);
  const frameWindow = node?.tagName === 'IFRAME' ? node.contentWindow : null;
  if (frameWindow && !frameWindow.Element.prototype.scrollIntoView) {
    frameWindow.Element.prototype.scrollIntoView = function scrollIntoView() {};
  }
  return result;
};
