export default function signature_component() {
  const wrapper = document.createElement('div');
  wrapper.className = 'signature-wrapper';

  wrapper.innerHTML = `
      <a class="signature" href="https://suppsalism.com">Powered by suppsalism</a>
    `;

  return wrapper;
}
