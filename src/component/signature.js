export default function signature_component() {
  const wrapper = document.createElement('div');
  wrapper.className = 'signature-wrapper';

  wrapper.innerHTML = `
      <span>Powered by suppsalism</span>
    `;

  return wrapper;
}
