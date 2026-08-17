function hexToRgb(hex) {
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

function calculateBrightness({ r, g, b }) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Generic contrast check, used to pick readable text color for a given
 * background color (hex or rgb() string).
 */
function rgbStringToRgb(value) {
  const [r = 0, g = 0, b = 0] = (value.match(/\d+/g) ?? []).map(Number);
  return { r, g, b };
}

export function getTextColorForBackground(backgroundColor) {
  const rgb = backgroundColor.startsWith('#')
    ? hexToRgb(backgroundColor)
    : rgbStringToRgb(backgroundColor);

  return calculateBrightness(rgb) > 128 ? '#000' : '#fff';
}
