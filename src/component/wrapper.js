export default function wrapper_component({ type = 'overlay' }) {
  const wrapper = document.createElement('div');
  wrapper.className = `wrapper ${type}`;
  wrapper.innerHTML = `
      <div class="container">
          <div class="content"></div>
      </div>
    `;

  return wrapper;
}
