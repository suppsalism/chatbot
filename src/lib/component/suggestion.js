export default function suggestion_component({ text, on_click = () => {} }) {
  const button = document.createElement('button');

  button.className = 'suggestion';
  button.textContent = text;
  button.onclick = on_click;

  return button;
}
