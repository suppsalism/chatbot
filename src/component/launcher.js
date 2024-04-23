export default function launcher_component({
  avatar,
  color,
  position = 'right',
  on_toggle = () => {},
}) {
  const button = document.createElement('button');
  button.className = `launcher ${position}`;
  button.style.setProperty('--color', color);
  button.innerHTML = `<img src="${avatar}" alt="Brand logo" />`;

  button.addEventListener('click', on_toggle);

  return button;
}
