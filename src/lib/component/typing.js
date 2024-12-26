export default function typing_component({ position, avatar }) {
  const typing = document.createElement('span');
  typing.className = 'typing';

  for (let i = 1; i <= 3; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    typing.appendChild(dot);
  }

  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${position}`;

  const container = document.createElement('div');
  container.className = 'message-container';
  wrapper.appendChild(container);

  const group_message = document.createElement('div');
  group_message.className = 'group-message';

  if (avatar) {
    const div = document.createElement('div');
    div.className = 'avatar-wrapper';

    const img = document.createElement('img');
    img.className = 'avatar';
    img.src = avatar;
    img.alt = 'Brand logo';
    div.appendChild(img);

    group_message.appendChild(div);
  }

  const message_span = document.createElement('span');
  message_span.className = `message ${position}`;
  group_message.appendChild(message_span);

  message_span.appendChild(typing);

  container.appendChild(group_message);

  return wrapper;
}
