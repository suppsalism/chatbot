export default function thead_component({ avatar, name, on_close }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'thead-wrapper';

  wrapper.innerHTML = `
      <div class="thead-container">
          <div class="thead-content">
              <div class="left">
                  <img class="avatar" src="${avatar}" alt="Brand logo" />
                  <span class="name">${name}</span>
              </div>
              <div class="right">
                  <button>
                      <svg viewBox="0 0 24 24" height="20" width="20" fill="currentColor">
                          <path d="M19 6.41L17.59 5L12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                      </svg>
                  </button>
              </div>
          </div>
      </div>
    `;

  const close_button = wrapper.querySelector('button');
  close_button.addEventListener('click', on_close);

  return wrapper;
}
