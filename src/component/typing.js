export default function typing_component({ position, avatar, color = '#fff' }) {
  function hex_to_rgb(hex) {
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

  function calculate_brightness({ r, g, b }) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  function get_text_color_for_bg(hex_color) {
    const rgb = hex_color.startsWith('#')
      ? hex_to_rgb(hex_color)
      : hex_color.match(/\d+/g).map(Number);
    const brightness = calculate_brightness(rgb);

    return brightness > 128 ? '#000' : '#fff';
  }

  const typing = document.createElement('span');
  typing.className = 'typing';

  for (let i = 1; i <= 3; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    typing.appendChild(dot);
  }

  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${position}`;
  wrapper.style.setProperty('--bg-color', color);
  wrapper.style.setProperty('--txt-color', get_text_color_for_bg(color));

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
