import { createStyleTag } from './style-tag';
import { CLASS } from '../constants/class-names';
import { iframeId } from '../constants/dom';
import widgetCss from '../styles/widget.css';

function createMeta(doc, attrs) {
  const meta = doc.createElement('meta');
  Object.entries(attrs).forEach(([key, value]) => meta.setAttribute(key, value));
  return meta;
}

function themeClass(theme) {
  return theme === 'dark' ? CLASS.themeDark : CLASS.themeLight;
}

/**
 * Creates the iframe and prepares its document (spec §10.2 step 4). A
 * same-origin iframe's initial document exists synchronously once attached
 * to the DOM — no network is involved, so nothing here can fail on a slow
 * connection.
 */
export function mountIframe({ shell, instanceId, config }) {
  const iframe = shell.doc.createElement('iframe');
  iframe.id = iframeId(instanceId);
  iframe.className = CLASS.iframe;
  iframe.setAttribute('title', 'Chat');
  shell.element.appendChild(iframe);

  const doc = iframe.contentWindow.document;

  doc.head.appendChild(createMeta(doc, { charset: 'utf-8' }));
  doc.head.appendChild(
    createMeta(doc, {
      name: 'viewport',
      content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0',
    })
  );

  const styleTag = createStyleTag(doc, widgetCss);
  doc.head.appendChild(styleTag);

  doc.body.className = themeClass(config.theme);
  doc.body.style.setProperty('--ss-brand', config.brandColor);

  return {
    doc,
    element: iframe,
    applyConfig(nextConfig) {
      doc.body.className = themeClass(nextConfig.theme);
      doc.body.style.setProperty('--ss-brand', nextConfig.brandColor);
    },
    destroy() {
      iframe.remove();
    },
  };
}
