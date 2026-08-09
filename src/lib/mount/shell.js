import { createStyleTag } from './styles';
import { CLASS, shellId } from '../constants/dom';
import shellCss from '../../shell.css';

function orientationClass(orientation) {
  return orientation === 'left' ? CLASS.shellLeft : CLASS.shellRight;
}

/**
 * Host-page container + launcher slot. Everything created here is a
 * descendant of `mount`, which is what makes destroy() correct (spec §5.1).
 */
export function mountShell({ mount, instanceId, config }) {
  const doc = mount.ownerDocument;

  const styleTag = createStyleTag(doc, shellCss);
  doc.head.appendChild(styleTag);

  const container = doc.createElement('div');
  container.id = shellId(instanceId);
  container.className = `${CLASS.shellContainer} ${orientationClass(config.orientation)}`;
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', 'Chat widget');
  container.style.setProperty('--ss-brand', config.brandColor);

  mount.appendChild(container);

  return {
    doc,
    element: container,
    setVisible(visible) {
      container.classList.toggle(CLASS.shellVisible, visible);
    },
    applyConfig(nextConfig) {
      container.classList.remove(CLASS.shellLeft, CLASS.shellRight);
      container.classList.add(orientationClass(nextConfig.orientation));
      container.style.setProperty('--ss-brand', nextConfig.brandColor);
    },
    destroy() {
      container.remove();
      styleTag.remove();
    },
  };
}
